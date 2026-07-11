import zipfile, os
src = r'D:\0_DAT\SiYuan\scripts\zotero-plugin'
xpi = os.path.expanduser(r'~/Desktop/zotero-siyuan-sync.xpi')
buf = __import__('io').BytesIO()
with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, dirs, files in os.walk(src):
        for fname in files:
            full = os.path.join(root, fname)
            rel = os.path.relpath(full, src)
            # 排除构建脚本和源码相关
            if fname.endswith(('.py', '.bat', '.xpi', '.md')):
                continue
            z.write(full, rel)
with open(xpi, 'wb') as f:
    f.write(buf.getvalue())
print(f'OK {os.path.getsize(xpi)} bytes')
with zipfile.ZipFile(xpi) as z:
    for info in z.infolist():
        print(f'  {info.filename:45s} {info.file_size} bytes')
