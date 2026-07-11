#!/usr/bin/env python3
"""siyuan_import.py — 从 JSON 文件导入到 SiYuan（不依赖 Zotero 数据库）"""

import json, urllib.request, urllib.parse, sys, os, re
from datetime import datetime

API="http://127.0.0.1:6806"
PROXY="http://127.0.0.1:10809"
DS_KEY="sk-89881757f3c044929e38c53b4249b115"
DS_MODEL="deepseek-chat"

def req(d,p):
    u=urllib.request.Request(f"{API}{p}",data=json.dumps(d).encode(),headers={"Content-Type":"application/json"})
    return json.loads(urllib.request.urlopen(u,timeout=15).read())

ds_headers={"Authorization":f"Bearer {DS_KEY}","Content-Type":"application/json"}
proxy=urllib.request.ProxyHandler({"http":PROXY,"https":PROXY})
ds_opener=urllib.request.build_opener(proxy)

def llm_analyze(title,abstract,authors,journal):
    prompt=f"""你是一位电磁兼容/高电压研究领域的专家。请分析以下论文，输出中文结果。

标题: {title}
作者: {', '.join(authors) if authors else '未知'}
期刊: {journal or '未知'}
摘要: {abstract or '无'}

请输出以下内容（每项一行，不要序号）:
研究动机/背景（1-2句话）
研究方法（1-2句话）
主要创新点（1-2句话）
"""
    data={"model":DS_MODEL,"messages":[{"role":"user","content":prompt}],"temperature":0.3,"max_tokens":800}
    try:
        u=ds_opener.open(urllib.request.Request("https://api.deepseek.com/chat/completions",data=json.dumps(data).encode(),headers=ds_headers),timeout=30)
        r=json.loads(u.read())
        return r["choices"][0]["message"]["content"].strip()
    except Exception as e:
        return f"AI 分析失败: {e}"

def find_notebook(subdir_hint=""):
    """查找 SiYuan 笔记本"""
    ret=req({},"/api/notebook/lsNotebooks")
    notebooks=ret["data"]["notebooks"]
    # 先根据提示匹配
    if subdir_hint:
        for nb in notebooks:
            if subdir_hint in nb["name"]:
                return nb["id"], subdir_hint
    # 找包含 缓冲区 的
    for nb in notebooks:
        if "缓冲区" in nb["name"]:
            return nb["id"], "未分类"
    # 随便用第一个
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

    # AI 分析
    print(f"   🤖 DeepSeek 分析中...")
    analysis=llm_analyze(title,abstract,meta.get("authors",[]),journal)

    safe_name=re.sub(r'[\\/:*?"<>|]','_',title)[:60]
    path=f"/{safe_name}"

    content=f"""# {title}

## 元数据
- **DOI**: {doi or '无'}
- **作者**: {authors}
- **期刊**: {journal}
- **日期**: {date}
- **链接**: {url}

## AI 分析

{analysis}

## 个人思考

"""
    ret=req({"notebook":nb_id,"path":path,"markdown":content},"/api/filetree/createDocWithMd")
    if ret.get("code")==0:
        print(f"   ✅ 已创建: {title[:40]}...")
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
        print("❌ 找不到 SiYuan 笔记本")
        sys.exit(1)
    print(f"   笔记本: {sub_name}")

    ok=create_note(meta,nb_id,sub_name)
    if ok:
        print("✅ 导入成功")
        # 清理临时文件
        try:os.remove(json_path)
        except:pass
    else:
        print("❌ 导入失败")

if __name__=="__main__":
    main()
