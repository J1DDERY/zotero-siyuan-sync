import zipfile, os
src = os.path.dirname(os.path.abspath(__file__))
xpi = os.path.join(os.path.expanduser("~"), "Desktop", "zotero-siyuan-sync.xpi")
buf = __import__("io").BytesIO()
with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(src):
        # 跳过 .git 目录
        dirs[:] = [d for d in dirs if d != ".git"]
        for fname in files:
            full = os.path.join(root, fname)
            relf = os.path.relpath(full, src)
            if relf.startswith(".git" + os.sep):
                continue
            if fname.endswith((".py", ".bat", ".md", ".xpi")):
                continue
            if fname in (".gitignore", "updates.json"):
                continue
            z.write(full, relf)
with open(xpi, "wb") as f:
    f.write(buf.getvalue())
print(f"OK {os.path.getsize(xpi)} bytes -> {xpi}")
with zipfile.ZipFile(xpi) as z:
    for info in z.infolist():
        print(f"  {info.filename:45s} {info.file_size} bytes")
