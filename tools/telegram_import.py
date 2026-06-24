#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Перенос контента из Telegram-канала «Караван идёт» в Ленту сайта.

Как пользоваться (один раз настроить, потом повторять при каждом обновлении):

1. Установи Telegram Desktop (десктопное приложение, не телефон).
2. Открой свой канал → ⋮ (меню) → "Экспорт истории чата".
3. В настройках экспорта:
      - Формат: "Машиночитаемый JSON" (Machine-readable JSON)
      - Отметь "Фото", если хочешь перенести картинки
4. Telegram создаст папку с файлом result.json (и папкой photos/).
5. Запусти этот скрипт:

      python3 tools/telegram_import.py "/путь/к/ChatExport/result.json"

Скрипт создаст по записи в папке feed/ для каждого поста и обновит feed/manifest.json.
Существующие записи он не трогает и не дублирует — можно запускать повторно.

Перед публикацией просмотри сгенерированные .md: Telegram-посты часто короткие,
их полезно отредактировать и дать им человеческие заголовки.
"""

import json, sys, os, re, shutil
from datetime import datetime

MONTHS = ["января","февраля","марта","апреля","мая","июня",
          "июля","августа","сентября","октября","ноября","декабря"]

# Папки сайта (относительно корня проекта)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FEED_DIR = os.path.join(ROOT, "feed")
MANIFEST = os.path.join(FEED_DIR, "manifest.json")
IMG_DIR = os.path.join(ROOT, "assets", "feed")

TAG = "Из Telegram"          # метка, под которой посты появятся в ленте
MIN_LEN = 30                 # пропускать совсем короткие посты (символов)


def entities_to_markdown(text):
    """Telegram хранит текст как строку или список фрагментов с форматированием."""
    if isinstance(text, str):
        return text
    out = []
    for part in text:
        if isinstance(part, str):
            out.append(part)
            continue
        t = part.get("type")
        s = part.get("text", "")
        if t == "bold":
            out.append(f"**{s}**")
        elif t in ("italic",):
            out.append(f"*{s}*")
        elif t in ("link", "url"):
            out.append(s)
        elif t == "text_link":
            out.append(f"[{s}]({part.get('href','')})")
        elif t == "code":
            out.append(f"`{s}`")
        elif t in ("blockquote",):
            out.append("> " + s.replace("\n", "\n> "))
        else:
            out.append(s)
    return "".join(out)


def make_slug(dt, idx):
    return f"tg-{dt.strftime('%Y-%m-%d')}-{idx}"


def make_title(body):
    first = next((l.strip() for l in body.splitlines() if l.strip()), "Запись из Telegram")
    first = re.sub(r"[*_`#>\[\]]", "", first)
    return (first[:80] + "…") if len(first) > 80 else first


def make_excerpt(body):
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", body)   # [текст](url) -> текст
    flat = re.sub(r"\s+", " ", re.sub(r"[*_`#>\[\]]", "", text)).strip()
    return (flat[:160] + "…") if len(flat) > 160 else flat


def main():
    if len(sys.argv) < 2:
        print("Укажи путь к result.json:\n  python3 tools/telegram_import.py /путь/result.json")
        sys.exit(1)
    src = sys.argv[1]
    if not os.path.exists(src):
        print(f"Файл не найден: {src}"); sys.exit(1)

    with open(src, encoding="utf-8") as f:
        data = json.load(f)
    export_dir = os.path.dirname(os.path.abspath(src))
    messages = data.get("messages", [])

    os.makedirs(FEED_DIR, exist_ok=True)

    # текущий манифест
    manifest = []
    if os.path.exists(MANIFEST):
        with open(MANIFEST, encoding="utf-8") as f:
            manifest = json.load(f)
    existing = {m["slug"] for m in manifest}

    new_entries = []
    per_day = {}

    for msg in messages:
        if msg.get("type") != "message":
            continue
        body = entities_to_markdown(msg.get("text", "")).strip()
        if len(body) < MIN_LEN:
            continue
        try:
            dt = datetime.fromtimestamp(int(msg["date_unixtime"]))
        except Exception:
            dt = datetime.fromisoformat(msg.get("date", "1970-01-01T00:00:00"))

        day_key = dt.strftime("%Y-%m-%d")
        per_day[day_key] = per_day.get(day_key, 0) + 1
        slug = make_slug(dt, per_day[day_key])
        if slug in existing:
            continue

        # фото, если есть
        img_md = ""
        photo = msg.get("photo")
        if photo:
            src_img = os.path.join(export_dir, photo)
            if os.path.exists(src_img):
                os.makedirs(IMG_DIR, exist_ok=True)
                fname = f"{slug}{os.path.splitext(photo)[1]}"
                shutil.copy(src_img, os.path.join(IMG_DIR, fname))
                img_md = f"\n\n![]({os.path.join('assets','feed',fname).replace(os.sep,'/')})\n"

        date_human = f"{dt.day} {MONTHS[dt.month-1]} {dt.year}"
        title = make_title(body)

        md = (f"---\ntitle: {title}\ndate: {date_human}\ntag: {TAG}\n---\n\n"
              f"{body}{img_md}\n")
        with open(os.path.join(FEED_DIR, f"{slug}.md"), "w", encoding="utf-8") as f:
            f.write(md)

        new_entries.append({
            "slug": slug, "title": title, "date": date_human,
            "tag": TAG, "excerpt": make_excerpt(body),
            "_sort": dt.timestamp()
        })

    # новые записи сортируем по дате (свежие сверху) и кладём НАД существующими,
    # не трогая порядок записей, которые ты добавил вручную
    new_entries.sort(key=lambda x: x["_sort"], reverse=True)
    for m in new_entries:
        m.pop("_sort", None)
    combined = new_entries + manifest

    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(combined, f, ensure_ascii=False, indent=2)

    print(f"Готово. Новых записей: {len(new_entries)}. Всего в ленте: {len(combined)}.")
    if new_entries:
        print("Не забудь просмотреть и отредактировать новые файлы в папке feed/.")


if __name__ == "__main__":
    main()
