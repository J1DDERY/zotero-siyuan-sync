import zipfile, os
src = os.path.dirname(os.path.abspath(__file__))
xpi = os.path.join(os.path.expanduser("~"), "Desktop", "zotero-siyuan-sync.xpi")
buf = __import__("io").BytesIO()
with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(src):
        # 跳过 .git 目录和构建产物
        rel = os.path.relpath(root, src)
        if rel.startswith(".git") or rel == ".":
            dirs[:] = [d for d in dirs if not d.startswith(".git")]
            if rel == ".":
                continue
        for fname in files:
            full = os.path.join(root, fname)
            relf = os.path.relpath(full, src)
            if any(relf.startswith(p) for p in (".git",)): continue
            if fname.endswith((".py", ".bat", ".md", ".xpi")): continue
            z.write(full, relf)
with open(xpi, "wb") as f:
    f.write(buf.getvalue())
print(f"OK {os.path.getsize(xpi)} bytes -> {xpi}")
with zipfile.ZipFile(xpi) as z:
    for info in z.infolist():
        print(f"  {info.filename:45s} {info.file_size} bytes")
