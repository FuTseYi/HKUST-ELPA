from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from PIL import Image

root=Path(__file__).parent
cards=[('01-overview.png','封面'),('05-features.png','核心功能'),('02-practice.png','练习'),('03-notes.png','笔记'),('04-share.png','分享'),('practice-demo.gif','练习演示'),('notes-demo.gif','笔记演示'),('share-demo.gif','分享演示')]
html='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>HKUST-ELPA 宣发素材</title><style>body{margin:0;background:#eff3f8;color:#193552;font:16px/1.7 "Microsoft YaHei",sans-serif}header{background:#192e4e;color:white;padding:32px max(24px,5vw)}h1{margin:0;font-size:30px}header p{color:#c4d4e7;margin:8px 0}main{max-width:1440px;margin:32px auto;padding:0 24px;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px}article{background:white;border:1px solid #d6e0ec;border-radius:14px;overflow:hidden}img{width:100%;display:block}a{color:inherit;text-decoration:none}article p{margin:14px 18px;font-weight:bold}small{font-weight:normal;float:right;color:#677d95}footer{text-align:center;padding:20px 24px 40px;color:#6d8096}</style><header><h1>HKUST-ELPA · 宣发素材</h1><p>5 张竖版图 + 3 个 GIF · 点击图片打开原文件</p></header><main>'''
for name,label in cards:
    html+=f'<article><a href="{name}" target="_blank"><img src="{name}" alt="{label}" loading="lazy"><p>{label}<small>{"GIF · 约 13 秒" if name.endswith("gif") else "PNG · 1080 × 1440"}</small></p></a></article>'
html+='</main><footer>真实页面操作截图 · 分享使用演示示例 · 没有发送真实投稿<br>完整使用说明见同目录「使用说明.md」</footer>'
(root/'index.html').write_text(html,encoding='utf-8')
files=[root/x[0] for x in cards]+[root/'index.html',root/'使用说明.md',root/'contact-sheet.jpg',root/'manifest.json']
for path in files:
    if path.suffix in ('.png','.gif','.jpg'):
        with Image.open(path) as im: im.verify()
with ZipFile(root/'HKUST-ELPA-social-kit.zip','w',ZIP_DEFLATED) as z:
    for path in files:z.write(path,path.name)
with ZipFile(root/'HKUST-ELPA-social-kit.zip') as z:
    assert z.testzip() is None
print('Validated 5 PNGs, 3 GIFs and ZIP:',(root/'HKUST-ELPA-social-kit.zip').stat().st_size,'bytes')
