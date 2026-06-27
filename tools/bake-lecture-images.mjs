/* ============================================================================
   bake-lecture-images.mjs — «запекает» внешние картинки слайд-дека локально.

   Лекции хранят кадры/постеры ссылками на image.tmdb.org (и портреты — на
   upload.wikimedia.org). Эти домены недоступны части аудитории (РФ), поэтому при
   открытии ИСХОДНОГО файла видны только плейсхолдеры. Скрипт скачивает все такие
   картинки в папку <папка-лекции>/img/ и переписывает ссылки на относительные
   img/<имя> — после этого дек самодостаточен и открывается где угодно без сети.

   Запуск: node tools/bake-lecture-images.mjs "lectures/<курс>/lecture-NN.html"
   Идемпотентно: уже относительные ссылки (img/...) пропускаются.
   ========================================================================== */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const IMG_RE = /https?:\/\/(?:image\.tmdb\.org\/t\/p\/[A-Za-z0-9_\/.-]+?|upload\.wikimedia\.org\/[^\s"'<>)]+?)\.(?:jpg|jpeg|png|webp|svg)/gi;

function nameFor(url){
  if(url.includes('image.tmdb.org')){
    return url.split('/t/p/')[1].replace(/[^A-Za-z0-9.]+/g, '_'); // wNNN_HASH.jpg
  }
  return decodeURIComponent(url.split('/').pop()).replace(/[^A-Za-z0-9.]+/g, '_');
}

async function fetchRetry(url, tries = 4){
  let last;
  for(let i = 0; i < tries; i++){
    try{
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (deck-baker)' } });
      if(res.ok) return Buffer.from(await res.arrayBuffer());
      last = new Error('HTTP ' + res.status);
    }catch(e){ last = e; }
    await new Promise(r => setTimeout(r, 1500 * (i + 1)));
  }
  throw last;
}

const deck = process.argv[2];
if(!deck){ console.error('usage: node tools/bake-lecture-images.mjs <deck.html>'); process.exit(1); }
const dir = path.dirname(deck);
const imgDir = path.join(dir, 'img');
await mkdir(imgDir, { recursive: true });

let html = await readFile(deck, 'utf8');
const urls = [...new Set(html.match(IMG_RE) || [])];
console.log(`найдено ${urls.length} внешних картинок в ${path.basename(deck)}`);

let ok = 0, skip = 0, fail = 0;
for(const url of urls){
  const name = nameFor(url);
  const dest = path.join(imgDir, name);
  try{
    if(!existsSync(dest)){
      const buf = await fetchRetry(url);
      await writeFile(dest, buf);
    } else skip++;
    html = html.split(url).join('img/' + name);
    ok++;
  }catch(e){ console.error(`  ! ${url}: ${e.message}`); fail++; }
}
await writeFile(deck, html);
console.log(`готово: ${ok} переписано (${skip} уже были), ошибок ${fail} → ${path.relative(process.cwd(), imgDir)}/`);
