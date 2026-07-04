/* Универсальный запекатель кадров для лекционных дек.
   Читает у каждого фрейма data-tmdb / data-year / data-idx и заполняет пустой
   <img> внутри бэкдропом с TMDB (как это делает клиентский loadTMDBStills, но на сборке).
   Запуск: node tools/bake-lecture-stills.mjs "путь/дека1.html" ["дека2.html" ...]
   Без аргументов — L9 и L10 психоанализа. */
import { loadToken } from './resolve-tmdb.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const token = await loadToken(path.resolve('.'));
const H = { Authorization:`Bearer ${token}` };

const decks = process.argv.slice(2);
if(!decks.length){
  const base = 'lectures/psychoanalytic film theory';
  decks.push(`${base}/lecture-09-bezumie.html`, `${base}/lecture-10-vzglyad-rebenka.html`);
}

async function findMovie(q, year){
  const u = new URL('https://api.themoviedb.org/3/search/movie');
  u.searchParams.set('query', q);
  if(year) u.searchParams.set('year', String(year));
  const r = await fetch(u, { headers:H }); const j = await r.json();
  const res = (j.results||[]);
  return res.find(m => (m.release_date||'').startsWith(String(year))) || res[0];
}
async function backdrops(id){
  const r = await fetch(`https://api.themoviedb.org/3/movie/${id}/images`, { headers:H });
  const j = await r.json();
  const b = (j.backdrops||[]).slice().sort((a,b)=>b.vote_average-a.vote_average);
  return b.length ? b : (j.stills||[]);
}

// фрейм с data-* сразу за которым идёт пустой <img …> (с onload или без; но без src)
const FRAME_RE = /(<div class="(?:shot|framebox)[^"]*" data-tmdb="([^"]*)" data-year="([^"]*)" data-idx="(\d+)">)(<img (?![^>]*\bsrc=)([^>]*)>)/g;

let totalFilled = 0, totalMiss = 0;
for(const deck of decks){
  if(!existsSync(deck)){ console.log('  ! нет файла:', deck); continue; }
  let html = await readFile(deck, 'utf8');
  const imgDir = path.join(path.dirname(deck), 'img');
  await mkdir(imgDir, { recursive:true });
  const cache = {};
  let filled = 0, miss = 0;

  // собрать список замен (regex не может быть async внутри replace)
  const jobs = [];
  html.replace(FRAME_RE, (m, open, tmdb, year, idx, imgTag, attrs)=>{
    const alt = (attrs.match(/alt="([^"]*)"/)||[])[1] || '';
    jobs.push({ m, open, tmdb, year, idx:+idx, imgTag, attrs, alt }); return m;
  });

  for(const job of jobs){
    const key = job.tmdb + job.year;
    if(!(key in cache)){
      const mv = await findMovie(job.tmdb, job.year);
      cache[key] = mv ? await backdrops(mv.id) : [];
      if(!mv) console.log('  ! фильм не найден:', job.tmdb, job.year);
    }
    const arr = cache[key];
    const pick = arr[job.idx] || arr[arr.length-1];
    if(!pick){ console.log('  ! нет кадра для:', job.alt, '('+job.tmdb+')'); miss++; continue; }
    const name = 'w1280_' + pick.file_path.replace(/^\//,'');
    const dest = path.join(imgDir, name);
    if(!existsSync(dest)){
      const r = await fetch(`https://image.tmdb.org/t/p/w1280${pick.file_path}`, { headers:{ 'User-Agent':'Mozilla/5.0' } });
      if(!r.ok){ console.log('  ! download', r.status, name); miss++; continue; }
      await writeFile(dest, Buffer.from(await r.arrayBuffer()));
    }
    // сохраняем существующие атрибуты (alt/loading/onload); onload добавляем, если его нет
    let attrs = job.attrs;
    if(!/\bonload=/.test(attrs)) attrs += ` onload="this.closest('.shot,.framebox').classList.add('has-image')"`;
    const filledImg = `<img src="img/${name}" ${attrs}>`;
    html = html.replace(job.open + job.imgTag, job.open + filledImg);
    filled++;
  }
  await writeFile(deck, html);
  totalFilled += filled; totalMiss += miss;
  console.log(`✓ ${path.basename(deck)} — заполнено ${filled}, пропущено ${miss}`);
}
console.log(`Готово: ${totalFilled} кадров, пропущено ${totalMiss}.`);
