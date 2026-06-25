/* ============================================================================
   resolve-tmdb.mjs — проставляет TMDB-id в front-matter рецензий.

   Для каждой рецензии без поля `tmdb:` ищет фильм на TMDB по оригинальному
   названию + году и дописывает `tmdb: <id>` в шапку .md. После этого ссылка на
   Letterboxd строится как letterboxd.com/tmdb/<id> — прямо на страницу фильма.

   Токен НИКОГДА не коммитится: берётся из переменной окружения
   TMDB_TOKEN (v4 read-token) или TMDB_API_KEY (v3), либо из .env (в .gitignore).

   Запуск вручную:   node tools/resolve-tmdb.mjs
   Автоматически:    вызывается из build.mjs, если токен доступен (иначе тихо пропускается).
   ========================================================================== */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

/* читает TMDB_TOKEN / TMDB_API_KEY из окружения или из .env рядом с проектом */
export async function loadToken(root){
  if(process.env.TMDB_TOKEN) return process.env.TMDB_TOKEN.trim();
  if(process.env.TMDB_API_KEY) return process.env.TMDB_API_KEY.trim();
  const envPath = path.join(root, '.env');
  if(existsSync(envPath)){
    const txt = await readFile(envPath,'utf8');
    const m = txt.match(/^\s*(?:TMDB_TOKEN|TMDB_API_KEY)\s*=\s*["']?([^"'\n]+)["']?\s*$/m);
    if(m) return m[1].trim();
  }
  return null;
}

function parseFront(text){
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if(!m) return null;
  const meta = {};
  m[1].split('\n').forEach(line=>{
    const i = line.indexOf(':'); if(i===-1) return;
    meta[line.slice(0,i).trim()] = line.slice(i+1).trim().replace(/^["']|["']$/g,'');
  });
  return { meta, block:m[0], inner:m[1] };
}

/* варианты запроса: куски original (до « / »), затем русское название без кавычек */
function queries(meta){
  const out = [];
  (meta.original||'').split('/').map(s=>s.trim()).filter(Boolean).forEach(s=>out.push(s));
  const ru = (meta.film||meta.title||'').replace(/[«»]/g,'').trim();
  if(ru) out.push(ru);
  return [...new Set(out)];
}

async function searchTmdb(query, year, token){
  const bearer = token.length > 40 || token.includes('.');
  const url = new URL('https://api.themoviedb.org/3/search/movie');
  url.searchParams.set('query', query);
  // НЕ фильтруем по году на сервере (ломается на старых/зарубежных тайтлах) —
  // берём все результаты и предпочитаем нужный год уже на клиенте.
  if(!bearer) url.searchParams.set('api_key', token);
  const res = await fetch(url, bearer ? { headers:{ Authorization:`Bearer ${token}` } } : {});
  if(!res.ok) throw new Error(`TMDB ${res.status} ${res.statusText}`);
  const results = (await res.json()).results || [];
  if(!results.length) return null;
  if(year){
    const exact = results.find(r => (r.release_date||'').slice(0,4) === String(year));
    if(exact) return exact;
  }
  return results[0];
}

export async function resolveMissing(root, token, { log = ()=>{} } = {}){
  const dir = path.join(root, 'reviews');
  const files = (await readdir(dir)).filter(f=>f.endsWith('.md'));
  let added = 0, failed = [];
  for(const f of files){
    const p = path.join(dir, f);
    const txt = await readFile(p, 'utf8');
    const fm = parseFront(txt);
    if(!fm || /^tmdb:/m.test(fm.inner)) continue; // уже есть id или нет шапки
    let hit = null;
    for(const q of queries(fm.meta)){
      try{ hit = await searchTmdb(q, fm.meta.year, token); }catch(e){ log(`  ! ${f}: ${e.message}`); }
      if(hit) break;
    }
    if(!hit){ failed.push(f); log(`  — ${f}: не найдено`); continue; }
    // вставляем строку `tmdb: <id>` перед закрывающим ---
    const newBlock = fm.block.replace(/\n---$/, `\ntmdb: ${hit.id}\n---`);
    await writeFile(p, txt.replace(fm.block, newBlock));
    added++;
    log(`  ✓ ${f} → tmdb ${hit.id} (${hit.title||hit.original_title}, ${(hit.release_date||'').slice(0,4)})`);
  }
  return { added, failed };
}

/* CLI */
if(import.meta.url === `file://${process.argv[1]}`){
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
  const token = await loadToken(root);
  if(!token){ console.error('Нет токена. Задай TMDB_TOKEN в .env или окружении.'); process.exit(1); }
  console.log('Резолвлю TMDB-id для рецензий…');
  const { added, failed } = await resolveMissing(root, token, { log:(m)=>console.log(m) });
  console.log(`Готово: добавлено ${added}, не найдено ${failed.length}${failed.length?': '+failed.join(', '):''}`);
}
