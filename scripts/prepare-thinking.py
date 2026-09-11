"""Align supplied 4x3 artwork without redrawing; output one horizontal atlas."""
import sys
from collections import deque
from PIL import Image

def body_bounds(image):
    """Largest opaque connected component: body outline, excluding bubbles."""
    w,h=image.size
    mask=bytearray(a>100 for a in image.getchannel('A').tobytes())
    largest=[]
    for start in range(w*h):
        if not mask[start]: continue
        queue=deque([start]); mask[start]=0; pixels=[]
        while queue:
            p=queue.popleft(); pixels.append(p); x=p%w
            for n in (p-1 if x else -1,p+1 if x<w-1 else -1,p-w,p+w):
                if 0<=n<w*h and mask[n]: mask[n]=0; queue.append(n)
        if len(pixels)>len(largest): largest=pixels
    return min(p%w for p in largest),min(p//w for p in largest),max(p%w for p in largest)+1,max(p//w for p in largest)+1

reference=Image.open('public/mascot/idle-00.png').convert('RGBA')
rx0,ry0,rx1,ry1=body_bounds(reference)
source = Image.open(sys.argv[1]).convert('RGBA')
frames = []
for row in range(3):
    for col in range(4):
        cell = source.crop((col*362, row*362, (col+1)*362, (row+1)*362))
        x0,y0,x1,y1 = body_bounds(cell)
        sx,sy=(rx1-rx0)/(x1-x0),(ry1-ry0)/(y1-y0)
        resized = cell.resize((round(362*sx),round(362*sy)),Image.Resampling.LANCZOS)
        frame = Image.new('RGBA',(336,380))
        frame.alpha_composite(resized,(round(rx0-x0*sx),round(ry1+76-y1*sy)))
        bounds=body_bounds(frame)
        assert abs((bounds[2]-bounds[0])-(rx1-rx0))<=2
        assert abs((bounds[3]-bounds[1])-(ry1-ry0))<=2
        assert abs(bounds[3]-(ry1+76))<=1
        frames.append(frame)
atlas = Image.new('RGBA',(336*12,380))
for i,frame in enumerate(frames):
    atlas.alpha_composite(frame,(i*336,0))
atlas.save('public/mascot/thinking-sheet.png')
print('12 frames, 336 x 380; atlas 4032 x 380')
