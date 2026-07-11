#!/usr/bin/env python3
"""siyuan_import.py — 从 JSON 文件导入到 SiYuan（不依赖 Zotero 数据库）"""

import json, urllib.request, urllib.parse, sys, os, re
from datetime import datetime

API="http://127.0.0.1:6806"
PROXY="http://127.0.0.1:10809"

# ── DeepSeek API 配置 ──────────────────────────
DS_KEY=os.environ.get("DEEPSEEK_API_KEY")
if not DS_KEY:
    print("❌ 请设置 DEEPSEEK_API_KEY 环境变量")
    print("   Windows: set DEEPSEEK_API_KEY=sk-你的key")
    sys.exit(1)
# DS_KEY = "sk-你的key"  # ← 取消注释并填入 key
DS_MODEL="deepseek-chat"

proxy=urllib.request.ProxyHandler({"http":PROXY,"https":PROXY})
ds_opener=urllib.request.build_opener(proxy)
ds_headers={"Authorization":f"Bearer {DS_KEY}","Content-Type":"application/json"}

def req(d,p):
    u=urllib.request.Request(f"{API}{p}",data=json.dumps(d).encode(),headers={"Content-Type":"application/json"})
    return json.loads(urllib.request.urlopen(u,timeout=15).read())

def llm_analyze(title,abstract,authors,journal):
    prompt=f"""你是一名电磁兼容(EMC)领域研究者。精读以下论文：

标题: {title}
作者: {authors}
期刊: {journal}
摘要: {abstract[:800] if abstract else '无'}

用中文按以下格式逐项回答，每项2-4句话：

研究动机: 
方法与技术路线: 
关键创新点: 
关键结果: （列出具体数值）
局限与展望: """
    data=json.dumps({"model":DS_MODEL,
        "messages":[{"role":"user","content":prompt}],
        "temperature":0.1,"max_tokens":800}).encode()
    try:
        r=json.loads(ds_opener.open(urllib.request.Request(
            "https://api.deepseek.com/v1/chat/completions",data=data,
            headers=ds_headers),timeout=60).read())
        text=r["choices"][0]["message"]["content"]
        parts={}
        for key in ["研究动机","方法与技术路线","关键创新点","关键结果","局限与展望"]:
            m=re.search(rf'{re.escape(key)}:\s*(.*?)(?=\n\n(?:研究动机|方法与技术路线|关键创新点|关键结果|局限与展望)|$)',text,re.DOTALL)
            parts[key]=m.group(1).strip() if m else "(待补充)"
        return parts
    except Exception as e:
        return {k:f"（LLM 分析失败: {e}）" for k in ["研究动机","方法与技术路线","关键创新点","关键结果","局限与展望"]}

def find_notebook(subdir_hint=""):
    """查找 SiYuan 笔记本"""
    NOTEBOOK_MAP={
        "E1":"[E] 电磁干扰与电磁兼容","E2":"[E] 电磁干扰与电磁兼容","E3":"[E] 电磁干扰与电磁兼容",
        "E4":"[E] 电磁干扰与电磁兼容","E5":"[E] 电磁干扰与电磁兼容",
        "M1":"[M] 电磁测量与传感","M2":"[M] 电磁测量与传感","M3":"[M] 电磁测量与传感",
        "M4":"[M] 电磁测量与传感","M5":"[M] 电磁测量与传感",
        "P1":"[P] 电力电子与电能质量","P2":"[P] 电力电子与电能质量","P3":"[P] 电力电子与电能质量",
        "P4":"[P] 电力电子与电能质量","P5":"[P] 电力电子与电能质量",
        "L1":"[L] 脉冲功率与等离子体","L2":"[L] 脉冲功率与等离子体",
        "A1":"[A] 天线与传播","A2":"[A] 天线与传播",
        "C1":"[C] 电路与系统","C2":"[C] 电路与系统",
        "S1":"[S] 信号处理与成像",
        "H1":"[H] 高电压与绝缘",
    }
    ret=req({},"/api/notebook/lsNotebooks")
    notebooks=ret["data"]["notebooks"]

    # 优先按 --dir 提示匹配
    if subdir_hint:
        long=NOTEBOOK_MAP.get(subdir_hint,"")
        if long:
            for nb in notebooks:
                if nb["name"]==long:
                    return nb["id"], subdir_hint
        # fallback: 模糊匹配
        for nb in notebooks:
            if subdir_hint in nb["name"]:
                return nb["id"], subdir_hint

    # fallback: 找包含 缓冲区 的
    for nb in notebooks:
        if "缓冲区" in nb["name"]:
            return nb["id"], "未分类"
    # 第一个可用
    if notebooks:
        return notebooks[0]["id"], "未分类"
    return None, None

def create_note(meta,nb_id,sub_name):
    title=meta.get("title","无标题")
    doi=meta.get("doi","")
    authors=", ".join(meta.get("authors",[]))
    journal=meta.get("journal","")
    abstract=meta.get("abstract","")
    date=meta.get("date","")
    url=meta.get("url","")
    key=meta.get("key","")

    # AI 分析
    print(f"   🤖 DeepSeek 分析中...")
    analysis=llm_analyze(title,abstract,meta.get("authors",[]),journal)

    # 笔记名称
    safe_name=f"📖 {re.sub(r'[\\\\/:*?\"<>|]','',title)[:30].strip()}"
    path=f"/{safe_name}"

    md=f"""# {title}

> **精读笔记** | {datetime.now().strftime('%Y-%m-%d')} | 源: Zotero

---

## 📋 元数据

| 字段 | 内容 |
|------|------|
| **标题** | {title} |
| **作者** | {authors or '未知'} |
| **期刊** | {journal or '未知'} |
| **DOI** | [{doi}](https://doi.org/{doi}) |
| **Zotero** | [{key}]({url or '#'}) |

---

## 🎯 研究动机

{analysis.get('研究动机','(待补充)')}

---

## 🔧 方法与技术路线

{analysis.get('方法与技术路线','(待补充)')}

---

## ✨ 关键创新点

{analysis.get('关键创新点','(待补充)')}

---

## 📊 关键结果

{analysis.get('关键结果','(待补充)')}

---

## 💭 局限与展望

{analysis.get('局限与展望','(待补充)')}

---

## ✏️ 个人思考

<!-- 在此记录你对本文的看法、与自己研究的关联 -->

---

*笔记创建于 {datetime.now().strftime('%Y-%m-%d %H:%M')}*
"""
    ret=req({"notebook":nb_id,"path":path,
        "title":safe_name[:80],"type":"d","markdown":md},
        "/api/filetree/createDocWithMd")
    if ret.get("code")==0:
        print(f"   ✅ 已创建: {title[:40]}...")
        # 清理临时文件
        try:os.remove(sys.argv[1])
        except:pass
        return True
    else:
        print(f"   ❌ 创建失败: {ret.get('msg','')}")
        return False

def main():
    if len(sys.argv)<2:
        print("用法: python siyuan_import.py <json_file> [--dir 目录名]")
        sys.exit(1)

    json_path=sys.argv[1]
    subdir=""
    if len(sys.argv)>3 and sys.argv[2]=="--dir":
        subdir=sys.argv[3]

    if not os.path.exists(json_path):
        print(f"❌ 文件不存在: {json_path}")
        sys.exit(1)

    with open(json_path) as f:
        meta=json.load(f)

    title=meta.get("title","无标题")
    doi=meta.get("doi","")
    print(f"📄 {title}")
    if doi:print(f"   DOI: {doi}")

    nb_id,sub_name=find_notebook(subdir)
    if not nb_id:
        print("❌ 找不到 SiYuan 笔记本，请先启动 SiYuan")
        sys.exit(1)
    print(f"   笔记本: {sub_name or '未分类'}")
    print(f"   目标: SiYuan/{sub_name or '未分类'}")

    ok=create_note(meta,nb_id,sub_name)
    if ok:
        print("✅ 导入成功")
    else:
        print("❌ 导入失败")

if __name__=="__main__":
    main()
