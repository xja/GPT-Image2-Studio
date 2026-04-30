# GPT-Image2-Studio

一个面向本地创作流的图片生成工作台：用浏览器管理提示词、参考图、比例、分辨率、PPT 生成和历史画廊，通过本机 Node 服务转发 `Responses API`，并使用内置 `image_generation` 工具调用 `gpt-image-2` 生成图片。

> API Key 只保存在本机 `.local/config.json`，公开仓库不内置私人 Base URL，生成结果默认写入 Windows 图片目录，不会随源码提交到 GitHub。

## 功能概览

| 模块 | 能力 |
| --- | --- |
| Studio | 提示词输入、参考图上传、比例选择、分辨率选择、推理强度选择、输出格式选择、实时生成状态 |
| PPT | 上传文档、输入文本或主题生成 PPT 大纲、逐页生成幻灯片、补齐缺页、标注重绘单页、导出 `.pptx` |
| 队列 | 最多 20 个生成任务排队，最多 2 个任务并发请求，尚未开始的排队任务可取消 |
| 模板 | 本地提示词模板，可创建、修改、插入和删除 |
| 画廊 | 按日期分组、本地缩略图、关键词筛选、日期筛选、尺寸筛选、参考图筛选 |
| 本地服务 | 静态页面托管、配置保存、SSE 转发、图片写入、输出目录打开 |
| 命令行 | 支持直接用 `npm run generate` 生成单张图片 |
| Windows 安装包 | 使用系统自带 IExpress 打包为 `.exe` 安装器，内置当前 Node 运行时 |

## 功能更新

- 新增 PPT 生成工作流：支持 PDF / DOCX / PPTX / TXT / MD / CSV 文件、文本材料或主题输入生成演示文稿。
- PPT 页面按 16:9 幻灯片图像生成，可补齐失败页，并支持在单页上涂抹标注后重新生成。
- 新增 PPTX 导出，支持转场效果、自动播放时间和动态组件预设。
- 任务队列改为最多 20 个任务、2 个并发，未开始的排队任务可以直接取消。
- 参数区新增输出格式选择，工作台支持 PNG / JPG 保存。
- 实时动态会同步任务状态，并在有新动态时显示提示。
- 生成流程增强了流式结果解析、最终图片提取、非流式兜底和上游错误提示。
- 分辨率预设已更新，默认尺寸优先落在 1K 到 2K 区间。

> 高分辨率容易触发生成失败、超时或没有最终图片结果。建议日常最好使用 1K 和 2K 分辨率，需要更大图时再逐档尝试。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| Runtime | Node.js 20+，ES Modules |
| Server | Node 原生 `http` 服务，PPTX 导出依赖 `jszip` 和 `pptxgenjs` |
| Frontend | 原生 HTML / CSS / JavaScript，浏览器端 ESM |
| API | `POST /responses`，结构化大纲生成，`tools[].type = "image_generation"`，`tools[].model = "gpt-image-2"` |
| Streaming | `text/event-stream` / SSE，监听中途预览和最终图片事件 |
| Storage | 本地 `.local/config.json` 保存配置，`Pictures/YYYY-MM-DD/` 保存图片和 PPTX，`Pictures/json/ppt-decks/` 保存 PPT 清单 |
| Packaging | Windows `iexpress.exe` + `tar.exe`，生成自解压安装包 |

## 快速启动

### 方式一：本地开发启动

```powershell
npm install
npm start
```

启动后打开：

```text
http://localhost:3600
```

如果 `3600` 端口已被占用，可以手动指定端口：

```powershell
$env:PORT="3601"
npm start
```

### 方式二：Windows 启动器

双击项目根目录下的：

```text
launch-studio.cmd
```

启动器会检查端口、拉起 `node server.mjs`，并自动打开浏览器。

### 方式三：命令行生成

```powershell
npm run generate -- --prompt "一张产品海报，明亮商业摄影，干净背景" --size "1024x1536" --quality "high" --format "jpeg"
```

查看命令行帮助：

```powershell
npm run help
```

### 方式四：PPT 生成

启动工作台后切换到顶部 `PPT` 视图，或直接打开：

```text
http://localhost:3600/#ppt
```

PPT 工作流支持三种输入方式：上传文档、粘贴文本、只输入主题。生成过程会先生成结构化大纲，再逐页生成 16:9 幻灯片图片，最后导出 `.pptx` 文件。

## 配置方式

首次打开工作台后，进入右上角“配置”，填写：

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| Base URL | `https://api.openai.com/v1` | Responses API 根路径 |
| API Key | 空 | 可使用你的中转 Key 或 OpenAI Key |
| Responses Model | `gpt-5.4` | 外层 Responses 模型 |
| Image Model | `gpt-image-2` | 固定由图片工具调用 |

公开仓库只保留 OpenAI 官方根路径作为安全默认值。如果使用私有中转服务，请只在工作台配置、`.env` 或命令行临时环境变量中填写真实 Base URL，不要写入 README、示例代码或可提交文件。

配置会保存到：

```text
<项目目录>/.local/config.json
```

`.local/` 已加入 `.gitignore`，不会提交到仓库。

## 参数选择

### 工作台参数

| 参数 | 可选值 | 说明 |
| --- | --- | --- |
| 提示词 | 任意文本 | 生成主体、风格、构图、场景和限制 |
| 参考图 | 最多 6 张 | 通过 `referenceImages` 上传给本地服务 |
| 比例 | `1:1`、`5:4`、`9:16`、`21:9`、`16:9`、`4:3`、`3:2`、`4:5`、`3:4`、`2:3` | 会自动追加比例构图提示 |
| 分辨率 | `auto` 或当前比例支持的尺寸 | `auto` 会使用该比例的默认尺寸；建议优先使用 1K 和 2K |
| 推理强度 | `low`、`medium`、`high`、`xhigh` | 默认 `xhigh` |
| 图片质量 | `high` | 当前默认高质量 |
| 输出格式 | `png`、`jpg` | 工作台默认保存为 PNG |

### 任务队列与提示词模板

- 同一会话最多保留 20 个生成任务，最多 2 个任务并发请求，剩余任务会在前序任务完成后自动继续；尚未开始的排队任务可在缩略图右上角取消。
- 提示词框旁的模板按钮会打开本地 Prompt Kit，可创建、修改、插入和删除提示词模板，模板数据保存在浏览器本地。

![提示词模板弹窗](prompt-template-popover.png)

### PPT 参数

| 参数 | 可选值 | 说明 |
| --- | --- | --- |
| 输入方式 | 上传文档、文本材料、主题 | 上传文档支持 PDF / DOCX / PPTX / TXT / MD / CSV |
| 页数 | 1-20 | 大纲页数和生成页数会严格匹配 |
| 风格 | 商务汇报、教育培训、产品发布、营销提案、科技发布等 | 用于约束整套演示文稿视觉方向 |
| 动态组件 | 智能动态或具体预设 | 影响页面中的进度条、焦点高亮、箭头流线、数据卡片等组件 |
| 转场 | 无、淡入、推入、擦除等 | 导出 PPTX 时写入幻灯片转场 |
| 自动播放 | 秒数 | 导出 PPTX 时用于自动切页 |

PPT 每页默认使用 `2048x1152` 的 16:9 画布。生成失败的页面可以点“补齐缺页”继续生成；已生成页面可以打开单页编辑器，用涂抹标注和文字说明重新生成。

### 比例与尺寸完整表

`auto` 会使用“默认”列的尺寸；手动选择分辨率时，按对应比例行横向选择。表格中重复的分辨率会按列完整保留。高分辨率更容易报错，建议优先选择 1K 和 2K 尺寸。

| 比例 | 默认 | 分辨率 1 | 分辨率 2 | 分辨率 3 | 分辨率 4 | 分辨率 5 | 分辨率 6 | 分辨率 7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `1:1` | `1024x1024` | `1024x1024` | `1536x1536` | `2048x2048` | `2816x2816` | - | - | - |
| `5:4` | `1280x1024` | `1280x1024` | `1920x1536` | `2560x2048` | `3120x2496` | - | - | - |
| `9:16` | `720x1280` | `720x1280` | `1152x2048` | `2016x3584` | `2151x3824` | `2160x3840` | - | - |
| `21:9` | `1680x720` | `1680x720` | `1916x821` | `2688x1152` | `3360x1440` | `3824x1639` | `3832x1642` | `3840x1646` |
| `16:9` | `1280x720` | `1280x720` | `2048x1152` | `3584x2016` | `3824x2151` | `3840x2160` | - | - |
| `4:3` | `1024x768` | `1024x768` | `1536x1152` | `2048x1536` | `3072x2304` | - | - | - |
| `3:2` | `1536x1024` | `1536x1024` | `2304x1536` | `3072x2048` | `3456x2304` | - | - | - |
| `4:5` | `1024x1280` | `1024x1280` | `1536x1920` | `2048x2560` | `2496x3120` | - | - | - |
| `3:4` | `768x1024` | `768x1024` | `1536x2048` | `1920x2560` | `2304x3072` | `2448x3264` | - | - |
| `2:3` | `1024x1536` | `1024x1536` | `1536x2304` | `2048x3072` | `2304x3456` | - | - | - |

### 命令行参数

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--prompt` | 内置示例提示词 | 图片提示词 |
| `--size` | `1024x1536` | 图片尺寸 |
| `--quality` | `high` | 图片质量 |
| `--format` | `jpeg` | 输出格式 |
| `--output` | `output/generated-时间戳.<ext>` | 输出文件路径 |
| `--base-url` | `OPENAI_BASE_URL` 或 `https://api.openai.com/v1` | API 根路径 |
| `--model` | `RESPONSES_MODEL` 或 `gpt-5.4` | 外层 Responses 模型 |

命令行模式需要环境变量：

```powershell
$env:OPENAI_API_KEY="你的 API Key"
$env:OPENAI_BASE_URL="https://api.openai.com/v1"
$env:RESPONSES_MODEL="gpt-5.4"
```

如果接入兼容代理，把 `OPENAI_BASE_URL` 替换为你的私有端点即可；真实地址建议只放在本机 `.env` 或当前终端环境变量里。

## 输出路径

工作台生成的图片默认保存到 Windows 图片目录：

```text
C:\Users\<你的用户名>\Pictures\YYYY-MM-DD\
```

每张图片会同时保存一份同名元数据，画廊会按日期读取并展示这些本地输出。页面里的“打开输出目录”会直接打开当天目录。

PPT 工作流生成的幻灯片图片和 `.pptx` 文件也保存在当天日期目录中，PPT 历史清单保存在：

```text
C:\Users\<你的用户名>\Pictures\json\ppt-decks\
```

命令行生成默认保存到项目内：

```text
output/generated-时间戳.<ext>
```

`output/` 已被忽略，不会提交到 GitHub。

## Windows 安装包

生成安装包：

```powershell
npm run build:installer
```

构建脚本会：

| 步骤 | 说明 |
| --- | --- |
| 准备应用文件 | 复制 `server.mjs`、`lib/`、`public/`、文档和启动文件 |
| 准备依赖 | 复制 `package-lock.json` 和当前 `node_modules/` |
| 内置 Node | 复制本机 `node.exe` 到安装包运行时目录 |
| 生成 Payload | 用 `tar.exe` 打包为 `payload.zip` |
| 生成 EXE | 用 Windows 自带 `iexpress.exe` 输出安装器 |

安装包产物位于：

```text
artifacts/windows-installer/<build-id>/GPT-Image2-Studio-Setup-v0.1.1.exe
```

安装后默认写入：

```text
%LOCALAPPDATA%\GPT-Image2-Studio
```

安装器会创建开始菜单和桌面启动脚本。启动脚本会自动寻找可用端口、拉起本地服务并打开浏览器。

## GitHub 发布建议

源码仓库建议保持私有或按需公开。发布 Release 时上传安装包：

```powershell
gh release create v0.1.1 artifacts/windows-installer/<build-id>/GPT-Image2-Studio-Setup-v0.1.1.exe --title "GPT-Image2-Studio v0.1.1" --notes-file docs/windows-installer.md
```

发布前请确认 `.local/`、除 `.env.example` 外的 `.env*`、`output/`、`artifacts/` 和日志文件没有进入提交。

## 项目结构

```text
GPT-Image2-Studio/
├─ docs/                     # 教程和发布说明
├─ examples/                 # 示例素材或示例数据
├─ lib/                      # 服务端和前端共享逻辑
├─ public/                   # 浏览器工作台
├─ scripts/                  # 构建和打包脚本
├─ test/                     # Node test 测试
├─ generate-image.mjs        # 命令行生成入口
├─ server.mjs                # 本地 Web 服务入口
├─ launch-studio.cmd         # Windows 快速启动器
├─ stop-studio-services.cmd  # 停止本地服务脚本
├─ package-lock.json         # npm 依赖锁定文件
└─ package.json
```
