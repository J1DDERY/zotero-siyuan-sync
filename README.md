# Zotero SiYuan Sync

一键将 Zotero 论文发送到 [SiYuan 笔记](https://github.com/siyuan-note/siyuan) 生成精读笔记（含 DeepSeek AI 分析）。

## 功能

- ✅ **右键菜单**：选中论文 → 右键 → 发送到 SiYuan 精读笔记
- ✅ **工具栏按钮**：一键导入
- ✅ **DeepSeek AI 分析**：自动生成研究动机、方法、创新点摘要
- ✅ **结构化笔记**：元数据 + AI 分析 + 个人思考，直接写入 SiYuan
- ✅ **不依赖 Zotero 数据库**：绕过锁冲突，直接从插件获取元数据

## 安装

1. 在 [Releases](https://github.com/emc-research/zotero-siyuan-sync/releases) 下载最新 `.xpi` 文件
2. Zotero → 工具 → 插件 → ⚙ → Install Add-on From File...
3. 选择下载的 `.xpi` 文件
4. 重启 Zotero

## 使用

1. 确保 **SiYuan** 在运行
2. 在 Zotero 中选中一篇有 DOI 的论文
3. **右键 → 发送到 SiYuan 精读笔记**
4. 等待 DeepSeek AI 分析（约 20 秒）
5. 在 SiYuan 中查看生成的笔记

## 依赖

- Zotero ≥ 9.0.3
- SiYuan (本地运行，默认端口 6806)
- Python 3.12+
- DeepSeek API Key（已内置，如需更换请编辑 `siyuan_import.py`）

## 项目结构

```
zotero-siyuan-sync/
├─ bootstrap.js              # Zotero 插件入口
├─ manifest.json             # 插件清单
├─ prefs.js                  # 默认配置
├─ updates.json              # 自动更新地址
├─ chrome/content/
│  ├─ icons/                 # 图标
│  └─ scripts/
│     └─ siyuan-sync.js      # 主逻辑
├─ siyuan_import.py          # Python 后端（独立可运行）
├─ build_xpi.py              # XPI 打包脚本
└─ README.md
```

## 开发

```bash
# 打包 XPI
python build_xpi.py

# 测试 Python 后端
python siyuan_import.py _tmp_import.json --dir 笔记本名
```

## 自行构建

```bash
git clone https://github.com/YOUR_USERNAME/zotero-siyuan-sync.git
cd zotero-siyuan-sync
python build_xpi.py
# 生成的 xpi 在桌面
```

## 许可

MIT
