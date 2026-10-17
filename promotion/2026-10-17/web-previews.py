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
