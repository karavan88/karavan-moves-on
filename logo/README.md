# Караван идёт — логотип

Айдентика авторского журнала о кино. Сюжет вырос из аватара канала: свет
кинопроектора как лунный луч, караван, идущий через ночь.

## Файлы

| Файл | Назначение |
|------|------------|
| `karavan-icon.svg` | Основной знак (круглая печать). Вектор, масштабируется без потерь. |
| `karavan-icon-1024.png` … `-256.png` | Знак в растре: аватар, соцсети, превью. |
| `apple-touch-icon.png` | Иконка для iOS (180×180). |
| `favicon-48.png` / `-32.png` / `-16.png` | Фавиконы для вкладки браузера. |
| `karavan-signature.svg` / `.png` | Широкая подпись (проектор + караван + луна). |
| `karavan-icon-light.svg`, `karavan-signature-light.svg` | Версии для светлого фона. |
| `karavan-avatar-notext.png` / `.svg` | Оригинальный аватар (640×640) с убранной надписью «КАРАВАН ИДЁТ». SVG самодостаточный (картинка встроена). |

PNG-знаки имеют прозрачные углы — кладутся на любой фон.

## Цвета

| Роль | HEX |
|------|-----|
| Ночь (фон) | `#0E1D36` |
| Золото (акцент, рамка) | `#CDA14A` |
| Луна / светлый | `#F3E9CF` |
| Силуэты | `#070F1E` |

Для светлого фона: фон `#F3E9CF`, акцент `#9C7A33`, силуэты `#16263F`.

## Шрифт

- **Заголовок / название** — Playfair Display (600).
- **Подзаголовок / интерфейс** — Manrope (700, разрядка).

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Manrope:wght@400;600;700&display=swap" rel="stylesheet">
```

## Шапка сайта (знак + текст)

Логотип в шапке собирается из иконки и живого текста — так он чёткий на любом
экране и доступен для поиска.

```html
<a class="brand" href="/">
  <img src="/logo/karavan-icon.svg" width="50" height="50" alt="">
  <span class="brand__name">КАРАВАН ИДЁТ</span>
  <span class="brand__sub">ЖУРНАЛ О КИНО</span>
</a>
```

```css
.brand { display:grid; grid-template-columns:auto auto; grid-template-rows:auto auto;
  column-gap:14px; align-items:center; text-decoration:none; }
.brand img { grid-row:1 / 3; }
.brand__name { font-family:"Playfair Display",serif; font-weight:600; font-size:23px;
  letter-spacing:.03em; color:#F3E9CF; line-height:1; }
.brand__sub  { font-family:"Manrope",sans-serif; font-weight:700; font-size:8.5px;
  letter-spacing:.30em; color:#CDA14A; margin-top:5px; }
```

## Фавикон

```html
<link rel="icon" type="image/png" sizes="32x32" href="/logo/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/logo/favicon-16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/logo/apple-touch-icon.png">
```

## Охранное поле

Вокруг знака оставляйте отступ не меньше половины его диаметра. Минимальный
размер знака — 24 px (читается до 16 px в виде фавикона).
