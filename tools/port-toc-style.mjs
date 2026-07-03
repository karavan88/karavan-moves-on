/* Приводит стиль оглавления L9/L10 к L1/L2: левый выдвижной ящик, 1 колонка,
   тот же .toc-item. Меняются ТОЛЬКО CSS-правила (структура пунктов в JS одинакова).
   Акцент — родной для деки (--gold вместо --violet).
   Запуск: node tools/port-toc-style.mjs <deck.html> [<deck2.html> ...] */
import { readFile, writeFile } from 'node:fs/promises';

const RULES = {
  '.toc-panel': '.toc-panel{position:fixed;inset:0;z-index:60;background:rgba(7,13,24,.82);display:none;opacity:0;transition:opacity .2s}',
  '.toc-panel.open': '.toc-panel.open{display:block;opacity:1}',
  '.toc-inner': '.toc-inner{position:absolute;left:0;top:0;bottom:0;width:min(440px,86vw);background:var(--ink-2);border-right:2px solid var(--gold);padding:30px 26px;overflow:auto;box-shadow:0 0 60px rgba(0,0,0,.6)}',
  '.toc-head': '.toc-head{display:flex;align-items:baseline;justify-content:space-between;gap:16px;border-bottom:1px solid var(--line);padding-bottom:16px;margin-bottom:12px}',
  '.toc-title': '.toc-title{font-family:var(--display);font-weight:700;font-size:22px;color:var(--bone)}',
  '.toc-back': '.toc-back{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold-soft);text-decoration:none}',
  '.toc-list': '.toc-list{display:flex;flex-direction:column}',
  '.toc-item': '.toc-item{display:flex;align-items:baseline;gap:14px;width:100%;text-align:left;background:none;border:none;border-bottom:1px solid var(--line);padding:13px 4px;font-family:var(--serif);font-size:16px;color:var(--bone);cursor:pointer;transition:.14s}',
  '.toc-item:hover': '.toc-item:hover{color:var(--gold-soft);padding-left:10px}',
  '.toc-item.cur': '.toc-item.cur{color:var(--gold-soft)}',
  '.toc-item .tnum': '.toc-item .tnum{font-family:var(--mono);font-size:12px;color:var(--gold);min-width:24px}',
};
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

for(const file of process.argv.slice(2)){
  let h = await readFile(file, 'utf8');
  let done = 0, added = 0;
  for(const [sel, rule] of Object.entries(RULES)){
    // точное правило: селектор + {...} без вложенных фигурных
    const re = new RegExp(esc(sel) + '\\{[^{}]*\\}');
    if(re.test(h)){ h = h.replace(re, rule); done++; }
    else { h = h.replace('\n</style>', rule + '\n</style>'); added++; } // если правила не было — добавим
  }
  await writeFile(file, h);
  console.log(`✓ ${file.split('/').pop()} — заменено ${done}, добавлено ${added}`);
}
