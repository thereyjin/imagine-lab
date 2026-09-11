"""Deterministic extraction only. Never redraws or modifies the source sheet."""
import json
import sys
import zipfile
from pathlib import Path
from collections import deque
from PIL import Image, ImageDraw

source = Image.open(sys.argv[1]).convert('RGBA')
out = Path('public/mascot')
out.mkdir(parents=True, exist_ok=True)
w, h = source.size
alpha = source.getchannel('A')
mask = bytearray(1 if a > 100 else 0 for a in alpha.tobytes())
components = []
for seed in range(w*h):
    if not mask[seed]:
        continue
    mask[seed] = 0
    queue = deque([seed])
    pixels = []
    while queue:
        p = queue.popleft()
        pixels.append(p)
        x, y = p % w, p // w
        for n in ((p-1 if x else -1), (p+1 if x < w-1 else -1), p-w, p+w):
            if 0 <= n < w*h and mask[n]:
                mask[n] = 0
                queue.append(n)
    if len(pixels) > 10000:
        xs = [p % w for p in pixels]
        ys = [p // w for p in pixels]
        components.append((min(xs), min(ys), max(xs)+1, max(ys)+1))
assert len(components) == 12, f'Expected 12 characters, detected {len(components)}'
components.sort(key=lambda b: (round(b[1]/(h/2)), b[0]))
canvas = (336, 304)
baseline = 282
frames, report = [], []
for i, body in enumerate(components):
    x0,y0,x1,y1 = body
    # Include nearby motion marks, but not unrelated stray marks above the heads.
    bounds = (max(0,x0-22), max(0,y0-5), min(w,x1+25), min(h,y1+5))
    crop = source.crop(bounds)
    # Register by lower body, not cap or waving hands.
    lower = alpha.crop((x0,y1-48,x1,y1))
    lower_box = lower.getbbox()
    center = x0+(lower_box[0]+lower_box[2])/2
    offset = (round(canvas[0]/2-center+bounds[0]), baseline-y1+bounds[1])
    frame = Image.new('RGBA',canvas)
    frame.alpha_composite(crop,offset)
    frame.save(out/f'idle-{i:02}.png')
    frames.append(frame)
    report.append({'frame':i,'body':body,'crop':bounds,'offset':offset,'baseline':baseline})
# Mostly rest; brief blink and a quiet alternate rest. No waving/cup poses in idle.
sequence = [0,1,0,2,0,1,0]
durations = [3100,130,2200,700,2400,150,1800]
frames[0].save(out/'idle.webp',save_all=True,append_images=[frames[i] for i in sequence[1:]],duration=durations,loop=0,lossless=True)
(out/'frames.json').write_text(json.dumps({'canvas':canvas,'sequence':sequence,'durations':durations,'frames':report},indent=2))
contact = Image.new('RGB',(6*336,2*336),'#f3f2ed')
draw = ImageDraw.Draw(contact)
for i,frame in enumerate(frames):
    contact.paste(frame,((i%6)*336,(i//6)*336),frame)
    draw.text(((i%6)*336+12,(i//6)*336+306),str(i),fill='black')
contact.save(out/'contact-sheet.jpg')
with zipfile.ZipFile(out/'idle-frames.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for filename in [*(f'idle-{i:02}.png' for i in range(12)), 'idle.webp', 'frames.json']:
        archive.write(out/filename,filename)
print(json.dumps({'frames':len(frames),'canvas':canvas,'baseline':baseline,'loop_ms':sum(durations)}))
