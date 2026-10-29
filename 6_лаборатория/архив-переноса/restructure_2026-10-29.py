#!/usr/bin/env python3
"""Перенос папок Dark Mode Lab на понятную структуру (29.10.2026). Один раз; потом файл лежит в 6_лаборатория/архив-переноса/.
restructure_2026-10-29.py <корень> --git   : в репозитории (git mv / git rm) + перенос неотслеживаемых файлов
restructure_2026-10-29.py <корень> --mac   : после git pull — переносит оставшиеся (неотслеживаемые) файлы, мусор → Корзина
Черновики → _черновики/, отклонённое → Корзина (на Маке) или удаление из git (в облаке)."""
import os, sys, re, shutil, subprocess, time, pathlib

EP = {"2026-10-27_perytons": "2026-10-27_перитоны"}

def dest(rel):
    """→ (действие, новый путь): move | draft | trash"""
    p = rel
    def m(a):
        return p == a or p.startswith(a + "/")
    if m(".tmp_prev") or "/__pycache__" in p or p.startswith("scripts/__pycache__") or p.endswith(".pyc"):
        return "trash", None
    # 1_правила
    for a, b in [("docs/устав.md", "1_правила/устав.md"), ("docs/channel-description.md", "1_правила/описание-канала.md"),
                 ("art/style_bible.txt", "1_правила/библия-стиля.txt"), ("art/style-reference.html", "1_правила/эталон-стиля.html"),
                 ("art/style-reference.png", "1_правила/эталон-стиля.png")]:
        if p == a: return "move", b
    # 2_бренд
    for a, b in [("assets/brand/final/avatar.png", "2_бренд/аватар.png"), ("assets/brand/final/banner-ru.jpg", "2_бренд/баннер-ru.jpg"),
                 ("assets/brand/final/banner-en.jpg", "2_бренд/баннер-en.jpg"), ("assets/brand/final/README.md", "2_бренд/README.md"),
                 ("assets/memes/CATALOG.md", "2_бренд/мемы-каталог.md"), ("assets/gifs/CATALOG.md", "2_бренд/гифки-каталог.md")]:
        if p == a: return "move", b
    if m("assets/brand") or m("assets/common/fonts/candidates"): return "trash", None
    for a, b in [("assets/common/fonts", "2_бренд/шрифты"), ("assets/common/frames", "2_бренд/рамки"), ("assets/common/textures", "2_бренд/фактуры")]:
        if m(a): return "move", b + p[len(a):]
    if m("assets/memes") or m("assets/gifs"): return "trash", None
    # 4_инструменты
    for a, b in [("templates/dml", "4_инструменты/движок-глав"), ("templates/obsion", "4_инструменты/анимация-obsion")]:
        if m(a): return "move", b + p[len(a):]
    if m("templates/scenes"): return "trash", None
    tools = {"find_assets.py": "поиск-материалов", "kym.py": "поиск-материалов", "screenshot.py": "поиск-материалов",
             "gif_frames.py": "поиск-материалов", "yt_check.py": "поиск-материалов", "glitch.py": "бренд",
             "music_mix.py": "звук"}
    if p.startswith("scripts/"):
        n = p[len("scripts/"):]
        if n in tools: return "move", f"4_инструменты/{tools[n]}/{n}"
        if n == "new_episode.sh": return "move", "4_инструменты/новый-выпуск.sh"
        if n == "setup_mac_render.sh": return "move", "4_инструменты/движок-глав/настройка-мака.sh"
        if n == "restructure_2026-10-29.py": return "move", "6_лаборатория/архив-переноса/restructure_2026-10-29.py"
        if n == "README.md": return "trash", None
    # 5_готовые-видео
    for a, b in [("видео/обложки", "5_готовые-видео/обложки"), ("видео/шортсы", "5_готовые-видео/шортсы")]:
        if m(a): return "move", b + p[len(a):]
    if m("видео"): return "trash", None
    # 6_лаборатория
    for a, b in [("lab/diary.md", "6_лаборатория/дневник.md"), ("lab/journal.md", "6_лаборатория/журнал.md"),
                 ("lab/topics.md", "6_лаборатория/банк-тем.md"), ("lab/yt_check.md", "6_лаборатория/проверка-тем.md")]:
        if p == a: return "move", b
    if p.startswith("lab/yt_topics"): return "move", "6_лаборатория/списки-тем/" + p[len("lab/"):]
    # выпуски
    if m("episodes/2026-10-27_knight-capital"):
        q = p[len("episodes/2026-10-27_knight-capital/"):]
        if q.startswith("script/") or q in ("plan/titles.md", "README.md"):
            return "move", "6_лаборатория/резерв-тем/knight-capital/" + q.split("/")[-1]
        return "trash", None
    if m("episodes/_template"):
        q = p[len("episodes/_template"):]
        q = q.replace("/plan", "/план", 1).replace("/source-media/real", "/материалы/настоящие", 1).replace("/source-media/memes/CATALOG.md", "/материалы/мемы/CATALOG.md", 1)
        if "/source-media" in q: q = q.replace("/source-media", "/материалы", 1)
        return "move", "3_выпуски/_шаблон" + q
    for old, new in EP.items():
        root = f"episodes/{old}"
        if not m(root): continue
        q = p[len(root) + 1:] if p != root else ""
        E = f"3_выпуски/{new}"
        if q == "README.md": return "move", f"{E}/README.md"
        if q.startswith("script/"): return "move", f"{E}/сценарий/" + q[7:]
        if q.startswith("plan/"):
            n = q[5:]
            if n in ("creative.md", "titles.md", "safety.md", "publish.md"): return "move", f"{E}/план/{n}"
            return "trash", None
        if q.startswith("source-media/"):
            n = q[len("source-media/"):]
            if n == "real/CATALOG.md": return "move", f"{E}/материалы/каталог.md"
            if n == "real/sources.csv": return "move", f"{E}/материалы/источники.csv"
            if n.startswith("real/_gif") or "/candidates" in n: return "trash", None
            for a, b in [("real/", "настоящие/"), ("cutouts/", "вырезки/"), ("memes/", "мемы/"), ("music/", "музыка/")]:
                if n.startswith(a): return "move", f"{E}/материалы/{b}" + n[len(a):]
            return "trash", None
        if q.startswith("thumbs/"):
            n = q[7:]
            mp = {"final.html": "превью.html", "dml_mark.png": "dml_mark.png", "thumb-fru.jpg": "превью-ru.jpg", "thumb-fen.jpg": "превью-en.jpg"}
            return ("move", f"{E}/превью/{mp[n]}") if n in mp else ("trash", None)
        if q.startswith("storyboard/") or q.startswith("_frames"): return "trash", None
        if q.startswith("build/"):
            n = q[6:]
            if n in ("render_queue.sh", "concat.txt", "assemble.log", "render_mac.log") or n.startswith("watch_full") or re.search(r"(^|/)(watch[^/]*/|_frames/|render\.log$|audio(\.raw)?\.wav$|[^/]+_draft\.mp4$|hook_draft_v\d\.mp4$|hook_720\.mp4$)", n):
                return "trash", None
            if n == "perytons_draft_music.mp4": return "move", f"{E}/готово/перитоны_RU_черновик.mp4"
            if n == "perytons_draft_full.mp4": return "move", f"{E}/сборка/_без-музыки.mp4"
            return "move", f"{E}/сборка/" + n
        return "trash", None
    return None, None   # корень и прочее — не трогаем


def walk(root):
    for d, ds, fs in os.walk(root):
        ds[:] = [x for x in ds if x not in (".git", "node_modules", "_черновики") and not re.match(r"^[1-6]_", x) and not (d == root and x == "_черновики")]
        if d == root:
            ds[:] = [x for x in ds if x in ("docs", "art", "assets", "episodes", "scripts", "templates", "видео", "lab", ".tmp_prev")]
        for f in fs:
            yield os.path.relpath(os.path.join(d, f), root)


def main():
    root, mode = sys.argv[1], sys.argv[2]
    os.chdir(root)
    tracked = set(subprocess.run(["git", "ls-files", "-z"], capture_output=True).stdout.decode().split("\0")) if mode == "--git" else set()
    trash = os.path.expanduser(f"~/.Trash/darkmodelab-уборка-{time.strftime('%Y%m%d-%H%M%S')}") if mode == "--mac" else os.path.join(root, "_черновики/_в-корзину")
    n = {"move": 0, "trash": 0, "skip": 0}
    for rel in sorted(walk(".")):
        rel = rel[2:] if rel.startswith("./") else rel
        act, new = dest(rel)
        if act is None: n["skip"] += 1; continue
        if act == "trash":
            if rel in tracked: subprocess.run(["git", "rm", "-q", "--cached", rel], check=True)
            t = os.path.join(trash, rel); os.makedirs(os.path.dirname(t), exist_ok=True); shutil.move(rel, t); n["trash"] += 1; continue
        os.makedirs(os.path.dirname(new) or ".", exist_ok=True)
        if os.path.exists(new):   # уже на месте (git pull) — старую копию в корзину
            t = os.path.join(trash, rel); os.makedirs(os.path.dirname(t), exist_ok=True); shutil.move(rel, t); n["trash"] += 1; continue
        if rel in tracked: subprocess.run(["git", "mv", rel, new], check=True)
        else: shutil.move(rel, new)
        n["move"] += 1
    # пустые старые папки
    for d in ("docs", "art", "assets", "episodes", "scripts", "templates", "видео", "lab", ".tmp_prev"):
        for dp, ds, fs in (os.walk(d, topdown=False) if os.path.isdir(d) else []):
            for f in fs:
                if f in (".gitkeep", ".DS_Store"):
                    pth = os.path.join(dp, f)
                    if pth in tracked: subprocess.run(["git", "rm", "-q", pth])
                    elif os.path.exists(pth): os.remove(pth)
            try: os.rmdir(dp)
            except OSError: pass
    print(n, "корзина:", trash)

if __name__ == "__main__":
    main()
