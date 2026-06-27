/* ============================================================================
   build-lectures.mjs — встраивает самодостаточные слайд-деки лекций в сайт.

   Лекции лежат в /lectures/<предмет с пробелами>/lecture-NN-*.html и хранят
   ссылки на кадры/постеры прямо на image.tmdb.org. Этот модуль:
     • скачивает их картинки локально (image.tmdb.org недоступен части аудитории),
       переиспользуя тот же локализатор, что и основной build.mjs;
     • кладёт готовые («ready») лекции в dist/lectures/<slug>/<файл>;
     • генерирует лендинг dist/lectures/index.html с разделами-предметами.

   Не-готовые лекции и предметы без плана показываются на лендинге как
   «готовится» (без ссылки) — файлы в dist не попадают.
   ========================================================================== */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { collectTmdbUrls, localizeImages, applyMap } from './localize-images.mjs';

const WIKIMEDIA_RE = /https?:\/\/upload\.wikimedia\.org\/[^\s"'<>)]+?\.(?:jpg|jpeg|png|svg|webp)/gi;
const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const SUBJECTS = [
  {
    slug: 'marxist-film-theory',
    srcDir: 'marxist film theory',
    title: 'Марксистская теория кино',
    blurb: 'История одной интеллектуальной традиции: как кино связано с капитализмом, идеологией и властью. Одиннадцать лекций — от товара и идеологии до политической экономии кино.',
    lectures: [
      { n:'01', file:'lecture-01-vvedenie.html',           title:'Зачем марксизму кино',     sub:'Основания: товар и идеология',          ready:true  },
      { n:'02', file:'lecture-02-montazh.html',            title:'Монтаж и спор о форме',     sub:'Эйзенштейн · Вертов · Пудовкин',        ready:false },
      { n:'03', file:'lecture-03-kulturindustriya_1.html', title:'Культуриндустрия',          sub:'Адорно и Хоркхаймер',                   ready:false },
      { n:'04', file:'lecture-04-benyamin_1.html',         title:'Беньямин: аура',            sub:'Произведение в эпоху воспроизводимости',ready:false },
      { n:'05', file:'lecture-05-brecht_1.html',           title:'Брехт: очуждение',          sub:'Эпический метод на экране',             ready:false },
      { n:'06', file:'lecture-06-althusser_1.html',        title:'Альтюссер: интерпелляция',  sub:'Идеология и субъект',                   ready:false },
      { n:'07', file:'lecture-07-apparatus.html',          title:'Теория аппарата',           sub:'Журнал Screen и киноаппарат',           ready:false },
      { n:'08', file:'lecture-08-gramsci.html',            title:'Грамши и гегемония',        sub:'Солидарность против атомизации',        ready:false },
      { n:'09', file:'lecture-09-jameson.html',            title:'Джеймисон: постмодерн',     sub:'Поздний капитализм и культура',         ready:false },
      { n:'10', file:'lecture-10-capitalism.html',         title:'Капитализм сегодня',        sub:'Капстоун: тупик, конкуренция, разрыв',  ready:false },
      { n:'11', file:null,                                  title:'Политическая экономия кино',sub:'Индустрия, стриминг, внимание, ИИ',     ready:false },
    ],
  },
  { slug:'psychoanalysis', title:'Психоанализ и теория кино', blurb:'Взгляд, желание, фантазм: как психоанализ объясняет кино. План курса готовится.', lectures:[] },
  { slug:'sociology',      title:'Социология кино',           blurb:'Производство, аудитории и социальные институты кинематографа. План курса готовится.', lectures:[] },
];

function renderLanding(subjects){
  const card = (s)=>{
    const lectures = s.lectures||[];
    const items = lectures.map(l=>{
      const href = (l.ready && l.file) ? `/lectures/${s.slug}/${l.file}` : null;
      const tag = href ? '<span class="go">смотреть →</span>' : '<span class="soon">готовится</span>';
      const inner = `<span class="ln">${l.n}</span><span class="lt">${esc(l.title)}</span>${l.sub?`<span class="ls">${esc(l.sub)}</span>`:''}${tag}`;
      return href
        ? `<a class="lec ready" href="${href}">${inner}</a>`
        : `<div class="lec">${inner}</div>`;
    }).join('');
    const body = lectures.length
      ? `<div class="lecgrid">${items}</div>`
      : `<div class="empty">План курса готовится</div>`;
    return `<section class="subj" id="subj-${s.slug}">
      <div class="subj-head">
        <h2>${esc(s.title)}</h2>
        <p>${esc(s.blurb)}</p>
      </div>
      ${body}
    </section>`;
  };
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Лекции — авторские курсы Карена Аванесяна | Караван идёт</title>
<meta name="description" content="Авторские курсы Карена Аванесяна о кино: марксистская теория кино, психоанализ и теория кино, социология кино.">
<link rel="canonical" href="https://karavancinema.netlify.app/lectures/">
<meta property="og:title" content="Лекции — авторские курсы о кино">
<meta property="og:description" content="Марксистская теория кино и другие авторские курсы Карена Аванесяна.">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&family=PT+Serif:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@400;500;700&display=swap&subset=cyrillic,cyrillic-ext,latin" rel="stylesheet">
<style>
:root{
  --ink:#14110f;--ink-2:#1d1916;--oxblood:#3a1714;
  --bone:#ece6da;--bone-dim:#b7ad9d;--slate:#857c6e;
  --red:#d6342a;--red-deep:#a8261d;--ochre:#c9962b;
  --line:rgba(236,230,218,.14);--line-strong:rgba(236,230,218,.28);
  --display:'Oswald',system-ui,sans-serif;--serif:'PT Serif',Georgia,serif;--mono:'JetBrains Mono',ui-monospace,monospace;
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{background:var(--ink);color:var(--bone);font-family:var(--serif);-webkit-font-smoothing:antialiased;min-height:100vh}
.wrap{max-width:1080px;margin:0 auto;padding:40px 28px 80px}
a{color:inherit;text-decoration:none}
.back{font-family:var(--mono);font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--bone-dim);display:inline-block;margin-bottom:34px;transition:.18s}
.back:hover{color:var(--red)}
.masthead{border-bottom:2px solid var(--line-strong);padding-bottom:26px;margin-bottom:40px;position:relative}
.masthead::before{content:"";position:absolute;left:0;bottom:-2px;width:120px;height:2px;background:var(--red)}
.kick{font-family:var(--mono);font-size:12.5px;letter-spacing:.26em;text-transform:uppercase;color:var(--red);margin-bottom:14px}
h1{font-family:var(--display);font-weight:600;text-transform:uppercase;font-size:clamp(44px,8vw,104px);line-height:.92;letter-spacing:-.01em}
.sub{font-family:var(--display);font-weight:300;font-size:clamp(17px,2vw,24px);color:var(--bone-dim);margin-top:14px}
.subjnav{position:sticky;top:0;z-index:10;display:flex;flex-wrap:wrap;gap:8px;padding:14px 0 16px;margin-top:4px;background:linear-gradient(var(--ink) 72%,rgba(20,17,15,0))}
.subjnav a{font-family:var(--mono);font-size:11.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--bone-dim);border:1px solid var(--line-strong);padding:9px 14px;border-radius:2px;transition:.16s}
.subjnav a:hover{border-color:var(--red);color:var(--bone);background:var(--ink-2)}
.subj{margin-top:50px;scroll-margin-top:72px}
.subj-head h2{font-family:var(--display);font-weight:600;text-transform:uppercase;font-size:clamp(24px,3.4vw,42px);letter-spacing:-.005em;color:var(--bone)}
.subj-head h2::before{content:"";display:inline-block;width:26px;height:13px;background:var(--red);margin-right:14px;transform:skewX(-12deg)}
.subj-head p{max-width:74ch;margin:12px 0 22px;font-size:clamp(15px,1.4vw,17px);line-height:1.5;color:var(--bone-dim)}
.lecgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.lec{position:relative;display:grid;grid-template-columns:auto 1fr;column-gap:18px;row-gap:2px;align-items:baseline;border:1px solid var(--line-strong);background:var(--ink-2);padding:18px 22px;border-radius:2px}
.lec .ln{grid-row:span 3;font-family:var(--display);font-weight:700;font-size:34px;line-height:.8;color:var(--red)}
.lec .lt{font-family:var(--display);font-weight:600;text-transform:uppercase;font-size:18px;letter-spacing:.01em}
.lec .ls{font-size:13.5px;color:var(--bone-dim);line-height:1.4}
.lec .go{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--ochre);margin-top:8px}
.lec .soon{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--slate);margin-top:8px}
.lec.ready{transition:.18s;cursor:pointer}
.lec.ready::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--red);opacity:0;transition:.18s}
.lec.ready:hover{border-color:var(--red);background:#241f1b;transform:translateY(-2px)}
.lec.ready:hover::before{opacity:1}
.lec:not(.ready){opacity:.62}
.empty{font-family:var(--mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--slate);border:1px dashed var(--line-strong);padding:22px 24px;border-radius:2px}
footer{margin-top:64px;padding-top:22px;border-top:1px solid var(--line);font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--slate)}
@media (max-width:720px){.lecgrid{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="wrap">
  <a class="back" href="/">← Караван идёт</a>
  <header class="masthead">
    <div class="kick">Авторские курсы · Карен Аванесян</div>
    <h1>Лекции</h1>
    <div class="sub">Курсы о кино как способе понять капитализм, идеологию и общество.</div>
  </header>
  <nav class="subjnav" aria-label="Предметы">
    ${subjects.map(s=>`<a href="#subj-${s.slug}">${esc(s.title)}</a>`).join('\n    ')}
  </nav>
  ${subjects.map(card).join('\n')}
  <footer>Караван идёт · авторский сайт о кино Карена Аванесяна</footer>
</div>
</body>
</html>`;
}

export async function buildLectures({ ROOT, OUT, log = ()=>{} }){
  const LECT_SRC = path.join(ROOT, 'lectures');
  if(!existsSync(LECT_SRC)){ return; }

  // 1) собрать внешние картинки всех ГОТОВЫХ лекций и локализовать одним проходом
  const urls = [];
  const readyFiles = [];
  for(const s of SUBJECTS){
    if(!s.srcDir) continue;
    for(const l of (s.lectures||[])){
      if(!(l.ready && l.file)) continue;
      const p = path.join(LECT_SRC, s.srcDir, l.file);
      if(!existsSync(p)){ log(`  ! нет файла лекции: ${l.file}`); continue; }
      const html = await readFile(p, 'utf8');
      urls.push(...collectTmdbUrls(html), ...(html.match(WIKIMEDIA_RE) || []));
      readyFiles.push({ s, l, p });
    }
  }
  const IMG = await localizeImages(urls, {
    distImgDir: path.join(OUT, 'assets', 'img'),
    cacheDir: path.join(ROOT, '.cache', 'img'),
    log,
  });

  // 2) записать готовые лекции в dist с переписанными ссылками
  for(const { s, l, p } of readyFiles){
    const html = applyMap(await readFile(p, 'utf8'), IMG);
    const dest = path.join(OUT, 'lectures', s.slug, l.file);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, html);
  }

  // 3) лендинг
  await mkdir(path.join(OUT, 'lectures'), { recursive: true });
  await writeFile(path.join(OUT, 'lectures', 'index.html'), renderLanding(SUBJECTS));

  log(`  лекции: ${readyFiles.length} опубликовано, лендинг /lectures/`);
}
