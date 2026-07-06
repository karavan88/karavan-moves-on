/* ============================================================================
   render.js — единый источник разметки для сайта «Караван идёт».
   Импортируется И браузером (SPA-навигация), И сборщиком build.mjs (пререндер).
   Чистые функции: никакого DOM, никакого fetch, никакого marked внутри.
   Тело статей приходит уже как HTML (bodyHtml) — парсит его вызывающая сторона.
   ========================================================================== */

/* ---------- утилиты ---------- */
export function esc(s){ return String(s??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

export function parseFrontMatter(text){
  const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if(!m) return {meta:{}, body:text};
  const meta = {};
  m[1].split('\n').forEach(line=>{
    const i = line.indexOf(':'); if(i===-1) return;
    const key = line.slice(0,i).trim();
    let val = line.slice(i+1).trim().replace(/^["']|["']$/g,'');
    meta[key]=val;
  });
  return {meta, body:m[2]};
}

/* Оценка по 10-балльной шкале — 10 звёзд. */
export function stars(rating){
  const r = Math.max(0,Math.min(10,parseFloat(rating)||0));
  let html='';
  for(let i=1;i<=10;i++){
    if(r>=i) html+='<span class="st-full">★</span>';
    else if(r>=i-0.5) html+='<span class="st-half">★</span>';
    else html+='<span class="st-empty">★</span>';
  }
  return html;
}

/* Единый рендер оценки (шкала 0–10).
   mode 'badge' — пилюля «★ N» на постере; mode 'full' — ряд из 10 звёзд + «N / 10». */
export function ratingHTML(rating, mode='badge'){
  if(rating===undefined || rating===null || rating==='') return '';
  if(mode==='full') return `<div class="stars">${stars(rating)}<span class="num">${esc(rating)} / 10</span></div>`;
  return `<div class="rating-badge">★ ${esc(rating)}</div>`;
}

/* черновики (draft: true) не публикуются */
export function isPublished(x){ return !(x && (x.draft===true || x.draft==='true')); }
export function published(list){ return (list||[]).filter(isPublished); }

/* ---------- даты, чтение, теги ---------- */
const RU_MONTHS=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
export function ruDate(iso){
  const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(iso||''); if(!m) return iso||'';
  return `${+m[3]} ${RU_MONTHS[+m[2]-1]} ${m[1]}`;
}
export function plural(n,[one,few,many]){
  const a=Math.abs(n)%100, b=a%10;
  if(a>10&&a<20) return many;
  if(b>1&&b<5) return few;
  if(b===1) return one;
  return many;
}
export function wordsFromHtml(html){
  const text=(html||'').replace(/<[^>]*>/g,' ');
  return (text.match(/[A-Za-zА-Яа-яЁё0-9]+(?:-[A-Za-zА-Яа-яЁё0-9]+)*/g)||[]).length;
}
export function readMins(words){ return Math.max(1, Math.round(words/180)); }
export function splitTags(s){ return (s||'').split(',').map(x=>x.trim()).filter(Boolean); }
const TRANSLIT={'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};
export function tagSlug(tag){
  return (tag||'').toLowerCase().replace(/[«»"']/g,'')
    .split('').map(ch=>TRANSLIT[ch]!==undefined?TRANSLIT[ch]:ch).join('')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'tag';
}
export function tagChips(tagsStr){
  const tags=splitTags(tagsStr);
  if(!tags.length) return '';
  return `<div class="pill-row tags-row">${tags.map(tg=>`<a class="pill tag-chip" href="/tag/${tagSlug(tg)}">#${esc(tg)}</a>`).join('')}</div>`;
}

/* «Читать дальше»: близость по меткам, режиссёру и фестивалю. */
export function buildRelated(all, current, limit=3){
  const cur=splitTags(current.tags);
  const scored=published(all).filter(r=>r.slug!==current.slug).map(r=>{
    let s=0;
    const rt=splitTags(r.tags);
    s += rt.filter(x=>cur.includes(x)).length*2;
    if(current.director && r.director===current.director) s+=3;
    if(current.festival && r.festival===current.festival) s+=1;
    return {r,s};
  }).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,limit).map(x=>x.r);
  return scored;
}

/* ---------- карточки и строки списков ---------- */
export function reviewCardHTML(r){
  const film = r.film || r.title;
  const poster = r.poster
    ? `<img src="${esc(r.poster)}" alt="${esc(film)}" loading="lazy" decoding="async" onerror="this.outerHTML='<div class=&quot;ph&quot;>${esc(film)}</div>'">`
    : `<div class="ph">${esc(film)}</div>`;
  return `<a class="card" href="/review/${esc(r.slug)}">
    <div class="poster">
      ${poster}
      ${ratingHTML(r.rating)}
    </div>
    <div class="card-body">
      <h3>${esc(film)}</h3>
      <div class="card-meta">${[r.year,r.director].filter(Boolean).map(esc).join(' · ')}</div>
      ${r.title&&r.title!==film?`<div class="card-headline">${esc(r.title)}</div>`:''}
    </div>
  </a>`;
}

/* Карточка «Прокат 2026» — постер + название, ведёт на хаб фильма. */
export function prokatCardHTML(x){
  const poster = x.poster
    ? `<img src="${esc(x.poster)}" alt="«${esc(x.name)}»" loading="lazy" decoding="async" onerror="this.outerHTML='<div class=&quot;ph&quot;>${esc(x.name)}</div>'">`
    : `<div class="ph">${esc(x.name)}</div>`;
  return `<a class="card" href="/film/${esc(x.slug)}">
    <div class="poster">${poster}${x.rating?`<div class="rating-badge">★ ${esc(x.rating)}</div>`:''}</div>
    <div class="card-body">
      <h3>«${esc(x.name)}»</h3>
      <div class="card-meta">${esc(x.sub||'')}</div>
    </div>
  </a>`;
}

export function collectionCardHTML(c){
  const cover = c.cover
    ? `<img src="${esc(c.cover)}" alt="${esc(c.title)}" loading="lazy" decoding="async" onerror="this.outerHTML='<div class=&quot;ph&quot;>${esc(c.title)}</div>'">`
    : `<div class="ph">${esc(c.title)}</div>`;
  return `<a class="card" href="/collection/${esc(c.slug)}">
    <div class="poster cover">
      ${cover}
      ${c.count?`<div class="count-badge">${esc(c.count)} фильмов</div>`:''}
    </div>
    <div class="card-body">
      <h3>${c.overline?`<span class="card-prefix">${esc(c.overline)}: </span>`:''}${esc(c.title)}</h3>
      ${c.excerpt?`<div class="card-excerpt">${esc(c.excerpt)}</div>`:''}
    </div>
  </a>`;
}

/* Карточка заметки — в том же стиле, что и подборки (обложка сверху + текст). */
export function feedCardHTML(f){
  const img = f.image||f.cover||f.thumb;
  const cover = img
    ? `<img src="${esc(img)}" alt="${esc(f.title)}" loading="lazy" decoding="async" onerror="this.outerHTML='<div class=&quot;ph&quot;>${esc(f.title)}</div>'">`
    : `<div class="ph">${esc(f.title)}</div>`;
  const meta = [f.tag,f.date].filter(Boolean).map(esc).join(' · ');
  return `<a class="card" href="/feed/${esc(f.slug)}">
    <div class="poster cover">${cover}</div>
    <div class="card-body">
      ${meta?`<div class="feed-date">${meta}</div>`:''}
      <h3>${esc(f.title)}</h3>
      ${f.excerpt?`<div class="card-excerpt">${esc(f.excerpt)}</div>`:''}
    </div>
  </a>`;
}

export function pressItemHTML(p){
  const thumb = p.thumb
    ? `<img src="${esc(p.thumb)}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'">`
    : '';
  return `<a class="press-item" href="${esc(p.url)}" target="_blank" rel="noopener">
    <div class="press-thumb">${thumb}<span class="press-ext" aria-label="Открыть оригинал">↗</span></div>
    <div class="press-main">
      <div class="press-outlet">${esc(p.outlet)}</div>
      <h3>${esc(p.title)}</h3>
      <div class="press-meta">${[p.date,p.note].filter(Boolean).map(esc).join(' · ')}</div>
    </div>
  </a>`;
}

export function festivalItemHTML(it){
  const thumb = it.thumb?`<img src="${esc(it.thumb)}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'">`:'';
  const attrs = it.external
    ? `href="${esc(it.href)}" target="_blank" rel="noopener"`
    : `href="${esc(it.href)}"`;
  return `<a class="press-item" ${attrs}>
    <div class="press-thumb">${thumb}<span class="press-ext">${it.external?'↗':'→'}</span></div>
    <div class="press-main">
      <div class="press-outlet">${esc(it.kind)}</div>
      <h3>${esc(it.title)}</h3>
      <div class="press-meta">${esc(it.date||'')}</div>
    </div>
  </a>`;
}

export function timelineItems(list, itemPrefix){
  return list.map(f=>{
    const img = (f.image||f.cover||f.thumb)
      ? `<div class="feed-thumb"><img src="${esc(f.image||f.cover||f.thumb)}" alt="" loading="lazy" decoding="async" onerror="this.parentNode.style.display='none'"></div>`
      : '';
    return `
    <a class="feed-item${img?' has-img':''}" href="${itemPrefix}/${esc(f.slug)}">
      ${img}
      <div class="feed-main">
        ${f.tag?`<span class="feed-tag">${esc(f.tag)}</span><br>`:''}
        <span class="feed-date">${esc(f.date||'')}</span>
        <h3>${esc(f.title)}</h3>
        ${f.excerpt?`<p>${esc(f.excerpt)}</p>`:''}
        <span class="more">Читать →</span>
      </div>
    </a>`;
  }).join('');
}

export function homeLabel(title, href){
  return `<div class="section-label">${esc(title)} <a href="${href}">все →</a></div>`;
}

/* ---------- агрегация фестивалей ---------- */
export function homeFestItems({reviews=[], festivals=[], press=[]}){
  const items=[];
  reviews.forEach(r=>r.festival&&items.push({kind:'Рецензия',title:r.film||r.title,date:r.festival,thumb:r.poster,href:'/review/'+r.slug,external:false}));
  festivals.forEach(d=>items.push({kind:'Дневник',title:d.title,date:d.festival||d.tag,thumb:'',href:'/festival/'+d.slug,external:false}));
  press.forEach(p=>p.festival&&items.push({kind:'Публикация · '+(p.outlet||''),title:p.title,date:p.festival,thumb:p.thumb,href:p.url,external:true}));
  return items;
}

export function festivalGroups({reviews=[], feed=[], diaries=[], press=[]}){
  const groups={};
  const add=(f,it)=>{ if(!f) return; (groups[f]=groups[f]||[]).push(it); };
  reviews.forEach(r=>r.festival&&add(r.festival,{kind:'Рецензия',title:r.film||r.title,date:[r.year,r.director].filter(Boolean).join(' · '),thumb:r.poster,href:'/review/'+r.slug,external:false}));
  feed.forEach(f=>f.festival&&add(f.festival,{kind:'Заметка',title:f.title,date:f.date,thumb:'',href:'/feed/'+f.slug,external:false}));
  diaries.forEach(d=>add(d.festival||d.tag,{kind:'Дневник',title:d.title,date:d.date,thumb:'',href:'/festival/'+d.slug,external:false}));
  press.forEach(p=>p.festival&&add(p.festival,{kind:'Публикация · '+(p.outlet||''),title:p.title,date:p.date,thumb:p.thumb,href:p.url,external:true}));
  return groups;
}

/* Большой «выбор автора» — флагманский материал на всю ширину. */
export function featuredReviewHTML(r){
  const film = r.film || r.title;
  const img = r.poster
    ? `<img src="${esc(r.poster)}" alt="${esc(film)}" decoding="async" onerror="this.outerHTML='<div class=&quot;ph&quot;>${esc(film)}</div>'">`
    : `<div class="ph">${esc(film)}</div>`;
  return `<a class="featured" href="/review/${esc(r.slug)}">
    <div class="featured-poster">${img}${ratingHTML(r.rating)}</div>
    <div class="featured-body">
      <div class="featured-kicker">Выбор автора</div>
      <h2 class="featured-title">${esc(r.title||film)}</h2>
      ${r.title&&r.title!==film?`<div class="featured-film">${esc(film)}</div>`:''}
      <div class="featured-meta">${[r.year,r.director].filter(Boolean).map(esc).join(' · ')}</div>
      ${r.excerpt?`<p class="featured-excerpt">${esc(r.excerpt)}</p>`:''}
      <span class="featured-cta">Читать →</span>
    </div>
  </a>`;
}

/* Полоса под hero: издания, для которых пишет автор, и счётчики сайта. */
export function homeStripHTML(stats){
  const s = stats || {};
  const nums = [
    s.reviews ? `${s.reviews} ${plural(s.reviews,['рецензия','рецензии','рецензий'])}` : '',
    s.press ? `${s.press} ${plural(s.press,['публикация','публикации','публикаций'])}` : '',
    s.courses ? `${s.courses} ${plural(s.courses,['курс','курса','курсов'])}` : '',
  ].filter(Boolean).join(' · ');
  return `<section class="home-strip" aria-label="Пишу для">
    <span class="hs-label">Пишу для</span>
    <a class="hs-mark hs-ik" href="/press">Искусство кино</a>
    <a class="hs-mark hs-mf" href="/press">Мир фантастики</a>
    <a class="hs-mark hs-fr" href="/press">Film<b>.</b>ru</a>
    <a class="hs-mark hs-ka" href="/press">Киноафиша</a>
    ${nums?`<span class="hs-nums">${nums}</span>`:''}
  </section>`;
}

/* Карточка курса — в токенах сайта (работает в обеих темах);
   курс отличает только акцентный цвет --cc (класс mrx/vie/soc). */
export function courseCardHTML(c){
  const isStub = !c.total;
  const status = isStub ? 'план курса готовится'
    : c.ready
      ? `${c.total} ${plural(c.total,['лекция','лекции','лекций'])} · ${c.ready} ${plural(c.ready,['опубликована','опубликованы','опубликовано'])}`
      : `${c.total} ${plural(c.total,['лекция','лекции','лекций'])} · готовится`;
  const cta = isStub ? 'Подробнее →' : (c.ready ? 'Открыть курс →' : 'Программа →');
  return `<a class="course-card ${esc(c.accent||'soc')}" href="${esc(c.href)}">
    <span class="cc-kick">${esc(c.kicker||'Курс')}</span>
    <h3>${esc(c.title)}</h3>
    ${c.tagline?`<span class="cc-sub">${esc(c.tagline)}</span>`:''}
    <span class="cc-bot"><span class="cc-status">${status}</span><span class="cc-cta">${cta}</span></span>
  </a>`;
}

/* Страница /lectures/ — обычная страница сайта: шапка/футер/тема из общего шаблона. */
export function lecturesView(subjects){
  const list = subjects || [];
  const card = (s)=>{
    const lectures = s.lectures||[];
    const items = lectures.map(l=>{
      const href = (l.ready && l.file) ? `/lectures/${esc(s.slug)}/${esc(l.file)}` : null;
      const tag = href ? '<span class="go">смотреть →</span>' : '<span class="soon">готовится</span>';
      const inner = `<span class="ln">${esc(l.n)}</span><span class="lt">${esc(l.title)}</span>${l.sub?`<span class="ls">${esc(l.sub)}</span>`:''}${l.films?`<span class="lf"><b>Кейсы:</b> ${esc(l.films)}</span>`:''}${tag}`;
      return href ? `<a class="lec ready" href="${href}">${inner}</a>` : `<div class="lec">${inner}</div>`;
    }).join('');
    const body = lectures.length ? `<div class="lecgrid">${items}</div>` : `<div class="empty">План курса готовится</div>`;
    const prog = s.programme ? `<a class="prog" href="/lectures/${esc(s.slug)}/${esc(s.programme)}">Полная программа курса →</a>` : '';
    return `<section class="subj acc-${esc(s.accent||'soc')}" id="subj-${esc(s.slug)}">
      <div class="subj-head">
        <div class="subj-kick">${esc(s.kicker||'Курс')}</div>
        <h2>${esc(s.title)}</h2>
        <p>${esc(s.blurb)}</p>
        ${prog}
      </div>
      ${body}
    </section>`;
  };
  return `<main class="lectures">
    <header class="lect-masthead">
      <div class="lect-kick">Авторские курсы · Карен Аванесян</div>
      <h1>Лекции</h1>
      <div class="lect-sub">Авторские курсы по теории кино — от социальной критики до психоанализа.</div>
    </header>
    <nav class="subjnav" aria-label="Предметы">${list.map(s=>`<a href="#subj-${esc(s.slug)}">${esc(s.title)}</a>`).join('')}</nav>
    ${list.map(card).join('')}
  </main>`;
}

/* ---------- ВИДЫ (содержимое #app) ---------- */
export function homeView(data){
  const reviews = published(data.reviews);
  const feed = published(data.feed);
  const festivals = published(data.festivals);
  const collections = published(data.collections);
  const press = published(data.press);
  const films = data.films || [];
  const site = data.site || {};

  /* редакционная «шапка»: флагманский материал — «выбор автора» */
  let top='';
  const featured = site.featured ? reviews.find(r=>r.slug===site.featured) : null;
  if(featured) top += featuredReviewHTML(featured);

  const courses = data.courses || [];
  const stats = data.stats || {
    reviews: reviews.length, press: press.length,
    courses: courses.filter(c=>c.total>0).length,
  };

  /* ряды разделов */
  let out='';
  /* «Прокат 2026» — живой поток современного кино: мои рецензии (тег «прокат2026»),
     публикации в СМИ (prokat:true) и ручной список site.json→prokat.
     Карточки ведут на хаб фильма /film/<slug>. */
  const filmBySlug = new Map(films.map(f=>[f.slug,f]));
  const prokatSite = ((site&&site.prokat)||[]).map(n=>({
    name:String(n).replace(/[«»]/g,''), slug:filmSlug(n), poster:'', sub:''}));
  const prokatPress = press.filter(p=>p.prokat && p.film).map(p=>({
    name:p.film.replace(/[«»]/g,''), slug:filmSlug(p.film), poster:p.thumb, sub:'СМИ · '+(p.outlet||'')}));
  const prokatRev = reviews.filter(r=>splitTags(r.tags).includes('прокат2026')).map(r=>({
    name:(r.film||r.title||'').replace(/[«»]/g,''), slug:filmSlug(r.film||r.title), poster:r.poster, rating:r.rating,
    sub:[r.year,r.director].filter(Boolean).join(' · ')}));
  const seenPk = new Set();
  const prokat = [...prokatSite, ...prokatPress, ...prokatRev]
    .filter(x=>!seenPk.has(x.slug) && seenPk.add(x.slug))
    .map(x=>{ const f=filmBySlug.get(x.slug); return {...x, poster:(f&&f.poster)||x.poster, name:(f&&f.name)||x.name,
      sub:x.sub||[f&&f.year,f&&f.director].filter(Boolean).join(' · ')}; });
  if(prokat.length) out+=`${homeLabel('Прокат 2026','/films')}<div class="grid">${prokat.slice(0,4).map(prokatCardHTML).join('')}</div>`;
  if(reviews.length) out+=`${homeLabel('Рецензии','/reviews')}<div class="grid">${reviews.slice(0,4).map(reviewCardHTML).join('')}</div>`;
  if(courses.length) out+=`${homeLabel('Лекции · авторские курсы','/lectures/')}<div class="courses-grid">${courses.map(courseCardHTML).join('')}</div>`;
  if(collections.length) out+=`${homeLabel('Подборки','/collections')}<div class="grid wide">${collections.slice(0,2).map(collectionCardHTML).join('')}</div>`;
  const pressRow = press.slice(0,3);
  if(pressRow.length) out+=`${homeLabel('Публикации в СМИ','/press')}<div class="press-list" style="max-width:none;margin:0">${pressRow.map(pressItemHTML).join('')}</div>`;
  if(feed.length) out+=`${homeLabel('Заметки','/feed')}<div class="grid wide">${feed.slice(0,2).map(feedCardHTML).join('')}</div>`;

  const heroCopy = site.heroCopy
    || 'Карен Аванесян — исследователь кино, кандидат социологических наук. Рецензии, репортажи с фестивалей и публикации в СМИ:<br>кино как зеркало общества и бессознательного.';
  const body = top + out;
  return `
    <section class="hero">
      <div class="kicker">Авторский сайт исследователя кино Карена Аванесяна</div>
      <h1>Кино глазами <em>социолога</em></h1>
      <p>${heroCopy}</p>
      <div class="home-author">
        <img src="/assets/karen.jpg" alt="Карен Аванесян" loading="lazy" decoding="async" onerror="this.style.display='none'">
        <span class="q">«Кино для меня — документ эпохи. Каждый кадр хранит слепок общества и коллективного бессознательного»</span>
      </div>
    </section>
    <main id="home">${body || `<div class="state">Пока нет материалов.</div>`}</main>`;
}

export function reviewsView(list){
  const items = published(list);
  const grid = items.length ? items.map(reviewCardHTML).join('') : `<div class="state">Пока нет рецензий.</div>`;
  return `<main>
    <div class="page-title">Рецензии</div>
    <div class="page-sub">Разборы фильмов: личное впечатление и анализ в одном тексте.</div>
    <input id="revSearch" class="search" type="search" placeholder="Поиск по названию (рус / eng) или режиссёру…" aria-label="Поиск по рецензиям">
    <div class="grid" id="grid">${grid}</div></main>`;
}

/* Бейджи «смотреть на …»: берём прямую ссылку из front-matter (letterboxd/kinopoisk),
   а если её нет — строим поиск по оригинальному названию, чтобы кнопки работали всегда. */
/* Letterboxd: прямая ссылка на страницу фильма через TMDB-id (letterboxd.com/tmdb/<id>
   редиректит на /film/<slug>/). Пока id не вычислен — мягкий фолбэк на поиск. */
function extLinkRow(meta){
  const id = (meta.tmdb||'').toString().trim();
  const q = encodeURIComponent((meta.original||'').split('/')[0].trim() || (meta.film||meta.title||'').replace(/[«»]/g,'').trim());
  const lb = meta.letterboxd
    || (id ? `https://letterboxd.com/tmdb/${id}/` : '')
    || (q ? `https://letterboxd.com/search/films/${q}/` : '');
  if(!lb) return '';
  return `<div class="ext-links"><a class="lb" href="${esc(lb)}" target="_blank" rel="noopener" aria-label="Letterboxd"></a></div>`;
}

function pubLine(dateISO){
  if(!dateISO) return '';
  return `<div class="pub-line">Опубликовано ${ruDate(dateISO)}</div>`;
}

/* Мост «фильм → лекция»: связывает рецензию с курсом, где фильм в программе. */
function bridgeHTML(b){
  if(!b) return '';
  const soon = b.ready ? '' : ' <span class="bridge-soon">(готовится)</span>';
  const cta  = b.ready ? 'Открыть лекцию →' : 'Программа курса →';
  return `<aside class="bridge">
    <span class="bridge-kicker">Из лекций</span>
    <div class="bridge-text">Фильм разбирается в курсе «${esc(b.course)}»: лекция ${esc(b.n)} · «${esc(b.lecture)}»${soon}</div>
    <a class="bridge-cta" href="${esc(b.href)}">${cta}</a>
  </aside>`;
}

function collectionsLineHTML(list){
  if(!list||!list.length) return '';
  return `<div class="pill-row incoll-row">${list.map(c=>`<a class="fest-badge" href="/collection/${esc(c.slug)}">Из подборки «${esc(c.title)}»</a>`).join('')}</div>`;
}

function relatedHTML(list){
  if(!list||!list.length) return '';
  return `<div class="section-label" style="margin-top:44px">Читать дальше</div>
    <div class="grid related-grid">${list.map(reviewCardHTML).join('')}</div>`;
}

export function reviewPageView(meta, bodyHtml, extras={}){
  const film = meta.film || meta.title;
  const headline = (meta.title && meta.title !== film) ? meta.title : '';
  const mins = readMins(wordsFromHtml(bodyHtml));
  const poster = meta.poster
    ? `<img src="${esc(meta.poster)}" alt="${esc(film)}" decoding="async" onerror="this.parentNode.innerHTML='<div class=&quot;ph&quot;>${esc(film)}</div>'">`
    : `<div class="ph">${esc(film||'?')}</div>`;
  return `<main><article class="review-wrap">
    <a class="back" href="/reviews">← ко всем рецензиям</a>
    <div class="review-head">
      <div class="poster-col">
        <div class="poster">${poster}</div>
      </div>
      <div class="info">
        <div class="review-mins">${mins} мин чтения</div>
        <h1>${esc(film||'Без названия')}</h1>
        ${meta.original?`<div class="review-orig">${esc(meta.original)}</div>`:''}
        <div class="sub">${[meta.year,meta.director?'реж. '+meta.director:'',meta.country].filter(Boolean).map(esc).join(' · ')}${(meta.rating||meta.rating===0)?` · <span class="rate">★ ${esc(meta.rating)}/10</span>`:''}</div>
        ${meta.festival?`<div><a class="fest-stamp" href="/festivals" title="Все материалы фестиваля">${esc(meta.festival)}</a></div>`:''}
        ${extLinkRow(meta)}
        ${film?`<div class="film-hub-line"><a href="/film/${esc(filmSlug(film))}">Все материалы о фильме →</a></div>`:''}
        ${tagChips(meta.tags)}
      </div>
    </div>
    ${headline?`<h2 class="review-headline">${esc(headline)}</h2>`:''}
    <div class="prose">${bodyHtml}</div>
    ${pubLine(extras.date)}
    ${bridgeHTML(extras.bridge)}
    ${collectionsLineHTML(extras.incollections)}
    ${relatedHTML(extras.related)}
    <footer class="review-author">
      <img class="review-author-pic" src="/assets/karen.jpg" alt="Карен Аванесян" decoding="async" onerror="this.style.display='none'">
      <div class="review-author-text">
        <span class="review-author-rubric">Автор</span>
        <span class="review-author-name">Карен Аванесян</span>
      </div>
    </footer>
  </article></main>`;
}

export function collectionsView(list){
  const items = published(list);
  const grid = items.length ? items.map(collectionCardHTML).join('') : `<div class="state">Пока нет подборок.</div>`;
  return `<main>
    <div class="page-title">Подборки</div>
    <div class="page-sub">Авторские коллекции фильмов на разные темы — кино, собранное по смыслу, а не по алфавиту.</div>
    <div class="grid wide" id="cols">${grid}</div></main>`;
}

export function collectionPageView(meta, bodyHtml){
  if(meta.layout === 'scrolly') return scrollyView(meta, bodyHtml, '/collections', 'ко всем подборкам');
  return `<main><article class="review-wrap">
    <a class="back" href="/collections">← ко всем подборкам</a>
    ${meta.cover?`<div class="poster cover" style="border-radius:14px;border:1px solid var(--border);margin-bottom:24px;max-height:320px"><img src="${esc(meta.cover)}" alt="" decoding="async" onerror="this.parentNode.style.display='none'"></div>`:''}
    <h1 class="page-title" style="margin-top:0">${esc(meta.title||'')}</h1>
    ${meta.subtitle?`<div class="page-sub">${esc(meta.subtitle)}</div>`:''}
    <div class="prose">${bodyHtml}</div>
  </article></main>`;
}

/* Кинематографичная «скролл-история»: каждая запись (.coll-entry из markdown)
   превращается в сцену на весь экран. Постер уходит в размытый фон, текст
   проявляется при прокрутке. Используется и подборками, и заметками — поэтому
   ссылка «назад» параметризуется. meta.snap:"page" включает жёсткий снап
   (каждый скролл — на следующую сцену, страница не застревает между фильмами).
   Браузерный «усилитель» (enhanceScrolly в index.html) добавляет фон, анимации
   и счётчик; без JS страница остаётся читаемой как обычный список. */
export function scrollyView(meta, bodyHtml, backHref, backLabel){
  const count = (bodyHtml.match(/class="coll-entry"/g) || []).length;
  const kicker = meta.kicker || '';
  const paged = meta.snap === 'page' || meta.snap === 'mandatory';
  const stills = meta.media === 'stills';  /* широкие кадры вместо постеров */
  /* одна строка метаданных под названием (истории про один фильм):
     режиссёр · год · ★ N/10 · Letterboxd */
  const fmParts = [];
  if(meta.director) fmParts.push(esc(meta.director));
  if(meta.year) fmParts.push(esc(meta.year));
  if(meta.rating) fmParts.push(`<span class="rate">★ ${esc(meta.rating)}/10</span>`);
  let fm = fmParts.join(' · ');
  if(meta.letterboxd) fm += (fm ? ' ' : '') + `<a class="lb" href="${esc(meta.letterboxd)}" target="_blank" rel="noopener" aria-label="Letterboxd"></a>`;
  const filmMeta = fm ? `<div class="scrolly-filmmeta">${fm}</div>` : '';
  return `<main class="scrolly${paged ? ' scrolly--paged' : ''}${stills ? ' scrolly--stills' : ''}"${paged ? ' data-snap="mandatory"' : ''}>
    <a class="back scrolly-back" href="${backHref}">← ${esc(backLabel)}</a>
    <section class="scene scene-intro">
      <div class="scene-intro-inner">
        ${kicker ? `<div class="scrolly-kicker">${esc(kicker)}</div>` : ''}
        <h1 class="scrolly-title">${meta.overline ? `<span class="title-noir">${esc(meta.overline)}: </span>` : ''}${esc(meta.title || '')}</h1>
        ${filmMeta}
        ${meta.subtitle ? `<p class="scrolly-sub">${esc(meta.subtitle)}</p>` : ''}
        <div class="scrolly-author">
          <span class="scrolly-rubric">Скролл-история</span>
          <img class="scrolly-avatar" src="/assets/karen.jpg" alt="Карен Аванесян" decoding="async" onerror="this.style.display='none'">
          <span>рассказывает <b>Карен Аванесян</b></span>
        </div>
        <div class="scroll-hint" aria-hidden="true"><span>прокрутите вниз</span><i></i></div>
      </div>
    </section>
    <div class="prose scrolly-body">${bodyHtml}</div>
    ${count ? `<div class="scrolly-counter" aria-hidden="true"><b id="scNow">1</b><i>/ ${count}</i></div>` : ''}
  </main>`;
}

export function feedView(list){
  const items = published(list);
  const body = items.length ? items.map(feedCardHTML).join('') : `<div class="state">Пока нет записей.</div>`;
  return `<main>
    <div class="page-title">Заметки</div>
    <div class="page-sub">Короткие мысли и наблюдения о кино — между большими текстами.</div>
    <div class="grid wide" id="feed">${body}</div></main>`;
}

export function timelineItemView(meta, bodyHtml, backHref, backLabel){
  if(meta.layout === 'scrolly') return scrollyView(meta, bodyHtml, backHref, backLabel);
  return `<main><article class="review-wrap">
    <a class="back" href="${backHref}">← ${esc(backLabel)}</a>
    ${meta.date?`<div class="feed-date" style="margin-bottom:10px">${esc(meta.date)}</div>`:''}
    <h1 class="page-title" style="margin-top:0">${esc(meta.title||'')}</h1>
    ${meta.tag?`<div class="pill-row" style="margin-bottom:20px"><span class="pill">${esc(meta.tag)}</span></div>`:''}
    <div class="prose">${bodyHtml}</div>
  </article></main>`;
}

export const PRESS_RUBRICS = ['Рецензии','Рецензии с фестивалей','Тематические подборки','Интервью'];
export function rubricId(r){ return 'pr-'+r.replace(/[^a-zа-я0-9]+/gi,'-').toLowerCase(); }
export function pressView(list){
  const items = published(list);
  if(!items.length) return `<main>
    <div class="page-title">Публикации в СМИ</div>
    <div class="press-body"><div class="state">Пока нет публикаций.</div></div></main>`;
  const groups = {};
  items.forEach(p=>{ const r=p.rubric||'Прочее'; (groups[r]=groups[r]||[]).push(p); });
  const rubrics = [...PRESS_RUBRICS.filter(r=>groups[r]),
                   ...Object.keys(groups).filter(r=>!PRESS_RUBRICS.includes(r))];
  const nav = rubrics.map(r=>`<a href="#${rubricId(r)}">${esc(r)} <span>${groups[r].length}</span></a>`).join('');
  const body = rubrics.map(r=>`
    <div class="section-label" id="${rubricId(r)}" style="scroll-margin-top:78px">${esc(r)}</div>
    <div class="press-list" style="margin:0 0 30px">${groups[r].map(pressItemHTML).join('')}</div>
  `).join('');
  return `<main>
    <div class="page-title">Публикации в СМИ</div>
    <div class="page-sub">Мои тексты, опубликованные в других изданиях — по рубрикам.</div>
    <div class="press-layout">
      <nav class="press-nav" aria-label="Рубрики">${nav}</nav>
      <div class="press-body">${body}</div>
    </div></main>`;
}

/* Текущий/недавний фестиваль — выше. Прочие сохраняют исходный порядок. */
export const FESTIVAL_ORDER = ['Il Cinema Ritrovato 2026','Канны 2026'];
export function festId(f){ return 'fest-'+f.replace(/[^a-zа-я0-9]+/gi,'-').toLowerCase(); }

/* Логотипы фестивалей. Файл кладётся в assets/fest/ (официальный логотип, который
   приносит владелец сайта). gold:true — перекрашиваем в золото через CSS-маску
   (для одноцветных лого вроде каннской пальмы); иначе показываем как есть.
   Пока список пуст — заголовки фестивалей выводятся только текстом. */
const FESTIVAL_LOGOS = [
  { re:/канны|cannes/i, src:'/assets/fest/cannes.svg',    gold:true  },
  { re:/ritrovato/i,    src:'/assets/fest/ritrovato.png', gold:false },
];
export function festivalLogoTag(name){
  const m = FESTIVAL_LOGOS.find(l=>l.re.test(name));
  if(!m) return '';
  if(m.gold) return `<span class="fest-logo gold" style="--logo:url('${m.src}')" role="img" aria-label="${esc(name)}"></span>`;
  return `<img class="fest-logo" src="${esc(m.src)}" alt="${esc(name)}" loading="lazy" decoding="async">`;
}
export function festivalsView(data){
  const groups = festivalGroups({
    reviews: published(data.reviews),
    feed: published(data.feed),
    diaries: published(data.diaries),
    press: published(data.press),
  });
  const keys = Object.keys(groups).sort((a,b)=>{
    const ia=FESTIVAL_ORDER.indexOf(a), ib=FESTIVAL_ORDER.indexOf(b);
    return (ia===-1?99:ia)-(ib===-1?99:ib);
  });
  const intro = `<div class="page-title">Кинофестивали</div>
    <div class="page-sub">Я езжу на фестивали и пишу с места. Сюда автоматически собирается всё, у чего отмечен фестиваль — рецензии, заметки, дневники и публикации в СМИ.</div>`;
  if(!keys.length) return `<main>${intro}<div class="state">Пока нет фестивальных материалов.</div></main>`;
  const nav = keys.map(f=>`<a href="#${festId(f)}">${esc(f)} <span>${groups[f].length}</span></a>`).join('');
  const body = keys.map(f=>{
    const logo = festivalLogoTag(f);
    return `
    <div class="fest-head${logo?' has-logo':''}" id="${festId(f)}" style="scroll-margin-top:78px">
      ${logo?`<span class="fest-emblem">${logo}</span>`:''}
      <span class="fest-name">${esc(f)}</span>
    </div>
    <div class="press-list" style="max-width:none;margin:0 0 30px">${groups[f].map(festivalItemHTML).join('')}</div>`;
  }).join('');
  return `<main>${intro}
    <div class="press-layout">
      <nav class="press-nav" aria-label="Фестивали">${nav}</nav>
      <div class="press-body" id="fest">${body}</div>
    </div></main>`;
}

export function aboutView(meta, bodyHtml){
  const photo = meta.photo
    ? `<img src="${esc(meta.photo)}" alt="${esc(meta.name)}" decoding="async" onerror="this.parentNode.innerHTML='${esc((meta.name||'К')[0])}'">`
    : (meta.name?esc(meta.name[0]):'К');
  const socials = [['Написать',meta.email?'mailto:'+meta.email:''],['Telegram',meta.telegram],['Letterboxd',meta.letterboxd],['Кинопоиск',meta.kinopoisk]].filter(s=>s[1]);
  const socialHTML = socials.length?`<div class="socials">${socials.map(s=>`<a href="${esc(s[1])}" target="_blank" rel="noopener">${esc(s[0])} <span>↗</span></a>`).join('')}</div>`:'';
  return `<main><div class="about-wrap">
    <div class="about-hero">
      <div class="photo">${photo}</div>
      <div class="who">
        <h1>${esc(meta.name||'Карен Аванесян')}</h1>
        <div class="role">${esc(meta.role||'')}</div>
        ${socialHTML}
      </div>
    </div>
    <article class="prose">${bodyHtml}</article>
  </div></main>`;
}

export function tagView(tag, list){
  const items = published(list).filter(r=>splitTags(r.tags).includes(tag));
  const grid = items.length ? items.map(reviewCardHTML).join('') : `<div class="state">С этой меткой пока пусто.</div>`;
  return `<main>
    <a class="back" href="/reviews">← ко всем рецензиям</a>
    <div class="page-title">#${esc(tag)}</div>
    <div class="page-sub">${items.length} ${plural(items.length,['материал','материала','материалов'])} с этой меткой.</div>
    <div class="grid">${grid}</div></main>`;
}

export function searchView(){
  return `<main>
    <div class="page-title">Поиск</div>
    <div class="page-sub">По рецензиям, подборкам, заметкам и публикациям в СМИ.</div>
    <input id="siteSearch" class="search" type="search" placeholder="Название, режиссёр, тема…" aria-label="Поиск по сайту" autofocus>
    <div id="sres"><div class="state">Начните вводить запрос.</div></div>
  </main>`;
}

/* ---------- УКАЗАТЕЛЬ ФИЛЬМОВ и хаб фильма ---------- */
/* Каждый фильм = узел графа: где он фигурирует (рецензия, лекции-кейсы, подборки).
   Данные собирает build.mjs (films.json); здесь только разметка. Название хранится
   без «ёлочек», выводится в «…». */
export function filmSlug(name){ return tagSlug((name||'').replace(/[«»]/g,'')); }

export function filmRowHTML(f){
  const thumb = f.poster
    ? `<img src="${esc(f.poster)}" alt="" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'">`
    : '';
  const meta = [f.year, f.director?'реж. '+f.director:'', f.country, f.runtime?f.runtime+' мин':'']
    .filter(Boolean).map(esc).join(' · ');
  const ann = (f.overview||'').trim();
  const badges = [];
  if(f.review) badges.push(`<span class="fb fb-rev">Рецензия${f.review.rating?` · ★ ${esc(f.review.rating)}`:''}</span>`);
  (f.lectures||[]).forEach(l=>badges.push(`<span class="fb fb-lec">Лекция ${esc(l.n)} · ${esc(l.course)}</span>`));
  (f.collections||[]).forEach(c=>badges.push(`<span class="fb fb-coll">Подборка «${esc(c.title)}»</span>`));
  return `<a class="film-row${f.poster?'':' no-poster'}" href="/film/${esc(f.slug)}">
    <div class="film-thumb">${thumb}</div>
    <div class="film-main">
      <h3>«${esc(f.name)}»</h3>
      ${meta?`<div class="film-meta">${meta}</div>`:''}
      ${ann?`<p class="film-ann">${esc(ann)}</p>`:''}
      ${badges.length?`<div class="film-badges">${badges.join('')}</div>`:''}
    </div>
  </a>`;
}

export function filmsIndexView(films){
  const list = films||[];
  const body = list.length ? list.map(filmRowHTML).join('') : `<div class="state">Пока пусто.</div>`;
  return `<main>
    <div class="page-title">Все фильмы</div>
    <div class="page-sub">Указатель: каждый фильм, о котором я писал или который разбираю в лекциях и подборках, — со всеми связями в одном месте.</div>
    <input id="filmSearch" class="search" type="search" placeholder="Название фильма…" aria-label="Поиск по фильмам">
    <div class="film-index" id="filmIndex">${body}</div>
  </main>`;
}

export function filmHubView(f){
  const poster = f.poster
    ? `<img src="${esc(f.poster)}" alt="«${esc(f.name)}»" decoding="async" onerror="this.parentNode.innerHTML='<div class=&quot;ph&quot;>${esc(f.name)}</div>'">`
    : `<div class="ph">${esc(f.name)}</div>`;
  const sub = [f.year, f.country, f.runtime?f.runtime+' мин':''].filter(Boolean).map(esc).join(' · ');
  const genres = (f.genres||'').split(',').map(s=>s.trim()).filter(Boolean);
  /* Letterboxd: прямая ссылка через TMDB-id, иначе — поиск. Иконка — фирменная .lb. */
  const lbHref = f.tmdb ? `https://letterboxd.com/tmdb/${esc(f.tmdb)}/` : `https://letterboxd.com/search/films/${encodeURIComponent(f.name)}/`;

  /* кросс-материалы одним потоком карточек */
  const cards = [];
  if(f.review) cards.push(`<a class="hub-card hc-rev" href="/review/${esc(f.review.slug)}">
      <span class="hc-kind">Рецензия</span>
      <span class="hc-title">Читать разбор</span>
      ${f.review.rating?`<span class="hc-note"><span class="rate">★ ${esc(f.review.rating)}/10</span></span>`:''}
    </a>`);
  (f.collections||[]).forEach(c=>cards.push(`<a class="hub-card hc-coll" href="/collection/${esc(c.slug)}">
      <span class="hc-kind">Подборка</span>
      <span class="hc-title">«${esc(c.title)}»</span>
    </a>`));
  (f.lectures||[]).forEach(l=>cards.push(`<a class="hub-card hc-lec" href="${esc(l.href)}">
      <span class="hc-kind">Лекция · ${esc(l.course)}</span>
      <span class="hc-title">«${esc(l.lecture)}»</span>
      <span class="hc-note">лекция ${esc(l.n)}${l.ready?'':' · <span class="bridge-soon">готовится</span>'}</span>
    </a>`));
  (f.press||[]).forEach(p=>cards.push(`<a class="hub-card hc-press" href="${esc(p.url)}" target="_blank" rel="noopener">
      <span class="hc-kind">СМИ · ${esc(p.outlet)}</span>
      <span class="hc-title">${esc(p.title)} ↗</span>
    </a>`));
  (f.feed||[]).forEach(n=>cards.push(`<a class="hub-card hc-coll" href="/feed/${esc(n.slug)}">
      <span class="hc-kind">Скролл-история</span>
      <span class="hc-title">«${esc(n.title)}»</span>
    </a>`));

  const hub = cards.length
    ? `<div class="hub-h2">Где на «Караване»</div><div class="hub-cards">${cards.join('')}</div>`
    : `<div class="hub-cards"><div class="hub-empty">Пока только упоминание — материалы об этом фильме появятся здесь.</div></div>`;

  return `<main><article class="review-wrap film-hub">
    <a class="back" href="/films">← ко всем фильмам</a>
    <div class="film-head-wrap">
      ${f.backdrop?`<div class="film-backdrop" style="background-image:url('${esc(f.backdrop)}')" aria-hidden="true"></div>`:''}
      <div class="review-head film-head">
        <div class="poster-col">
          <div class="poster">${poster}</div>
          <a class="lb lb-under" href="${esc(lbHref)}" target="_blank" rel="noopener" aria-label="Letterboxd"></a>
        </div>
        <div class="info">
          <h1>«${esc(f.name)}»</h1>
          ${f.original?`<div class="film-orig">${esc(f.original)}</div>`:''}
          ${genres.length?`<div class="film-genres">${genres.map(g=>`<span class="genre-pill">${esc(g)}</span>`).join('')}</div>`:''}
          ${sub?`<div class="sub">${sub}</div>`:''}
          ${f.director?`<div class="film-credit"><span class="cl">Режиссёр</span> ${esc(f.director)}</div>`:''}
          ${(f.cast&&f.cast.length)?`<div class="film-credit"><span class="cl">В главных ролях</span> ${esc(f.cast.join(', '))}</div>`:''}
          ${f.overview?`<p class="film-overview">${esc(f.overview)}</p>`:''}
        </div>
      </div>
    </div>
    ${hub}
  </article></main>`;
}

/* ---------- состояние ошибки ---------- */
export function loadError(){
  return `<main><div class="state"><h2>Не удалось загрузить контент</h2>
    <p>Открой сайт через локальный сервер или хостинг (см. README), а не двойным кликом по файлу.</p></div></main>`;
}
export function notFoundView(title, backHref, backLabel){
  return `<main><div class="state"><h2>${esc(title)}</h2>
    <a class="back" href="${backHref}">← ${esc(backLabel)}</a></div></main>`;
}
