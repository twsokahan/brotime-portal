"""把活動的卡片 PDF 切成網站用的圖。

用法：python3 tools/cards.py tools/cards/<activity>.json
spec 裡 box 是頁面寬高的比例 [x0, y0, x1, y1]；og 為 true 的組另外輸出 LINE 預覽用的 JPEG。
卡片可加 "pad": {"aspect": [寬, 高], "color": "#rrggbb"}，裁完後置中補底色到這個比例（例如當首頁 4:5 封面）。
tools/watermark.json 的 enabled 為 true 時（正式公開前），每張圖都疊上創價班徽章＋twsokahan 的浮水印，
畫法在 sokahan-propalsal-2026/plan-builder/watermark.py。
"""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parent.parent
WATERMARK = json.loads((REPO / "tools" / "watermark.json").read_text(encoding="utf-8"))["enabled"]
if WATERMARK:
    sys.path.insert(0, str(Path.home() / "code" / "sokahan-propalsal-2026" / "plan-builder"))
    import watermark
FULL_WIDTH, THUMB_WIDTH, WEBP_QUALITY = 900, 240, 80
OG_SIZE, OG_CARD_HEIGHT, OG_QUALITY = (1200, 630), 570, 85
PAPER = "#f7f0e3"
CONTACT_CARD_HEIGHT, CONTACT_GAP, CONTACT_COLUMNS = 360, 24, 6


def render_page(pdf, page, dpi, prefix):
    subprocess.run(
        ["pdftoppm", "-r", str(dpi), "-f", str(page), "-l", str(page), "-png", "-singlefile", pdf, str(prefix)],
        check=True,
    )
    return Image.open(f"{prefix}.png").convert("RGB")


def crop(page_image, box):
    width, height = page_image.size
    x0, y0, x1, y1 = box
    return page_image.crop((round(x0 * width), round(y0 * height), round(x1 * width), round(y1 * height)))


def padded(image, pad):
    aspect_width, aspect_height = pad["aspect"]
    width = max(image.width, round(image.height * aspect_width / aspect_height))
    height = max(image.height, round(image.width * aspect_height / aspect_width))
    canvas = Image.new("RGB", (width, height), pad["color"])
    canvas.paste(image, ((width - image.width) // 2, (height - image.height) // 2))
    return canvas


def scaled_to_width(image, width):
    return image.resize((width, round(image.height * width / image.width)), Image.LANCZOS)


def scaled_to_height(image, height):
    return image.resize((round(image.width * height / image.height), height), Image.LANCZOS)


def og_image(card):
    canvas = Image.new("RGB", OG_SIZE, PAPER)
    scaled = scaled_to_height(card, OG_CARD_HEIGHT)
    canvas.paste(scaled, ((OG_SIZE[0] - scaled.width) // 2, (OG_SIZE[1] - scaled.height) // 2))
    return canvas


def contact_sheet(named_cards):
    tiles = [(card_id, scaled_to_height(card, CONTACT_CARD_HEIGHT)) for card_id, card in named_cards]
    cell_width = max(tile.width for _, tile in tiles) + CONTACT_GAP
    cell_height = CONTACT_CARD_HEIGHT + 2 * CONTACT_GAP
    columns = min(CONTACT_COLUMNS, len(tiles))
    rows = -(-len(tiles) // columns)
    sheet = Image.new("RGB", (columns * cell_width + CONTACT_GAP, rows * cell_height + CONTACT_GAP), "#808080")
    draw = ImageDraw.Draw(sheet)
    for i, (card_id, tile) in enumerate(tiles):
        x = CONTACT_GAP + (i % columns) * cell_width
        y = CONTACT_GAP + (i // columns) * cell_height
        draw.text((x, y), card_id, fill="white")
        sheet.paste(tile, (x, y + CONTACT_GAP))
    return sheet


def contact_sheet_path(activity):
    job_dir = os.environ.get("CLAUDE_JOB_DIR")
    folder = Path(job_dir) / "tmp" if job_dir else Path(tempfile.gettempdir())
    folder.mkdir(parents=True, exist_ok=True)
    return folder / f"{activity}-contact.png"


def main(spec_path):
    spec = json.loads(Path(spec_path).read_text(encoding="utf-8"))
    out_dir = REPO / "public" / "cards" / spec["activity"]
    out_dir.mkdir(parents=True, exist_ok=True)
    marker = {"exif": watermark.marker_exif()} if WATERMARK else {}
    named_cards = []
    with tempfile.TemporaryDirectory() as workdir:
        for set_key, card_set in spec["sets"].items():
            pdf = os.path.expanduser(card_set["pdf"])
            pages = {}
            for card in card_set["cards"]:
                if card["page"] not in pages:
                    pages[card["page"]] = render_page(
                        pdf, card["page"], card_set["dpi"], Path(workdir) / f"{set_key}-{card['page']}"
                    )
                image = crop(pages[card["page"]], card["box"])
                if "pad" in card:
                    image = padded(image, card["pad"])
                if image.width < FULL_WIDTH:
                    print(f"注意：{card['id']} 裁出來只有 {image.width}px 寬，會被放大；把 dpi 調高", file=sys.stderr)
                if WATERMARK:
                    image = watermark.apply(image)
                base = out_dir / card["id"]
                scaled_to_width(image, FULL_WIDTH).save(f"{base}.webp", quality=WEBP_QUALITY, **marker)
                scaled_to_width(image, THUMB_WIDTH).save(f"{base}-thumb.webp", quality=WEBP_QUALITY, **marker)
                if card_set.get("og"):
                    og_image(image).save(f"{base}-og.jpg", quality=OG_QUALITY, **marker)
                named_cards.append((card["id"], image))
    sheet_path = contact_sheet_path(spec["activity"])
    contact_sheet(named_cards).save(sheet_path)
    print(f"已輸出 {len(named_cards)} 張卡到 {out_dir.relative_to(REPO)}；檢查圖：{sheet_path}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("用法：python3 tools/cards.py tools/cards/<activity>.json")
    main(sys.argv[1])
