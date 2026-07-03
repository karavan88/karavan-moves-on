/* Разовый скрипт: портирует «кино-режим» переходов из свежей деки в мою (с картинками).
   Переносит: data-атрибуты фаз на секции (по индексу), CSS (keyframes + правила фаз),
   SVG .haunt-оверлей и 2 строки в apply(). Идемпотентен (проверяет маркер).
   Запуск: node tools/port-cine-transitions.mjs <src-fresh.html> <dest-repo.html> */
import { readFile, writeFile } from 'node:fs/promises';

const [src, dest] = process.argv.slice(2);
if(!src || !dest){ console.error('usage: node port-cine-transitions.mjs <fresh> <repo>'); process.exit(1); }
const fresh = await readFile(src, 'utf8');
let repo = await readFile(dest, 'utf8');

if(repo.includes('data-phase="real"') || repo.includes('/* CINE-TRANSITIONS */')){
  console.log('уже портировано — пропускаю', dest); process.exit(0);
}

const KF = ['condL','condR','disDesc','disDream','disReal','driftD','fogIn','hauntIn','unveil','wakeIn'];

/* --- 1) секции по индексу: копируем открывающий тег из свежей (добавляет data-фазы) --- */
const secRe = /<section class="slide[^"]*"[^>]*>/g;
const freshTags = fresh.match(secRe) || [];
let idx = 0;
repo = repo.replace(secRe, () => freshTags[idx++] || arguments[0]);
console.log('секций переразмечено:', idx, '(свежих тегов:', freshTags.length + ')');

/* --- 2) CSS: @keyframes фаз + все правила с data-phase/unveil/cond/haunt/.haunt --- */
function grabKeyframes(css, name){
  const at = css.indexOf('@keyframes '+name);
  if(at<0) return '';
  let i = css.indexOf('{', at), depth=0, j=i;
  for(; j<css.length; j++){ if(css[j]==='{')depth++; else if(css[j]==='}'){depth--; if(depth===0){j++;break;}} }
  return css.slice(at, j);
}
const kfBlocks = KF.map(n=>grabKeyframes(fresh, n)).filter(Boolean);
// простые правила selector{...} (без вложенности), чей селектор или тело относится к переходам
const ruleRe = /([^{}]+)\{([^{}]*)\}/g; let m; const rules=[];
while((m = ruleRe.exec(fresh))){
  const sel=m[1], body=m[2];
  if(/data-phase|data-unveil|data-cond|data-haunt|\.haunt\b/.test(sel)) rules.push(m[0].trim());
}
const cssBlock = '\n/* CINE-TRANSITIONS: кино-режим фазовой драматургии (портировано) */\n'
  + kfBlocks.join('\n') + '\n' + rules.join('\n') + '\n';
repo = repo.replace(/\n<\/style>/, cssBlock + '</style>');
console.log('CSS: keyframes', kfBlocks.length, '+ правил', rules.length);

/* --- 3) SVG .haunt-оверлей: вставить после .vignette (глобальный оверлей) --- */
const hi = fresh.indexOf('<svg class="haunt"');
const haunt = hi>=0 ? fresh.slice(hi, fresh.indexOf('</svg>', hi)+6) : '';
if(haunt && !repo.includes('class="haunt"')){
  if(repo.includes('<div class="vignette"></div>'))
    repo = repo.replace('<div class="vignette"></div>', '<div class="vignette"></div>\n'+haunt);
  else repo = repo.replace('<body>', '<body>\n'+haunt);
  console.log('SVG .haunt вставлен');
}

/* --- 4) JS: 2 строки в apply() после actEls.forEach(...) --- */
const anchor = "actEls.forEach(a=>a.classList.toggle('cur',a.dataset.a===act));";
const inject = anchor + "\n  document.body.dataset.phase=slides[i].dataset.phase||'real';\n  document.body.dataset.haunt=slides[i].hasAttribute('data-haunt')?'1':'0';";
if(repo.includes(anchor) && !repo.includes("document.body.dataset.phase")){
  repo = repo.replace(anchor, inject);
  console.log('JS: строки фаз добавлены в apply()');
}

await writeFile(dest, repo);
console.log('✓ портировано →', dest);
