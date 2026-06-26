/* ============================================================================
   render.js — единый источник разметки для сайта «Караван идёт».
   Импортируется И браузером (SPA-навигация), И сборщиком build.mjs (пререндер).
   Чистые функции: никакого DOM, никакого fetch, никакого marked внутри.
   Тело статей приходит уже как HTML (bodyHtml) — парсит его вызывающая сторона.
   ========================================================================== */

/* ---------- утилиты ---------- */
export function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

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

/* черновики (draft: true) не публикуются */
export function isPublished(x){ return !(x && (x.draft===true || x.draft==='true')); }
export function published(list){ return (list||[]).filter(isPublished); }

/* ---------- карточки и строки списков ---------- */
export function reviewCardHTML(r){
  const film = r.film || r.title;
  const poster = r.poster
    ? `<img src="${esc(r.poster)}" alt="${esc(film)}" loading="lazy" decoding="async" onerror="this.outerHTML='<div class=&quot;ph&quot;>${esc(film)}</div>'">`
    : `<div class="ph">${esc(film)}</div>`;
  return `<a class="card" href="/review/${esc(r.slug)}">
    <div class="poster">
      ${poster}
      ${r.rating?`<div class="rating-badge">★ ${esc(r.rating)}</div>`:''}
    </div>
    <div class="card-body">
      <h3>${esc(film)}</h3>
      <div class="card-meta">${[r.year,r.director].filter(Boolean).map(esc).join(' · ')}</div>
      ${r.title&&r.title!==film?`<div class="card-headline">${esc(r.title)}</div>`:''}
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
      <h3>${esc(c.title)}</h3>
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
    <div class="featured-poster">${img}${r.rating?`<div class="rating-badge">★ ${esc(r.rating)}</div>`:''}</div>
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

/* ---------- ВИДЫ (содержимое #app) ---------- */
export function homeView(data){
  const reviews = published(data.reviews);
  const feed = published(data.feed);
  const festivals = published(data.festivals);
  const collections = published(data.collections);
  const press = published(data.press);
  const site = data.site || {};

  /* редакционная «шапка»: флагманский материал — «выбор автора» */
  let top='';
  const featured = site.featured ? reviews.find(r=>r.slug===site.featured) : null;
  if(featured) top += featuredReviewHTML(featured);

  /* ряды разделов */
  let out='';
  if(reviews.length) out+=`${homeLabel('Рецензии','/reviews')}<div class="grid">${reviews.slice(0,4).map(reviewCardHTML).join('')}</div>`;
  const pressRow = press.slice(0,3);
  if(pressRow.length) out+=`${homeLabel('Публикации в СМИ','/press')}<div class="press-list" style="max-width:none;margin:0">${pressRow.map(pressItemHTML).join('')}</div>`;
  const festItems = homeFestItems({reviews,festivals,press});
  if(festItems.length) out+=`${homeLabel('Кинофестивали','/festivals')}<div class="press-list" style="max-width:none;margin:0 0 8px">${festItems.slice(0,3).map(festivalItemHTML).join('')}</div>`;
  if(collections.length) out+=`${homeLabel('Подборки','/collections')}<div class="grid wide">${collections.slice(0,2).map(collectionCardHTML).join('')}</div>`;
  if(feed.length) out+=`${homeLabel('Заметки','/feed')}<div class="grid wide">${feed.slice(0,2).map(feedCardHTML).join('')}</div>`;

  const heroCopy = site.heroCopy
    || 'Карен Аванесян — исследователь кино, кандидат социологических наук. Рецензии, репортажи с фестивалей и публикации в СМИ:<br>кино как зеркало общества и бессознательного.';
  const body = top + out;
  return `
    <section class="hero">
      <div class="kicker">Авторский сайт о кино Карена Аванесяна</div>
      <h1>Кино глазами <em>социолога</em></h1>
      <p>${heroCopy}</p>
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
const LB_ICON = `<svg class="ico ico-lb" viewBox="0 0 38 14" aria-hidden="true"><circle cx="7" cy="7" r="6.5" fill="#ff8000"/><circle cx="19" cy="7" r="6.5" fill="#00e054"/><circle cx="31" cy="7" r="6.5" fill="#40bcf4"/></svg>`;
/* Letterboxd: прямая ссылка на страницу фильма через TMDB-id (letterboxd.com/tmdb/<id>
   редиректит на /film/<slug>/). Пока id не вычислен — мягкий фолбэк на поиск. */
function extLinkRow(meta){
  const id = (meta.tmdb||'').toString().trim();
  const q = encodeURIComponent((meta.original||'').split('/')[0].trim() || (meta.film||meta.title||'').replace(/[«»]/g,'').trim());
  const lb = meta.letterboxd
    || (id ? `https://letterboxd.com/tmdb/${id}/` : '')
    || (q ? `https://letterboxd.com/search/films/${q}/` : '');
  if(!lb) return '';
  return `<div class="ext-links"><a class="ext lb" href="${esc(lb)}" target="_blank" rel="noopener">${LB_ICON}Letterboxd<span class="arr">↗</span></a></div>`;
}

export function reviewPageView(meta, bodyHtml){
  const film = meta.film || meta.title;
  const headline = (meta.title && meta.title !== film) ? meta.title : '';
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
        <h1>${esc(film||'Без названия')}</h1>
        <div class="sub">${[meta.year,meta.director?'реж. '+meta.director:'',meta.country].filter(Boolean).map(esc).join(' · ')}</div>
        ${meta.rating?`<div class="stars">${stars(meta.rating)}<span class="num">${esc(meta.rating)} / 10</span></div>`:''}
        ${meta.festival?`<div><a class="fest-badge" href="/festivals">#${esc(meta.festival)}</a></div>`:''}
        ${extLinkRow(meta)}
      </div>
    </div>
    ${headline?`<h2 class="review-headline">${esc(headline)}</h2>`:''}
    <div class="prose">${bodyHtml}</div>
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
  return `<main><article class="review-wrap">
    <a class="back" href="/collections">← ко всем подборкам</a>
    ${meta.cover?`<div class="poster cover" style="border-radius:14px;border:1px solid var(--border);margin-bottom:24px;max-height:320px"><img src="${esc(meta.cover)}" alt="" decoding="async" onerror="this.parentNode.style.display='none'"></div>`:''}
    <h1 class="page-title" style="margin-top:0">${esc(meta.title||'')}</h1>
    ${meta.subtitle?`<div class="page-sub">${esc(meta.subtitle)}</div>`:''}
    <div class="prose">${bodyHtml}</div>
  </article></main>`;
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

/* ---------- состояние ошибки ---------- */
export function loadError(){
  return `<main><div class="state"><h2>Не удалось загрузить контент</h2>
    <p>Открой сайт через локальный сервер или хостинг (см. README), а не двойным кликом по файлу.</p></div></main>`;
}
export function notFoundView(title, backHref, backLabel){
  return `<main><div class="state"><h2>${esc(title)}</h2>
    <a class="back" href="${backHref}">← ${esc(backLabel)}</a></div></main>`;
}
