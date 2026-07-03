/* Разовый скрипт: заполняет пустые <img alt="…"> в психо-деках картинками с TMDB.
   Для каждого слота — фильм по названию+году, бэкдроп/постер, качаем в img/, ставим src.
   Запуск: node tools/fill-psy-images.mjs */
import { loadToken } from './resolve-tmdb.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const token = await loadToken(path.resolve('.'));
const H = { Authorization:`Bearer ${token}` };

async function findMovie(q, year){
  const u = new URL('https://api.themoviedb.org/3/search/movie');
  u.searchParams.set('query', q);
  const r = await fetch(u, { headers:H }); const j = await r.json();
  const res = (j.results||[]);
  return res.find(m => (m.release_date||'').startsWith(String(year))) || res[0];
}
async function images(id){
  const r = await fetch(`https://api.themoviedb.org/3/movie/${id}/images`, { headers:H });
  return await r.json();
}

const DECKS = {
  'lectures/psychoanalytic film theory/lecture-01-bessoznatelnoe.html': [
    ['Кадр Мельеса', 'Le Voyage dans la Lune', 1902, 'backdrop', 0],
    ['Кадр из «Кабинета доктора Калигари»', 'The Cabinet of Dr. Caligari', 1920, 'backdrop', 0],
    ['Декорация «Калигари»', 'The Cabinet of Dr. Caligari', 1920, 'backdrop', 1],
    ['Чезаре', 'The Cabinet of Dr. Caligari', 1920, 'backdrop', 2],
    ['Кадр из «Носферату»', 'Nosferatu', 1922, 'backdrop', 0],
    ['Орлок', 'Nosferatu', 1922, 'backdrop', 1],
    ['Тень Орлока', 'Nosferatu', 1922, 'backdrop', 2],
    ['Кадр из «Пражского студента»', 'The Student of Prague', 1913, 'backdrop', 0],
    ['Двойник выходит из зеркала', 'The Student of Prague', 1913, 'backdrop', 1],
    ['Кадр из «Тайн одной души»', 'Secrets of a Soul', 1926, 'backdrop', 0],
    ['«Тайны одной души»', 'Secrets of a Soul', 1926, 'poster', 0],
    ['Сон из «Тайн одной души»', 'Secrets of a Soul', 1926, 'backdrop', 1],
    ['Роршах, «Хранители»', 'Watchmen', 2009, 'backdrop', 0],
  ],
  'lectures/psychoanalytic film theory/lecture-02-snovidenie.html': [
    ['Кадр из «Андалузского пса»', 'Un Chien Andalou', 1929, 'backdrop', 0],
    ['«Андалузский пёс»', 'Un Chien Andalou', 1929, 'poster', 0],
    ['Луна и облако', 'Un Chien Andalou', 1929, 'backdrop', 1],
    ['Кадр из «Завороженного»', 'Spellbound', 1945, 'backdrop', 0],
    ['«Завороженный»', 'Spellbound', 1945, 'poster', 0],
    ['Сон Дали', 'Spellbound', 1945, 'backdrop', 1],
    ['Кадр из «Вампира»', 'Vampyr', 1932, 'backdrop', 0],
    ['«Вампир»', 'Vampyr', 1932, 'poster', 0],
    ['Взгляд из гроба', 'Vampyr', 1932, 'backdrop', 1],
    ['Кадр из «Малхолланд Драйв»', 'Mulholland Drive', 2001, 'backdrop', 0],
    ['«Малхолланд Драйв»', 'Mulholland Drive', 2001, 'poster', 0],
    ['Club Silencio', 'Mulholland Drive', 2001, 'backdrop', 1],
  ],
};

const W = { backdrop:'w1280', poster:'w500' };
const cache = {};
let filled = 0, missing = 0;

for(const [deck, plan] of Object.entries(DECKS)){
  let html = await readFile(deck, 'utf8');
  const imgDir = path.join(path.dirname(deck), 'img');
  await mkdir(imgDir, { recursive:true });
  for(const [alt, q, year, kind, slot] of plan){
    const key = q + year;
    if(!cache[key]){
      const m = await findMovie(q, year);
      if(!m){ cache[key] = { backdrops:[], posters:[] }; console.log('  ! фильм не найден:', q, year); }
      else {
        const im = await images(m.id);
        cache[key] = {
          backdrops:(im.backdrops||[]).sort((a,b)=>b.vote_average-a.vote_average),
          posters:(im.posters||[]).sort((a,b)=>b.vote_average-a.vote_average),
        };
      }
    }
    const c = cache[key];
    let pick = (kind==='poster'?c.posters:c.backdrops)[slot];
    let usedKind = kind;
    if(!pick) pick = (kind==='poster'?c.posters:c.backdrops)[0];
    if(!pick){ pick = (kind==='poster'?c.backdrops:c.posters)[0]; usedKind = kind==='poster'?'backdrop':'poster'; }
    if(!pick){ console.log('  ! нет картинки для:', alt, '('+q+')'); missing++; continue; }
    const w = W[usedKind];
    const name = w + '_' + pick.file_path.replace(/^\//,'');
    const dest = path.join(imgDir, name);
    if(!existsSync(dest)){
      const r = await fetch(`https://image.tmdb.org/t/p/${w}${pick.file_path}`, { headers:{ 'User-Agent':'Mozilla/5.0' } });
      if(!r.ok){ console.log('  ! download', r.status, name); missing++; continue; }
      await writeFile(dest, Buffer.from(await r.arrayBuffer()));
    }
    // onload обязателен: CSS дека держит img в opacity:0, пока контейнер не получит .has-image
    const needle = `<img alt="${alt}"`;
    if(html.includes(needle)){ html = html.split(needle).join(`<img src="img/${name}" onload="this.closest('.shot,.framebox').classList.add('has-image')" alt="${alt}"`); filled++; }
    else console.log('  ! alt не найден в HTML:', alt);
  }
  await writeFile(deck, html);
  console.log('✓', path.basename(deck));
}
console.log(`Готово: заполнено ${filled}, пропущено ${missing}`);
