#!/usr/bin/env python3
"""Собирает data/terms.js из текстовых файлов terms-src/*.txt.

Формат строк:
  @ id | Название ветви | подзаголовок | id раздела вопросов | ключи источников
  ## Подгруппа
  - Термин {греч.} :: Определение [[Ин 1:1]] => Связанный; Другой
  ! Термин :: ...      (ересь или учение, отвергнутое Церковью)
  = Термин             (ссылка на термин, описанный в другой ветви)

Запуск:  python3 tools/build_terms.py
"""
import json, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "terms-src"
OUT = ROOT / "data" / "terms.js"

LINE = re.compile(r"^([-!])\s+(.+?)(?:\s+\{(.+?)\})?\s+::\s+(.+?)(?:\s+=>\s+(.+))?$")

branches, terms, order, refs_pending, errors, chasti = [], {}, [], [], [], []

for f in sorted(SRC_DIR.glob("*.txt")):
    br = grp = None
    for n, raw in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or (line.startswith("#") and not line.startswith("##")):
            continue
        where = f"{f.name}:{n}"
        if line.startswith("&"):
            pid, title, slot, brs = [p.strip() for p in line[1:].split("|")]
            chasti.append({"id": pid, "title": title, "c": int(slot),
                          "branches": [b.strip() for b in brs.split(",")]})
            continue
        if line.startswith("@"):
            parts = [p.strip() for p in line[1:].split("|")]
            br = {"id": parts[0], "title": parts[1], "sub": parts[2],
                  "qa": parts[3], "src": parts[4].split(",") if len(parts) > 4 else [],
                  "groups": []}
            branches.append(br)
            continue
        if line.startswith("##"):
            grp = {"name": line[2:].strip(), "items": []}
            br["groups"].append(grp)
            continue
        if line.startswith("="):
            name = line[1:].strip()
            grp["items"].append({"ref": name})
            refs_pending.append((name, where))
            continue
        m = LINE.match(line)
        if not m:
            errors.append(f"{where}: не разобрана строка: {line[:60]}")
            continue
        mark, name, greek, definition, rel = m.groups()
        if name in terms:
            errors.append(f"{where}: повтор термина «{name}»")
            continue
        terms[name] = {
            "t": name, "g": greek or "", "d": definition.strip(),
            "x": 1 if mark == "!" else 0,
            "b": br["id"], "grp": grp["name"],
            "rel": [r.strip() for r in rel.split(";")] if rel else [],
            "_where": where,
        }
        order.append(name)
        grp["items"].append({"t": name})

# Короткие имена: «Денница» → «Денница (Люцифер)», если такое сокращение однозначно
base = {}
for name in terms:
    b = re.sub(r"\s*\(.*?\)\s*$", "", name)
    if b != name:
        base.setdefault(b, []).append(name)
def resolve(r):
    if r in terms:
        return r
    cands = base.get(r, [])
    return cands[0] if len(cands) == 1 else r
for t in terms.values():
    t["rel"] = [resolve(r) for r in t["rel"]]
refs_pending = [(resolve(n), w) for n, w in refs_pending]
for br in branches:
    for g in br["groups"]:
        for i in g["items"]:
            if "ref" in i:
                i["ref"] = resolve(i["ref"])

# Проверка ссылок
for name, where in refs_pending:
    if name not in terms:
        errors.append(f"{where}: ссылка на неизвестный термин «{name}»")
missing = {}
for t in terms.values():
    for r in t["rel"]:
        if r not in terms:
            missing.setdefault(r, []).append(t["_where"])
for r, ws in sorted(missing.items()):
    errors.append(f"нет термина «{r}» (упомянут: {', '.join(ws[:3])})")

if errors:
    print("\n".join(errors))
    print(f"\nОшибок: {len(errors)}")
    sys.exit(1)

# Индексы
idx = {name: i for i, name in enumerate(order)}
out_terms = []
for name in order:
    t = terms[name]
    out_terms.append({
        "t": t["t"], "g": t["g"], "d": t["d"], "x": t["x"],
        "b": t["b"], "grp": t["grp"],
        "rel": sorted({idx[r] for r in t["rel"] if r != name}),
    })
out_branches = []
for br in branches:
    out_branches.append({
        "id": br["id"], "title": br["title"], "sub": br["sub"], "qa": br["qa"], "src": br["src"],
        "groups": [{"name": g["name"],
                    "items": [(idx[i["t"]] if "t" in i else {"ref": idx[i["ref"]]}) for i in g["items"]]}
                   for g in br["groups"]],
    })

bids = [b["id"] for b in out_branches]
used = [b for c in chasti for b in c["branches"]]
for b in bids:
    if b not in used:
        print(f"ветвь «{b}» не входит ни в одну часть"); sys.exit(1)
for b in used:
    if b not in bids:
        print(f"часть ссылается на неизвестную ветвь «{b}»"); sys.exit(1)
payload = {"parts": chasti, "branches": out_branches, "terms": out_terms}
js = ("/* Сгенерировано tools/build_terms.py из terms-src/*.txt — правьте исходники, не этот файл. */\n"
      "const TERMS_DATA = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n")
OUT.write_text(js, encoding="utf-8")
links = sum(len(t["rel"]) for t in out_terms)
print(f"Ветвей: {len(out_branches)}, подгрупп: {sum(len(b['groups']) for b in out_branches)}, "
      f"терминов: {len(out_terms)}, связей: {links}, ересей/заблуждений: {sum(t['x'] for t in out_terms)}")
print(f"Записано: {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} КБ)")
