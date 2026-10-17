"""Build compact website/README previews from the archived UI screenshots."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).parent
out = root / 'web'
out.mkdir(exist_ok=True)
font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 23)
labels = {
    'practice': ['选择练习范围 / Choose your questions', '打开练习工具 / Open Practice', '随机抽取一道题 / Draw a question', '开始计时，开口练习 / Start speaking', '查看练习阶段与时间 / Check your timer'],
    'notes': ['找到想练的题 / Find a question', '展开我的笔记 / Open Notes', '写下回答思路 / Write your outline', '标记练习状态 / Update your status', '刷新后笔记仍在 / Notes stay in this browser'],
    'share': ['考题与经验都能分享 / Questions or advice', '填写场次与题目 / Add exam details', '也可切换分享经验 / Share student tips', '选主题，填写内容 / Write your experience', '先预览再分享 / Preview before submitting']
}

def frame(name, text):
    screenshot = Image.open(root / 'raw' / (name + '.png')).convert('RGB')
    result = Image.new('RGB', (810, 645), '#f5f8fb')
    result.paste(screenshot.resize((810, 600), Image.Resampling.LANCZOS))
    draw = ImageDraw.Draw(result)
    draw.line((0, 600, 810, 600), fill='#d9e4ef', width=1)
    draw.text((18, 607), text, font=font, fill='#193552')
    return result

frame('guide', '考试流程与考生经验 / Guide & student tips').save(out / 'guide.png')
for kind, captions in labels.items():
    frames = [frame(f'{kind}-{i}', text) for i, text in enumerate(captions, 1)]
    poster = 3 if kind == 'share' else 4
    frames[poster].save(out / f'{kind}.png')
    atlas = Image.new('RGB', (810, 645 * 5))
    for i, image in enumerate(frames):
        atlas.paste(image, (0, i * 645))
    palette = atlas.resize((405, 1612)).quantize(colors=224)
    gif = [image.quantize(palette=palette, dither=Image.Dither.NONE) for image in frames]
    gif[0].save(out / f'{kind}.gif', save_all=True, append_images=gif[1:],
                duration=[2400, 2400, 2400, 2400, 3200], loop=0, optimize=True, disposal=2)
print('Built four compact posters and three compact GIFs in', out)

# One responsive image keeps the four panels together in GitHub's README.
heading = ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc', 25)
panels = [('guide', '01  考试指南与经验 / Guide & Tips'),
          ('practice', '02  抽题与计时 / Practice'),
          ('notes', '03  笔记与进度 / Notes & Progress'),
          ('share', '04  考题与经验分享 / Share')]
grids = []
for index in range(5):
    grid = Image.new('RGB', (1280, 1164), '#f5f8fb')
    draw = ImageDraw.Draw(grid)
    for number, (kind, title) in enumerate(panels):
        x, y = 24 + (number % 2) * 626, 24 + (number // 2) * 568
        draw.rounded_rectangle((x, y, x + 606, y + 548), radius=15, fill='white', outline='#d9e4ef', width=2)
        draw.text((x + 18, y + 18), title, font=heading, fill='#193552')
        image = frame('guide', '考试流程与考生经验 / Guide & student tips') if kind == 'guide' else frame(f'{kind}-{index + 1}', labels[kind][index])
        grid.paste(image.resize((582, 463), Image.Resampling.LANCZOS), (x + 12, y + 69))
    grids.append(grid)
grids[-1].save(out / 'feature-grid.png')
atlas = Image.new('RGB', (1280, 1164 * 5))
for index, image in enumerate(grids):
    atlas.paste(image, (0, index * 1164))
palette = atlas.resize((640, 2910)).quantize(colors=224)
gif = [image.quantize(palette=palette, dither=Image.Dither.NONE) for image in grids]
gif[0].save(out / 'feature-grid.gif', save_all=True, append_images=gif[1:],
            duration=[2400, 2400, 2400, 2400, 3200], loop=0, optimize=True, disposal=2)
print('Built a responsive 2 x 2 feature grid.')
