# Windows 安装包说明

`GPT-Image2-Studio-Setup-v0.1.1.exe` 是 Windows 自解压安装包，用系统自带 `iexpress.exe` 生成。

## 本次更新

- 任务队列调整为最多 20 个任务、2 个并发，尚未开始的排队任务可以取消。
- 新增 PNG / JPG 输出格式选择，生成元数据会记录实际输出格式。
- 实时动态改为保留任务状态，并增加新动态提示。
- 增强流式响应解析、最终图片提取、非流式兜底和上游错误提示，兼容性更稳。
- 更新多比例分辨率预设，默认优先选择 1K 到 2K 区间。

> 高分辨率更容易触发上游生成失败、超时或无最终图片结果。日常使用建议优先选择 1K 和 2K 分辨率，需要更大尺寸时再逐档尝试。

## 安装内容

安装器会把工作台写入：

```text
%LOCALAPPDATA%\GPT-Image2-Studio
```

安装内容包括本地 Web 服务、浏览器工作台、文档、示例文件和一个内置 `node.exe` 运行时。用户无需额外安装 Node.js 即可启动。

## 启动方式

安装完成后可以通过桌面或开始菜单里的 `GPT-Image2-Studio.cmd` 启动。启动脚本会自动选择可用端口，启动本地服务，并打开浏览器。

## 本地数据

API Key 和配置保存在安装目录下：

```text
%LOCALAPPDATA%\GPT-Image2-Studio\.local\config.json
```

生成图片保存到：

```text
%USERPROFILE%\Pictures\YYYY-MM-DD\
```

卸载时可直接删除 `%LOCALAPPDATA%\GPT-Image2-Studio`。如果也要清理生成图片，请手动删除对应日期的图片目录。

## 发布校验

发布前建议确认：

```powershell
npm test
npm run build:installer
```

安装包不包含 `.local/`、`.env*`、`output/`、`artifacts/`、日志文件和本地调试快照。
