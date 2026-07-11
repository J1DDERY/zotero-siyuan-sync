"use strict";

// Zotero SiYuan Sync — 主逻辑

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
        mi.addEventListener("command", () => Zotero.SiYuanSync.onSync(win));
        menu.appendChild(mi);
        this.addedIDs.push(mi.id);
        Zotero.log("SiYuanSync: ✅ 右键菜单已添加");
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
        btn.addEventListener("command", () => Zotero.SiYuanSync.onSync(win));
        tb.insertBefore(btn, tb.firstElementChild);
        this.addedIDs.push(btn.id);
        Zotero.log("SiYuanSync: ✅ 工具栏按钮已添加");
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

  onSync(win) {
    Zotero.log("SiYuanSync: onSync 点击");

    var items = win.ZoteroPane.getSelectedItems();
    if (!items || !items.length) {
      Zotero.log("SiYuanSync: ❌ 未选中论文");
      return;
    }

    var item = items[0];
    var doi = item.getField("DOI");
    var title = item.getField("title") || "无标题";
    Zotero.log("SiYuanSync: 论文=" + title + ", DOI=" + (doi || "无"));

    if (!doi) {
      Zotero.log("SiYuanSync: ❌ 无 DOI，跳过");
      return;
    }

    try {
      // 显示进度提示
      var pw = new Zotero.ProgressWindow({closeOnClick:true});
      pw.changeHeadline("📖 正在导入到 SiYuan");
      var desc = pw.addDescription("DeepSeek AI 分析中（约 20 秒）...");
      pw.show();

      var item = items[0];
      var meta = {
        doi: item.getField("DOI"),
        title: item.getField("title"),
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

      // 写 JSON 临时文件
      var tmp = "D:\\0_DAT\\SiYuan\\scripts\\_tmp_import.json";
      var jsonStr = JSON.stringify(meta);
      var f = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
      f.initWithPath(tmp);
      var s = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
      s.init(f, 0x02|0x08|0x20, 0o666, 0);
      s.write(jsonStr, jsonStr.length);
      s.close();

      // 调用 Python（阻塞模式，等待完成）
      var py = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
      py.initWithPath("C:\\Users\\dell\\AppData\\Local\\Programs\\Python\\Python312\\python.exe");
      var pr = Components.classes["@mozilla.org/process/util;1"].createInstance(Components.interfaces.nsIProcess);
      pr.init(py);
      pr.run(true, ["D:\\0_DAT\\SiYuan\\scripts\\siyuan_import.py", tmp, "--dir", "M4"], 4);
      pw.startCloseTimer(500);
      Zotero.log("SiYuanSync: ✅ 导入完成: " + doi);
    } catch (e) {
      pw.startCloseTimer(500);
      Zotero.log("SiYuanSync: ❌ 导入失败: " + e.message);
    }
  },
});
