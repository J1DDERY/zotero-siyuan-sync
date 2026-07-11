# Zotero SiYuan Sync

> Zotero 插件：一键将论文发送到 SiYuan 笔记，自动生成含 DeepSeek AI 分析的**精读笔记**

[![Zotero](https://img.shields.io/badge/Zotero-9.0.3+-CC2936?logo=zotero&logoColor=white)](https://www.zotero.org)
[![SiYuan](https://img.shields.io/badge/SiYuan-3.7.1+-3884FF?logo=siyuan&logoColor=white)](https://github.com/siyuan-note/siyuan)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## ✨ 功能

| 功能 | 说明 |
|------|------|
| ✅ **一键导入** | Zotero 右键菜单 + 工具栏按钮 |
| ✅ **DeepSeek AI 分析** | 自动生成研究动机、方法、创新点摘要 |
| ✅ **结构化笔记** | 元数据 + AI 分析 + 个人思考，直接写入 SiYuan |
| ✅ **绕过数据库锁** | 插件直接获取元数据，不走 SQLite |
| ✅ **多笔记本支持** | 通过 `--dir` 参数指定目标笔记本 |

## 📦 安装

### 方法一：从 Release 安装（推荐）

1. 前往 [Releases](https://github.com/emc-research/zotero-siyuan-sync/releases) 下载最新 `.xpi`
2. Zotero → 工具 → 插件 → ⚙ → **Install Add-on From File...**
3. 选择下载的 `.xpi` 文件
4. 重启 Zotero

### 方法二：自行构建

```bash
git clone https://github.com/emc-research/zotero-siyuan-sync.git
cd zotero-siyuan-sync
python build_xpi.py
# 生成的 XPI 位于桌面
```

## 🚀 使用

### 前置条件

- ✅ Zotero ≥ **9.0.3**
- ✅ **SiYuan** 在运行（默认端口 6806）
- ✅ Python **3.12+**
- ✅ 论文在 Zotero 中有 **DOI 字段**

### 操作步骤

```
① 选中论文
      ↓
② 右键 → "发送到 SiYuan 精读笔记"
      ↓
③ 等待 DeepSeek AI 分析（约 20 秒）
      ↓
④ 在 SiYuan 中查看笔记 ✨
```

### 笔记格式

笔记自动生成以下结构：

```markdown
# 论文标题

## 元数据
- **DOI**: 10.1109/...
- **作者**: Author A, Author B
- **期刊**: IEEE Trans. on EMC
- **日期**: 1993
- **链接**: https://doi.org/...

## AI 分析
*DeepSeek 自动生成：研究动机、方法、创新点*

## 个人思考
*（留给你手动补充）*
```

## 🗂️ 项目结构

```
zotero-siyuan-sync/
├─ bootstrap.js                 # Zotero 插件引导（registerChrome + hooks）
├─ manifest.json                # 插件清单（含 update_url）
├─ prefs.js                     # 默认配置
├─ updates.json                 # 自动更新清单（托管在 GitHub raw）
├─ chrome/content/
│  ├─ icons/
│  │  ├─ favicon.png            # 96px 图标
│  │  └─ favicon@0.5x.png       # 48px 图标
│  └─ scripts/
│     └─ siyuan-sync.js         # 主逻辑（菜单注册 + nsIProcess 调用）
├─ siyuan_import.py             # Python 后端（独立可运行）
├─ build_xpi.py                 # XPI 打包脚本
└─ README.md
```

## 🛠️ 开发

```bash
# 打包 XPI
python build_xpi.py

# 测试 Python 后端
python siyuan_import.py _tmp_import.json --dir 笔记本名

# 验证 JSON 格式
python -m json.tool manifest.json

# 查看 Git 提交
git log --oneline --graph
```

### 加载未打包的插件（开发模式）

1. 在 Zotero profile 的 `extensions/` 目录下创建代理文件：

```bash
echo "D:\0_DAT\SiYuan\scripts\zotero-plugin" > \
  "C:\Users\...\extensions\zotero-siyuan-sync@emc-research"
```

2. 删除 `extensions.json` 中该插件条目
3. 重启 Zotero

## 🔧 自定义笔记模板

编辑 `siyuan_import.py` 中 `create_note()` 函数的 `content` 字符串（第 75-88 行）：

```python
content=f"""---
title: {title}
date: {date}
tags: [精读]
---

## 📋 元数据
| 字段 | 值 |
|------|-----|
| DOI | {doi or '无'} |
| 作者 | {authors} |
| 期刊 | {journal} |

## 🤖 AI 总结
{analysis}

## 💭 个人思考

"""
```

## 📄 许可

MIT License

---

**如果这个项目对你有帮助，请给一个 ⭐！**
