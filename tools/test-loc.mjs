/* Диагностика локализации имён: показывает каждый шаг цепочки для нескольких
   заведомо известных режиссёров. Запуск:  node tools/test-loc.mjs           */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadToken } from './resolve-tmdb.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const token = await loadToken(ROOT);
console.log('TMDB-токен:', token ? `есть (${token.length} символов)` : 'НЕТ — проверь .env');
console.log('Node:', process.version, '| глобальный fetch:', typeof fetch === 'function' ? 'да' : 'НЕТ');

const UA = 'karavan-cinema/1.0 (https://karavancinema.netlify.app; karen.avanesyan@gmail.com)';

async function tmdb(p, params = {}) {
  const u = 'https://api.themoviedb.org/3' + p + '?' + new URLSearchParams(params);
  const r = await fetch(u, { headers: { Authorization: 'Bearer ' + token } });
  console.log(`  TMDB ${p} → HTTP ${r.status}`);
  if (!r.ok) throw new Error('TMDB ' + r.status);
  return r.json();
}

async function wikidata(qid) {
  const u = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=labels&languages=ru&format=json`;
  let r;
  try { r = await fetch(u, { headers: { 'User-Agent': UA } }); }
  catch (e) { console.log('  Wikidata FETCH FAILED:', e.message); return ''; }
  console.log(`  Wikidata ${qid} → HTTP ${r.status}`);
  if (!r.ok) { console.log('    тело ответа:', (await r.text()).slice(0, 220)); return ''; }
  const j = await r.json();
  const ru = (((j.entities || {})[qid] || {}).labels || {}).ru;
  return (ru && ru.value) || '';
}

for (const [query, year] of [['Metropolis', 1927], ['Day for Night', 1973], ['Un chien andalou', 1929]]) {
  console.log(`\n=== ${query} (${year}) ===`);
  try {
    const res = (await tmdb('/search/movie', { query, year, language: 'ru-RU' })).results;
    if (!res || !res.length) { console.log('  фильм не найден'); continue; }
    const cr = await tmdb('/movie/' + res[0].id + '/credits', { language: 'ru-RU' });
    const dir = (cr.crew || []).find(c => c.job === 'Director');
    if (!dir) { console.log('  режиссёр не найден'); continue; }
    console.log(`  режиссёр по TMDB: «${dir.name}» (person id ${dir.id})`);
    const per = await tmdb('/person/' + dir.id, { language: 'ru-RU' });
    console.log('  also_known_as:', (per.also_known_as || []).join(' | ') || '(пусто)');
    const ext = await tmdb('/person/' + dir.id + '/external_ids');
    console.log('  wikidata_id:', ext.wikidata_id || '(нет)');
    if (ext.wikidata_id) console.log('  → русская подпись Wikidata:', (await wikidata(ext.wikidata_id)) || '(пусто)');
  } catch (e) { console.log('  ОШИБКА:', e.message); }
}
