# GPT-Image2-Studio

GPT-Image2-Studio 是一个本地优先的图片与演示文稿创作工作台。它通过浏览器界面管理提示词、参考图、比例、分辨率、批量计划、历史记录和导出文件，由本机 Node 服务或 Cloudflare Pages Worker 转发 `Responses API`，并使用内置 `image_generation` 工具调用 `gpt-image-2` 生成图片。

> API Key 和私人 Base URL 默认只保存在本机 `.local/config.json` 或浏览器本地配置中。生成结果默认写入 Windows 图片目录；`.local/`、`output/`、`artifacts/`、`dist/`、日志和构建产物不会提交到 GitHub。

## 功能概览

| 模块 | 能力 |
| --- | --- |
| Studio | 单图提示词生成、参考图上传、风格迁移、参考图编排、本地 Prompt Kit 模板、比例/分辨率/格式/推理强度选择、实时 SSE 状态和瀑布画廊 |
| 图片拆解 | 上传 1 张源图生成高信息密度拆解信息图，支持标注语言、自定义语言、两侧说明卡片、缩略图切换和独立输出目录 |
| 套图模式 | 面向单个商品生成电商营销套图，支持计划预览、单图提示词微调、9 张套图参考图、参考图用途识别、Logo 位置/底色控制、SKU 补图、四级类目模板、目标语言和历史套图复用 |
| 写真模式 | 面向人物参考图生成 1-100 张专业写真，支持人物可见特征分析、手写描述、服装/道具/配饰参考图、内置服饰资产库、动作预览卡、风格/景别/比例选择和写真记录复用 |
| 文章插图 | 先解析完整文章包，生成可编辑分镜、风格圣经、人物/场景设定和参考图，再确认生成正式插图 |
| PPT | 上传文档、粘贴文本或输入主题生成演示文稿；支持文档分析、逐页生图、补齐缺页、标注重绘单页、默认 PPTX 导出和本地可编辑 PPTX 重建 |
| 资产记录 | 普通画廊、文章插图记录、套图记录、写真记录和 PPT 记录分开管理，可搜索、预览、复制路径/提示词、导出清单和打开本地文件夹 |
| 队列 | 同一会话最多保留 25 个生成任务，最多 10 个并发生成请求，尚未开始的排队任务可取消 |
| 本地服务 | 静态页面托管、配置保存、SSE 转发、图片写入、目录打开、历史目录迁移和本地文件路径回报 |
| 命令行 | 支持 `npm run generate` 直接生成单张图片 |
| Windows 安装包 | 使用系统自带 IExpress 打包 `.exe` 安装器，内置当前 Node 运行时 |

## 本次 main 更新

- 新增写真模式与写真记录：独立路由 `#portrait` 和 `#portrait-record`，人物参考图最多 3 张，服装/道具/配饰参考图最多 9 张。
- 写真模式支持“分析人物”生成安全的可见特征草稿，也支持完全手写人物描述；分析结果只描述可见呈现，不推断真实身份、年龄、种族、国籍、宗教、健康、残障、怀孕、性取向等敏感属性。
- 写真计划器支持 1-100 张计划，自动轮换商务形象、时尚杂志、电影街拍、棚拍质感、自然光生活、复古胶片、黑白肖像、户外旅拍、社媒头像和自定义风格，并为每张图写入景别、动作、镜头、光圈、景深虚化、光线和场景提示。
- 写真新增本地服装道具配饰资产库：包含上衣、下装、外套、裙装、鞋子、包袋、配饰、帽子和 COS 分类，经典服饰/鞋履包含多色 PNG 变体，COS 分类包含巫女、魔法少女、赛博战士和幻想骑士等泛化参考资产。
- 写真动作选择器新增真实 PNG 预览卡，覆盖站立、行走、坐姿、倚靠、回眸、整理衣袖、手持道具和转身动感。
- 写真记录支持搜索、预览、复制路径、复制/导出提示词、导出清单、打开本地文件夹和复用到当前写真；复用会恢复分析草稿、人物描述、风格、景别、动作和提示词，参考图需要重新上传。
- PPT 工作流新增“分析文档”：可根据上传文档、粘贴文本或主题推荐页数、风格和内容分段，并回填 PPT 表单。
- PPT 导出新增“可编辑重建”模式：默认仍先生成稳定的整页图片 PPTX；本地环境可在此基础上调用 Presentations artifact-tool 工作流尝试生成额外的可编辑 PPTX，并在记录页展示两个下载入口。
- 套图模式继续保留上传图批量加 Logo、SKU 主体元数据、历史 SKU 参考绑定和视觉语言锁定；补图与重生成会沿用同一套清单和参考图关系。
- Cloudflare / Vercel 运行路径保持云端安全边界：普通 PPTX 可生成；可编辑重建、打开本机文件夹、返回完整本地路径等依赖本机文件系统或 Codex runtime 的能力会明确降级或返回不支持提示。
- 任务队列默认更新为 25 个会话任务、10 个并发生成请求；套图参考图上限为 9，普通生成参考图上限为 6。
- 画廊元数据恢复增强，能保留写真、套图、PPT、文章插图等模式的关键字段，避免索引稀疏时丢失筛选和复用信息。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| Runtime | Node.js 20+，ES Modules |
| Server | Node 原生 `http` 服务，本地文件系统读写，SSE 流式转发 |
| Frontend | 原生 HTML / CSS / JavaScript，浏览器端 ESM，按视图懒加载模块 |
| API | `POST /responses`，`tools[].type = "image_generation"`，`tools[].model = "gpt-image-2"` |
| Storage | Windows `Pictures` 目录保存生成结果，`.local/config.json` 保存本机配置，浏览器 localStorage / IndexedDB 保存 UI 与缓存状态 |
| PPT | `pptxgenjs` 和 `jszip` 生成普通 PPTX；本地可选 Presentations artifact-tool 生成可编辑重建 PPTX |
| Cloud | Cloudflare Pages Worker 兼容核心生成和 PPT 普通导出；R2/Queue 为云端生成和图片缓存提供可选支撑 |
| Packaging | Windows `iexpress.exe` + `tar.exe` 生成自解压安装包 |

## 快速启动

### 本地开发启动

```powershell
npm install
npm start
```

启动后打开：

```text
http://localhost:3600
```

如果 `3600` 端口已被占用：

```powershell
$env:PORT="3601"
npm start
```

也可以双击项目根目录下的启动器：

```text
launch-studio.cmd
```

停止本地服务：

```text
stop-studio-services.cmd
```

### 配置 API

浏览器右下角配置面板可保存：

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| Base URL | `https://api.openai.com/v1` | 可替换为兼容 Responses API 的私有端点 |
| API Key | 空 | 本地保存，不提交到仓库 |
| Responses 模型 | 本地默认 `gpt-5.4`，Cloudflare 默认 `gpt-5.5` | 负责文本规划、结构化输出和调用图片工具 |
| 推理强度 | `xhigh` | 可选 `low` / `medium` / `high` / `xhigh` |
| 图片工具模型 | `gpt-image-2` | 代码固定写入 image generation tool |

### 命令行生成

```powershell
$env:OPENAI_API_KEY="你的 API Key"
$env:OPENAI_BASE_URL="https://api.openai.com/v1"
$env:RESPONSES_MODEL="gpt-5.4"

npm run generate -- --prompt "一张产品海报，明亮商业摄影，干净背景" --size "1024x1536" --quality "high" --format "jpeg"
```

查看命令行帮助：

```powershell
npm run help
```

## 主要工作流

### Studio 单图与参考图

默认工作台支持提示词生成、参考图生成、风格迁移、参考图编排和本地 Prompt Kit 模板。普通生成最多上传 6 张参考图；风格迁移需要原图和风格参考图；参考图编排可先分析多图关系，再把分析结果用于正式生成。

常用入口：

```text
http://localhost:3600/#studio
http://localhost:3600/#style-transfer
http://localhost:3600/#reference-analysis
```

参考图编排支持简体中文、English、日本語、한국어等输出语言约束；图片内标题、标签、注释和短文案会跟随所选语言，同时保留商品名、型号、数字和单位。

Prompt Kit 模板保存在浏览器本地，可创建、编辑、插入和删除常用提示词，不会写入公开仓库。

### 图片拆解

入口：

```text
http://localhost:3600/#image-decomposition
```

图片拆解只接受 1 张源图，适合产品、设备、服饰、包装或结构清晰的物体。可配置比例、分辨率、标注语言、自定义语言和两侧说明卡片；生成结果会进入独立 `image-decomposition` 输出目录，并在拆解页与画廊中回显。

### 套图模式

入口：

```text
http://localhost:3600/#creation
```

套图模式面向单个商品生成电商营销图。填写商品名、描述和卖点后，可选择 4 / 6 / 8 / 10 / 12 张基础营销图数量、营销场景、目标语言、视觉语言、比例、分辨率、输出格式、行业模板和图片角色组合。参考图最多 9 张，并可标注商品主体、包装清单、材质细节、使用场景、风格参考或其他用途。

套图模式还支持：

- 1577 个四级电商类目模板，支持逐级选择和按三级/四级类目名或编码搜索。
- 智能识别参考图用途、生成备注和类目线索；识别到明确四级类目时可自动切换行业模板。
- 可选 Logo 单独上传，支持九宫格位置、透明底直接放置或非透明底先抠图。
- SKU 主体补图，历史参考图重传后可手动绑定到历史 SKU 主体。
- 上传图批量加 Logo，为多张源图沿用同一 Logo 参考生成品牌化版本。
- 计划预览、单张提示词微调、单张重生成和补齐未完成项。
- 目标语言支持简体中文、English、日本語、한국어、Français、Deutsch、Español。
- 尺寸规格支持公制、英制、双单位和原文保留。

套图记录入口：

```text
http://localhost:3600/#creation-record
```

记录页支持搜索商品、场景、行业、类目路径或语言，批量复制相对路径、完整本地路径和整套提示词，导出提示词文本或清单 JSON，打开套图文件夹，并复用历史套图继续补图或重生成。

### 写真模式

入口：

```text
http://localhost:3600/#portrait
```

写真模式面向人物参考图生成一组专业摄影写真。人物参考图最多 3 张，服装/道具/配饰参考图最多 9 张。上传人物参考图后可点击“分析人物”得到可编辑的可见特征草稿，也可以直接手写人物描述。计划数量会自动限制在 1-100 张。

写真模式可配置：

- 摄影风格：商务形象、时尚杂志、电影街拍、棚拍质感、自然光生活、复古胶片、黑白肖像、户外旅拍、社媒头像和自定义风格。
- 景别：远景、全身、中景、近景、特写。
- 动作：站立、行走、坐姿、倚靠、回眸、整理衣袖、手持道具、转身动感。
- 服装道具配饰：可上传自定义参考图，也可从内置资产库选择上衣、下装、外套、裙装、鞋子、包袋、配饰、帽子和 COS 参考资产。
- 比例、分辨率、输出格式和摄影补充说明。

写真记录入口：

```text
http://localhost:3600/#portrait-record
```

记录页支持搜索人物、风格或提示词，预览单张图片，复制路径，复制/导出整组提示词，导出写真清单 JSON，打开本地文件夹，并复用历史记录。复用不会恢复原始参考图文件；继续生成、补图或重生成前需要重新上传人物参考图。

### 文章插图

入口：

```text
http://localhost:3600/#article-illustration
```

文章插图模式支持粘贴正文、上传 `.txt` / `.md` / `.csv` / `.json` 文本文件和填写补充说明。系统会先完整阅读文章包，再生成分镜、风格圣经、人物/场景设定、重点参考图和正式插图计划。用户可以先生成参考图，再确认生成正式插图；插图数量由模型根据文章节奏建议，不复用套图固定张数。

文章插图记录入口：

```text
http://localhost:3600/#article-record
```

记录页支持复制整套提示词、复制准确题注、继续失败项和按标题/风格/正文摘要搜索。

### PPT 生成

入口：

```text
http://localhost:3600/#ppt
```

PPT 工作流支持三种输入来源：

| 输入来源 | 支持内容 |
| --- | --- |
| 上传文档 | PDF / DOCX / PPTX / TXT / MD / CSV |
| 文本材料 | 直接粘贴大段文本 |
| 主题 | 只输入主题，由模型生成大纲 |

可先点击“分析文档”，让模型推荐页数、风格和内容分段；也可以直接设置页数、视觉风格、动态组件、转场、自动播放秒数和 PPTX 导出方式后生成。

PPT 导出方式：

| 模式 | 说明 |
| --- | --- |
| 普通图片页 | 默认稳定路径，每页以 16:9 图片嵌入 PPTX |
| 可编辑重建 | 本地增强路径：先保留普通 PPTX，再尝试用 Presentations artifact-tool 生成额外可编辑 PPTX |

PPT 生成失败的页面可点击“补齐缺页”继续生成；已生成页面可打开单页编辑器，涂抹标注并输入修改说明后重绘该页。

PPT 记录入口：

```text
http://localhost:3600/#ppt-record
```

记录页会展示普通 PPTX 下载链接；如果本地可编辑重建成功，也会展示额外的可编辑 PPTX 下载链接。

## 参数与限制

| 项目 | 当前限制 |
| --- | --- |
| 普通参考图 | 最多 6 张 |
| 套图参考图 | 最多 9 张 |
| 写真人物参考图 | 最多 3 张 |
| 写真服装/道具/配饰参考图 | 最多 9 张 |
| 写真计划数量 | 1-100 张 |
| 套图基础数量 | 4 / 6 / 8 / 10 / 12 张，SKU 补图可追加 |
| PPT 页数 | 1-20 页 |
| 会话任务数 | 最多 25 个 |
| 并发生成数 | 最多 10 个 |
| 推理强度 | `low` / `medium` / `high` / `xhigh` |
| 输出格式 | PNG / JPG |

比例与分辨率：

| 比例 | `auto` 默认尺寸 | 可选尺寸 |
| --- | --- | --- |
| `1:1` | `1024x1024` | `1024x1024`、`1536x1536`、`2048x2048`、`2816x2816` |
| `5:4` | `1280x1024` | `1280x1024`、`1920x1536`、`2560x2048`、`3120x2496` |
| `9:16` | `720x1280` | `720x1280`、`1152x2048`、`2016x3584`、`2151x3824`、`2160x3840` |
| `21:9` | `1680x720` | `1680x720`、`1916x821`、`2688x1152`、`3360x1440`、`3824x1639`、`3832x1642`、`3840x1646` |
| `16:9` | `1280x720` | `1280x720`、`2048x1152`、`3584x2016`、`3824x2151`、`3840x2160` |
| `4:3` | `1024x768` | `1024x768`、`1536x1152`、`2048x1536`、`3072x2304` |
| `3:2` | `1536x1024` | `1536x1024`、`2304x1536`、`3072x2048`、`3456x2304` |
| `4:5` | `1024x1280` | `1024x1280`、`1536x1920`、`2048x2560`、`2496x3120` |
| `3:4` | `768x1024` | `768x1024`、`1536x2048`、`1920x2560`、`2304x3072`、`2448x3264` |
| `2:3` | `1024x1536` | `1024x1536`、`1536x2304`、`2048x3072`、`2304x3456` |

高分辨率更容易触发上游超时、失败或没有最终图片结果。日常建议优先使用 1K 到 2K 尺寸，需要大图时再逐档尝试。

## 输出路径

本地服务默认把生成结果保存到 Windows 图片目录：

```text
C:\Users\<你的用户名>\Pictures\YYYY-MM\MM-DD\
```

不同模式会写入独立子目录：

```text
YYYY-MM-DD-prompt\
YYYY-MM-DD-style-transfer\
YYYY-MM-DD-reference-analysis\
YYYY-MM-DD-image-decomposition\
YYYY-MM-DD-creation\HHMM-商品名-短ID\
YYYY-MM-DD-portrait\HHMM-人物名-短ID\
YYYY-MM-DD-article\文章名-短ID\
YYYY-MM-DD-ppt\PPT名称-短ID\
```

清单与索引：

```text
Pictures\json\creation-sets\
Pictures\json\portrait-sets\
Pictures\json\article-illustration-sets\
Pictures\json\ppt-decks\
```

普通生成、风格迁移、参考图编排和图片拆解会继续进入瀑布画廊索引。套图、写真、文章插图和 PPT 以各自记录页为主，不默认混入普通画廊。

命令行生成默认写入项目内：

```text
output/generated-时间戳.<ext>
```

`output/` 已被 `.gitignore` 忽略，不会提交到 GitHub。

## 本地与云端能力边界

| 能力 | 本地 Node | Cloudflare Pages Worker / Vercel |
| --- | --- | --- |
| 普通图片生成 | 支持 | 支持 |
| 风格迁移、参考图编排、图片拆解 | 支持 | 支持核心生成 |
| 套图生成 | 支持记录、补图、打开文件夹和路径回报 | 支持生成；本地文件夹操作不可用 |
| 写真生成 | 支持记录、补图、打开文件夹和路径回报 | 支持生成；本地文件夹操作不可用 |
| 文章插图 | 支持计划、参考图、正式插图和记录 | 以部署配置为准 |
| PPT 普通导出 | 支持 | 支持 |
| PPT 可编辑重建 | 需要本地 Presentations artifact-tool runtime | 不加载 artifact-tool，只保留普通 PPTX 并返回不支持提示 |
| API Key 存储 | `.local/config.json` | 浏览器本地配置或部署侧安全注入 |

## 构建与验证

常用验证命令：

```powershell
cmd /c npm test
cmd /c npm run build:pages
cmd /c npm run sync:public-lib -- --check
git diff --check
```

Cloudflare Pages 构建：

```powershell
npm run build:pages
```

构建产物写入：

```text
dist/
```

Windows 安装包：

```powershell
npm run build:installer
```

安装包产物写入：

```text
artifacts/windows-installer/<build-id>/GPT-Image2-Studio-Setup-v0.1.2.exe
```

## GitHub 同步注意事项

提交前确认以下路径没有进入暂存区：

```text
.local/
.env
.env.*
output/
artifacts/
dist/
node_modules/
.vercel/
.playwright-mcp/
*.log
```

本次同步属于 main 分支的非 Release 更新；没有用户明确要求时，不自动创建 tag 或 GitHub Release。

## 项目结构

```text
GPT-Image2-Studio/
├── docs/                         # 教程、发布说明和执行计划记录
├── examples/                     # API 请求与 SSE 示例
├── lib/                          # 本地服务和前端共享逻辑
├── openspec/                     # 规格变更、设计和验收场景
├── public/                       # 浏览器工作台、样式、前端模块和内置资产
│   ├── assets/portrait-actions/  # 写真动作预览图
│   └── assets/portrait-accessories/ # 写真服装道具配饰资产
├── scripts/                      # 构建、打包和 public/lib 同步脚本
├── test/                         # Node test 测试
├── cloudflare-pages-worker.mjs   # Cloudflare Pages API Worker
├── generate-image.mjs            # 命令行单图生成入口
├── server.mjs                    # 本地 Web 服务入口
├── launch-studio.cmd             # Windows 快速启动器
├── launch-studio.ps1             # Windows PowerShell 启动器
├── stop-studio-services.cmd      # 停止本地服务脚本
├── wrangler.jsonc                # Cloudflare Pages 配置
├── wrangler.api.jsonc            # Worker API 配置
├── vercel.json                   # Vercel 兼容配置
├── package-lock.json
└── package.json
```
