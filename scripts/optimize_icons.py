from pathlib import Path
from PIL import Image


ASSET_NAMES = (
    "icon.png",
    "splash-icon.png",
    "favicon.png",
    "android-icon-foreground.png",
)
ASSET_DIR = Path(__file__).resolve().parents[1] / "assets" / "images"


def optimize_icon(path: Path) -> None:
    with Image.open(path) as source:
        image = source.convert("RGBA")
        image.thumbnail((512, 512), Image.Resampling.LANCZOS)
        image.save(path, format="PNG", optimize=True, compress_level=9)


for asset_name in ASSET_NAMES:
    optimize_icon(ASSET_DIR / asset_name)
