# Windows 安装包说明

`GPT-Image2-Studio-Setup-v0.1.2.exe` 是 Windows 自解压安装包，用系统自带 `iexpress.exe` 生成。

## 本次更新

- 套图模式新增 1577 个四级电商类目模板，可逐级选择一级、二级、三级和四级类目，也可按三级/四级类目名或编码搜索。
- 选中四级类目后，套图计划会自动使用对应角色组合、类目路径和拍摄重点。
- 套图参考图智能识别可给出类目线索，并在匹配到明确四级类目时自动切换模板。
- 类目自动匹配收紧了模糊词判断，避免“手机”等泛词误切换到不确定类目。
- 前端改为按需加载四级类目模板，减少初次打开工作台时需要加载的脚本体积。

> 高分辨率更容易触发上游生成失败、超时或无最终图片结果。日常使用建议优先选择 1K 和 2K 分辨率，需要更大尺寸时再逐档尝试。

## 安装内容

安装器会把工作台写入：

```text
%LOCALAPPDATA%\GPT-Image2-Studio
```

安装内容包括本地 Web 服务、浏览器工作台、文档、示例文件、当前 `node_modules/` 依赖和一个内置 `node.exe` 运行时。用户无需额外安装 Node.js 即可启动。

## 启动方式

安装完成后可以通过桌面或开始菜单里的 `GPT-Image2-Studio.cmd` 启动。启动脚本会自动选择可用端口，启动本地服务，并打开浏览器。

## 本地数据

API Key 和配置保存在安装目录下：

```text
%LOCALAPPDATA%\GPT-Image2-Studio\.local\config.json
```

生成图片保存到：

```text
%USERPROFILE%\Pictures\YYYY-MM\MM-DD\
```

PPT 工作流生成的幻灯片图片和 `.pptx` 文件也保存到日期目录，PPT 历史清单保存到：

```text
%USERPROFILE%\Pictures\json\ppt-decks\
```

卸载时可直接删除 `%LOCALAPPDATA%\GPT-Image2-Studio`。如果也要清理生成图片，请手动删除对应日期的图片目录。

## 发布校验

发布前建议确认：

```powershell
npm test
npm run build:installer
```

安装包不包含 `.local/`、`.env*`、`output/`、`artifacts/`、日志文件和本地调试快照。
