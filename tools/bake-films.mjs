/* ============================================================================
   bake-films.mjs — «запекает» данные о фильмах с TMDB в films-meta.json.

   Указатель фильмов (/films) и хабы (/film/<slug>) берут постер, год, режиссёра,
   страну, хронометраж и описание из этого файла. Netlify собирает БЕЗ токена,
   поэтому данные должны лежать в коммите — этот скрипт их и готовит.

   Запуск (локально, нужен TMDB-токен в .env → TMDB_TOKEN):
       npm run bake-films
   Идемпотентен: уже заполненные фильмы пропускает, дозаполняет новые.
   После — закоммить films-meta.json и запушить.
   ========================================================================== */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadToken } from './resolve-tmdb.mjs';
import { filmLectureMapAll } from './courses-data.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const IMG = 'https://image.tmdb.org/t/p/w500';
const BACK = 'https://image.tmdb.org/t/p/w1280';
const rd  = async p => { try { return JSON.parse(await readFile(path.join(ROOT, p), 'utf8')); } catch { return []; } };
const rdt = async p => { try { return await readFile(path.join(ROOT, p), 'utf8'); } catch { return ''; } };

async function tmdb(pathname, params, token){
  const url = 'https://api.themoviedb.org/3' + pathname + '?' + new URLSearchParams(params);
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if(!r.ok) throw new Error(r.status + ' ' + pathname);
  return r.json();
}

async function main(){
  const token = await loadToken(ROOT);
  if(!token){ console.log('Нет TMDB-токена (.env → TMDB_TOKEN). Пропускаю: данные фильмов останутся как есть.'); return; }

  /* собрать имена фильмов + подсказки для поиска (оригинал/год дают точный матч) */
  const hints = new Map();  // имя (без «ёлочек») → {query, year}
  const add = (nameG, query, year)=>{
    const k = (nameG||'').replace(/[«»]/g,'').trim();
    if(!k) return;
    if(!hints.has(k)) hints.set(k, { query: (query||k).trim(), year: year||undefined });
  };

  /* Ручные подсказки: фильмы, которые не находятся по русскому названию —
     задаём оригинальное название + год для точного матча на TMDB.
     Добавляются первыми, поэтому имеют приоритет. */
  add('Целуй меня насмерть',   'Kiss Me Deadly', 1955);
  add('Тайны одной души',      'Geheimnisse einer Seele', 1926);
  add('Вестсайдская история',  'West Side Story', 1961);   // оригинал Уайза/Роббинса, не ремейк Спилберга

  for(const r of await rd('reviews/manifest.json')){
    if(r.draft) continue;
    const orig = (r.original||'').split('/')[0].trim();
    add(r.film||r.title, orig || (r.film||r.title||'').replace(/[«»]/g,''), r.year);
  }
  for(const p of await rd('press.json')) if(p.film) add(p.film, p.film.replace(/[«»]/g,''));
  for(const c of await rd('collections/manifest.json')){
    if(c.draft) continue;
    const t = await rdt(`collections/${c.slug}.md`);
    for(const m of t.matchAll(/<h3>\s*«([^»]+)»/g)) add('«'+m[1]+'»', m[1]);
  }
  for(const name of filmLectureMapAll().keys()) add('«'+name+'»', name);

  let meta = {};
  if(existsSync(path.join(ROOT,'films-meta.json'))) meta = JSON.parse(await rdt('films-meta.json'));

  const save = () => writeFile(path.join(ROOT,'films-meta.json'), JSON.stringify(meta, null, 2));
  const total = hints.size;
  console.log(`Ищу на TMDB ${total} фильмов… (файл films-meta.json дописывается по ходу)\n`);

  const SCHEMA = 5;                                     // v5: рабочая локализация имён через Wikidata (исправлен User-Agent)
  let ruRegion; try { ruRegion = new Intl.DisplayNames(['ru'], { type:'region' }); } catch { ruRegion = null; }
  const countryRu = c => { try { return (ruRegion && ruRegion.of(c.iso_3166_1)) || c.name; } catch { return c.name; } };
  /* постер на языке оригинала: приоритет — язык фильма, затем без языка, затем английский */
  const pickPoster = (images, orig, fallback) => {
    const ps = (images && images.posters) || [];
    const by = lang => ps.find(p => p.iso_639_1 === lang);
    const hit = by(orig) || by(null) || by('en') || ps[0];
    return hit ? IMG + hit.file_path : (fallback ? IMG + fallback : '');
  };

  /* --- имена по-русски: ручной словарь (приоритет) + также-известен-как из TMDB --- */
  const NAME_MAP = {
    '大島渚':'Нагиса Осима', '楊德昌':'Эдвард Ян', '김대우':'Ким Тэ-у', '나홍진':'На Хон-джин',
  };
  const isCyr = s => /[А-Яа-яЁё]/.test(s);
  const nameCache = new Map();          // id → русское имя
  const leftover  = new Set();          // кому русского не нашлось
  let wdHits = 0;                        // сколько имён локализовано через Wikidata
  /* Wikidata: TMDB-персона → wikidata_id → русская подпись (без ключа, но нужен User-Agent) */
  const wikidataRu = async (personId) => {
    try{
      const ext = await tmdb('/person/'+personId+'/external_ids', {}, token);
      const qid = ext && ext.wikidata_id;
      if(!qid) return '';
      const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=labels&languages=ru&format=json`;
      // Wikimedia требует User-Agent с контактами, иначе отдаёт 403 (из-за этого локализация раньше молча не работала)
      const r = await fetch(url, { headers: { 'User-Agent': 'karavan-cinema/1.0 (https://karavancinema.netlify.app; karen.avanesyan@gmail.com)' } });
      if(!r.ok) return '';
      const j = await r.json();
      let v = (((j.entities||{})[qid]||{}).labels||{}).ru;
      v = v && v.value || '';
      if(v && /^[^,]+,\s*[^,]+$/.test(v)){ const [a,b] = v.split(','); v = b.trim()+' '+a.trim(); }  // «Фамилия, Имя» → «Имя Фамилия»
      return v;
    }catch{ return ''; }
  };
  const ruName = async (person) => {
    const nm = ((person && person.name) || '').trim();
    if(!nm) return nm;
    if(NAME_MAP[nm]) return NAME_MAP[nm];
    if(isCyr(nm)) return nm;
    if(person.id!=null && nameCache.has(person.id)) return nameCache.get(person.id);
    let out = nm;
    try{
      const per = await tmdb('/person/'+person.id, { language:'ru-RU' }, token);
      const cyr = (per.also_known_as||[]).map(s=>s.trim()).find(isCyr);
      if(cyr) out = cyr;
    }catch{}
    if(!isCyr(out) && person.id!=null){                 // TMDB не дал кириллицу → пробуем Wikidata
      const wd = await wikidataRu(person.id);
      if(wd && isCyr(wd)){ out = wd; wdHits++; }
    }
    if(!isCyr(out)) leftover.add(out);
    if(person.id!=null) nameCache.set(person.id, out);
    return out;
  };
  const ruNames = async (people) => { const r=[]; for(const p of people) r.push(await ruName(p)); return r; };

  let added=0, failed=0, skipped=0, i=0;
  for(const [name, h] of hints){
    i++;
    const tag = `[${String(i).padStart(3)}/${total}]`;
    if(meta[name] && meta[name].tmdb && meta[name].v === SCHEMA){ skipped++; continue; }
    try{
      const p = { query: h.query, language:'ru-RU' }; if(h.year) p.year = h.year;
      let res = (await tmdb('/search/movie', p, token)).results;
      if(!res || !res.length) res = (await tmdb('/search/movie', { query: h.query }, token)).results;
      if(!res || !res.length){ failed++; console.log(`${tag} × не найдено: ${name}`); continue; }
      const id = res[0].id;
      const [d, cr, im] = await Promise.all([
        tmdb('/movie/'+id, { language:'ru-RU' }, token),
        tmdb('/movie/'+id+'/credits', { language:'ru-RU' }, token),
        tmdb('/movie/'+id+'/images', {}, token),           // все языки — чтобы выбрать оригинальный постер
      ]);
      const directors = await ruNames((cr.crew||[]).filter(c=>c.job==='Director'));
      const cast = await ruNames((cr.cast||[]).slice().sort((a,b)=>(a.order??99)-(b.order??99)).slice(0,4));
      meta[name] = {
        v: SCHEMA,
        tmdb: id,
        original: (d.original_title && d.original_title !== d.title) ? d.original_title : '',  // оригинальное название
        poster:   pickPoster(im, d.original_language, d.poster_path),   // язык оригинала
        backdrop: d.backdrop_path ? BACK + d.backdrop_path : '',
        year:     (d.release_date||'').slice(0,4),
        director: directors.join(', '),
        cast:     cast,
        genres:   (d.genres||[]).map(g=>g.name).join(', '),             // жанры на русском
        country:  (d.production_countries||[]).map(countryRu).join(', '),
        overview: d.overview || '',
        runtime:  d.runtime || 0,
      };
      added++; console.log(`${tag} ✓ ${name} → TMDB ${id}`);
      if(added % 10 === 0) await save();   // промежуточное сохранение — виден прогресс
    }catch(e){ failed++; console.log(`${tag} × ${name} — ${e.message}`); }
  }
  await save();

  /* Добор недостающих полей у уже готовых записей без полного перезапекания.
     Сейчас — оригинальное название: один лёгкий запрос /movie на фильм, без имён и Wikidata. */
  let topped = 0;
  const needOrig = Object.keys(meta).filter(nm => meta[nm] && meta[nm].tmdb && !('original' in meta[nm]));
  if(needOrig.length){
    console.log(`\nДобираю оригинальные названия для ${needOrig.length} фильмов…`);
    for(const nm of needOrig){
      try{
        const d = await tmdb('/movie/'+meta[nm].tmdb, { language:'ru-RU' }, token);
        meta[nm].original = (d.original_title && d.original_title !== d.title) ? d.original_title : '';
        topped++;
        if(topped % 20 === 0) await save();
      }catch(e){ /* пропускаем сбойные */ }
    }
    await save();
    console.log(`Оригинальных названий дозаполнено: ${topped}.`);
  }

  console.log(`\nfilms-meta.json: +${added} новых, ${skipped} уже было, ${failed} не найдено. Всего ${Object.keys(meta).length}.`);
  console.log(`Имён локализовано через Wikidata: ${wdHits}.`);
  if(leftover.size){
    console.log(`\nБез русского написания осталось ${leftover.size} имён (TMDB не дал кириллический вариант):`);
    console.log('  ' + [...leftover].sort().join(', '));
    console.log('Пришли этот список — добавлю их в ручной словарь NAME_MAP.');
  }
  console.log('\nЗакоммить films-meta.json и запушить — данные подхватит сборка.');
}
main().catch(e=>{ console.error(e); process.exit(1); });
