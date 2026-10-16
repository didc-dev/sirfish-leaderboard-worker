"""Render the weekly leaderboard image for the Sir Fish building.

Usage: python render_board.py <rows.json> <out.png>
rows.json: {"rows": [{"name": str, "floor": int, "points": int}], "updated": "...", "weekEnds": "..."}
Ornate gold-on-navy style matching the game UI. 1024x792, emissive in-game (dark = unlit).
"""
import json
import math
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1024, 792  # panel on the building is 3.1 x 2.4 m
FONTS = "C:/Windows/Fonts/"
GOLD = (255, 214, 102)
GOLD_DARK = (176, 122, 32)
NAVY = (10, 22, 48)
TEXT = (232, 240, 255)
MEDALS = [(255, 207, 64), (205, 220, 235), (214, 140, 80)]


# Windows fonts locally; on Linux (GitHub Actions) the open Liberation/DejaVu equivalents.
LINUX = {
    "georgiab.ttf": ["/usr/share/fonts/truetype/liberation2/LiberationSerif-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"],
    "segoeuib.ttf": ["/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"],
    "segoeui.ttf": ["/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"],
}


def font(name, size, fallback="segoeuib.ttf"):
    for f in (name, fallback, "arialbd.ttf"):
        for path in [FONTS + f] + LINUX.get(f, []):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default(size)


def gold_text(img, xy, text, f, anchor="mm"):
    """Gold gradient text with a dark outline and a soft glow."""
    d = ImageDraw.Draw(img, "RGBA")
    box = d.textbbox(xy, text, font=f, anchor=anchor, stroke_width=4)
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(glow).text(xy, text, font=f, anchor=anchor, fill=(255, 190, 60, 150))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(9)))
    d.text(xy, text, font=f, anchor=anchor, fill=(40, 20, 0), stroke_width=4, stroke_fill=(40, 20, 0))
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).text(xy, text, font=f, anchor=anchor, fill=255)
    grad = Image.new("RGBA", img.size)
    gd = ImageDraw.Draw(grad)
    y0, y1 = box[1], max(box[1] + 1, box[3])
    for y in range(y0, y1):
        t = (y - y0) / (y1 - y0)
        c = tuple(int(a + (b - a) * t) for a, b in zip((255, 246, 200), GOLD_DARK))
        gd.line([(box[0], y), (box[2], y)], fill=c + (255,))
    img.paste(grad, (0, 0), mask)


def panel(img, box, radius, fill, outline=None, width=1):
    """Translucent rounded box; Pillow overwrites alpha on RGBA images, so blend through a layer."""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle(box, radius, fill=fill, outline=outline, width=width)
    img.alpha_composite(layer)


def frame(d):
    d.rounded_rectangle([6, 6, W - 7, H - 7], 28, outline=GOLD_DARK, width=6)
    d.rounded_rectangle([16, 16, W - 17, H - 17], 22, outline=GOLD, width=2)
    for cx, cy in ((34, 34), (W - 35, 34), (34, H - 35), (W - 35, H - 35)):
        d.regular_polygon((cx, cy, 11), 4, rotation=45, fill=GOLD)


def fmt(n):
    return f"{n:,}".replace(",", " ")


def render(data, out):
    img = Image.new("RGBA", (W, H), NAVY + (255,))
    bg = ImageDraw.Draw(img, "RGBA")
    for y in range(H):  # deep-water vertical gradient
        t = y / H
        bg.line([(0, y), (W, y)], fill=(int(8 + 10 * t), int(30 - 12 * t), int(70 - 30 * t), 255))
    for i in range(14):  # faint light shafts
        x = 60 + i * 72
        if i % 3 == 0:
            layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
            ImageDraw.Draw(layer).polygon([(x, 0), (x + 26, 0), (x - 70, H), (x - 110, H)], fill=(60, 120, 190, 38))
            img.alpha_composite(layer)
    img = img.filter(ImageFilter.GaussianBlur(2)).convert("RGBA")
    d = ImageDraw.Draw(img, "RGBA")
    frame(d)
    gold_text(img, (W // 2, 78), "WEEKLY TOWER RANKS", font("georgiab.ttf", 62))
    d = ImageDraw.Draw(img, "RGBA")
    d.line([(220, 130), (W - 220, 130)], fill=GOLD_DARK, width=3)
    d.regular_polygon((W // 2, 130, 9), 4, rotation=45, fill=GOLD)

    rows = data.get("rows", [])[:5]
    name_f, num_f, small_f = font("georgiab.ttf", 44), font("segoeuib.ttf", 38), font("segoeui.ttf", 24)
    top, step = 158, 94
    owner = data.get("owner")
    if owner:  # the lot owner's best: shown, never ranked (platform rule)
        cy = top + (step - 10) // 2
        panel(img, [60, top, W - 61, top + step - 10], 14, (255, 214, 102, 26), (120, 90, 30, 255))
        d.text((98, cy), "*", font=font("georgiab.ttf", 40), fill=GOLD, anchor="mm")
        d.text((140, cy), owner["name"][:18], font=name_f, fill=GOLD, anchor="lm")
        tag_x = 150 + d.textlength(owner["name"][:18], font=name_f)
        d.text((tag_x, cy + 2), "owner", font=small_f, fill=(170, 190, 225), anchor="lm")
        d.text((W - 440, cy), f"Floor {owner['floor']}", font=num_f, fill=(150, 220, 255), anchor="lm")
        d.text((W - 84, cy), fmt(owner["points"]), font=num_f, fill=GOLD, anchor="rm")
        top += step
    if not rows and not owner:
        gold_text(img, (W // 2, H // 2 + 10), "A new week begins", font("georgiab.ttf", 44))
        d = ImageDraw.Draw(img, "RGBA")
        d.text((W // 2, H // 2 + 66), "Be the first climber on the board", font=small_f, fill=TEXT, anchor="mm")
    for i, r in enumerate(rows):
        y = top + i * step
        panel(img, [60, y, W - 61, y + step - 10], 14, (255, 255, 255, 18) if i % 2 == 0 else (0, 0, 0, 60))
        cy = y + (step - 10) // 2
        if i < 3:
            d.ellipse([78, cy - 20, 118, cy + 20], fill=MEDALS[i], outline=(60, 35, 0), width=3)
            d.text((98, cy), str(i + 1), font=font("georgiab.ttf", 24), fill=(50, 28, 0), anchor="mm")
        else:
            d.text((98, cy), str(i + 1), font=font("georgiab.ttf", 26), fill=TEXT, anchor="mm")
        name = r["name"][:18]
        d.text((140, cy), name, font=name_f, fill=MEDALS[i] if i < 3 else TEXT, anchor="lm")
        d.text((W - 440, cy), f"Floor {r['floor']}", font=num_f, fill=(150, 220, 255), anchor="lm")
        d.text((W - 84, cy), fmt(r["points"]), font=num_f, fill=GOLD, anchor="rm")
    foot = f"Updated {data.get('updated', '')}  -  week ends {data.get('weekEnds', '')}  -  press Enter to climb"
    d.text((W // 2, H - 40), foot, font=small_f, fill=(170, 190, 225), anchor="mm")
    img.convert("RGB").save(out, optimize=True)


if __name__ == "__main__":
    render(json.load(open(sys.argv[1], encoding="utf-8")), sys.argv[2])
    print("BOARD", sys.argv[2])
