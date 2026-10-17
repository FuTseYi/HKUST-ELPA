# 宣传素材 · Promotion

集中存放网站后续在社交媒体、同学群及其他渠道使用的宣传素材，独立于页面运行代码。

## 素材批次

| 批次 | 内容 | 预览与使用 |
| --- | --- | --- |
| 2026-10-17 | 5 张 3:4 竖版 PNG、练习 / 笔记 / 分享 3 个 GIF | [打开预览](./2026-10-17/index.html) · [使用说明](./2026-10-17/使用说明.md) |

HTML 预览需在浏览器中打开；GitHub 上可直接浏览对应 PNG / GIF 文件。

## 存放约定

每次新增素材建立一个 `YYYY-MM-DD/` 目录，保留历史批次；同一天的不同方案可用 `YYYY-MM-DD-v2/`。

```text
promotion/
├── README.md
└── 2026-10-17/
    ├── 01-overview.png … 05-features.png  # 发布成品
    ├── *-demo.gif                       # 发布动图
    ├── index.html                       # 素材预览页
    ├── 使用说明.md                       # 发布顺序、规格与内容口径
    ├── contact-sheet.jpg                # 缩略总览
    ├── manifest.json                    # 动图规格
    ├── raw/                             # 原始页面截图
    ├── capture.js                       # 实际页面操作与截图
    ├── render.js / features.js           # 排版与图片生成
    ├── assemble.py / package.py          # 动图合成与交付打包
    └── frames/                          # 再生成的中间帧，不纳入 Git
```

成品、截图和制作源文件纳入版本管理；可再生成的 `frames/` 和 ZIP 交付包由根目录 `.gitignore` 忽略，避免重复保存大文件。生成脚本只用于素材制作，不被网站页面加载。

## 更新与制作

宣传文案与对应批次截图应反映同一版本的真实功能。演示填写使用明确标注的示例，避免发送真实投稿；发布前核对网址、页面外观和功能是否仍然适用。

当前批次以仓库根目录为运行目录。本地站点启动后，页面截图和排版脚本可通过 Playwright CLI 执行：

```powershell
# 首次准备：项目依赖及 Chromium；Python 合成脚本另需 Pillow
npm ci
npx playwright install chromium
python -m pip install Pillow

# 在另一个终端保持本地站点运行
python -m http.server 8765 --bind 127.0.0.1

# 回到仓库根目录执行制作；仅在需要重新截图时运行 capture.js
npx --yes --package @playwright/cli playwright-cli -s=promotion open http://127.0.0.1:8765/
npx --yes --package @playwright/cli playwright-cli -s=promotion run-code --filename promotion/2026-10-17/capture.js
New-Item -ItemType Directory -Force promotion/2026-10-17/frames
npx --yes --package @playwright/cli playwright-cli -s=promotion run-code --filename promotion/2026-10-17/render.js
npx --yes --package @playwright/cli playwright-cli -s=promotion run-code --filename promotion/2026-10-17/features.js
python promotion/2026-10-17/assemble.py
python promotion/2026-10-17/package.py
```

`render.js` 输出至 `frames/`。重新截图会覆盖该批次文件；制作新一批时应复制脚本到新批次，并更新脚本中的批次路径及文案。
