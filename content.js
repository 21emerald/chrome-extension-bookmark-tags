// ============================================================
// bookmark-tags content.js — 页面信息提取 + 站点脚本编排
// v2.4.0 — 脚本执行委托给 background (chrome.scripting.executeScript MAIN world)
//          站点脚本只有一个 script 字段，预置变量 title/labels/tags/preview/previewVideo
// ============================================================

function getDefaultPageInfo() {
  return {
    title: document.title || location.href,
    labels: [],
    tags: [],
    url: location.href,
    preview: '',
    previewVideo: '',
  };
}

async function runSiteConfigs() {
  const configs = await chrome.runtime.sendMessage({ action: 'listSiteConfigs' });
  if (!Array.isArray(configs) || configs.length === 0) return getDefaultPageInfo();

  for (const sc of configs) {
    try {
      const regex = new RegExp(sc.urlPattern);
      if (regex.test(location.href)) {
        if (!sc.script) return getDefaultPageInfo();

        const info = getDefaultPageInfo();
        // 委托 background 在 MAIN world 执行站点脚本
        // 传入初始值，脚本中可直接读写 title/labels/tags/preview/previewVideo
        const result = await chrome.runtime.sendMessage({
          action: 'executeSitePreview',
          scriptStr: sc.script,
          title: info.title,
          labels: info.labels,
          tags: info.tags,
          preview: info.preview,
          previewVideo: info.previewVideo,
        });

        if (result && typeof result === 'object') {
          return {
            ...info,
            title: result.title || info.title,
            labels: Array.isArray(result.labels) ? result.labels : info.labels,
            tags: Array.isArray(result.tags) ? result.tags : info.tags,
            preview: result.preview || '',
            previewVideo: result.previewVideo || '',
          };
        }
        return info;
      }
    } catch (e) {
      console.warn('[bookmark-tags] site config error:', sc.id, e);
    }
  }

  return getDefaultPageInfo();
}

async function main() {
  const info = await runSiteConfigs();
  chrome.runtime.sendMessage({ action: 'pageInfo', data: info });
}

// 响应 popup 的实时查询请求
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'getPageInfo') {
    runSiteConfigs().then(info => sendResponse(info));
    return true; // async
  }
});

main();
