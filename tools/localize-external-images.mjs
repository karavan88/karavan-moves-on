/* Локализует НЕ-TMDB внешние картинки (Wikimedia Commons, произвольные CDN) в файле:
   скачивает в assets/img/ и переписывает src на локальный путь. TMDB не трогает —
   их запекает сборка (localize-images.mjs).
   Запуск: node tools/localize-external-images.mjs <path-to-file> */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const file = process.argv[2];
if(!file){ console.error('usage: node tools/localize-external-images.mjs <file>'); process.exit(1); }
let html = await readFile(file, 'utf8');
const imgDir = 'assets/img';
await mkdir(imgDir, { recursive:true });

// внешние http(s) src, кроме image.tmdb.org
const urls = [...new Set([...html.matchAll(/src="(https?:\/\/[^"]+)"/g)].map(m=>m[1]))]
  .filter(u => !/image\.tmdb\.org/.test(u));

function slugFromUrl(u){
  // берём последний сегмент пути (для Wikimedia — имя файла после Special:FilePath/)
  let last = decodeURIComponent(u.split('?')[0].split('/').pop());
  const ext = (last.match(/\.(jpe?g|png|webp)$/i)||['.jpg'])[0].toLowerCase().replace('.jpeg','.jpg');
  last = last.replace(/\.(jpe?g|png|webp)$/i,'');
  const slug = last.toLowerCase()
    .replace(/[«»'"’]/g,'').replace(/[^a-z0-9а-яё]+/gi,'_')
    .replace(/_+/g,'_').replace(/^_|_$/g,'').slice(0,46);
  return 'art_' + slug + ext;
}

let done = 0;
for(const url of urls){
  const name = slugFromUrl(url);
  const dest = path.join(imgDir, name);
  if(!existsSync(dest)){
    try{
      // curl надёжнее fetch на медленных зеркалах: ретраи, редиректы, щедрый таймаут
      execFileSync('curl', ['-fsSL','--retry','3','--retry-delay','2','--connect-timeout','30','--max-time','90',
        '-A','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)','-o',dest,url], { stdio:['ignore','ignore','ignore'] });
    }catch(e){ console.log('  ! не скачал:', url.slice(0,70)); continue; }
    if(!existsSync(dest) || statSync(dest).size < 1000){ console.log('  ! пусто/мало:', url.slice(0,70)); continue; }
  }
  html = html.split(url).join('/assets/img/'+name);
  console.log('  ✓', name, '←', url.slice(0,64)+'…');
  done++;
}
await writeFile(file, html);
console.log(`Готово: локализовано ${done} из ${urls.length} внешних картинок.`);
