# GPT-Image2-Studio

一个面向本地创作流的图片生成工作台：用浏览器管理提示词、参考图、比例、分辨率和历史画廊，通过本机 Node 服务转发 `Responses API`，并使用内置 `image_generation` 工具调用 `gpt-image-2` 生成图片。

> API Key 只保存在本机 `.local/config.json`，公开仓库不内置私人 Base URL，生成结果默认写入 Windows 图片目录，不会随源码提交到 GitHub。

## 功能概览

| 模块 | 能力 |
| --- | --- |
| Studio | 提示词输入、参考图上传、比例选择、分辨率选择、推理强度选择、实时生成状态 |
| 队列 | 最多 12 个生成任务排队，最多 4 个任务并发请求 |
| 模板 | 本地提示词模板，可创建、修改、插入和删除 |
| 画廊 | 按日期分组、本地缩略图、关键词筛选、日期筛选、尺寸筛选、参考图筛选 |
| 本地服务 | 静态页面托管、配置保存、SSE 转发、图片写入、输出目录打开 |
| 命令行 | 支持直接用 `npm run generate` 生成单张图片 |
| Windows 安装包 | 使用系统自带 IExpress 打包为 `.exe` 安装器，内置当前 Node 运行时 |

## 技术栈

| 层级 | 技术 |
| --- | --- |
| Runtime | Node.js 20+，ES Modules |
| Server | Node 原生 `http` 服务，无外部 npm 依赖 |
| Frontend | 原生 HTML / CSS / JavaScript，浏览器端 ESM |
| API | `POST /responses`，`tools[].type = "image_generation"`，`tools[].model = "gpt-image-2"` |
| Streaming | `text/event-stream` / SSE，监听中途预览和最终图片事件 |
| Storage | 本地 `.local/config.json` 保存配置，`Pictures/YYYY-MM-DD/` 保存输出 |
| Packaging | Windows `iexpress.exe` + `tar.exe`，生成自解压安装包 |

## 快速启动

### 方式一：本地开发启动

```powershell
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
| 分辨率 | `auto` 或当前比例支持的尺寸 | `auto` 会使用该比例的默认尺寸 |
| 推理强度 | `low`、`medium`、`high`、`xhigh` | 默认 `xhigh` |
| 图片质量 | `high` | 当前默认高质量 |
| 输出格式 | `png` | 工作台默认保存为 PNG |

### 任务队列与提示词模板

- 同一会话最多保留 12 个生成任务，最多 4 个任务并发请求，剩余任务会在前序任务完成后自动继续。
- 提示词框旁的模板按钮会打开本地 Prompt Kit，可创建、修改、插入和删除提示词模板，模板数据保存在浏览器本地。

![提示词模板弹窗](prompt-template-popover.png)

### 比例与尺寸完整表

`auto` 会使用“默认”列的尺寸；手动选择分辨率时，按对应比例行横向选择。重复分辨率只展示一次。

| 比例 | 默认 | 分辨率 1 | 分辨率 2 | 分辨率 3 | 分辨率 4 |
| --- | --- | --- | --- | --- | --- |
| `1:1` | `1024x1024` | `1024x1024` | `1536x1536` | `2048x2048` | `2880x2880` |
| `5:4` | `1280x1024` | `1280x1024` | `1920x1536` | `2560x2048` | `3200x2560` |
| `9:16` | `1008x1792` | `1008x1792` | `1584x2816` | `2016x3584` | `2160x3840` |
| `21:9` | `2352x1008` | `2352x1008` | `3696x1584` | - | - |
| `16:9` | `1792x1008` | `1792x1008` | `2816x1584` | `3584x2016` | `3840x2160` |
| `4:3` | `1344x1008` | `1344x1008` | `2048x1536` | `2752x2064` | `3264x2448` |
| `3:2` | `1536x1024` | `1536x1024` | `2304x1536` | `3072x2048` | `3504x2336` |
| `4:5` | `1024x1280` | `1024x1280` | `1536x1920` | `2048x2560` | `2560x3200` |
| `3:4` | `1008x1344` | `1008x1344` | `1536x2048` | `2064x2752` | `2448x3264` |
| `2:3` | `1024x1536` | `1024x1536` | `1536x2304` | `2048x3072` | `2336x3504` |

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
| 内置 Node | 复制本机 `node.exe` 到安装包运行时目录 |
| 生成 Payload | 用 `tar.exe` 打包为 `payload.zip` |
| 生成 EXE | 用 Windows 自带 `iexpress.exe` 输出安装器 |

安装包产物位于：

```text
artifacts/windows-installer/<build-id>/GPT-Image2-Studio-Setup-v0.1.0.exe
```

安装后默认写入：

```text
%LOCALAPPDATA%\GPT-Image2-Studio
```

安装器会创建开始菜单和桌面启动脚本。启动脚本会自动寻找可用端口、拉起本地服务并打开浏览器。

## GitHub 发布建议

源码仓库建议保持私有或按需公开。发布 Release 时上传安装包：

```powershell
gh release create v0.1.0 artifacts/windows-installer/<build-id>/GPT-Image2-Studio-Setup-v0.1.0.exe --title "GPT-Image2-Studio v0.1.0" --notes-file docs/windows-installer.md
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
└─ package.json
```
