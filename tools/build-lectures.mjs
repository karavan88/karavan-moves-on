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
import { writeFile, mkdir, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

import { SUBJECTS } from './courses-data.mjs';

function renderLanding(subjects){
  const card = (s)=>{
    const lectures = s.lectures||[];
    const items = lectures.map(l=>{
      const href = (l.ready && l.file) ? `/lectures/${s.slug}/${l.file}` : null;
      const tag = href ? '<span class="go">смотреть →</span>' : '<span class="soon">готовится</span>';
      const inner = `<span class="ln">${l.n}</span><span class="lt">${esc(l.title)}</span>${l.sub?`<span class="ls">${esc(l.sub)}</span>`:''}${l.films?`<span class="lf"><b>Кейсы:</b> ${esc(l.films)}</span>`:''}${tag}`;
      return href
        ? `<a class="lec ready" href="${href}">${inner}</a>`
        : `<div class="lec">${inner}</div>`;
    }).join('');
    const body = lectures.length
      ? `<div class="lecgrid">${items}</div>`
      : `<div class="empty">План курса готовится</div>`;
    return `<section class="subj acc-${s.accent||'soc'}" id="subj-${s.slug}">
      <div class="subj-head">
        <div class="subj-kick">${esc(s.kicker||'Курс')}</div>
        <h2>${esc(s.title)}</h2>
        <p>${esc(s.blurb)}</p>
        ${s.programme?`<a class="prog" href="/lectures/${s.slug}/${s.programme}">Полная программа курса →</a>`:''}
      </div>
      ${body}
    </section>`;
  };
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script>try{if(localStorage.getItem('km-theme')==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}</script>
<title>Лекции — авторские курсы Карена Аванесяна | Караван идёт</title>
<meta name="description" content="Авторские курсы Карена Аванесяна о кино: марксистская теория кино, психоанализ и теория кино, социология кино.">
<link rel="canonical" href="https://karavancinema.netlify.app/lectures/">
<meta property="og:title" content="Лекции — авторские курсы о кино">
<meta property="og:description" content="Марксистская теория кино и другие авторские курсы Карена Аванесяна.">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&family=PT+Serif:ital,wght@0,400;0,700;1,400&family=Playfair+Display:wght@600;700;800&family=JetBrains+Mono:wght@400;500;700&family=Manrope:wght@400;500;700;800&display=swap&subset=cyrillic,cyrillic-ext,latin" rel="stylesheet">
<style>
:root{
  --bg:#080910;--card1:#1e2438;--card2:#141828;--border:#2c3247;
  --text:#ececf1;--muted:#9aa2b6;--muted-warm:#b3aa98;--sand:#cdbb95;
  --gold:#e8b84b;--accent:#e8b84b;--accent-2:#c8423a;--heading:#ffffff;--maxw:1180px;
  --mrx:#d6342a;--mrx-2:#c9962b;--vie:#c9a14a;--vie-2:#a23142;
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);font-family:'Manrope',system-ui,sans-serif;-webkit-font-smoothing:antialiased;min-height:100vh}
body::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background:
  radial-gradient(760px 480px at 86% 0%, rgba(232,184,75,.13), transparent 60%),
  radial-gradient(680px 460px at 4% 3%, rgba(200,66,58,.08), transparent 58%),
  radial-gradient(1100px 900px at 50% 42%, rgba(62,62,88,.16), transparent 72%),
  linear-gradient(180deg,#12121c 0%,#0b0b12 50%,#08080b 100%)}
a{color:inherit;text-decoration:none}
.wrap{max-width:1180px;margin:0 auto;padding:44px 24px 80px}
.masthead{border-bottom:1px solid rgba(232,184,75,.30);padding-bottom:26px;margin-bottom:10px;position:relative}
.masthead::after{content:"";position:absolute;left:0;bottom:-1px;width:120px;height:2px;background:var(--gold)}
.kick{font-size:11px;letter-spacing:.26em;text-transform:uppercase;color:var(--muted-warm);margin-bottom:14px}
h1{font-family:'Playfair Display',serif;font-weight:800;font-size:clamp(40px,7vw,84px);line-height:1;letter-spacing:-.01em;color:var(--heading)}
.sub{font-size:clamp(15px,1.6vw,18px);color:var(--muted);margin-top:12px;max-width:64ch}
.subjnav{position:sticky;top:0;z-index:10;display:flex;flex-wrap:wrap;gap:8px;padding:14px 0 16px;margin-top:6px;background:linear-gradient(var(--bg) 72%,rgba(8,9,16,0))}
.subjnav a{font-size:12px;letter-spacing:.05em;color:var(--muted);border:1px solid var(--border);padding:8px 15px;border-radius:20px;background:rgba(20,24,40,.45);transition:.16s}
.subjnav a:hover{border-color:rgba(232,184,75,.55);color:var(--text)}
.subj{margin-top:54px;scroll-margin-top:72px}
.subj-kick{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;margin-bottom:10px;color:var(--muted-warm)}
.subj-head h2{font-family:'Playfair Display',serif;font-weight:700;font-size:clamp(24px,3.2vw,38px);color:var(--heading);display:flex;align-items:center;gap:14px}
.subj-head h2::before{content:"";width:26px;height:13px;transform:skewX(-12deg);background:var(--gold);flex-shrink:0}
.subj-head p{max-width:74ch;margin:12px 0 22px;font-size:15px;line-height:1.6;color:var(--muted)}
.prog{display:inline-block;margin:0 0 20px;color:var(--gold);font-size:13px;letter-spacing:.02em;border-bottom:1px solid transparent;transition:border-color .2s}
.prog:hover{border-color:var(--gold)}
.lecgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.lec{position:relative;display:grid;grid-template-columns:auto 1fr;column-gap:18px;row-gap:2px;align-items:baseline;border:1px solid var(--border);background:linear-gradient(180deg,var(--card1),var(--card2));padding:18px 22px;border-radius:12px;box-shadow:0 12px 28px rgba(0,0,0,.35),inset 0 1px 0 rgba(160,185,245,.08)}
.lec .ln{grid-row:span 4;font-family:'Playfair Display',serif;font-weight:800;font-size:30px;line-height:.9;color:var(--gold)}
.lec .lt{font-weight:800;font-size:16px;letter-spacing:.01em;color:var(--heading)}
.lec .ls{font-size:13.5px;color:var(--muted);line-height:1.45}
.lec .lf{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;color:var(--muted);line-height:1.5;margin-top:8px}
.lec .lf b{color:var(--sand);font-weight:600;letter-spacing:.08em;text-transform:uppercase;font-size:9.5px;margin-right:5px}
.lec .go{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-top:8px}
.lec .soon{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:#6f7690;margin-top:8px}
.lec.ready{transition:.18s;cursor:pointer}
.lec.ready::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:12px 0 0 12px;background:var(--gold);opacity:0;transition:.18s}
.lec.ready:hover{border-color:rgba(232,184,75,.55);transform:translateY(-2px)}
.lec.ready:hover::before{opacity:1}
.lec:not(.ready){opacity:.6}
.empty{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:#6f7690;border:1px dashed var(--border);padding:22px 24px;border-radius:12px}
/* нить айдентики каждого курса */
.acc-mrx .subj-kick{color:var(--mrx)}
.acc-mrx .subj-head h2::before{background:var(--mrx)}
.acc-mrx .lec .ln{color:var(--mrx)}
.acc-mrx .lec .lf b{color:var(--mrx-2)}
.acc-mrx .lec .go{color:var(--mrx)}
.acc-mrx .lec.ready::before{background:var(--mrx)}
.acc-mrx .lec.ready:hover{border-color:rgba(214,52,42,.55)}
.acc-vie .subj-kick{color:var(--vie)}
.acc-vie .subj-head h2::before{background:repeating-linear-gradient(90deg,var(--vie) 0 6px,transparent 6px 12px);transform:none;height:6px;width:38px}
.acc-vie .lec .ln{color:var(--vie)}
.acc-vie .lec .lf b{color:var(--vie-2)}
.acc-vie .lec .go{color:var(--vie)}
.acc-vie .lec.ready::before{background:var(--vie)}
.acc-vie .lec.ready:hover{border-color:rgba(201,161,74,.6)}
.acc-soc .subj-head h2::before{background:var(--border)}
footer.site{position:relative;background:#0b0c10;border-top:1px solid transparent;color:#cdd3e2;font-size:13px;text-align:left;padding:38px 24px 26px;margin-top:70px;box-shadow:inset 0 1px 0 rgba(255,255,255,.05), 0 -12px 30px -12px rgba(0,0,0,.78)}
footer.site::after{content:"";position:absolute;left:0;right:0;bottom:100%;height:74px;pointer-events:none;background:radial-gradient(42% 130% at 0% 100%, rgba(232,184,75,.08), transparent 70%),radial-gradient(44% 130% at 100% 100%, rgba(232,184,75,.085), transparent 70%),radial-gradient(60% 120% at 50% 100%, rgba(232,184,75,.07), transparent 73%)}
footer.site a{color:var(--accent)}
.sfoot{max-width:var(--maxw);margin:0 auto;display:grid;grid-template-columns:1.5fr 1fr 1.1fr;gap:26px}
@media(max-width:860px){.sfoot{grid-template-columns:1fr 1fr}}
@media(max-width:520px){.sfoot{grid-template-columns:1fr}}
.sfoot-col h4{font-size:10.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--muted-warm);margin:0 0 12px;font-weight:700}
.sfoot-name{font-weight:800;font-size:13.5px;letter-spacing:.16em;color:var(--heading);margin-bottom:9px}
.sfoot-brand p{margin:0;font-size:13px;color:var(--muted);max-width:30ch;line-height:1.6}
.sfoot-links{columns:2;column-gap:20px}
.sfoot-col a{display:block;color:#dfe3ef;font-size:13px;margin:0 0 8px;break-inside:avoid;transition:color .2s}
.sfoot-col a:hover{color:var(--accent)}
.sfoot-bottom{max-width:var(--maxw);margin:26px auto 0;padding-top:16px;border-top:1px solid var(--border);font-size:12px;color:var(--muted)}
[data-theme="light"] footer.site{background:linear-gradient(180deg,#1c87c4,#166ea6);border-top-color:rgba(255,255,255,.2);color:rgba(255,255,255,.88)}
[data-theme="light"] footer.site a{color:#ffd75e}
[data-theme="light"] footer.site::after{display:none}
[data-theme="light"] .sfoot-col h4{color:rgba(255,255,255,.75)}
[data-theme="light"] .sfoot-col a{color:rgba(255,255,255,.92)}
[data-theme="light"] .sfoot-col a:hover{color:#ffd75e}
[data-theme="light"] .sfoot-brand p{color:rgba(255,255,255,.85)}
[data-theme="light"] .sfoot-name{color:#ffffff}
[data-theme="light"] .sfoot-bottom{border-color:rgba(255,255,255,.25);color:rgba(255,255,255,.85)}
@media (max-width:720px){.lecgrid{grid-template-columns:1fr}}
/* ===== СВЕТЛАЯ ТЕМА (как на сайте: бумага + лазурь) ===== */
:root[data-theme="light"]{
  --bg:#fbfaf7;--card1:#ffffff;--card2:#f6f4ee;--border:#e3ddd0;
  --text:#15171e;--muted:#5b6170;--muted-warm:#7c7563;--sand:#8a6f36;
  --gold:#b98b2e;--accent:#1e3fb8;--accent-2:#1781bc;--heading:#15171e;
  --mrx:#c0281f;--mrx-2:#9c7a33;--vie:#9c7a33;--vie-2:#8a2f3e;
}
[data-theme="light"] body::before{background:
  radial-gradient(900px 600px at 86% 2%, rgba(34,154,214,.28), transparent 60%),
  radial-gradient(820px 560px at 4% 4%, rgba(34,154,214,.10), transparent 58%),
  radial-gradient(1300px 1050px at 50% 42%, rgba(120,180,220,.10), transparent 72%),
  linear-gradient(180deg,#eaf5fc 0%,#f4f9fd 50%,#fbfaf7 100%)}
[data-theme="light"] .masthead{border-bottom-color:rgba(185,139,46,.35)}
[data-theme="light"] .subjnav{background:linear-gradient(var(--bg) 72%,rgba(251,250,247,0))}
[data-theme="light"] .subjnav a{background:#ffffff}
[data-theme="light"] .lec{box-shadow:0 1px 2px rgba(21,23,30,.05),0 12px 30px rgba(21,23,30,.09)}
[data-theme="light"] .empty{color:#8a8578}
[data-theme="light"] .lec .soon{color:#8a8578}
[data-theme="light"] header.site{background:linear-gradient(180deg,#2ba7df,#1c87c4);border-bottom-color:rgba(255,255,255,.22);box-shadow:0 1px 0 rgba(255,255,255,.18)}
[data-theme="light"] header.site::after{display:none}
[data-theme="light"] header.site .brand-name{color:#ffffff}
[data-theme="light"] header.site .brand-sub{color:#ffe08a}
[data-theme="light"] header.site .menu a{color:rgba(255,255,255,.85)}
[data-theme="light"] header.site .menu a:hover,[data-theme="light"] header.site .menu a.active{color:#ffffff}
[data-theme="light"] header.site .menu a.active::after{background:#ffd75e}
[data-theme="light"] .brand .logo{box-shadow:0 0 0 1px #CDA14A,0 2px 9px rgba(0,0,0,.28)}
[data-theme="light"] header.site .head-ic,[data-theme="light"] header.site .theme-toggle,[data-theme="light"] header.site .nav-toggle{border-color:rgba(255,255,255,.42);color:#ffffff}
[data-theme="light"] header.site .head-ic:hover,[data-theme="light"] header.site .theme-toggle:hover{border-color:#ffffff;color:#ffffff}
/* ===== общая шапка сайта (как на основном сайте) ===== */
header.site{position:sticky;top:0;z-index:50;backdrop-filter:blur(14px);font-family:'Manrope',system-ui,sans-serif;background:#0b0c10;border-bottom:1px solid transparent;box-shadow:inset 0 1px 0 rgba(255,255,255,.05), 0 12px 30px -12px rgba(0,0,0,.78)}
header.site::after{content:"";position:absolute;left:0;right:0;top:100%;height:74px;pointer-events:none;z-index:-1;background:radial-gradient(40% 155% at 0% 0%, rgba(232,184,75,.10), transparent 70%),radial-gradient(42% 155% at 100% 0%, rgba(232,184,75,.115), transparent 70%),radial-gradient(60% 120% at 50% 0%, rgba(232,184,75,.08), transparent 73%)}
header.site .nav{max-width:var(--maxw);margin:0 auto;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:20px}
header.site .brand{display:flex;align-items:center;gap:13px}
header.site .brand .logo{width:50px;height:50px;display:block;border-radius:50%;object-fit:cover;box-shadow:0 0 0 1px #CDA14A, 0 3px 12px rgba(0,0,0,.5)}
header.site .brand .logo-fallback{width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-2));display:grid;place-items:center;font-weight:800;color:#0a0a0c;font-size:22px}
header.site .brand-text{display:flex;flex-direction:column;justify-content:center}
header.site .brand-name{font-family:"Playfair Display",serif;font-weight:600;font-size:23px;letter-spacing:.03em;color:#F3E9CF;line-height:1;white-space:nowrap}
header.site .brand-sub{font-weight:700;font-size:8.5px;letter-spacing:.30em;color:#CDA14A;margin-top:5px;white-space:nowrap}
header.site .nav-right{display:flex;align-items:center;gap:14px}
header.site .menu{display:flex;gap:14px;flex-wrap:wrap;align-items:center}
.head-links{display:flex;align-items:center;gap:9px}
.head-ic{width:36px;height:36px;border:1px solid var(--border);border-radius:50%;display:grid;place-items:center;color:var(--text);transition:color .2s,border-color .2s;flex-shrink:0}
.head-ic:hover{color:var(--accent);border-color:var(--accent)}
.head-ic svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.head-ic svg .dot{fill:currentColor;stroke:none}
.theme-toggle{background:none;border:1px solid var(--border);border-radius:50%;width:38px;height:38px;display:grid;place-items:center;color:var(--text);cursor:pointer;flex-shrink:0;transition:color .2s,border-color .2s}
.theme-toggle:hover{color:var(--accent);border-color:var(--accent)}
.theme-toggle .ic{width:18px;height:18px}
.theme-toggle .ic-sun{display:block;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}
.theme-toggle .ic-moon{display:none;fill:currentColor;stroke:none}
:root[data-theme="light"] .theme-toggle .ic-sun{display:none}
:root[data-theme="light"] .theme-toggle .ic-moon{display:block}
header.site .menu a{color:#eef1f8;font-size:14px;font-weight:700;letter-spacing:.02em;transition:color .2s;position:relative;padding:2px 0}
header.site .menu a:hover,header.site .menu a.active{color:var(--text)}
header.site .menu a.active::after{content:"";position:absolute;left:0;right:0;bottom:-6px;height:2px;background:var(--accent)}
header.site .nav-toggle{display:none;background:none;border:1px solid var(--border);border-radius:9px;width:42px;height:38px;color:var(--text);cursor:pointer;font-size:18px;line-height:1}
@media(max-width:760px){
  header.site .nav-toggle{display:block}
  header.site .nav{position:relative}
  header.site .menu{display:none;position:absolute;top:100%;left:0;right:0;flex-direction:column;gap:0;background:rgba(12,12,16,.98);border-bottom:1px solid var(--border);padding:8px 0}
  header.site .menu.open{display:flex}
  header.site .menu a{padding:12px 24px;width:100%}
  header.site .menu a.active::after{display:none}
}
</style>
</head>
<body>
<header class="site">
  <div class="nav">
    <a class="brand" href="/" aria-label="Караван идёт — на главную">
      <img class="logo" src="/logo/karavan-avatar-notext.png" width="50" height="50" alt=""
           onerror="this.outerHTML='<div class=&quot;logo-fallback&quot;>К</div>'">
      <span class="brand-text">
        <span class="brand-name">КАРАВАН ИДЁТ</span>
        <span class="brand-sub">КИНОЖУРНАЛ</span>
      </span>
    </a>
    <div class="nav-right">
      <nav class="menu" id="menu" aria-label="Основное меню">
        <a href="/reviews">Рецензии</a>
        <a href="/lectures/" class="active">Лекции</a>
        <a href="/collections">Подборки</a>
        <a href="/festivals">Кинофестивали</a>
        <a href="/press">Публикации в СМИ</a>
        <a href="/feed">Заметки</a>
        <a href="/about">Обо мне</a>
      </nav>
      <div class="head-links" aria-label="Поиск и связь">
        <a class="head-ic" href="/search" title="Поиск по сайту" aria-label="Поиск по сайту">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.2"/><line x1="15.2" y1="15.2" x2="20.5" y2="20.5"/></svg>
        </a>
        <a class="head-ic" href="https://t.me/karavan_goes" target="_blank" rel="noopener" title="Telegram-канал" aria-label="Telegram-канал">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.3 3.6 3.2 10.7c-.9.4-.9 1.6.1 1.9l4.5 1.4 1.7 5.2c.3.9 1.4 1 2 .3l2.3-2.9 4.6 3.3c.8.5 1.8.1 2-.9l2.5-13c.2-1-.7-1.8-1.6-1.4Z"/><path d="m9.4 13.9 8.4-7.8"/></svg>
        </a>
        <a class="head-ic" href="/rss.xml" target="_blank" title="RSS-лента" aria-label="RSS-лента">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 11.2a8.3 8.3 0 0 1 8.3 8.3"/><path d="M4.5 4.8A14.7 14.7 0 0 1 19.2 19.5"/><circle class="dot" cx="5.6" cy="18.4" r="1.5"/></svg>
        </a>
      </div>
      <button class="theme-toggle" id="themeToggle" type="button" aria-label="Светлая или тёмная тема" title="Светлая / тёмная тема">
        <svg class="ic ic-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.4"/><line x1="12" y1="1.7" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22.3"/><line x1="1.7" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22.3" y2="12"/><line x1="4.3" y1="4.3" x2="6" y2="6"/><line x1="18" y1="18" x2="19.7" y2="19.7"/><line x1="4.3" y1="19.7" x2="6" y2="18"/><line x1="18" y1="6" x2="19.7" y2="4.3"/></svg>
        <svg class="ic ic-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
      </button>
      <button class="nav-toggle" id="navToggle" aria-label="Меню" aria-expanded="false">☰</button>
    </div>
  </div>
</header>
<div class="wrap">
  <header class="masthead">
    <div class="kick">Авторские курсы · Карен Аванесян</div>
    <h1>Лекции</h1>
    <div class="sub">Авторские курсы по теории кино — от социальной критики до психоанализа.</div>
  </header>
  <nav class="subjnav" aria-label="Предметы">
    ${subjects.map(s=>`<a href="#subj-${s.slug}">${esc(s.title)}</a>`).join('\n    ')}
  </nav>
  ${subjects.map(card).join('\n')}
</div>
<footer class="site">
  <div class="sfoot">
    <div class="sfoot-col sfoot-brand">
      <div class="sfoot-name">КАРАВАН ИДЁТ</div>
      <p>Тексты о кино, лекционные курсы и фестивальные дневники Карена Аванесяна.</p>
    </div>
    <div class="sfoot-col">
      <h4>Разделы</h4>
      <div class="sfoot-links">
        <a href="/reviews">Рецензии</a>
        <a href="/lectures/">Лекции</a>
        <a href="/collections">Подборки</a>
        <a href="/festivals">Кинофестивали</a>
        <a href="/press">Публикации в СМИ</a>
        <a href="/feed">Заметки</a>
        <a href="/about">Обо мне</a>
      </div>
    </div>
    <div class="sfoot-col">
      <h4>Связь</h4>
      <a href="https://t.me/karavan_goes" target="_blank" rel="noopener">Telegram · @karavan_goes</a>
      <a href="mailto:karavan0788@yandex.com">karavan0788@yandex.com</a>
      <a href="/rss.xml" target="_blank">RSS-лента</a>
      <a href="https://letterboxd.com/karavan0788/" target="_blank" rel="noopener">Letterboxd</a>
    </div>
  </div>
  <div class="sfoot-bottom">
    <span>© <span id="year"></span> Караван идёт · Карен Аванесян</span>
  </div>
</footer>
<script>
(function(){var m=document.getElementById('menu'),t=document.getElementById('navToggle');if(t&&m)t.addEventListener('click',function(){var o=m.classList.toggle('open');t.setAttribute('aria-expanded',o?'true':'false');});})();
(function(){var b=document.getElementById('themeToggle');if(!b)return;b.addEventListener('click',function(){var toLight=document.documentElement.getAttribute('data-theme')!=='light';if(toLight)document.documentElement.setAttribute('data-theme','light');else document.documentElement.removeAttribute('data-theme');try{localStorage.setItem('km-theme',toLight?'light':'dark');}catch(e){}});})();
(function(){var y=document.getElementById('year');if(y)y.textContent=new Date().getFullYear();})();
</script>
</body>
</html>`;
}

export async function buildLectures({ ROOT, OUT, log = ()=>{} }){
  const LECT_SRC = path.join(ROOT, 'lectures');
  if(!existsSync(LECT_SRC)){ return; }

  // Картинки в деках уже «запечены» локально (см. tools/bake-lecture-images.mjs):
  // ссылки относительные img/<…>, файлы лежат в lectures/<курс>/img/. Поэтому при
  // сборке ничего не качаем — просто копируем дек и его папку img/ в dist.
  let count = 0;
  for(const s of SUBJECTS){
    if(!s.srcDir) continue;
    const destDir = path.join(OUT, 'lectures', s.slug);
    /* программа курса — копируем, даже если опубликованных лекций ещё нет */
    if(s.programme && existsSync(path.join(LECT_SRC, s.srcDir, s.programme))){
      await mkdir(destDir, { recursive: true });
      await cp(path.join(LECT_SRC, s.srcDir, s.programme), path.join(destDir, s.programme));
    }
    const ready = (s.lectures||[]).filter(l => l.ready && l.file && existsSync(path.join(LECT_SRC, s.srcDir, l.file)));
    if(!ready.length) continue;
    await mkdir(destDir, { recursive: true });
    const imgSrc = path.join(LECT_SRC, s.srcDir, 'img');
    if(existsSync(imgSrc)) await cp(imgSrc, path.join(destDir, 'img'), { recursive: true });
    for(const l of ready){
      await cp(path.join(LECT_SRC, s.srcDir, l.file), path.join(destDir, l.file));
      count++;
    }
  }

  log(`  лекции: ${count} опубликовано (деки + картинки запечены)`);
}
