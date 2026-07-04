/* Раскатывает «фото-ирис» на заставки кейсов психо-дек.
   Заставка кейса = секция .framefull, у которой fk НЕ начинается со «Сцена»
   (то есть «Кейс NN…», «Кода…», «Кода-кейс…»). Сцены (fk «Сцена…») не трогаем.
   Добавляет класс photo-iris на такие секции и, если нет, CSS-блок эффекта.
   Идемпотентно. Запуск: node tools/apply-photo-iris.mjs */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'lectures/psychoanalytic film theory';
const DECKS = [
  'lecture-01-bessoznatelnoe.html','lecture-02-snovidenie.html','lecture-04-zerkalo.html',
  'lecture-09-bezumie.html','lecture-10-vzglyad-rebenka.html','lecture-11-trevoga.html',
];

const CSS = `
/* ФОТО-ИРИС: заставки кейсов раскрываются расширяющимся ирисом (не склейка из черноты) */
.slide.photo-iris .shot img{opacity:1;clip-path:circle(0% at 50% 46%)}
.slide.photo-iris.active .shot img{animation:photoIris 2.9s 3s cubic-bezier(.34,.08,.24,1) both}
@keyframes photoIris{from{clip-path:circle(0% at 50% 46%)}to{clip-path:circle(80% at 50% 46%)}}
@media (prefers-reduced-motion: reduce){.slide.photo-iris .shot img{clip-path:none;animation:none}}
`;

for(const file of DECKS){
  const p = path.join(BASE, file);
  let html = await readFile(p, 'utf8');
  let tagged = 0;

  // секции не вложены → надёжный захват до первого </section>
  html = html.replace(/<section class="(slide[^"]*)"([^>]*)>([\s\S]*?)<\/section>/g, (m, cls, rest, body)=>{
    if(!/\bframefull\b/.test(cls)) return m;
    if(/\bphoto-iris\b/.test(cls)) return m; // уже помечена
    const fk = ((body.match(/<div class="fk"[^>]*>([\s\S]*?)<\/div>/)||[])[1]||'').replace(/<[^>]*>/g,'').trim();
    // заставка кейса: fk есть и НЕ начинается со «Сцена»
    if(!fk || /^Сцена/.test(fk)) return m;
    tagged++;
    return `<section class="${cls} photo-iris"${rest}>${body}</section>`;
  });

  // добавить CSS, если его ещё нет (L11 уже содержит канонический блок — не трогаем)
  let cssAdded = false;
  if(!/photoIris/.test(html)){
    html = html.replace(/\n<\/style>/, CSS + '</style>');
    cssAdded = true;
  }

  await writeFile(p, html);
  console.log(`✓ ${file} — помечено заставок: ${tagged}${cssAdded?' (+CSS)':' (CSS уже был)'}`);
}
console.log('Готово.');
