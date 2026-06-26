# Telegram Instant View — для сайта «Караван идёт»

«Instant View» (⚡) — это телеграмовский режим чтения, как у telegra.ph: при
отправке ссылки в Telegram под карточкой появляется кнопка, открывающая
статью в чистом, мгновенно загружающемся виде прямо внутри приложения.

Важно понимать три вещи:

1. **Карточки-превью уже работают.** Любая ссылка на рецензию/публикацию/
   фестиваль уже отдаёт заголовок, описание и постер (Open Graph). Это видно
   сразу при вставке ссылки — отдельно настраивать не нужно.
2. **Сам сайт уже мобильный.** Открытая на телефоне страница лёгкая,
   пререндеренная и читается без проблем. Instant View добавляет лишь чтение
   *внутри* Telegram, не открывая браузер.
3. **Instant View нельзя включить из кода.** Он появляется, только когда для
   домена создан и опубликован *шаблон* на платформе Telegram
   (`instantview.telegram.org`). Шаблон живёт там, а не в репозитории, и
   создаётся под вашим аккаунтом Telegram.

---

## Шаги

1. Откройте **https://instantview.telegram.org/** и войдите под своим Telegram.
2. Нажмите **My Templates → Create a new template**.
3. В поле URL вставьте адрес статьи, например:
   `https://karavancinema.netlify.app/review/solaris`
4. Слева появится редактор шаблона, справа — живой предпросмотр. Вставьте
   шаблон ниже (раздел «Шаблон»).
5. Правьте и сразу смотрите предпросмотр. Если какой-то узел «не найден» —
   редактор подсветит строку; поправьте XPath по реальной разметке страницы.
6. Проверьте на нескольких типах страниц, меняя URL вверху:
   - рецензия: `/review/solaris`
   - публикация в СМИ: ведёт на внешний сайт — IV для них не нужен
   - фестивальная заметка: `/festival/<slug>` (если есть)
   - заметка: `/feed/<slug>` (если есть)
7. Когда всё выглядит хорошо — **Mark as ready / Track changes**. Для вас
   ссылка с Instant View заработает сразу. Чтобы IV применялся автоматически
   у всех, шаблон проходит очередь проверки Telegram (для личного сайта это
   не гарантировано, но ваш шаблон по ссылке работает).

---

## Разметка страницы рецензии (что мапит шаблон)

```
<article class="review-wrap">
  <a class="back">← ко всем рецензиям</a>
  <div class="review-head">
    <div class="poster-col"><div class="poster"><img …></div></div>   ← обложка
    <div class="info">
      <h1>«Солярис»</h1>                                              ← фильм
      <div class="sub">1972 · реж. Андрей Тарковский · СССР</div>     ← подзаголовок
      <div class="stars">★★★… 9 / 10</div>
      <a class="fest-badge">#…</a>
    </div>
  </div>
  <h2 class="review-headline">Через космос к человеку…</h2>           ← заголовок
  <div class="prose"> …текст статьи… </div>                           ← тело
</article>
```

В `<head>` каждой статьи уже есть `og:title`, `og:image`,
`og:site_name`, `article:author`, `article:published_time` — шаблон берёт
часть данных из них.

---

## Шаблон (Instant View 2.1) — стартовая версия

Вставьте целиком, затем доведите в редакторе по живому предпросмотру.

```
~version: "2.1"

# Генерируем IV только для страниц-статей (у них есть тело .prose).
# Для списков, главной и внешних публикаций IV не нужен.
?exists: //div[contains(@class, "prose")]

# --- Заголовок ---
# Основной — «рубрика-заголовок» рецензии; запасные — h1 и og:title.
title:    //h2[contains(@class, "review-headline")]
@unless($title): title: //h1
@unless($title): title: //meta[@property="og:title"]/@content

# Подзаголовок — название фильма; кикер — имя сайта.
subtitle: //div[contains(@class, "review-head")]//h1
kicker:   //meta[@property="og:site_name"]/@content

# --- Автор и дата ---
author:     "Карен Аванесян"
author_url: "https://karavancinema.netlify.app/about"
published_date: //meta[@property="article:published_time"]/@content

# --- Обложка ---
cover: //div[contains(@class, "poster")]//img
@unless($cover): cover: //meta[@property="og:image"]/@content

# --- Тело статьи ---
body: //div[contains(@class, "prose")]

# В начало тела добавляем строку «год · режиссёр · страна».
@prepend_to($body): //div[contains(@class, "review-head")]//div[contains(@class, "sub")]

# --- Чистка интерфейса ---
@remove: //a[contains(@class, "back")]
@remove: //nav
@remove: //a[contains(@class, "fest-badge")]
@remove: //div[contains(@class, "stars")]

# Стандартная очистка скриптов/служебного.
@remove: //script
@remove: //style
```

> Синтаксис IV капризен; точные имена функций (`@prepend_to`, `@unless`,
> `?exists`) проверяйте по подсветке редактора и правьте на месте — живой
> предпросмотр показывает результат сразу.
