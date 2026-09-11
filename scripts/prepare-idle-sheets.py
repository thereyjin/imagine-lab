"""Build aligned idle sprite sheets without redrawing the supplied artwork."""
import sys
from collections import deque
from pathlib import Path
from PIL import Image

CANVAS = (336, 304)
OUT = Path('public/mascot')

def body_bounds(image: Image.Image):
    w, h = image.size
    mask = bytearray(a > 100 for a in image.getchannel('A').tobytes())
    largest = []
    for start in range(w * h):
        if not mask[start]:
            continue
        queue = deque([start])
        mask[start] = 0
        pixels = []
        while queue:
            point = queue.popleft()
            pixels.append(point)
            x = point % w
            for neighbor in (point - 1 if x else -1, point + 1 if x < w - 1 else -1, point - w, point + w):
                if 0 <= neighbor < w * h and mask[neighbor]:
                    mask[neighbor] = 0
                    queue.append(neighbor)
        if len(pixels) > len(largest):
            largest = pixels
    return min(p % w for p in largest), min(p // w for p in largest), max(p % w for p in largest) + 1, max(p // w for p in largest) + 1

def lower_center(image: Image.Image, bounds):
    x0, _, x1, y1 = bounds
    lower = image.getchannel('A').crop((x0, y1 - 48, x1, y1)).getbbox()
    return x0 + (lower[0] + lower[2]) / 2

reference = Image.open(OUT / 'idle-00.png').convert('RGBA')
reference_bounds = body_bounds(reference)
reference_center = lower_center(reference, reference_bounds)
reference_height = reference_bounds[3] - reference_bounds[1]
reference_baseline = reference_bounds[3]

# The existing blink is converted to one deterministic, evenly timed atlas.
blink_sequence = [0, 0, 0, 1, 0, 0, 2, 0]
blink_frames = [Image.open(OUT / f'idle-{index:02}.png').convert('RGBA') for index in blink_sequence]
blink_atlas = Image.new('RGBA', (CANVAS[0] * len(blink_frames), CANVAS[1]))
for index, frame in enumerate(blink_frames):
    blink_atlas.alpha_composite(frame, (index * CANVAS[0], 0))
blink_atlas.save(OUT / 'idle-blink-sheet.png')

source = Image.open(sys.argv[1]).convert('RGBA')
cell_width, cell_height = source.width // 4, source.height // 3
assert source.size == (cell_width * 4, cell_height * 3), 'Expected an even 4x3 sprite sheet'

gesture_frames = []
for row in range(3):
    for column in range(4):
        cell = source.crop((column * cell_width, row * cell_height, (column + 1) * cell_width, (row + 1) * cell_height))
        bounds = body_bounds(cell)
        scale = reference_height / (bounds[3] - bounds[1])
        resized = cell.resize((round(cell_width * scale), round(cell_height * scale)), Image.Resampling.LANCZOS)
        x = round(reference_center - lower_center(cell, bounds) * scale)
        y = round(reference_baseline - bounds[3] * scale)
        frame = Image.new('RGBA', CANVAS)
        frame.alpha_composite(resized, (x, y))
        aligned = body_bounds(frame)
        assert abs(aligned[3] - reference_baseline) <= 2, 'Frame baseline drifted'
        gesture_frames.append(frame)

# The supplied final three drawings drift left even after baseline registration.
# Align their body-box centers to the reference character while preserving artwork.
reference_body_center = (reference_bounds[0] + reference_bounds[2]) / 2
for index in range(9, 12):
    bounds = body_bounds(gesture_frames[index])
    shift_x = round(reference_body_center - (bounds[0] + bounds[2]) / 2)
    corrected = Image.new('RGBA', CANVAS)
    corrected.alpha_composite(gesture_frames[index], (shift_x, 0))
    gesture_frames[index] = corrected

gesture_atlas = Image.new('RGBA', (CANVAS[0] * len(gesture_frames), CANVAS[1]))
for index, frame in enumerate(gesture_frames):
    gesture_atlas.alpha_composite(frame, (index * CANVAS[0], 0))
gesture_atlas.save(OUT / 'idle-gesture-sheet.png')
print(f'blink: {len(blink_frames)} frames; gesture: {len(gesture_frames)} frames; canvas: {CANVAS[0]}x{CANVAS[1]}')
