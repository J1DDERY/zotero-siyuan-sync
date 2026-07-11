"use strict";

// Zotero SiYuan Sync — 主逻辑

Zotero.SiYuanSync = Zotero.SiYuanSync || {};

Object.assign(Zotero.SiYuanSync, {
  // 笔记本映射（与 siyuan_import.py 的 NOTEBOOK_MAP 保持一致）
  DIRECTORIES: [
    ["M4", "📐 M4 电磁场重建与反演"],
    ["M1", "📐 M1 近场探头"],
    ["M2", "📐 M2 电流测量"],
    ["M3", "📐 M3 信号处理"],
    ["M5", "📐 M5 标定"],
    ["E1", "⚡ E1 传导干扰"],
    ["E2", "⚡ E2 辐射干扰"],
    ["E3", "⚡ E3 干扰源"],
    ["E4", "⚡ E4 防护"],
    ["E5", "⚡ E5 标准"],
    ["P1", "🔌 P1 电力电子"],
    ["P2", "🔌 P2 电能质量"],
    ["P3", "🔌 P3 变换器"],
    ["P4", "🔌 P4 逆变器"],
    ["P5", "🔌 P5 电机"],
    ["L1", "💥 L1 脉冲功率"],
    ["L2", "💥 L2 等离子体"],
    ["A1", "📡 A1 天线"],
    ["A2", "📡 A2 传播"],
    ["C1", "🔧 C1 电路"],
    ["C2", "🔧 C2 系统"],
    ["S1", "📊 S1 信号与成像"],
    ["H1", "🔺 H1 高电压"],
  ],

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

  // 获取或选择笔记本目录
  async getDir() {
    // 先从 prefs 读取上次的选择
    var dir = Zotero.Prefs.get("extensions.zotero-siyuan-sync.dir", true);
    if (dir) return dir;

    // 弹出选择对话框
    var labels = this.DIRECTORIES.map(d => d[1]);
    var idx = await new Promise(resolve => {
      Services.prompt.select(
        null,
        "选择目标笔记本",
        "导入到哪个子方向？",
        labels,
        labels.length,
        resolve
      );
    });

    if (idx < 0 || idx >= this.DIRECTORIES.length) return null;
    dir = this.DIRECTORIES[idx][0];
    Zotero.Prefs.set("extensions.zotero-siyuan-sync.dir", dir, true);
    Zotero.log("SiYuanSync: 选择目录: " + dir + " (" + this.DIRECTORIES[idx][1] + ")");
    return dir;
  },

  async onSync(win) {
    Zotero.log("SiYuanSync: onSync 点击");

    var items = win.ZoteroPane.getSelectedItems();
    if (!items || !items.length) {
      Zotero.log("SiYuanSync: ❌ 未选中论文");
      return;
    }

    // 获取目标目录
    var dir = await this.getDir();
    if (!dir) {
      Zotero.log("SiYuanSync: ❌ 未选择目录");
      return;
    }

    // 逐篇导入
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
        pr.run(true, ["D:\\0_DAT\\SiYuan\\scripts\\siyuan_import.py", tmp, "--dir", dir], 4 + dir.length);
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
