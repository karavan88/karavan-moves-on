/* ============================================================================
   localize-images.mjs — скачивает картинки с image.tmdb.org и кладёт их рядом
   с сайтом, чтобы они грузились с собственного домена.

   Зачем: image.tmdb.org недоступен части аудитории (в т.ч. в России). Постеры,
   обложки и кадры из TMDB у таких посетителей не открываются. Решение — при сборке
   скачать их в /assets/img/ и переписать ссылки на локальные пути.

   Картинки складываются в dist/assets/img (на продакшене скачиваются заново при
   каждом деплое из региона Netlify, где TMDB доступен) и в локальный кэш .cache/img
   (чтобы повторные локальные сборки не качали заново). Кэш и dist — в .gitignore.
   ========================================================================== */
import { mkdir, writeFile, copyFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const TMDB_RE = /https?:\/\/image\.tmdb\.org\/t\/p\/[A-Za-z0-9_\/.-]+?\.(?:jpg|jpeg|png|webp)/gi;

export function collectTmdbUrls(text){
  return text.match(TMDB_RE) || [];
}

function localName(url){
  // .../t/p/w500/abc.jpg  →  w500_abc.jpg (размер в имени, чтобы w500 и w1280 не схлопнулись)
  const after = url.split('/t/p/')[1] || url;
  return after.replace(/[^A-Za-z0-9.]+/g, '_');
}

export function applyMap(text, map){
  let out = text;
  for(const [url, local] of map){ if(url !== local) out = out.split(url).join(local); }
  return out;
}

export async function localizeImages(urls, { distImgDir, cacheDir, log = ()=>{} }){
  await mkdir(distImgDir, { recursive: true });
  if(cacheDir) await mkdir(cacheDir, { recursive: true });
  const unique = [...new Set(urls)];
  const map = new Map();
  let ok = 0, fail = 0;
  const CONC = 8;
  for(let i=0; i<unique.length; i+=CONC){
    await Promise.all(unique.slice(i, i+CONC).map(async url=>{
      const name = localName(url);
      const dest = path.join(distImgDir, name);
      const cached = cacheDir ? path.join(cacheDir, name) : null;
      try{
        if(cached && existsSync(cached)){
          await copyFile(cached, dest);
        } else {
          const res = await fetch(url);
          if(!res.ok) throw new Error('HTTP '+res.status);
          const buf = Buffer.from(await res.arrayBuffer());
          await writeFile(dest, buf);
          if(cached) await writeFile(cached, buf);
        }
        map.set(url, '/assets/img/'+name);
        ok++;
      }catch(e){
        map.set(url, url);                 // фолбэк: оставить внешнюю ссылку
        fail++; log(`  ! не скачал ${url}: ${e.message}`);
      }
    }));
  }
  log(`  картинки TMDB: ${ok} локально${fail?`, ${fail} осталось внешними`:''}`);
  return map;
}

/* собрать все TMDB-URL из исходных файлов сайта */
export async function gatherTmdbUrls(root, files){
  const urls = [];
  for(const rel of files){
    const p = path.join(root, rel);
    if(!existsSync(p)) continue;
    urls.push(...collectTmdbUrls(await readFile(p, 'utf8')));
  }
  return urls;
}
