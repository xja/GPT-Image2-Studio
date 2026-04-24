# Responses API 图片生成示例

这个示例演示如何通过 `POST /responses` 调用内置工具 `image_generation` 生成图片，并从流式 SSE 事件里的 `response.output_item.done` 提取最终图片的 base64 数据。

如果你想直接复制一版可发帖教程，见：

- [docs/2026-04-22-responses-api-image-generation-tutorial.md](docs/2026-04-22-responses-api-image-generation-tutorial.md)

如果你想直接使用本地 HTML 工作台，执行：

```powershell
npm start
```

然后打开：

```text
http://localhost:3600
```

工作台能力：

- 在浏览器里填写中转 URL、API Key 和默认参数
- 支持提示词 + 可选参考图上传
- 通过本地 Node 服务转发 `Responses API`
- 实时展示生成状态和中途预览
- 最终图片自动保存到 Windows 图片目录下的 `YYYY-MM-DD/`
- 页面底部自动展示本地画廊

Windows 下也可以直接双击：

```text
launch-studio.cmd
```

启动器会先检查 `3600` 端口；如果服务未启动，会先拉起 `node server.mjs`，然后自动打开浏览器。

目标场景：

- 不优先走 `POST /v1/images/generations`
- 外层模型继续使用 `gpt-5.4`
- 在 `tools` 里显式指定 `"model": "gpt-image-2"`
- 开启 `"stream": true`
- 从 `response.output_item.done` 中提取 `item.result`

## 目录

```text
responses-image-generation-demo-2026-04-22/
├─ .env.example
├─ .gitignore
├─ generate-image.mjs
├─ package.json
└─ README.md
```

## 运行环境

- Node.js 20 及以上
- 一个可用的 API Key

## 默认接口地址

脚本默认请求：

```text
https://api.asxs.top/v1/responses
```

如果你的代理要求其他前缀，比如 `https://api.asxs.top/openai/v1`，可以通过环境变量或命令行参数覆盖：

```powershell
$env:ASXS_BASE_URL="https://api.asxs.top/openai/v1"
```

或：

```powershell
npm run generate -- --base-url "https://api.asxs.top/openai/v1"
```

## 配置环境变量

复制 `.env.example` 的内容，至少准备下面这些变量：

```powershell
$env:ASXS_API_KEY="你的 key"
$env:ASXS_BASE_URL="https://api.asxs.top/v1"
$env:RESPONSES_MODEL="gpt-5.4"
```

脚本会优先读取：

- `ASXS_API_KEY`
- `OPENAI_API_KEY`

## 直接运行

```powershell
npm run generate -- --prompt "生成一张美女抖音直播带货的写实风图片，主播坐在直播桌前展示商品，竖版构图，灯光专业，适合电商宣传"
```

如果不传 `--prompt`，脚本会使用内置默认提示词。

成功后，图片会写入：

```text
output/generated-时间戳.jpeg
```

## 请求体结构

脚本发送的核心请求体如下：

```json
{
  "model": "gpt-5.4",
  "input": "生成一张美女抖音直播带货的写实风商业摄影图片",
  "stream": true,
  "tool_choice": {
    "type": "image_generation"
  },
  "tools": [
    {
      "type": "image_generation",
      "model": "gpt-image-2",
      "size": "1024x1536",
      "quality": "high",
      "output_format": "jpeg",
      "background": "opaque"
    }
  ]
}
```

关键点：

- 顶层 `model` 是 Responses 的外层模型，不是图片模型
- 图片模型通过 `tools[].model = "gpt-image-2"` 指定
- `tool_choice` 明确要求直接走图片工具，减少先回文本的概率

## SSE 处理逻辑

脚本会解析 `text/event-stream`，重点关注这几类事件：

- `response.image_generation_call.partial_image`
- `response.output_item.done`
- `response.completed`

最终图的提取逻辑是：

1. 监听 `response.output_item.done`
2. 判断 `payload.item.type === "image_generation_call"`
3. 如果 `payload.item.result` 存在，就把它当成最终图片 base64

脚本同时保留了一个兜底逻辑：

- 如果代理把最终结果放进 `response.completed.response.output`，也会尝试从那里提取 `image_generation_call.result`

## 代理兼容注意事项

这个项目里有两个边界要分清：

1. OpenAI 官方文档已经明确支持在 Responses API 中使用图像生成工具，并在工具里指定 `gpt-image-2`
2. 具体代理是否支持 `https://api.asxs.top/v1`、`https://api.asxs.top/openai/v1`，以及是否对 `tools[].model` 做了旧版枚举校验，取决于代理自己的实现

所以这份示例默认按你当前提供的信息优先走：

```text
https://api.asxs.top/v1/responses
```

如果你实测自己的 key 只能走别的前缀，改 `ASXS_BASE_URL` 即可，不需要改脚本主体。

## 可调参数

```powershell
npm run generate -- `
  --prompt "生成一张美女抖音直播带货的写实风图片" `
  --size "1024x1536" `
  --quality "high" `
  --format "jpeg" `
  --output ".\\output\\douyin-live.jpeg"
```

## 官方参考

- [OpenAI Image Generation Tool Guide](https://developers.openai.com/api/docs/guides/tools-image-generation)
- [OpenAI Streaming Responses Guide](https://developers.openai.com/api/docs/guides/streaming-responses)
- [OpenAI Responses API Reference](https://developers.openai.com/api/reference/resources/responses/methods/create)
