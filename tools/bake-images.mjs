/* ============================================================================
   bake-images.mjs — одноразовая «запечка» картинок TMDB в репозиторий.

   Зачем: сейчас постеры и кадры скачиваются с image.tmdb.org на каждом деплое
   Netlify (см. localize-images.mjs). Это работает, пока TMDB отвечает региону
   сборки. Запечка убирает зависимость: файлы кладутся в assets/img/ (попадают
   в git), а ссылки в ИСХОДНИКАХ переписываются на /assets/img/… навсегда.

   Запуск (локально, где image.tmdb.org доступен):
       npm run bake
   После запуска: проверить git diff, закоммитить assets/img и изменённые
   исходники. Сборка перестанет ходить в TMDB — localize-images просто не
   найдёт внешних ссылок.

   Скрипт идемпотентен: уже локальные ссылки не трогает, докачивает только
   недостающее (кэш .cache/img переиспользуется).
   ========================================================================== */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localizeImages, gatherTmdbUrls, applyMap } from './localize-images.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main(){
  /* те же источники, что видит build.mjs */
  const sourceData = [];
  for(const d of ['reviews','feed','festivals','collections']){
    const dir = path.join(ROOT, d);
    if(existsSync(dir)) for(const f of await readdir(dir)) if(/\.(md|json)$/.test(f)) sourceData.push(path.join(d, f));
  }
  sourceData.push('about.md', 'press.json', 'site.json');

  const urls = await gatherTmdbUrls(ROOT, sourceData);
  if(!urls.length){ console.log('Внешних TMDB-ссылок в исходниках нет — всё уже запечено.'); return; }
  console.log(`Найдено TMDB-ссылок: ${new Set(urls).size}. Скачиваю в assets/img/ …`);

  const map = await localizeImages(urls, {
    distImgDir: path.join(ROOT, 'assets', 'img'),
    cacheDir: path.join(ROOT, '.cache', 'img'),
    log: (m)=>console.log(m),
  });

  const stillExternal = [...map.entries()].filter(([u,l])=>u===l).length;
  if(stillExternal){
    console.log(`! ${stillExternal} картинок скачать не удалось — их ссылки в исходниках не трогаю.`);
  }

  let changed = 0;
  for(const rel of sourceData){
    const p = path.join(ROOT, rel);
    if(!existsSync(p)) continue;
    const before = await readFile(p, 'utf8');
    const after = applyMap(before, map);
    if(after !== before){ await writeFile(p, after); changed++; console.log('  переписан:', rel); }
  }
  console.log(`Готово: исходников переписано ${changed}. Проверь git diff и закоммить assets/img/.`);
}

main().catch(e=>{ console.error(e); process.exit(1); });
