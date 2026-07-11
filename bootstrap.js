"use strict";

// Zotero SiYuan Sync — Bootstrap
// 基于 zotero-plugin-template 模式

var chromeHandle;

function install(data, reason) {}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  // 注册 chrome
  var aomStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);
  var manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "siyuanSync", rootURI + "chrome/content/"],
  ]);

  // 加载主脚本 — 不传 ctx，直接在全局作用域运行
  Services.scriptloader.loadSubScript(
    rootURI + "chrome/content/scripts/siyuan-sync.js"
  );

  await Zotero.SiYuanSync.hooks.onStartup();
}

async function onMainWindowLoad({ window }, reason) {
  await Zotero.SiYuanSync?.hooks.onMainWindowLoad(window);
}

async function onMainWindowUnload({ window }, reason) {
  await Zotero.SiYuanSync?.hooks.onMainWindowUnload(window);
}

function shutdown({ id, version, resourceURI, rootURI }, reason) {
  if (reason === APP_SHUTDOWN) return;
  Zotero.SiYuanSync?.hooks.onShutdown();
  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
}

function uninstall(data, reason) {}
