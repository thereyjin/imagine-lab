"""Extract the supplied black brand mark onto a transparent, tightly cropped PNG."""
import sys
from pathlib import Path
from PIL import Image

source = Image.open(sys.argv[1]).convert('RGBA')
ink = Image.new('RGBA', source.size, (18, 18, 18, 0))
alpha = Image.new('L', source.size)
alpha.putdata([
    max(0, min(255, round((242 - (r + g + b) / 3) * 2.8)))
    for r, g, b, _ in source.getdata()
])
ink.putalpha(alpha)
bounds = alpha.getbbox()
assert bounds, 'No dark brand mark found'
x0, y0, x1, y1 = bounds
pad = 18
cropped = ink.crop((max(0, x0-pad), max(0, y0-pad), min(source.width, x1+pad), min(source.height, y1+pad)))
target = Path('public/imagine/brand-mark.png')
target.parent.mkdir(parents=True, exist_ok=True)
cropped.save(target)
print(f'{target}: {cropped.width} x {cropped.height}, transparent')
