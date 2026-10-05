// ============================================================
// bookmark-tags background.js — 数据层 & 消息调度
// v2.4.0 — preview/previewVideo + 版本化 Google Drive 同步 + 冲突合并
// ============================================================

/* ---------- 数据模型 ----------
  Bookmark: { id, url, title, tags:[tagId], favorite:0-5, labels:[], contentTags:[], preview:'', previewVideo:'', createdAt, updatedAt }
  TagGroup: { id, name, order, updatedAt }
  Tag:      { id, name, alias:[], tags:[tagId], groupId, order, updatedAt }
  SiteConfig:{ id, urlPattern, script, updatedAt }
  Config:   { syncEnabled, lastSyncAt, gdBaseVersion, gdDeviceId, gdDirty, locale, theme }
*/

const STORAGE_KEYS = {
  bookmarks:  'bt_bookmarks',
  tagGroups:  'bt_tagGroups',
  tags:       'bt_tags',
  siteConfigs:'bt_siteConfigs',
  config:     'bt_config',
  tombstones: 'bt_tombstones',
};

// ---------- 工具函数 ----------

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function now() { return Date.now(); }

async function getStore(key) {
  const r = await chrome.storage.local.get(key);
  return r[key] || [];
}
async function setStore(key, val) {
  await chrome.storage.local.set({ [key]: val });
}
async function getConfig() {
  const r = await chrome.storage.local.get(STORAGE_KEYS.config);
  return r[STORAGE_KEYS.config] || { syncEnabled: true, lastSyncAt: 0, gdBaseVersion: 0, gdDeviceId: '', gdDirty: false, theme: 'system' };
}

// ---------- Tombstone ----------

async function getTombstones() {
  return getStore(STORAGE_KEYS.tombstones);
}

async function addTombstone(id, type) {  // type: 'bookmark'|'tag'|'tagGroup'|'siteConfig'
  const all = await getTombstones();
  if (all.find(t => t.id === id && t.type === type)) return;
  all.push({ id, type, deletedAt: now() });
  await setStore(STORAGE_KEYS.tombstones, all);
}

// ---------- 书签 CRUD ----------

async function listBookmarks() { return getStore(STORAGE_KEYS.bookmarks); }

async function getBookmarkByUrl(url) {
  const all = await listBookmarks();
  return all.find(b => b.url === url) || null;
}

async function addBookmark({ url, title, tags = [], favorite = 0, labels = [], contentTags = [], preview = '', previewVideo = '' }) {
  const all = await listBookmarks();
  if (all.find(b => b.url === url)) return null;
  const bm = { id: uid(), url, title, tags, favorite, labels, contentTags, preview, previewVideo, createdAt: now(), updatedAt: now() };
  all.push(bm);
  await setStore(STORAGE_KEYS.bookmarks, all);
  await markDirtyAndSync();
  return bm;
}

async function updateBookmark(id, patch) {
  const all = await listBookmarks();
  const idx = all.findIndex(b => b.id === id);
  if (idx < 0) return null;
  Object.assign(all[idx], patch, { updatedAt: now() });
  await setStore(STORAGE_KEYS.bookmarks, all);
  await markDirtyAndSync();
  return all[idx];
}

async function removeBookmark(id) {
  const all = await listBookmarks();
  const filtered = all.filter(b => b.id !== id);
  await setStore(STORAGE_KEYS.bookmarks, filtered);
  await addTombstone(id, 'bookmark');
  await markDirtyAndSync();
  return filtered.length < all.length;
}

// ---------- 标签组 CRUD ----------

async function listTagGroups() { return getStore(STORAGE_KEYS.tagGroups); }

async function addTagGroup(name) {
  const all = await listTagGroups();
  // 同名去重：已存在则直接返回
  const existing = all.find(g => g.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  const maxOrder = all.reduce((m, g) => Math.max(m, g.order), 0);
  const g = { id: uid(), name, order: maxOrder + 1, updatedAt: now() };
  all.push(g);
  await setStore(STORAGE_KEYS.tagGroups, all);
  await markDirtyAndSync();
  return g;
}

async function updateTagGroup(id, patch) {
  const all = await listTagGroups();
  const idx = all.findIndex(g => g.id === id);
  if (idx < 0) return null;
  Object.assign(all[idx], patch, { updatedAt: now() });
  await setStore(STORAGE_KEYS.tagGroups, all);
  await markDirtyAndSync();
  return all[idx];
}

async function removeTagGroup(id) {
  let groups = await listTagGroups();
  groups = groups.filter(g => g.id !== id);
  await setStore(STORAGE_KEYS.tagGroups, groups);
  const tags = await listTags();
  tags.forEach(t => { if (t.groupId === id) t.groupId = ''; });
  await setStore(STORAGE_KEYS.tags, tags);
  await addTombstone(id, 'tagGroup');
  await markDirtyAndSync();
  return true;
}

// ---------- 标签 CRUD ----------

async function listTags() { return getStore(STORAGE_KEYS.tags); }

async function addTag({ name, alias = [], tags = [], groupId = '', order = 0 }) {
  const all = await listTags();
  // 同名去重：如果已存在同名 tag，直接返回已有的
  const existing = all.find(t => t.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  if (!order) {
    const sameGroup = all.filter(t => t.groupId === groupId);
    const maxOrder = sameGroup.reduce((m, t) => Math.max(m, t.order), 0);
    order = maxOrder + 1;
  }
  const t = { id: uid(), name, alias, tags, groupId, order, updatedAt: now() };
  all.push(t);
  await setStore(STORAGE_KEYS.tags, all);
  await markDirtyAndSync();
  return t;
}

async function updateTag(id, patch) {
  const all = await listTags();
  const idx = all.findIndex(t => t.id === id);
  if (idx < 0) return null;
  Object.assign(all[idx], patch, { updatedAt: now() });
  await setStore(STORAGE_KEYS.tags, all);
  await markDirtyAndSync();
  return all[idx];
}

async function removeTag(id) {
  let all = await listTags();
  all = all.filter(t => t.id !== id);
  await setStore(STORAGE_KEYS.tags, all);
  const bms = await listBookmarks();
  bms.forEach(b => { b.tags = b.tags.filter(tid => tid !== id); });
  await setStore(STORAGE_KEYS.bookmarks, bms);
  all.forEach(t => { t.tags = t.tags.filter(tid => tid !== id); });
  await setStore(STORAGE_KEYS.tags, all);
  await addTombstone(id, 'tag');
  await markDirtyAndSync();
  return true;
}

// ---------- 展开标签（含 alias 和被标记的 tags） ----------

async function expandTagIds(tagId) {
  const allTags = await listTags();
  const tag = allTags.find(t => t.id === tagId);
  if (!tag) return [tagId];
  const result = new Set([tagId]);

  tag.alias.forEach(a => {
    const matched = allTags.find(t => t.name === a);
    if (matched) result.add(matched.id);
  });

  allTags.forEach(t => {
    if (t.alias.includes(tag.name)) result.add(t.id);
  });

  allTags.forEach(t => {
    if (t.tags.includes(tagId)) result.add(t.id);
  });

  tag.tags.forEach(tid => result.add(tid));

  return [...result];
}

// ---------- 站点配置 CRUD ----------

async function listSiteConfigs() { return getStore(STORAGE_KEYS.siteConfigs); }

async function addSiteConfig({ urlPattern, script = '' }) {
  const all = await listSiteConfigs();
  const sc = { id: uid(), urlPattern, script, updatedAt: now() };
  all.push(sc);
  await setStore(STORAGE_KEYS.siteConfigs, all);
  await markDirtyAndSync();
  return sc;
}

async function updateSiteConfig(id, patch) {
  const all = await listSiteConfigs();
  const idx = all.findIndex(s => s.id === id);
  if (idx < 0) return null;
  Object.assign(all[idx], patch, { updatedAt: now() });
  await setStore(STORAGE_KEYS.siteConfigs, all);
  await markDirtyAndSync();
  return all[idx];
}

async function removeSiteConfig(id) {
  let all = await listSiteConfigs();
  all = all.filter(s => s.id !== id);
  await setStore(STORAGE_KEYS.siteConfigs, all);
  await addTombstone(id, 'siteConfig');
  await markDirtyAndSync();
  return true;
}

// ---------- 搜索（含 alias 和标记 tags 展开） ----------

async function searchBookmarks({ title = '', tagIds = [], favorite = 0, sort = 'newest' }) {
  let all = await listBookmarks();
  const allTags = await listTags();
  const allTagGroups = await listTagGroups();

  let expandedTagIds = [];
  if (tagIds.length > 0) {
    for (const tid of tagIds) {
      expandedTagIds = expandedTagIds.concat(await expandTagIds(tid));
    }
    expandedTagIds = [...new Set(expandedTagIds)];
  }

  if (title) {
    const kw = title.toLowerCase();

    // 预计算：分组名匹配 → 该分组下所有 tagId
    const matchedGroupTagIds = new Set();
    allTagGroups.forEach(g => {
      if (g.name.toLowerCase().includes(kw)) {
        allTags.forEach(t => {
          if (t.groupId === g.id) matchedGroupTagIds.add(t.id);
        });
      }
    });

    all = all.filter(b => {
      if (b.title.toLowerCase().includes(kw)) return true;
      // 搜索 tag name + alias + 标记tags 的 name + 分组名
      return b.tags.some(tid => {
        // 分组名匹配：该 tag 属于匹配的分组
        if (matchedGroupTagIds.has(tid)) return true;
        const t = allTags.find(x => x.id === tid);
        if (!t) return false;
        if (t.name.toLowerCase().includes(kw)) return true;
        if (t.alias.some(a => a.toLowerCase().includes(kw))) return true;
        // 搜索该 tag 被标记的其他 tag 的 name
        return t.tags.some(stid => {
          const st = allTags.find(x => x.id === stid);
          return st && st.name.toLowerCase().includes(kw);
        });
      });
    });
  }

  if (expandedTagIds.length > 0) {
    all = all.filter(b => expandedTagIds.some(tid => b.tags.includes(tid)));
  }

  if (favorite > 0) {
    all = all.filter(b => (b.favorite || 0) >= favorite);
  }

  // 排序
  switch (sort) {
    case 'newest':
      all.sort((a, b) => b.updatedAt - a.updatedAt);
      break;
    case 'favorite':
      all.sort((a, b) => (b.favorite || 0) - (a.favorite || 0));
      break;
    case 'tagAsc':
      all.sort((a, b) => (a.tags?.length || 0) - (b.tags?.length || 0));
      break;
    case 'tagDesc':
      all.sort((a, b) => (b.tags?.length || 0) - (a.tags?.length || 0));
      break;
  }

  return all;
}

// ---------- 推荐 ----------

async function suggestTags(labels = [], contentTags = []) {
  const allTags = await listTags();
  const results = [];
  const lower = [...labels, ...contentTags].map(s => s.toLowerCase());

  for (const tag of allTags) {
    const nameL = tag.name.toLowerCase();
    // 名称匹配
    if (lower.some(l => l.includes(nameL) || nameL.includes(l))) {
      results.push(tag);
      continue;
    }
    // alias 匹配
    if (tag.alias.some(a => lower.some(l => l.includes(a.toLowerCase()) || a.toLowerCase().includes(l)))) {
      results.push(tag);
      continue;
    }
  }

  return results;
}

async function recentTags(limit = 10) {
  const allTags = await listTags();
  return allTags.slice(-limit).reverse();
}

// ---------- 站点预览建议 ----------

async function suggestPreview(url) {
  const configs = await listSiteConfigs();
  for (const sc of configs) {
    try {
      if (new RegExp(sc.urlPattern).test(url)) {
        return { script: sc.script || '' };
      }
    } catch {}
  }
  return { script: '' };
}

// ---------- 执行站点脚本（在 MAIN world 中） ----------
// MV3 扩展 CSP 禁止 content script 使用 new Function()/eval()/<script> 注入
// 唯一路径：background 通过 chrome.scripting.executeScript 在页面 MAIN world 执行
// 脚本在页面上下文运行，有完整的 document/location 访问

// 静态函数，在 MAIN world 中执行站点脚本
// 预置变量：title, labels, tags, preview, previewVideo（均可读写）
// 脚本执行后返回修改后的变量值
// 方案C：将变量声明和 return 拼入 IIFE，确保间接 eval 下变量作用域正确
function __runSiteScript(scriptStr, _initTitle, _initLabels, _initTags, _initPreview, _initPreviewVideo) {
  const fullScript = `
    var title = ${JSON.stringify(_initTitle)};
    var labels = ${JSON.stringify(_initLabels)};
    var tags = ${JSON.stringify(_initTags)};
    var preview = ${JSON.stringify(_initPreview)};
    var previewVideo = ${JSON.stringify(_initPreviewVideo)};
    try { ${scriptStr} } catch(e) {
      try { eval('(' + ${JSON.stringify(scriptStr)} + ')'); } catch(e2) {
        console.warn('[bookmark-tags] site script eval failed:', e2);
      }
    }
    return { title: title, labels: labels, tags: tags, preview: preview, previewVideo: previewVideo };
  `;
  try {
    return (0, eval)(`(function() { ${fullScript} })()`);
  } catch(e) {
    console.warn('[bookmark-tags] site script eval failed:', e);
    return { title: _initTitle, labels: _initLabels, tags: _initTags, preview: _initPreview, previewVideo: _initPreviewVideo };
  }
}

/**
 * 执行站点脚本
 * 支持两种调用模式：
 * 1. content.js 传入 scriptStr（tabId 从 sender 推断），附带初始值
 * 2. popup 传入 tabId + url（自动匹配站点配置），初始值从 pageInfo 取
 */
async function executeSitePreview(msg, sender) {
  // 模式 1：content.js 请求
  if (msg.scriptStr) {
    const tabId = sender.tab ? sender.tab.id : msg.tabId;
    if (!tabId) return null;
    try {
      const r = await chrome.scripting.executeScript({
        target: { tabId },
        func: __runSiteScript,
        args: [msg.scriptStr, msg.title || '', msg.labels || [], msg.tags || [], msg.preview || '', msg.previewVideo || ''],
        world: 'MAIN',
      });
      if (r && r[0] && r[0].result != null) {
        return r[0].result;
      }
    } catch (e) { console.warn('[siteScript] failed:', e); }
    return null;
  }

  // 模式 2：popup 全量请求
  const tabId = msg.tabId;
  const url = msg.url;
  if (!tabId || !url) return null;

  const configs = await listSiteConfigs();
  let match = null;
  for (const sc of configs) {
    try {
      if (new RegExp(sc.urlPattern).test(url)) { match = sc; break; }
    } catch {}
  }
  if (!match || !match.script) {
    return { preview: null, previewVideo: null, title: null, labels: null, tags: null };
  }

  try {
    const r = await chrome.scripting.executeScript({
      target: { tabId },
      func: __runSiteScript,
      args: [match.script, msg.title || '', msg.labels || [], msg.tags || [], msg.preview || '', msg.previewVideo || ''],
      world: 'MAIN',
    });
    if (r && r[0] && r[0].result != null) {
      return r[0].result;
    }
  } catch (e) { console.warn('[siteScript] failed:', e); }
  return { preview: null, previewVideo: null, title: null, labels: null, tags: null };
}

// ---------- 图标刷新 ----------

async function refreshIcon(tabId, url) {
  if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('about:')) return;
  const bm = await getBookmarkByUrl(url);
  const iconPrefix = bm ? 'active' : '';
  const path = (size) => `icons/icon${size}${iconPrefix ? '-' + iconPrefix : ''}.png`;
  try {
    await chrome.action.setIcon({ tabId, path: { 16: path(16), 48: path(48), 128: path(128) } });
  } catch (e) {
    // tab may be closed
  }
}

async function refreshAllTabIcons() {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      await refreshIcon(tab.id, tab.url);
    }
  } catch (e) {
    // ignore
  }
}

// ---------- Chrome sync 监听（拉取） ----------
let _syncPushing = false;
let _gdMerging = false; // 合并写入时抑制 onChanged

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (_gdMerging) return; // 合并写入时抑制
  // 远程数据变更，自动拉取（chrome.storage.sync → local）
  if (area === 'local') {
    // local 变更不需要从 sync 拉取
    return;
  }
});

// 独立监听 chrome.storage.sync 变更
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (_syncPushing) return; // 忽略自己触发的变更
  // 远程数据变更，自动拉取
  syncFromCloud().catch(e => console.warn('[bookmark-tags] auto pull from sync change failed:', e));
});

// ---------- 脏标记 + 防抖推送 ----------

let _gdPushTimer = null;

async function markDirtyAndSync() {
  // 1. Chrome sync（保持原逻辑）
  const config = await getConfig();
  if (config.syncEnabled) {
    try {
      const data = {};
      for (const k of Object.values(STORAGE_KEYS)) {
        if (k === STORAGE_KEYS.tombstones) continue; // tombstone 不同步到 chrome.storage.sync
        data[k] = await getStore(k);
      }
      _syncPushing = true;
      await chrome.storage.sync.set(data);
      setTimeout(() => { _syncPushing = false; }, 500);
    } catch (e) {
      _syncPushing = false;
      console.warn('sync push failed:', e);
    }
  }
  // 2. 标记 dirty + 防抖 GD push
  if (config.gdAutoSync) {
    config.gdDirty = true;
    await setStore(STORAGE_KEYS.config, config);
    scheduleGdPush();
  }
}

function scheduleGdPush() {
  if (_gdPushTimer) clearTimeout(_gdPushTimer);
  _gdPushTimer = setTimeout(() => {
    _gdPushTimer = null;
    gdAutoPush().catch(e => console.warn('[gd] auto push failed:', e.message));
  }, 3000);
}

async function gdAutoPush() {
  const config = await getConfig();
  if (!config.gdAutoSync || !config.gdDirty) return;
  try {
    const result = await gdVersionedPush(false);
    if (result.ok) {
      config.gdDirty = false;
      await setStore(STORAGE_KEYS.config, config);
    }
  } catch (e) {
    console.warn('[gd] auto push error:', e.message);
  }
}

// ---------- chrome.alarms 定时兜底 ----------

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('gdAutoSync', { periodInMinutes: 1 });
  refreshAllTabIcons();
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('gdAutoSync', { periodInMinutes: 1 });
  refreshAllTabIcons();
});

// ---- Tab icon auto-refresh ----
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) await refreshIcon(tab.id, tab.url);
  } catch (e) {}
});
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') {
    try {
      if (tab.url) await refreshIcon(tabId, tab.url);
    } catch (e) {}
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'gdAutoSync') {
    await gdAutoPush();
  }
});

// ---------- Chrome sync 推送/拉取 ----------

async function syncIfEnabled() {
  // 兼容旧调用，实际走 markDirtyAndSync
  return markDirtyAndSync();
}

async function syncFromCloud({ force = false } = {}) {
  const config = await getConfig();
  if (!force && !config.syncEnabled) return { ok: false, error: 'sync not enabled' };
  try {
    const data = await chrome.storage.sync.get(Object.values(STORAGE_KEYS));
    let changed = false;
    // 先拉取业务数据（不含 config）
    for (const k of Object.values(STORAGE_KEYS)) {
      if (k === STORAGE_KEYS.config) continue; // config 最后单独处理
      if (k === STORAGE_KEYS.tombstones) continue; // tombstone 不同步到 chrome.storage.sync
      if (data[k] !== undefined) {
        await setStore(k, data[k]);
        changed = true;
      }
    }
    // 合并云端 config：保留云端的 syncEnabled，更新 lastSyncAt
    if (data[STORAGE_KEYS.config] !== undefined) {
      const cloudConfig = data[STORAGE_KEYS.config];
      const localConfig = await getConfig();
      // 云端 syncEnabled 优先（如果云端的同步设置更明确）
      const mergedConfig = { ...localConfig, ...cloudConfig, lastSyncAt: now() };
      await setStore(STORAGE_KEYS.config, mergedConfig);
      changed = true;
    } else if (changed) {
      // 云端没有 config 但有其他数据，更新本地 config 的 lastSyncAt
      config.lastSyncAt = now();
      await setStore(STORAGE_KEYS.config, config);
    }
    if (changed) {
      // 刷新图标状态
      await refreshAllTabIcons();
    }
    return { ok: true, pulled: changed };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ---------- Google Drive 云端同步 ----------

const GD_FILE_NAME = 'bookmark-tags-backup.json';
const GD_MIME_TYPE = 'application/json';

// 获取 Google OAuth token（interactive=true 会弹出授权窗口）
async function gdGetToken(interactive = false) {
  try {
    const details = {
      interactive,
      scopes: ['https://www.googleapis.com/auth/drive.appdata']
    };
    const result = await chrome.identity.getAuthToken(details);
    const token = typeof result === 'string' ? result : (result && result.token ? result.token : null);
    console.log('[gd] getAuthToken success, token:', token ? token.substring(0, 10) + '...' : 'null');
    return token;
  } catch (e) {
    console.warn('[gd] getAuthToken failed:', e.message);
    return null;
  }
}

// 清除缓存的 OAuth token 并重新获取
async function gdRefreshToken(interactive = false) {
  try {
    const oldResult = await chrome.identity.getAuthToken({ interactive: false }).catch(() => null);
    const oldToken = typeof oldResult === 'string' ? oldResult : (oldResult && oldResult.token ? oldResult.token : null);
    if (oldToken) {
      console.log('[gd] removing cached token:', oldToken.substring(0, 10) + '...');
      await chrome.identity.removeCachedAuthToken({ token: oldToken });
    }
  } catch (e) {
    // ignore
  }
  return gdGetToken(interactive);
}

// 查找 Google Drive 中的备份文件
async function gdFindFile(token) {
  const query = `name='${GD_FILE_NAME}' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=appDataFolder&fields=files(id,name,modifiedTime)`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Drive list failed: ${resp.status} ${err}`);
  }
  const data = await resp.json();
  return data.files && data.files.length > 0 ? data.files[0] : null;
}

// 上传数据到 Google Drive（创建或更新）
async function gdUpload(token, fileId, jsonData) {
  const body = JSON.stringify(jsonData);
  const metadata = {
    name: GD_FILE_NAME,
    mimeType: GD_MIME_TYPE,
  };
  if (!fileId) {
    metadata.parents = ['appDataFolder'];
  }

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  let multipartBody;
  if (fileId) {
    multipartBody = delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify({ mimeType: GD_MIME_TYPE }) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      body +
      closeDelim;
  } else {
    multipartBody = delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      body +
      closeDelim;
  }

  const uploadUrl = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

  const method = fileId ? 'PATCH' : 'POST';

  const resp = await fetch(uploadUrl, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Drive upload failed: ${resp.status} ${err}`);
  }
  return await resp.json();
}

// 从 Google Drive 下载数据
async function gdDownload(token, fileId) {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Drive download failed: ${resp.status} ${err}`);
  }
  return await resp.json();
}

// ---------- 版本化 Push（核心） ----------

async function gdVersionedPush(interactive = false, _retry = false) {
  let token = await gdGetToken(interactive);
  if (!token) return { ok: false, error: '授权失败' };

  try {
    const config = await getConfig();
    // 确保有 deviceId
    if (!config.gdDeviceId) {
      config.gdDeviceId = uid();
      await setStore(STORAGE_KEYS.config, config);
    }

    // 收集本地数据
    const localData = {};
    for (const k of Object.values(STORAGE_KEYS)) {
      localData[k] = await getStore(k);
    }

    // 读取远程文件
    const existing = await gdFindFile(token);

    if (!existing) {
      // 远程无文件 → 首次推送
      const payload = {
        _version: 1,
        _deviceId: config.gdDeviceId,
        _timestamp: now(),
        ...localData,
      };
      const result = await gdUpload(token, null, payload);
      config.gdBaseVersion = 1;
      config.gdFileId = result.id;
      config.gdLastSyncAt = now();
      config.gdDirty = false;
      await setStore(STORAGE_KEYS.config, config);
      return { ok: true, version: 1, fileId: result.id };
    }

    // 下载远程数据
    const remoteData = await gdDownload(token, existing.id);
    const remoteVersion = remoteData._version || 0;

    if (remoteVersion === config.gdBaseVersion || config.gdBaseVersion === 0) {
      // 版本一致或首次同步 → 安全推送
      const newVersion = Math.max(remoteVersion, config.gdBaseVersion) + 1;
      const payload = {
        _version: newVersion,
        _deviceId: config.gdDeviceId,
        _timestamp: now(),
        ...localData,
      };
      const result = await gdUpload(token, existing.id, payload);
      config.gdBaseVersion = newVersion;
      config.gdFileId = result.id;
      config.gdLastSyncAt = now();
      config.gdDirty = false;
      await setStore(STORAGE_KEYS.config, config);
      return { ok: true, version: newVersion, fileId: result.id };
    }

    // 版本不一致 → 需要合并
    console.log(`[gd] version mismatch: local=${config.gdBaseVersion}, remote=${remoteVersion}, merging...`);
    const { merged, conflicts } = gdMerge(localData, remoteData);

    // 写入合并结果到本地
    _gdMerging = true;
    try {
      for (const k of Object.values(STORAGE_KEYS)) {
        if (k === STORAGE_KEYS.config) continue;
        await setStore(k, merged[k]);
      }
      // 合并 tombstones
      await setStore(STORAGE_KEYS.tombstones, merged[STORAGE_KEYS.tombstones] || []);
    } finally {
      _gdMerging = false;
    }

    // 存储冲突（如果有）
    if (conflicts.length > 0) {
      await setStore('bt_gdConflicts', conflicts);
      // 通知 options 页面
      chrome.runtime.sendMessage({ action: 'gdConflictsDetected', conflicts }).catch(() => {});
    } else {
      await setStore('bt_gdConflicts', []);
    }

    // 推送合并后的数据
    const newVersion = remoteVersion + 1;
    const payload = {
      _version: newVersion,
      _deviceId: config.gdDeviceId,
      _timestamp: now(),
      ...merged,
    };
    // config 不纳入 payload 的业务数据，单独处理
    const mergedConfig = { ...config };
    delete mergedConfig.gdDirty;
    payload[STORAGE_KEYS.config] = mergedConfig;

    const result = await gdUpload(token, existing.id, payload);
    config.gdBaseVersion = newVersion;
    config.gdFileId = result.id;
    config.gdLastSyncAt = now();
    config.gdDirty = false;
    await setStore(STORAGE_KEYS.config, config);

    // 刷新图标
    await refreshAllTabIcons();

    return { ok: true, version: newVersion, fileId: result.id, merged: true, conflicts: conflicts.length };
  } catch (e) {
    if (e.message && e.message.includes('401') && !_retry) {
      console.log('[gd] push got 401, clearing token and retrying...');
      await gdRefreshToken(interactive);
      return gdVersionedPush(interactive, true);
    }
    throw e;
  }
}

// ---------- 合并算法 ----------

function gdMerge(localData, remoteData) {
  const conflicts = [];
  const merged = {};

  const entityTypes = [
    { key: STORAGE_KEYS.bookmarks, type: 'bookmark' },
    { key: STORAGE_KEYS.tags, type: 'tag' },
    { key: STORAGE_KEYS.tagGroups, type: 'tagGroup' },
    { key: STORAGE_KEYS.siteConfigs, type: 'siteConfig' },
  ];

  for (const { key, type } of entityTypes) {
    const localArr = localData[key] || [];
    const remoteArr = remoteData[key] || [];

    // 收集双方 tombstone
    const localTombs = new Map();
    (localData[STORAGE_KEYS.tombstones] || []).filter(t => t.type === type).forEach(t => localTombs.set(t.id, t));
    const remoteTombs = new Map();
    (remoteData[STORAGE_KEYS.tombstones] || []).filter(t => t.type === type).forEach(t => remoteTombs.set(t.id, t));

    const localMap = new Map(localArr.map(e => [e.id, e]));
    const remoteMap = new Map(remoteArr.map(e => [e.id, e]));
    const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

    const mergedArr = [];

    for (const id of allIds) {
      const local = localMap.get(id);
      const remote = remoteMap.get(id);
      const localTomb = localTombs.get(id);
      const remoteTomb = remoteTombs.get(id);

      if (local && remote) {
        // 双方都有 → updatedAt 新者优先
        const lu = local.updatedAt || 0;
        const ru = remote.updatedAt || 0;
        if (lu > ru) {
          mergedArr.push(local);
        } else if (ru > lu) {
          mergedArr.push(remote);
        } else if (JSON.stringify(local) === JSON.stringify(remote)) {
          mergedArr.push(local);
        } else {
          // 冲突
          conflicts.push({ type, id, local, remote });
          mergedArr.push(local); // 暂用本地版本
        }
      } else if (local && !remote) {
        // 仅本地有 → 检查远程是否删除了
        if (remoteTomb && remoteTomb.deletedAt > (local.updatedAt || 0)) {
          // 远程删除了且删除时间比本地更新 → 尊重删除
        } else {
          mergedArr.push(local);
        }
      } else if (!local && remote) {
        // 仅远程有 → 检查本地是否删除了
        if (localTomb && localTomb.deletedAt > (remote.updatedAt || 0)) {
          // 本地删除了且删除时间比远程更新 → 尊重删除
        } else {
          mergedArr.push(remote);
        }
      }
    }

    merged[key] = mergedArr;
  }

  // 合并 tombstones：去重，保留每个 id 最新的 deletedAt
  const allTombs = [...(localData[STORAGE_KEYS.tombstones] || []), ...(remoteData[STORAGE_KEYS.tombstones] || [])];
  const tombMap = new Map();
  for (const t of allTombs) {
    const k = `${t.type}:${t.id}`;
    const existing = tombMap.get(k);
    if (!existing || t.deletedAt > existing.deletedAt) {
      tombMap.set(k, t);
    }
  }
  // 清理 30 天以上的 tombstone
  const thirtyDaysAgo = now() - 30 * 24 * 60 * 60 * 1000;
  merged[STORAGE_KEYS.tombstones] = [...tombMap.values()].filter(t => t.deletedAt > thirtyDaysAgo);

  // 合并 config：本地优先（保留用户偏好设置）
  const localConfig = localData[STORAGE_KEYS.config] || {};
  const remoteConfig = remoteData[STORAGE_KEYS.config] || {};
  merged[STORAGE_KEYS.config] = {
    ...remoteConfig,
    ...localConfig,
    // 以下字段取本地
    syncEnabled: localConfig.syncEnabled ?? remoteConfig.syncEnabled,
    gdAutoSync: localConfig.gdAutoSync ?? remoteConfig.gdAutoSync,
    locale: localConfig.locale ?? remoteConfig.locale,
    theme:  localConfig.theme  ?? remoteConfig.theme,
  };

  return { merged, conflicts };
}

// ---------- 冲突解决 ----------

async function gdResolveConflicts(resolutions) {
  // resolutions: [{ type, id, choice: 'local'|'remote' }]
  const conflicts = await getStore('bt_gdConflicts');
  if (!conflicts || conflicts.length === 0) return { ok: true };

  // 读取远程数据
  const token = await gdGetToken(false);
  if (!token) return { ok: false, error: '授权失败' };

  const existing = await gdFindFile(token);
  if (!existing) return { ok: false, error: '远程无数据' };
  const remoteData = await gdDownload(token, existing.id);

  // 应用用户选择
  for (const r of resolutions) {
    const conflict = conflicts.find(c => c.type === r.type && c.id === r.id);
    if (!conflict) continue;

    const storageKey = r.type === 'bookmark' ? STORAGE_KEYS.bookmarks :
                       r.type === 'tag' ? STORAGE_KEYS.tags :
                       r.type === 'tagGroup' ? STORAGE_KEYS.tagGroups :
                       STORAGE_KEYS.siteConfigs;

    const all = await getStore(storageKey);
    const idx = all.findIndex(e => e.id === r.id);
    const chosen = r.choice === 'remote' ? conflict.remote : conflict.local;

    if (idx >= 0) {
      all[idx] = { ...chosen, updatedAt: now() };
    } else {
      all.push({ ...chosen, updatedAt: now() });
    }
    await setStore(storageKey, all);
  }

  // 清除已解决的冲突
  const remaining = conflicts.filter(c =>
    !resolutions.some(r => r.type === c.type && r.id === c.id)
  );
  await setStore('bt_gdConflicts', remaining);

  // 标记 dirty 以触发推送
  const config = await getConfig();
  config.gdDirty = true;
  await setStore(STORAGE_KEYS.config, config);
  scheduleGdPush();

  return { ok: true };
}

// ---------- 手动 GD Push（包装版本化 Push） ----------

async function gdSyncPush(interactive = false) {
  return gdVersionedPush(interactive);
}

// ---------- 手动 GD Pull ----------

async function gdSyncPull(interactive = false, _retry = false) {
  let token = await gdGetToken(interactive);
  if (!token) return { ok: false, error: '授权失败' };

  try {
    const existing = await gdFindFile(token);
    if (!existing) return { ok: false, error: '云端无备份数据' };

    const remoteData = await gdDownload(token, existing.id);
    const remoteVersion = remoteData._version || 0;

    // 收集本地数据
    const localData = {};
    for (const k of Object.values(STORAGE_KEYS)) {
      localData[k] = await getStore(k);
    }

    // 合并
    const { merged, conflicts } = gdMerge(localData, remoteData);

    // 写入合并结果
    _gdMerging = true;
    try {
      for (const k of Object.values(STORAGE_KEYS)) {
        if (k === STORAGE_KEYS.config) continue;
        await setStore(k, merged[k]);
      }
      await setStore(STORAGE_KEYS.tombstones, merged[STORAGE_KEYS.tombstones] || []);
    } finally {
      _gdMerging = false;
    }

    // 更新 config
    const config = await getConfig();
    config.gdBaseVersion = remoteVersion;
    config.gdFileId = existing.id;
    config.gdLastSyncAt = now();
    config.gdDirty = false;
    if (merged[STORAGE_KEYS.config]) {
      Object.assign(config, merged[STORAGE_KEYS.config], {
        gdBaseVersion: remoteVersion,
        gdFileId: existing.id,
        gdLastSyncAt: now(),
        gdDirty: false,
      });
    }
    await setStore(STORAGE_KEYS.config, config);

    // 存储冲突
    if (conflicts.length > 0) {
      await setStore('bt_gdConflicts', conflicts);
    } else {
      await setStore('bt_gdConflicts', []);
    }

    await refreshAllTabIcons();

    return { ok: true, pulled: true, fileId: existing.id, version: remoteVersion, conflicts: conflicts.length };
  } catch (e) {
    if (e.message && e.message.includes('401') && !_retry) {
      console.log('[gd] pull got 401, clearing token and retrying...');
      await gdRefreshToken(interactive);
      return gdSyncPull(interactive, true);
    }
    throw e;
  }
}

// ---------- 消息路由 ----------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handle = async () => {
    switch (msg.action) {
      case 'listBookmarks':       return await listBookmarks();
      case 'getBookmarkByUrl':    return await getBookmarkByUrl(msg.url);
      case 'addBookmark':         return await addBookmark(msg.data);
      case 'updateBookmark':      return await updateBookmark(msg.id, msg.patch);
      case 'removeBookmark':      return await removeBookmark(msg.id);
      case 'searchBookmarks':     return await searchBookmarks(msg.params);

      case 'listTagGroups':       return await listTagGroups();
      case 'addTagGroup':         return await addTagGroup(msg.name);
      case 'updateTagGroup':      return await updateTagGroup(msg.id, msg.patch);
      case 'removeTagGroup':      return await removeTagGroup(msg.id);

      case 'listTags':            return await listTags();
      case 'addTag':              return await addTag(msg.data);
      case 'updateTag':           return await updateTag(msg.id, msg.patch);
      case 'removeTag':           return await removeTag(msg.id);
      case 'expandTagIds':        return await expandTagIds(msg.tagId);

      case 'suggestTags':         return await suggestTags(msg.labels || [], msg.contentTags || []);
      case 'recentTags':          return await recentTags(msg.limit);
      case 'suggestPreview':      return await suggestPreview(msg.url);
      case 'executeSitePreview':  return await executeSitePreview(msg, sender);

      case 'listSiteConfigs':     return await listSiteConfigs();
      case 'addSiteConfig':       return await addSiteConfig(msg.data);
      case 'updateSiteConfig':    return await updateSiteConfig(msg.id, msg.patch);
      case 'removeSiteConfig':    return await removeSiteConfig(msg.id);

      case 'getConfig':           return await getConfig();
      case 'saveConfig':          await setStore(STORAGE_KEYS.config, msg.config); await markDirtyAndSync(); return msg.config;
      case 'saveTagGroups':       await setStore(STORAGE_KEYS.tagGroups, msg.groups); await markDirtyAndSync(); return msg.groups;

      case 'syncPush':            return await markDirtyAndSync();
      case 'syncPull':            return await syncFromCloud();

      case 'gdPush':              return await gdSyncPush(msg.interactive || false);
      case 'gdPull':              return await gdSyncPull(msg.interactive || false);
      case 'gdAuth': {
        const t = await gdRefreshToken(true);
        return t ? { ok: true } : { ok: false, error: '授权失败' };
      }

      case 'gdResolveConflicts':  return await gdResolveConflicts(msg.resolutions);
      case 'gdGetConflicts':      return await getStore('bt_gdConflicts');

      case 'refreshIcon': {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) await refreshIcon(tab.id, tab.url);
        return true;
      }

      case 'pageInfo': {
        if (sender.tab) {
          chrome.storage.local.set({ _currentPageInfo: { tabId: sender.tab.id, ...msg.data } });
        }
        return true;
      }

      default: return { error: 'unknown action: ' + msg.action };
    }
  };

  handle().then(r => sendResponse(r)).catch(e => sendResponse({ error: e.message }));
  return true;
});
