"use strict";

// Zotero SiYuan Sync — 主逻辑（零硬编码，完全可扩展）

Zotero.SiYuanSync = Zotero.SiYuanSync || {};

Object.assign(Zotero.SiYuanSync, {
  hooks: {
    async onStartup() {
      Zotero.log("SiYuanSync: onStartup begin");
      await Promise.all([
        Zotero.initializationPromise,
        Zotero.unlockPromise,
        Zotero.uiReadyPromise,
      ]);
      Zotero.log("SiYuanSync: Zotero 就绪");
      Zotero.SiYuanSync.addToAllWindows();
      Zotero.log("SiYuanSync: onStartup 完成");
    },

    async onMainWindowLoad(win) {
      Zotero.SiYuanSync.addToWindow(win);
    },

    async onMainWindowUnload(win) {
      Zotero.SiYuanSync.removeFromWindow(win);
    },

    onShutdown() {
      Zotero.SiYuanSync.removeFromAllWindows();
    },
  },

  addedIDs: [],

  addToAllWindows() {
    var wins = Zotero.getMainWindows();
    for (let win of wins) {
      if (win.ZoteroPane) this.addToWindow(win);
    }
  },

  addToWindow(win) {
    var doc = win.document;
    var added = false;

    // 右键菜单
    var menu = doc.getElementById("zotero-itemmenu");
    if (menu) {
      try {
        var mi = doc.createXULElement("menuitem");
        mi.id = "siyuan-sync-menuitem";
        mi.setAttribute("label", "发送到 SiYuan 精读笔记");
        mi.addEventListener("command", () => {
          Zotero.SiYuanSync.onSync(win).catch(e => Zotero.log("SiYuanSync: ❌ " + e.message));
        });
        menu.appendChild(mi);
        this.addedIDs.push(mi.id);
        added = true;
      } catch (e) {
        Zotero.log("SiYuanSync: 菜单添加失败: " + e.message);
      }
    }

    // 工具栏按钮
    var tb = doc.getElementById("zotero-toolbar-item-tree");
    if (tb) {
      try {
        var btn = doc.createXULElement("toolbarbutton");
        btn.id = "siyuan-sync-btn";
        btn.setAttribute("class", "zotero-tb-button");
        btn.setAttribute("label", "精读");
        btn.setAttribute("tooltiptext", "发送到 SiYuan 精读笔记");
        btn.addEventListener("command", () => {
          Zotero.SiYuanSync.onSync(win).catch(e => Zotero.log("SiYuanSync: ❌ " + e.message));
        });
        tb.insertBefore(btn, tb.firstElementChild);
        this.addedIDs.push(btn.id);
        added = true;
      } catch (e) {
        Zotero.log("SiYuanSync: 工具栏添加失败: " + e.message);
      }
    }

    if (!added) {
      Zotero.log("SiYuanSync: ⚠️ 未能添加任何 UI 元素");
    }
  },

  removeFromWindow(win) {
    var doc = win.document;
    for (let id of this.addedIDs) {
      var el = doc.getElementById(id);
      if (el) el.remove();
    }
  },

  removeFromAllWindows() {
    var wins = Zotero.getMainWindows();
    for (let win of wins) {
      if (win.ZoteroPane) this.removeFromWindow(win);
    }
  },

  // 获取目标目录（用户可自由输入，如 "M4"、"2024 Papers" 等）
  async getDir() {
    var dir = Zotero.Prefs.get("extensions.zotero-siyuan-sync.dir");
    if (dir) return dir;

    // 弹出一个简单的文本输入框
    var input = { value: "" };
    var ok = Services.prompt.prompt(
      null,
      "设置 SiYuan 目标目录",
      "输入 SiYuan 中的笔记本名或子目录名\n（例如：M4、2024 Papers、缓冲区）\n可后期在插件偏好中修改",
      input,
      null,
      { }
    );
    if (!ok || !input.value.trim()) return null;
    dir = input.value.trim();
    Zotero.Prefs.set("extensions.zotero-siyuan-sync.dir", dir, true);
    Zotero.log("SiYuanSync: 目标目录: " + dir);
    return dir;
  },

  async onSync(win) {
    Zotero.log("SiYuanSync: onSync 点击");

    var items = win.ZoteroPane.getSelectedItems();
    if (!items || !items.length) {
      Zotero.log("SiYuanSync: ❌ 未选中论文");
      return;
    }

    var dir = await this.getDir();
    if (!dir) {
      Zotero.log("SiYuanSync: ❌ 未设置目录");
      return;
    }

    var pw = new Zotero.ProgressWindow({closeOnClick:true});
    pw.changeHeadline("📖 导入到 " + dir);
    pw.show();
    var total = items.length;
    var success = 0;

    for (let i = 0; i < total; i++) {
      var item = items[i];
      var doi = item.getField("DOI");
      var title = item.getField("title") || "无标题";

      if (!doi) {
        Zotero.log("SiYuanSync: ⏭️ 跳过（无 DOI）: " + title);
        pw.addDescription("⏭️ " + title.slice(0, 30) + "...");
        continue;
      }

      pw.addDescription("🔄 [" + (i+1) + "/" + total + "] " + title.slice(0, 30) + "...");
      Zotero.log("SiYuanSync: [" + (i+1) + "/" + total + "] " + doi);

      try {
        var meta = {
          doi: doi,
          title: title,
          abstract: item.getField("abstractNote"),
          authors: [],
          journal: item.getField("publicationTitle"),
          date: item.getField("date"),
          url: "https://zotero.org/users/local/" + item.libraryID + "/items/" + item.key,
          key: item.key,
        };
        try {
          var creators = item.getCreators();
          for (let c of creators) {
            meta.authors.push((c.firstName || "") + " " + (c.lastName || ""));
          }
        } catch (e) {}

        var tmp = "D:\\0_DAT\\SiYuan\\scripts\\_tmp_import.json";
        var jsonStr = JSON.stringify(meta);
        var f = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
        f.initWithPath(tmp);
        var s = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
        s.init(f, 0x02|0x08|0x20, 0o666, 0);
        s.write(jsonStr, jsonStr.length);
        s.close();

        var py = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
        py.initWithPath("C:\\Users\\dell\\AppData\\Local\\Programs\\Python\\Python312\\python.exe");
        var pr = Components.classes["@mozilla.org/process/util;1"].createInstance(Components.interfaces.nsIProcess);
        pr.init(py);
        pr.run(true, ["D:\\0_DAT\\SiYuan\\scripts\\siyuan_import.py", tmp, "--dir", dir], 4);
        success++;
        Zotero.log("SiYuanSync: ✅ " + doi);
      } catch (e) {
        Zotero.log("SiYuanSync: ❌ " + doi + " — " + e.message);
      }
    }

    pw.changeHeadline("✅ 完成: " + success + "/" + total);
    pw.startCloseTimer(2000);
    Zotero.log("SiYuanSync: ✅ 导入完成 " + success + "/" + total);
  },
});
