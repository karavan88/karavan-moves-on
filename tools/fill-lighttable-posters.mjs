/* Разовый скрипт: вставляет постеры фильмов в «лайттейбл» слайда 2 психо-дек.
   Пустые .win w-xxx → <img> с постером (оригинальный язык фильма, правило проекта).
   Скоуп — только слайд 2 (data-toc="Введение"), чтобы не задеть .win в других слайдах.
   Запуск: node tools/fill-lighttable-posters.mjs */
import { loadToken } from './resolve-tmdb.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const token = await loadToken(path.resolve('.'));
const H = { Authorization:`Bearer ${token}` };
const ROOT = 'lectures/psychoanalytic film theory';

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
async function download(file_path, name, dir){
  const dest = path.join(dir, name);
  if(existsSync(dest)) return name;
  const r = await fetch(`https://image.tmdb.org/t/p/w500${file_path}`, { headers:{ 'User-Agent':'Mozilla/5.0' } });
  if(!r.ok){ console.log('  ! download', r.status, name); return null; }
  await writeFile(dest, Buffer.from(await r.arrayBuffer()));
  return name;
}

// deck → [winClass, russianName, query, year]
const PLAN = {
  'lecture-01-bessoznatelnoe.html': [
    ['w-prg','Пражский студент','The Student of Prague',1913],
    ['w-cal','Калигари','The Cabinet of Dr. Caligari',1920],
    ['w-nos','Носферату','Nosferatu',1922],
    ['w-sec','Тайны одной души','Secrets of a Soul',1926],
    ['w-md','Малхолланд Драйв','Mulholland Drive',2001],
    ['w-out','Прочь','Get Out',2017],
  ],
  'lecture-02-snovidenie.html': [
    ['w-chien','Андалузский пёс','Un Chien Andalou',1929],
    ['w-vampyr','Вампир','Vampyr',1932],
    ['w-oz','Волшебник страны Оз','The Wizard of Oz',1939],
    ['w-spell','Завороженный','Spellbound',1945],
    ['w-per','Персона','Persona',1966],
    ['w-md','Малхолланд Драйв','Mulholland Drive',2001],
  ],
  'lecture-09-bezumie.html': [
    ['w-cal','Кабинет доктора Калигари','The Cabinet of Dr. Caligari',1920],
    ['w-snk','Змеиная яма','The Snake Pit',1948],
    ['w-rep','Отвращение','Repulsion',1965],
    ['w-cuk','Пролетая над гнездом кукушки',"One Flew Over the Cuckoo's Nest",1975],
    ['w-pos','Одержимая','Possession',1981],
    ['w-mel','Меланхолия','Melancholia',2011],
  ],
  'lecture-10-vzglyad-rebenka.html': [
    ['w-kid','Малыш','The Kid',1921],
    ['w-hun','Ночь охотника','The Night of the Hunter',1955],
    ['w-bee','Дух улья','The Spirit of the Beehive',1973],
    ['w-crw','Выкорми ворона','Cría Cuervos',1976],
    ['w-cel','Селия','Celia',1989],
    ['w-tid','Страна приливов','Tideland',2005],
  ],
};

const imgDir = path.join(ROOT, 'img');
await mkdir(imgDir, { recursive:true });
const cache = {};

for(const [file, plan] of Object.entries(PLAN)){
  const full = path.join(ROOT, file);
  let html = await readFile(full, 'utf8');

  // вырезаем слайд 2 (первая секция с .lighttable), работаем только внутри него
  const ltStart = html.indexOf('<div class="lighttable">');
  const ltEnd = html.indexOf('</div>', html.lastIndexOf('<div class="fs">', ltStart>=0?html.indexOf('<div class="slide-foot"',ltStart):0));
  const sfIdx = html.indexOf('<div class="slide-foot"', ltStart);
  let block = html.slice(ltStart, sfIdx); // содержит все .fs со .win

  for(const [win, ruName, query, year] of plan){
    const key = query+year;
    if(!cache[key]){
      const m = await findMovie(query, year);
      if(!m){ console.log('  ! не найден:', query, year); cache[key]=null; }
      else {
        const im = await images(m.id);
        cache[key] = { posters:(im.posters||[]), lang:m.original_language };
      }
    }
    const c = cache[key];
    if(!c){ continue; }
    const posters = c.posters;
    // приоритет: постер на языке оригинала → textless (null) → самый рейтинговый
    const pick = posters.find(p=>p.iso_639_1===c.lang)
              || posters.find(p=>p.iso_639_1===null)
              || posters.slice().sort((a,b)=>b.vote_average-a.vote_average)[0];
    if(!pick){ console.log('  ! нет постера:', query); continue; }
    const name = 'poster_'+pick.file_path.replace(/^\//,'');
    const got = await download(pick.file_path, name, imgDir);
    if(!got) continue;
    const img = `<img src="img/${name}" alt="Постер «${ruName}»" loading="lazy" onload="this.closest('.win').classList.add('has-image')">`;
    const empty = `<div class="win ${win}"></div>`;
    if(block.includes(empty)){ block = block.replace(empty, `<div class="win ${win}">${img}</div>`); }
    else console.log('  ! пустой .win не найден в слайде 2:', win, 'в', file);
  }

  html = html.slice(0, ltStart) + block + html.slice(sfIdx);
  await writeFile(full, html);
  console.log('✓', file);
}
console.log('Готово.');
