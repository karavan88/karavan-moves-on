#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Помощник TMDB: по названию фильма достаёт постер, кадр-фон и метаданные
и печатает готовые поля для рецензии (front-matter + строку для manifest.json).

Ключ TMDB НЕ хранится в проекте — ты передаёшь его через переменную окружения,
поэтому на живой сайт он никогда не попадает.

Использование:

    export TMDB_TOKEN='твой_read_access_token'      # v4 (длинный, начинается с eyJ...)
    python3 tools/tmdb.py "Amma Ariyan" 1986
    python3 tools/tmdb.py "Солярис" 1972 --lang ru-RU

Год — необязателен, но уточняет поиск. Скрипт ничего не меняет в файлах,
только печатает — ты копируешь нужное в reviews/<фильм>.md и reviews/manifest.json.
"""

import os, sys, json, urllib.request, urllib.parse

IMG = "https://image.tmdb.org/t/p/w500"
BACK = "https://image.tmdb.org/t/p/w1280"


def api(path, params):
    token = os.environ.get("TMDB_TOKEN")
    key = os.environ.get("TMDB_KEY")
    if key:
        params = dict(params, api_key=key)
    url = "https://api.themoviedb.org/3" + path + "?" + urllib.parse.urlencode(params)
    headers = {"Authorization": "Bearer " + token} if token else {}
    req = urllib.request.Request(url, headers=headers)
    return json.load(urllib.request.urlopen(req, timeout=20))


def main():
    if not os.environ.get("TMDB_TOKEN") and not os.environ.get("TMDB_KEY"):
        print("Задай ключ:  export TMDB_TOKEN='...'  (или TMDB_KEY='...')")
        sys.exit(1)
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    lang = "ru-RU"
    if "--lang" in sys.argv:
        lang = sys.argv[sys.argv.index("--lang") + 1]
    if not args:
        print('Использование: python3 tools/tmdb.py "Название" [год]')
        sys.exit(1)
    query = args[0]
    year = args[1] if len(args) > 1 else None

    params = {"query": query, "language": lang}
    if year:
        params["year"] = year
    results = api("/search/movie", params).get("results", [])
    if not results:
        print("Ничего не найдено. Попробуй другое написание или убери год.")
        sys.exit(0)

    m = results[0]
    mid = m["id"]
    details = api(f"/movie/{mid}", {"language": lang})
    credits = api(f"/movie/{mid}/credits", {"language": lang})
    directors = [c["name"] for c in credits.get("crew", []) if c.get("job") == "Director"]
    countries = [c["name"] for c in details.get("production_countries", [])]
    title = m.get("title") or m.get("original_title")
    year_out = (m.get("release_date") or "")[:4]
    poster = IMG + m["poster_path"] if m.get("poster_path") else ""
    backdrop = BACK + m["backdrop_path"] if m.get("backdrop_path") else ""

    print("\n=== Нашёл ===")
    print(f"{title}  ({year_out})  TMDB id {mid}")
    print(f"режиссёр: {', '.join(directors) or '—'}")
    print(f"страна:   {', '.join(countries) or '—'}")
    print(f"хронометраж: {details.get('runtime') or '—'} мин\n")

    print("--- для front-matter в reviews/<файл>.md ---")
    print(f"title: {title}")
    print(f"year: {year_out}")
    print(f"director: {', '.join(directors)}")
    print(f"country: {', '.join(countries)}")
    print(f"poster: {poster}")
    print(f"backdrop: {backdrop}\n")

    print("--- строка для reviews/manifest.json ---")
    print(json.dumps({
        "slug": "ЗАМЕНИ-меня",
        "title": title, "year": year_out,
        "director": ", ".join(directors),
        "rating": "", "poster": poster,
        "excerpt": "Короткое описание для карточки."
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
