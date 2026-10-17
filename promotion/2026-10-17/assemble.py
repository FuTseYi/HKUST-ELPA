from pathlib import Path
from PIL import Image, ImageOps, ImageDraw
import json, zipfile

root = Path(__file__).parent
meta = {}
for name in ('practice', 'notes', 'share'):
    source = [Image.open(root / 'frames' / f'{name}-{i}.png').convert('RGB').resize((810,1080), Image.Resampling.LANCZOS) for i in range(1,6)]
    # A shared palette avoids color flicker between the actual browser frames.
    atlas = Image.new('RGB', (810,1080*5))
    for i,im in enumerate(source): atlas.paste(im,(0,i*1080))
    palette = atlas.resize((405,2700)).quantize(colors=224)
    frames, durations = [], []
    for i,im in enumerate(source):
        frames.append(im.quantize(palette=palette,dither=Image.Dither.NONE)); durations.append(2200 if i<4 else 3000)
        if i<4:
            for alpha in (.25,.5,.75):
                frames.append(Image.blend(im,source[i+1],alpha).quantize(palette=palette,dither=Image.Dither.NONE));durations.append(70)
    dest = root / f'{name}-demo.gif'
    frames[0].save(dest,save_all=True,append_images=frames[1:],duration=durations,loop=0,optimize=True,disposal=2)
    with Image.open(dest) as gif:
        meta[dest.name]={'size':gif.size,'frames':gif.n_frames,'duration_ms':sum(durations),'bytes':dest.stat().st_size}

thumbs=[]
for p in sorted(root.glob('0*.png')):
    im=Image.open(p).convert('RGB').resize((324,432),Image.Resampling.LANCZOS)
    thumbs.append(im)
sheet=Image.new('RGB',(324*len(thumbs)+24*(len(thumbs)+1),480),'#e4eaf2')
for i,im in enumerate(thumbs):sheet.paste(im,(24+i*348,24))
sheet.save(root/'contact-sheet.jpg',quality=93)
(root/'manifest.json').write_text(json.dumps(meta,indent=2),encoding='utf-8')
print(json.dumps(meta,indent=2))
