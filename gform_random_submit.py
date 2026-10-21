#!/usr/bin/env python3
"""
Užpildo Google Forms apklausą atsitiktiniais testiniais atsakymais.

Naudojimas (paleisk savo kompiuteryje, kur pasiekiamas docs.google.com):

    python3 gform_random_submit.py                 # 400 atsakymų
    python3 gform_random_submit.py --count 50       # kitoks kiekis
    python3 gform_random_submit.py --dry-run        # nieko nesiunčia, tik parodo
    python3 gform_random_submit.py --delay 1.5      # pauzė sekundėmis tarp pateikimų

Reikia tik standartinės Python 3 bibliotekos (jokių pip install).
"""

import argparse
import json
import random
import re
import sys
import time
import urllib.parse
import urllib.request

FORM_URL = (
    "https://docs.google.com/forms/d/e/"
    "1FAIpQLSezwOAImSvXEYGNJsA4zQNxnKKhTHuvw7XtktppUABfynNxeQ/viewform"
)

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"

# Atsitiktiniam tekstui
WORDS = (
    "labas rytas diena geras puikus neblogai gal taip ne nezinau idomu patiko "
    "testas atsakymas apklausa greitai letai vidutiniskai sutinku nesutinku "
    "kartais daznai retai visada niekada placiau komentaras pastaba nuomone"
).split()


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def extract_form_data(html):
    """Ištraukia FB_PUBLIC_LOAD_DATA_ JSON masyvą iš formos HTML."""
    m = re.search(r"FB_PUBLIC_LOAD_DATA_\s*=\s*(\[.*?\]);", html, re.DOTALL)
    if not m:
        raise RuntimeError(
            "Nepavyko rasti FB_PUBLIC_LOAD_DATA_. Patikrink, ar nuoroda teisinga "
            "ir ar forma vieša (priima atsakymus)."
        )
    return json.loads(m.group(1))


def random_text(paragraph=False):
    n = random.randint(5, 20) if paragraph else random.randint(1, 4)
    s = " ".join(random.choice(WORDS) for _ in range(n))
    return s.capitalize()


def build_fields(form_data):
    """
    Grąžina laukų sąrašą: kiekvienas – dict su entry id, tipu ir galimais variantais.
    Google Forms struktura: form_data[1][1] = klausimų masyvas.
    Klausimo tipai (indeksas [3]):
      0 short, 1 paragraph, 2 radio, 3 dropdown, 4 checkbox,
      5 linear scale, 7 grid, 9 date, 10 time
    """
    fields = []
    questions = form_data[1][1]
    for q in questions:
        qtype = q[3]
        if not q[4]:
            continue  # nera atsakomu daliu (pvz. antrastes blokas)
        for entry in q[4]:
            entry_id = entry[0]
            required = bool(entry[2]) if len(entry) > 2 else False
            options = []
            if entry[1]:
                options = [o[0] for o in entry[1]]
            fields.append(
                {
                    "id": entry_id,
                    "type": qtype,
                    "options": options,
                    "required": required,
                    "title": q[1] or "",
                }
            )
    return fields


def random_answer(field):
    """Grąžina (name, value) poras (listą) vienam laukui."""
    key = f"entry.{field['id']}"
    t = field["type"]
    opts = [o for o in field["options"] if o]  # be tusciu ("Kita")

    if t in (2, 3):  # radio / dropdown – vienas variantas
        if opts:
            return [(key, random.choice(opts))]
        return [(key, random_text())]
    if t == 4:  # checkbox – 1+ variantai
        if opts:
            k = random.randint(1, len(opts))
            for v in random.sample(opts, k):
                pass
            return [(key, v) for v in random.sample(opts, k)]
        return [(key, random_text())]
    if t == 5:  # linear scale – reiksmes yra options
        if opts:
            return [(key, random.choice(opts))]
        return [(key, str(random.randint(1, 5)))]
    if t == 1:  # paragraph
        return [(key, random_text(paragraph=True))]
    if t == 9:  # date
        y = random.randint(2023, 2026)
        mth = random.randint(1, 12)
        day = random.randint(1, 28)
        return [
            (f"{key}_year", str(y)),
            (f"{key}_month", str(mth)),
            (f"{key}_day", str(day)),
        ]
    if t == 10:  # time
        return [
            (f"{key}_hour", str(random.randint(0, 23))),
            (f"{key}_minute", str(random.randint(0, 59))),
        ]
    # 0 short answer ir viskas kita
    return [(key, random_text())]


def submit(form_response_url, pairs):
    data = urllib.parse.urlencode(pairs).encode()
    req = urllib.request.Request(
        form_response_url,
        data=data,
        headers={"User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=400)
    ap.add_argument("--delay", type=float, default=0.8, help="pauze tarp pateikimu, s")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    print("Siunciu formos puslapi...")
    html = fetch(FORM_URL)
    form_data = extract_form_data(html)
    fields = build_fields(form_data)

    response_url = FORM_URL.replace("/viewform", "/formResponse")

    print(f"Rasta laukų: {len(fields)}")
    for f in fields:
        tn = {0: "trumpas", 1: "ilgas", 2: "radio", 3: "sarasas",
              4: "varneles", 5: "skale", 9: "data", 10: "laikas"}.get(f["type"], f["type"])
        req = " [privalomas]" if f["required"] else ""
        print(f"  entry.{f['id']}  ({tn}){req}  {f['title'][:50]}")

    if args.dry_run:
        print("\n--- DRY RUN: pavyzdinis atsakymas ---")
        pairs = []
        for f in fields:
            pairs += random_answer(f)
        for k, v in pairs:
            print(f"  {k} = {v}")
        print("\nNieko neišsiųsta (--dry-run).")
        return

    ok = 0
    fail = 0
    for i in range(1, args.count + 1):
        pairs = []
        for f in fields:
            pairs += random_answer(f)
        try:
            status = submit(response_url, pairs)
            if status == 200:
                ok += 1
            else:
                fail += 1
                print(f"  #{i}: statusas {status}")
        except Exception as e:
            fail += 1
            print(f"  #{i}: KLAIDA {e}")
        if i % 25 == 0:
            print(f"  ... pateikta {i}/{args.count} (ok={ok}, klaidu={fail})")
        time.sleep(args.delay)

    print(f"\nBaigta. Sekmingai: {ok}, nepavyko: {fail}")


if __name__ == "__main__":
    main()
