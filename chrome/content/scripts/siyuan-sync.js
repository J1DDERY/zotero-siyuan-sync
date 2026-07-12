"use strict";

// Zotero SiYuan Sync — 主逻辑（全内置，零外部依赖）

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
    async onMainWindowLoad(win) { Zotero.SiYuanSync.addToWindow(win); },
    async onMainWindowUnload(win) { Zotero.SiYuanSync.removeFromWindow(win); },
    onShutdown() { Zotero.SiYuanSync.removeFromAllWindows(); },
  },

  addedIDs: [],

  addToAllWindows() {
    var wins = Zotero.getMainWindows();
    for (let win of wins) { if (win.ZoteroPane) this.addToWindow(win); }
  },

  addToWindow(win) {
    var doc = win.document, added = false;
    // 右键菜单
    var menu = doc.getElementById("zotero-itemmenu");
    if (menu) {
      try {
        var mi = doc.createXULElement("menuitem");
        mi.id = "siyuan-sync-menuitem";
        mi.setAttribute("label", "发送到 SiYuan 精读笔记");
        mi.addEventListener("command", () => Zotero.SiYuanSync.onSync(win).catch(e => Zotero.log("SiYuanSync: ❌ " + e.message)));
        menu.appendChild(mi);
        this.addedIDs.push(mi.id);

        // 分隔线
        var sep = doc.createXULElement("menuseparator");
        sep.id = "siyuan-sync-sep";
        menu.appendChild(sep);
        this.addedIDs.push(sep.id);

        // 设置菜单
        var settings = doc.createXULElement("menuitem");
        settings.id = "siyuan-sync-settings";
        settings.setAttribute("label", "⚙ SiYuan 设置…");
        settings.addEventListener("command", () => Zotero.SiYuanSync.showSettings());
        menu.appendChild(settings);
        this.addedIDs.push(settings.id);

        added = true;
      } catch (e) { Zotero.log("SiYuanSync: 菜单失败: " + e.message); }
    }
    var tb = doc.getElementById("zotero-toolbar-item-tree");
    if (tb) {
      try {
        var btn = doc.createXULElement("toolbarbutton");
        btn.id = "siyuan-sync-btn";
        btn.setAttribute("class", "zotero-tb-button");
        btn.setAttribute("label", "精读");
        btn.setAttribute("tooltiptext", "发送到 SiYuan 精读笔记");
        btn.addEventListener("command", () => Zotero.SiYuanSync.onSync(win).catch(e => Zotero.log("SiYuanSync: ❌ " + e.message)));
        tb.insertBefore(btn, tb.firstElementChild);
        this.addedIDs.push(btn.id); added = true;
      } catch (e) { Zotero.log("SiYuanSync: 工具栏失败: " + e.message); }
    }
    if (!added) Zotero.log("SiYuanSync: ⚠️ 未能添加 UI");
  },

  removeFromWindow(win) {
    var doc = win.document;
    for (let id of this.addedIDs) { var el = doc.getElementById(id); if (el) el.remove(); }
  },
  removeFromAllWindows() {
    var wins = Zotero.getMainWindows();
    for (let win of wins) { if (win.ZoteroPane) this.removeFromWindow(win); }
  },

  // ── 配置读取 ──────────────────────────

  async getApiKey() {
    var key = Zotero.Prefs.get("extensions.zotero-siyuan-sync.apikey");
    if (key) { Zotero.log("SiYuanSync: API Key 已保存"); return key; }
    var input = { value: "" };
    var ok = Services.prompt.prompt(null, "DeepSeek API Key",
      "输入你的 DeepSeek API Key\n（以 sk- 开头，仅保存到 Zotero 本地配置）",
      input, null, {});
    if (!ok || !input.value.trim()) return null;
    key = input.value.trim();
    Zotero.Prefs.set("extensions.zotero-siyuan-sync.apikey", key);
    Zotero.log("SiYuanSync: API Key 已保存");
    return key;
  },

  async getDir() {
    var dir = Zotero.Prefs.get("extensions.zotero-siyuan-sync.dir");
    if (dir) { Zotero.log("SiYuanSync: 目录: " + dir); return dir; }
    // 查询 SiYuan 笔记本列表让用户选择
    try {
      var ret = await this._siyuanAPI("/api/notebook/lsNotebooks", {});
      var notebooks = ret.data.notebooks;
      if (!notebooks || !notebooks.length) throw new Error("无笔记本");
      var labels = notebooks.map(n => n.name);
      var idx = { value: 0 };
      var ok = Services.prompt.select(null, "选择 SiYuan 笔记本",
        "导入到哪个笔记本？", labels, idx);
      if (!ok || idx.value < 0) return null;
      dir = notebooks[idx.value].id;
      Zotero.Prefs.set("extensions.zotero-siyuan-sync.dir", dir);
      Zotero.log("SiYuanSync: 目录: " + notebooks[idx.value].name + " (" + dir + ")");
      return dir;
    } catch (e) {
      Zotero.log("SiYuanSync: 获取笔记本列表失败: " + e.message);
      // 降级：手动输入
      var input = { value: "" };
      var ok = Services.prompt.prompt(null, "SiYuan 笔记本 ID",
        "无法获取笔记本列表，请手动输入笔记本 ID\n（可在 SiYuan → 设置 → 关于 中查看）",
        input, null, {});
      if (!ok || !input.value.trim()) return null;
      dir = input.value.trim();
      Zotero.Prefs.set("extensions.zotero-siyuan-sync.dir", dir);
      return dir;
    }
  },

  // ── HTTP 工具 ──────────────────────────

  _siyuanAPI(path, data) {
    return new Promise((resolve, reject) => {
      var xhr = new XMLHttpRequest();
      xhr.open("POST", "http://127.0.0.1:6806" + path, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.timeout = 15000;
      xhr.onload = () => {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch(e) { reject(new Error("SiYuan 响应解析失败")); }
      };
      xhr.onerror = () => reject(new Error("SiYuan 连接失败（请确认 SiYuan 在运行）"));
      xhr.ontimeout = () => reject(new Error("SiYuan 超时"));
      xhr.send(JSON.stringify(data));
    });
  },

  _deepseekAPI(prompt, apiKey) {
    return new Promise((resolve, reject) => {
      var xhr = new XMLHttpRequest();
      xhr.open("POST", "https://api.deepseek.com/v1/chat/completions", true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.setRequestHeader("Authorization", "Bearer " + apiKey);
      xhr.timeout = 60000;
      xhr.onload = () => {
        try {
          var r = JSON.parse(xhr.responseText);
          resolve(r.choices[0].message.content);
        } catch(e) { reject(new Error("DeepSeek 响应解析失败")); }
      };
      xhr.onerror = () => reject(new Error("DeepSeek API 请求失败（检查网络/代理）"));
      xhr.ontimeout = () => reject(new Error("DeepSeek 超时（60s）"));
      xhr.send(JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 800
      }));
    });
  },

  // ── SiYuan 操作 ──────────────────────────

  async _findNotebook(nbId) {
    var ret = await this._siyuanAPI("/api/notebook/lsNotebooks", {});
    var notebooks = ret.data.notebooks;
    // 直接用保存的笔记本 ID 查找
    for (let nb of notebooks) {
      if (nb.id === nbId) return { id: nb.id, name: nb.name };
    }
    // 降级：模糊匹配
    for (let nb of notebooks) {
      if (nb.name.includes("缓冲区")) return { id: nb.id, name: nb.name };
    }
    if (notebooks.length) return { id: notebooks[0].id, name: notebooks[0].name };
    throw new Error("SiYuan 中无可用笔记本");
  },

  async _createNote(meta, analysis, nbInfo) {
    var title = meta.title || "无标题";
    var authors = (meta.authors || []).join(", ");
    var safeName = "📖 " + title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 30).trim();
    var now = new Date();
    var dateStr = now.getFullYear() + "-" + String(now.getMonth()+1).padStart(2,"0") + "-" + String(now.getDate()).padStart(2,"0");
    var timeStr = dateStr + " " + String(now.getHours()).padStart(2,"0") + ":" + String(now.getMinutes()).padStart(2,"0");

    var md = `# ${title}

> **精读笔记** | ${dateStr} | 源: Zotero

---

## 📋 元数据

| 字段 | 内容 |
|------|------|
| **标题** | ${title} |
| **作者** | ${authors || "未知"} |
| **期刊** | ${meta.journal || "未知"} |
| **DOI** | [${meta.doi}](https://doi.org/${meta.doi}) |
| **Zotero** | [${meta.key}](${meta.url || "#"}) |

> ⚠️ **以下 AI 分析仅基于摘要（Abstract），未阅读全文。** 结果可能存在偏差，精读全文后请修正。

---

## 🎯 研究动机与背景

${analysis.motivation || "(待补充)"}

---

## 🔬 核心内容

${analysis.content || "(待补充)"}

---

## 💭 局限与展望

${analysis.limitations || "(待补充)"}

---

## ✏️ 个人思考

<!-- 在此记录你对本文的看法、与自己研究的关联 -->

---

*笔记创建于 ${timeStr}*
`;

    // 确保精读文献目录存在
    try {
      await this._siyuanAPI("/api/filetree/createDocWithMd", {
        notebook: nbInfo.id,
        path: "/精读文献",
        title: "精读文献",
        type: "d",
        markdown: ""
      });
    } catch (e) { /* 目录已存在则忽略错误 */ }

    var ret = await this._siyuanAPI("/api/filetree/createDocWithMd", {
      notebook: nbInfo.id,
      path: "/精读文献/" + safeName,
      title: safeName.slice(0, 80),
      type: "d",
      markdown: md
    });
    if (ret.code !== 0) throw new Error("创建笔记失败: " + (ret.msg || ""));
  },

  // ── AI 分析 ──────────────────────────

  _parseLLM(text) {
    var result = { motivation: "", content: "", limitations: "" };
    var keys = ["研究动机/背景", "核心内容", "局限与展望"];
    var pat = new RegExp("(" + keys.join("|") + ")(?:（[^）]*）)?:\\s*", "g");
    var parts = text.split(pat);
    for (var i = 1; i < parts.length - 1; i += 2) {
      var key = parts[i].replace(/（[^）]*）/g, "");
      var val = (parts[i + 1] || "").trim();
      // 去除 Markdown 粗体标记
      val = val.replace(/\*\*/g, "");
      if (key === "研究动机/背景") result.motivation = val;
      else if (key === "核心内容") result.content = val;
      else if (key === "局限与展望") result.limitations = val;
    }
    if (!result.motivation) result.motivation = "(待补充)";
    if (!result.content) result.content = "(待补充)";
    if (!result.limitations) result.limitations = "(待补充)";
    return result;
  },

  async _analyzeWithLLM(meta, apiKey) {
    var prompt = `你是一名电磁兼容(EMC)领域研究者。精读以下论文：

标题: ${meta.title}
作者: ${(meta.authors || []).join(", ")}
期刊: ${meta.journal || "未知"}
摘要: ${(meta.abstract || "无").slice(0, 800)}

用中文按以下 3 个方面回答，每项 2-4 句话，**各项之间不要重复**：

研究动机/背景: 
核心内容（方法、创新点、关键结果）: 
局限与展望: `;
    var text = await this._deepseekAPI(prompt, apiKey);
    return this._parseLLM(text);
  },

  // ── 主流程 ──────────────────────────

  async onSync(win) {
    Zotero.log("SiYuanSync: onSync");
    var items = win.ZoteroPane.getSelectedItems();
    if (!items || !items.length) { Zotero.log("无选中论文"); return; }

    var apiKey = await this.getApiKey();
    if (!apiKey) { Zotero.log("无 API Key"); return; }
    var dir = await this.getDir();
    if (!dir) { Zotero.log("无目录"); return; }

    var pw = new Zotero.ProgressWindow({closeOnClick:true});
    pw.changeHeadline("📖 导入到 " + dir);
    pw.show();
    var total = items.length, success = 0;

    for (let i = 0; i < total; i++) {
      var item = items[i];
      var doi = item.getField("DOI");
      var title = item.getField("title") || "无标题";
      if (!doi) { pw.addDescription("⏭️ " + title.slice(0,30)); continue; }

      pw.addDescription("🔄 [" + (i+1) + "/" + total + "] " + title.slice(0, 30));
      Zotero.log("SiYuanSync: [" + (i+1) + "/" + total + "] " + doi);

      try {
        var meta = {
          doi: doi, title: title,
          abstract: item.getField("abstractNote"),
          authors: [],
          journal: item.getField("publicationTitle"),
          date: item.getField("date"),
          url: "https://zotero.org/users/local/" + item.libraryID + "/items/" + item.key,
          key: item.key,
        };
        try {
          var creators = item.getCreators();
          for (let c of creators) meta.authors.push((c.firstName || "") + " " + (c.lastName || ""));
        } catch(e) {}

        var nbInfo = await this._findNotebook(dir);
        var analysis = await this._analyzeWithLLM(meta, apiKey);
        await this._createNote(meta, analysis, nbInfo);
        success++;
        Zotero.log("SiYuanSync: ✅ " + doi);
      } catch (e) {
        Zotero.log("SiYuanSync: ❌ " + doi + " — " + e.message);
        pw.addDescription("❌ " + title.slice(0, 20) + " — " + e.message.slice(0, 40));
      }
    }
    pw.changeHeadline("✅ 完成: " + success + "/" + total);
    pw.startCloseTimer(3000);
    Zotero.log("SiYuanSync: ✅ " + success + "/" + total);
  },

  showSettings() {
    var choice = { value: 0 };
    var items = ["重新设置 SiYuan 目录", "重新设置 API Key", "查看当前配置"];
    var ok = Services.prompt.select(null, "SiYuan Sync 设置",
      "选择要修改的配置：", items, choice);
    if (!ok) return;

    if (choice.value === 0) {
      Zotero.Prefs.set("extensions.zotero-siyuan-sync.dir", "");
      Zotero.log("SiYuanSync: 目录已清空");
      (async () => { await Zotero.SiYuanSync.getDir(); })();
    } else if (choice.value === 1) {
      Zotero.Prefs.set("extensions.zotero-siyuan-sync.apikey", "");
      Zotero.log("SiYuanSync: API Key 已清空");
      (async () => { await Zotero.SiYuanSync.getApiKey(); })();
    } else {
      var dir = Zotero.Prefs.get("extensions.zotero-siyuan-sync.dir") || "（未设置）";
      var key = Zotero.Prefs.get("extensions.zotero-siyuan-sync.apikey");
      var kshow = key ? key.slice(0, 8) + "…" : "（未设置）";
      Services.prompt.alert(null, "当前配置",
        "目录: " + dir + "\nAPI Key: " + kshow);
    }
  },
});
