/* ============================================================================
   build.mjs — пререндер сайта «Караван идёт» в статические HTML-страницы.

   Для каждого маршрута берёт шаблон index.html и впечатывает:
     • корректные <title>/description/canonical/OpenGraph/JSON-LD в <head>;
     • готовую разметку контента в #app (видно и без JS, и поисковикам);
     • флаг window.__VIEW__, чтобы браузерный SPA не перерисовывал то,
       что уже отрендерено.
   Дополнительно генерирует sitemap.xml, rss.xml и robots.txt.

   Разметку строит ТОТ ЖЕ модуль assets/render.js, что и браузер, — поэтому
   статика и клиентский рендер не расходятся.
   ========================================================================== */
import { readFile, writeFile, mkdir, cp, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { marked } from 'marked';
import * as R from './assets/render.js';
import { loadToken, resolveMissing } from './tools/resolve-tmdb.mjs';
import { gatherTmdbUrls, localizeImages, applyMap } from './tools/localize-images.mjs';
import { buildLectures } from './tools/build-lectures.mjs';
import { coursesSummary, filmLectureMap, SUBJECTS } from './tools/courses-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');
const SITE = (process.env.SITE_URL || 'https://karavancinema.netlify.app').replace(/\/$/,'');
const md = s => marked.parse(s || '');

/* ---------- ввод/вывод ---------- */
// карта внешних TMDB-ссылок → локальных путей (заполняется в main, см. localizeImages)
let IMG_MAP = new Map();
const readText = async (p) => applyMap(await readFile(path.join(ROOT, p), 'utf8'), IMG_MAP);
const readJSON = async (p) => { try { return JSON.parse(await readText(p)); } catch { return []; } };
const readMd = async (p) => { try { return R.parseFrontMatter(await readText(p)); } catch { return null; } };

/* plain-text выжимка из markdown для description (≈160 символов) */
function excerptFromBody(body, limit=160){
  const t = (body||'')
    .replace(/!\[[^\]]*\]\([^)]*\)/g,' ')      // картинки
    .replace(/\[([^\]]*)\]\([^)]*\)/g,'$1')    // ссылки → текст
    .replace(/[#>*_`~\-]+/g,' ')               // markdown-символы
    .replace(/\s+/g,' ').trim();
  return t.length>limit ? t.slice(0,limit-1).replace(/\s+\S*$/,'')+'…' : t;
}
const absUrl = (u) => !u ? `${SITE}/logo/karavan-signature.png` : (/^https?:/.test(u) ? u : `${SITE}${u.startsWith('/')?'':'/'}${u}`);
const xmlEsc = (s) => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/* ---------- шаблон ---------- */
/* кэш-бастинг локальных скриптов: ?v=<хэш содержимого>. Файлы кэшируются
   надолго (max-age=86400), а хэш в ссылке меняется при каждой правке —
   поэтому посетители сразу получают свежий JS после деплоя, без F5. */
const assetVer = async (rel) =>
  createHash('sha1').update(await readFile(path.join(ROOT, rel))).digest('hex').slice(0, 8);
const bust = (html, rel, v) => html.replaceAll(rel, `${rel}?v=${v}`);
let TEMPLATE = await readText('index.html');
for (const rel of ['/assets/render.js', '/assets/marked.min.js']) {
  TEMPLATE = bust(TEMPLATE, rel, await assetVer(rel.replace(/^\//, '')));
}

const SITE_NAME = 'Караван идёт';
/* ogTitle — короткий заголовок для карточки-превью (Telegram/Twitter/WhatsApp):
   без хвоста «— Караван идёт», его роль играет og:site_name. По умолчанию = title. */
function buildMeta({title, ogTitle, description, urlPath, image, type='website', jsonld, author, published}){
  const url = `${SITE}${urlPath}`;
  const img = absUrl(image);
  const desc = (description||'').replace(/\s+/g,' ').trim();
  const ogt = ogTitle || title;
  const lines = [
    `<title>${R.esc(title)}</title>`,
    `<meta name="description" content="${R.esc(desc)}">`,
    `<link rel="canonical" href="${R.esc(url)}">`,
    `<meta property="og:site_name" content="${R.esc(SITE_NAME)}">`,
    `<meta property="og:locale" content="ru_RU">`,
    `<meta property="og:title" content="${R.esc(ogt)}">`,
    `<meta property="og:description" content="${R.esc(desc)}">`,
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:url" content="${R.esc(url)}">`,
    `<meta property="og:image" content="${R.esc(img)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${R.esc(ogt)}">`,
    `<meta name="twitter:description" content="${R.esc(desc)}">`,
    `<meta name="twitter:image" content="${R.esc(img)}">`,
  ];
  if(type==='article'){
    lines.push(`<meta property="article:author" content="${R.esc(author||SITE_NAME)}">`);
    if(published) lines.push(`<meta property="article:published_time" content="${R.esc(published)}">`);
  }
  if(jsonld) lines.push(`<script type="application/ld+json">${JSON.stringify(jsonld)}</script>`);
  return lines.join('\n');
}

function renderPage({meta, appHtml, view}){
  let html = TEMPLATE;
  html = html.replace(/<!-- PAGE_META_START -->[\s\S]*?<!-- PAGE_META_END -->/, meta);
  html = html.replace('<!-- APP_CONTENT -->', appHtml);
  html = html.replace('<!-- VIEW_FLAG -->', `<script>window.__VIEW__=${JSON.stringify(view)}</script>`);
  return html;
}

async function emit(urlPath, html){
  const rel = urlPath === '/' ? 'index.html' : path.join(urlPath.replace(/^\//,''), 'index.html');
  const dest = path.join(OUT, rel);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, html);
  return rel;
}

/* ---------- сборка ---------- */
async function main(){
  /* Если доступен TMDB-токен (локально, через .env/окружение) — дорезолвим
     недостающие tmdb-id в рецензиях. На Netlify токена нет — шаг тихо пропускается,
     используются уже проставленные id. */
  const token = await loadToken(ROOT);
  if(token){
    const { added, failed } = await resolveMissing(ROOT, token, { log:(m)=>console.log(m) });
    if(added||failed.length) console.log(`TMDB-id: добавлено ${added}, не найдено ${failed.length}`);
  }

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  /* статика: всё, что нужно отдать как есть (включая .md и манифесты для SPA) */
  for(const item of ['assets','logo','reviews','feed','festivals','collections','about.md','press.json','site.json']){
    if(existsSync(path.join(ROOT,item))) await cp(path.join(ROOT,item), path.join(OUT,item), { recursive: true });
  }

  /* картинки TMDB → локально (image.tmdb.org недоступен части аудитории) */
  const sourceData = [];
  for(const d of ['reviews','feed','festivals','collections']){
    const dir = path.join(ROOT, d);
    if(existsSync(dir)) for(const f of await readdir(dir)) if(/\.(md|json)$/.test(f)) sourceData.push(path.join(d, f));
  }
  sourceData.push('about.md', 'press.json');
  const tmdbUrls = await gatherTmdbUrls(ROOT, sourceData);
  IMG_MAP = await localizeImages(tmdbUrls, {
    distImgDir: path.join(OUT, 'assets', 'img'),
    cacheDir: path.join(ROOT, '.cache', 'img'),
    log: (m)=>console.log(m),
  });
  // переписать ссылки в данных, скопированных в dist (их фетчит SPA при клиентской навигации)
  for(const rel of sourceData){
    const p = path.join(OUT, rel);
    if(existsSync(p)) await writeFile(p, applyMap(await readFile(p, 'utf8'), IMG_MAP));
  }

  /* данные */
  const reviews     = await readJSON('reviews/manifest.json');
  const feed        = await readJSON('feed/manifest.json');
  const festivals   = await readJSON('festivals/manifest.json');
  const collections = await readJSON('collections/manifest.json');
  const press       = await readJSON('press.json');
  let site = {}; try { site = JSON.parse(await readText('site.json')); } catch {}

  const pubReviews     = R.published(reviews);
  const pubFeed        = R.published(feed);
  const pubFestivals   = R.published(festivals);
  const pubCollections = R.published(collections);
  const pubPress       = R.published(press);

  /* ---------- обогащение: минуты чтения, «мосты» к лекциям, подборки, related ---------- */
  const courses = coursesSummary();
  const lectureMap = filmLectureMap();
  const collBodies = [];
  for(const c of pubCollections){
    const parsedC = await readMd(`collections/${c.slug}.md`);
    if(parsedC) collBodies.push({ slug:c.slug, title:c.title||parsedC.meta.title||'',
      text:(parsedC.meta.title||'')+'\n'+parsedC.body });
  }
  const reviewParsed = new Map();
  for(const r of pubReviews){
    const parsedR = await readMd(`reviews/${r.slug}.md`);
    if(!parsedR) continue;
    reviewParsed.set(r.slug, parsedR);
    if(parsedR.meta.tags) r.tags = parsedR.meta.tags;
    r.mins = R.readMins(R.wordsFromHtml(md(parsedR.body)));
    const filmKey = (r.film||r.title||'').replace(/[«»]/g,'').trim();
    const bridge = lectureMap.get(filmKey);
    if(bridge) r.bridge = bridge;
    const inColl = collBodies.filter(cb=>r.film && cb.text.includes(r.film)).map(cb=>({slug:cb.slug,title:cb.title}));
    if(inColl.length) r.incollections = inColl;
  }
  for(const r of pubReviews) r.related = R.buildRelated(pubReviews, r).map(x=>x.slug);
  const stats = { reviews: pubReviews.length, press: pubPress.length, courses: courses.filter(c=>c.total>0).length };
  /* обогащённые данные — и клиентскому SPA (перекрываем копии в dist) */
  await writeFile(path.join(OUT,'reviews','manifest.json'), JSON.stringify(reviews, null, 2));
  await writeFile(path.join(OUT,'site-data.json'), JSON.stringify({courses, stats}, null, 2));

  const urls = []; // для sitemap

  /* HOME */
  await emit('/', renderPage({
    meta: buildMeta({
      title: 'Караван идёт — авторский сайт исследователя кино Карена Аванесяна',
      description: 'Кино глазами социолога: рецензии, дневники фестивалей и лекционные курсы от марксизма до психоанализа. Авторский сайт Карена Аванесяна.',
      urlPath: '/',
    }),
    appHtml: R.homeView({reviews,feed,festivals,collections,press,site,courses,stats}),
    view: {view:'home', nav:'home'},
  }));
  urls.push({loc:'/', priority:'1.0'});

  /* РЕЦЕНЗИИ — список */
  await emit('/reviews', renderPage({
    meta: buildMeta({ title:'Рецензии — Караван идёт', description:'Разборы фильмов: личное впечатление и анализ в одном тексте.', urlPath:'/reviews' }),
    appHtml: R.reviewsView(reviews),
    view: {view:'reviews', nav:'reviews'},
  }));
  urls.push({loc:'/reviews', priority:'0.8'});

  /* РЕЦЕНЗИИ — страницы */
  for(const r of pubReviews){
    const parsed = reviewParsed.get(r.slug);
    if(!parsed) continue;
    const { meta, body } = parsed;
    const film = meta.film || meta.title || r.film || r.title;
    const desc = r.excerpt || excerptFromBody(body);
    const jsonld = {
      '@context':'https://schema.org','@type':'Review',
      'name': meta.title || r.title,
      'itemReviewed': {'@type':'Movie','name': (film||'').replace(/[«»]/g,''),
        ...(meta.director?{'director':{'@type':'Person','name':meta.director}}:{}) },
      ...(meta.rating?{'reviewRating':{'@type':'Rating','ratingValue':meta.rating,'bestRating':'10','worstRating':'0'}}:{}) ,
      'author': {'@type':'Person','name':'Карен Аванесян'},
      'reviewBody': excerptFromBody(body, 280),
    };
    await emit(`/review/${r.slug}`, renderPage({
      meta: buildMeta({
        title: `${(meta.title||r.title)} — ${film} — Караван идёт`,
        ogTitle: `${(meta.title||r.title)} · ${film}`,
        description: desc, urlPath:`/review/${r.slug}`, image: meta.poster||r.poster, type:'article', jsonld,
        author:'Карен Аванесян', published: r.date || meta.date,
      }),
      appHtml: R.reviewPageView(meta, md(body), {
        date: r.date, bridge: r.bridge, incollections: r.incollections,
        related: (r.related||[]).map(s=>pubReviews.find(x=>x.slug===s)).filter(Boolean),
      }),
      view: {view:'review', nav:'reviews', slug:r.slug},
    }));
    urls.push({loc:`/review/${r.slug}`, priority:'0.7'});
  }

  /* ПОДБОРКИ — список + страницы (только опубликованные) */
  await emit('/collections', renderPage({
    meta: buildMeta({ title:'Подборки — Караван идёт', description:'Авторские коллекции фильмов на разные темы — кино, собранное по смыслу.', urlPath:'/collections' }),
    appHtml: R.collectionsView(collections),
    view: {view:'collections', nav:'collections'},
  }));
  urls.push({loc:'/collections', priority:'0.7'});
  for(const c of pubCollections){
    const parsed = await readMd(`collections/${c.slug}.md`);
    if(!parsed) continue;
    const { meta, body } = parsed;
    await emit(`/collection/${c.slug}`, renderPage({
      meta: buildMeta({
        title: `${meta.title||c.title} — Подборки — Караван идёт`,
        description: c.excerpt || meta.subtitle || excerptFromBody(body),
        urlPath:`/collection/${c.slug}`, image: meta.cover||c.cover, type:'article',
      }),
      appHtml: R.collectionPageView(meta, md(body)),
      view: {view:'collection', nav:'collections', slug:c.slug},
    }));
    urls.push({loc:`/collection/${c.slug}`, priority:'0.6'});
  }

  /* ПУБЛИКАЦИИ В СМИ */
  await emit('/press', renderPage({
    meta: buildMeta({ title:'Публикации в СМИ — Караван идёт', description:'Тексты Карена Аванесяна в других изданиях — по рубрикам.', urlPath:'/press' }),
    appHtml: R.pressView(press),
    view: {view:'press', nav:'press'},
  }));
  urls.push({loc:'/press', priority:'0.7'});

  /* КИНОФЕСТИВАЛИ */
  await emit('/festivals', renderPage({
    meta: buildMeta({ title:'Кинофестивали — Караван идёт', description:'Репортажи и материалы с кинофестивалей: рецензии, заметки, дневники и публикации.', urlPath:'/festivals' }),
    appHtml: R.festivalsView({reviews,feed,diaries:festivals,press}),
    view: {view:'festivals', nav:'festivals'},
  }));
  urls.push({loc:'/festivals', priority:'0.7'});
  for(const d of pubFestivals){
    const parsed = await readMd(`festivals/${d.slug}.md`);
    if(!parsed) continue;
    const { meta, body } = parsed;
    await emit(`/festival/${d.slug}`, renderPage({
      meta: buildMeta({ title:`${meta.title||d.title} — Кинофестивали — Караван идёт`, ogTitle: meta.title||d.title, description: d.excerpt||excerptFromBody(body), urlPath:`/festival/${d.slug}`, image: meta.poster||meta.image, type:'article', author:'Карен Аванесян', published: d.dateISO || undefined }),
      appHtml: R.timelineItemView(meta, md(body), '/festivals', 'к фестивалям'),
      view: {view:'festival', nav:'festivals', slug:d.slug},
    }));
    urls.push({loc:`/festival/${d.slug}`, priority:'0.6'});
  }

  /* ЗАМЕТКИ (лента) — список + страницы */
  await emit('/feed', renderPage({
    meta: buildMeta({ title:'Заметки — Караван идёт', description:'Короткие мысли и наблюдения о кино — между большими текстами.', urlPath:'/feed' }),
    appHtml: R.feedView(feed),
    view: {view:'feed', nav:'feed'},
  }));
  urls.push({loc:'/feed', priority:'0.6'});
  for(const f of pubFeed){
    const parsed = await readMd(`feed/${f.slug}.md`);
    if(!parsed) continue;
    const { meta, body } = parsed;
    await emit(`/feed/${f.slug}`, renderPage({
      meta: buildMeta({ title:`${meta.title||f.title} — Заметки — Караван идёт`, ogTitle: meta.title||f.title, description: f.excerpt||excerptFromBody(body), urlPath:`/feed/${f.slug}`, image: meta.poster||meta.image, type:'article', author:'Карен Аванесян', published: f.dateISO || undefined }),
      appHtml: R.timelineItemView(meta, md(body), '/feed', 'в заметки'),
      view: {view:'feedItem', nav:'feed', slug:f.slug},
    }));
    urls.push({loc:`/feed/${f.slug}`, priority:'0.5'});
  }

  /* ОБО МНЕ */
  const about = await readMd('about.md');
  if(about){
    await emit('/about', renderPage({
      meta: buildMeta({ title:'Обо мне — Карен Аванесян — Караван идёт', description: excerptFromBody(about.body), urlPath:'/about', image: about.meta.photo }),
      appHtml: R.aboutView(about.meta, md(about.body)),
      view: {view:'about', nav:'about'},
    }));
    urls.push({loc:'/about', priority:'0.6'});
  }

  /* ПОИСК ПО САЙТУ */
  await emit('/search', renderPage({
    meta: buildMeta({ title:'Поиск — Караван идёт', description:'Поиск по рецензиям, подборкам, заметкам и публикациям в СМИ.', urlPath:'/search' }),
    appHtml: R.searchView(),
    view: {view:'search', nav:''},
  }));
  urls.push({loc:'/search', priority:'0.3'});

  /* СТРАНИЦЫ МЕТОК — /tag/<slug> из тегов рецензий */
  const tagIndex = new Map();
  for(const r of pubReviews) for(const tg of R.splitTags(r.tags)){
    const s = R.tagSlug(tg); if(!tagIndex.has(s)) tagIndex.set(s, tg);
  }
  for(const [slug, tag] of tagIndex){
    await emit(`/tag/${slug}`, renderPage({
      meta: buildMeta({ title:`#${tag} — Караван идёт`, description:`Материалы «Каравана» с меткой «${tag}».`, urlPath:`/tag/${slug}` }),
      appHtml: R.tagView(tag, reviews),
      view: {view:'tag', nav:'reviews', slug},
    }));
    urls.push({loc:`/tag/${slug}`, priority:'0.3'});
  }

  /* 404 — отдаётся Netlify со статусом 404; SPA не перерисовывает */
  await emit('/404', renderPage({
    meta: buildMeta({ title:'Страница не найдена — Караван идёт', description:'', urlPath:'/404' }),
    appHtml: R.notFoundView('Страница не найдена','/','на главную'),
    view: {view:'404', nav:'home'},
  }));
  // Netlify ищет 404.html в корне публикации
  await cp(path.join(OUT,'404','index.html'), path.join(OUT,'404.html'));

  /* sitemap.xml */
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u=>`  <url><loc>${SITE}${u.loc}</loc><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`;
  await writeFile(path.join(OUT,'sitemap.xml'), sitemap);

  /* robots.txt */
  await writeFile(path.join(OUT,'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

  /* rss.xml — рецензии и заметки, свежие сверху, с pubDate */
  const rfc822 = iso => iso ? new Date(iso+'T12:00:00Z').toUTCString() : '';
  const rssItems = [
    ...pubReviews.map(r=>({ title:`${r.title} — ${r.film||r.title}`, link:`${SITE}/review/${r.slug}`, desc:r.excerpt||'', date:r.date||'' })),
    ...pubFeed.map(f=>({ title:f.title, link:`${SITE}/feed/${f.slug}`, desc:f.excerpt||'', date:f.dateISO||'' })),
  ].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>Караван идёт — рецензии и заметки</title>
<link>${SITE}/</link>
<description>Кино глазами социолога: рецензии, заметки и лекционные курсы Карена Аванесяна.</description>
<language>ru</language>
${rssItems.map(i=>`<item><title>${xmlEsc(i.title)}</title><link>${i.link}</link><guid>${i.link}</guid>${i.date?`<pubDate>${rfc822(i.date)}</pubDate>`:''}<description>${xmlEsc(i.desc)}</description></item>`).join('\n')}
</channel></rss>
`;
  await writeFile(path.join(OUT,'rss.xml'), rss);

  /* ЛЕКЦИИ — лендинг /lectures/ как обычная страница сайта (общий шаблон),
     плюс публикация самодостаточных слайд-деков (buildLectures копирует файлы). */
  await emit('/lectures', renderPage({
    meta: buildMeta({ title:'Лекции — авторские курсы Карена Аванесяна', description:'Авторские курсы о кино: марксистская теория кино, психоанализ и теория кино, социология кино.', urlPath:'/lectures/' }),
    appHtml: R.lecturesView(SUBJECTS),
    view: {view:'lectures', nav:'lectures'},
  }));
  urls.push({loc:'/lectures/', priority:'0.8'});
  await buildLectures({ ROOT, OUT, log:(m)=>console.log(m) });

  console.log(`✓ Собрано ${urls.length} страниц + sitemap.xml, rss.xml, robots.txt → dist/`);
}

main().catch(e=>{ console.error(e); process.exit(1); });
