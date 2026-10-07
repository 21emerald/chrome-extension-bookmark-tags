// ============================================================
// bookmark-tags home.js — 新标签页首页
// 展示被标记为 🏠 首页的标签下的收藏，每次加载随机采样一批。
// 显示方式（卡片 / 卡片+预览图 / 列表）保存在 bt_config.homeDisplay，
// 因此会随 Chrome 同步 / Google Drive 一起走，下次打开自动记住。
// ============================================================

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function send(action, data = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action, ...data }, resp => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve(resp);
    });
  });
}

// 与 background.js 的 sanitizeLink 同一套白名单：挡住 javascript: / data: 之类的伪协议
function safeUrl(u) {
  const s = String(u == null ? '' : u).trim();
  return /^(https?|ftp):\/\/[^\s]+$/i.test(s) ? s : '';
}

const VIEW_MODES = ['card', 'card-preview', 'list'];
const DEFAULT_VIEW = 'card';

let allTags = [];
let viewMode = DEFAULT_VIEW;
let autoplayVideos = false;
let lastResult = null;

function updateViewButtons() {
  $$('#homeView .home-view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewMode);
  });
}

/** 清空网格前先停掉并释放所有 <video>，
 *  否则重绘（换一批 / 切模式）后旧视频仍在后台解码下载。 */
function clearGrid(grid) {
  grid.querySelectorAll('video').forEach(v => {
    v.pause();
    v.removeAttribute('src');
    v.load();
  });
  grid.innerHTML = '';
}

/** 构建预览媒体。有 previewVideo 时做成「缩略图 + 覆盖其上的静音循环视频」：
 *  悬停播放、移开暂停复位；开启自动播放则直接播放。
 *  没有视频就退化成一张普通预览图。 */
function buildMedia(bm) {
  const img = safeUrl(bm.preview);
  const vid = safeUrl(bm.previewVideo);
  if (!img && !vid) return null;

  if (!vid) {
    const image = document.createElement('img');
    image.className = 'home-card-preview';
    image.loading = 'lazy';
    image.alt = '';
    image.addEventListener('error', () => image.remove());
    image.src = img;
    return image;
  }

  const media = document.createElement('div');
  media.className = 'home-card-media';

  if (img) {
    const thumb = document.createElement('img');
    thumb.className = 'home-card-thumb';
    thumb.loading = 'lazy';
    thumb.alt = '';
    thumb.addEventListener('error', () => { thumb.style.display = 'none'; });
    thumb.src = img;
    media.appendChild(thumb);
  }

  const video = document.createElement('video');
  video.className = 'home-card-video' + (img ? '' : ' solo');
  video.src = vid;
  video.muted = true;          // 浏览器只允许静音自动播放
  video.loop = true;
  video.playsInline = true;
  video.preload = 'metadata';  // 首页最多 24 张卡，不用 auto 预载全部视频
  media.appendChild(video);

  if (autoplayVideos) {
    video.classList.add('playing');
    video.play().catch(() => {});
  } else {
    media.addEventListener('mouseenter', () => {
      video.classList.add('playing');
      video.play().catch(() => {});
    });
    media.addEventListener('mouseleave', () => {
      video.pause();
      video.currentTime = 0;
      video.classList.remove('playing');
    });
  }

  return media;
}

/** 按当前 viewMode 渲染卡片。DOM 只建一次，模式差异靠 container 上的 class 驱动；
 *  唯一的例外是预览图：只有在 card-preview 下才真正创建 <img>，
 *  免得切到列表模式还去下载一堆用不上的图片。 */
function renderResults() {
  const grid = $('#homeGrid');
  const empty = $('#homeEmpty');
  grid.className = 'home-grid view-' + viewMode;
  clearGrid(grid);
  empty.style.display = 'none';
  $('#homeCount').textContent = '';

  const res = lastResult;
  if (!res) return;

  if (res.homeTagCount === 0) {
    return showEmpty(t('home.empty_no_tags'), t('home.empty_no_tags_hint'), true);
  }
  if (!res.bookmarks || res.bookmarks.length === 0) {
    return showEmpty(t('home.empty_no_bookmarks'), '', true);
  }

  $('#homeCount').textContent = t('home.count', { n: res.bookmarks.length, total: res.total });

  res.bookmarks.forEach(bm => {
    const url = safeUrl(bm.url);
    if (!url) return;

    // 全程 createElement + 属性赋值，不用 innerHTML 拼模板：
    // 这是本页最主要的 XSS 防线，不依赖任何转义助手写对。
    const card = document.createElement('a');
    card.className = 'home-card';
    card.href = url;   // <a href> 天然支持 Ctrl/⌘+点击、中键、右键菜单

    if (viewMode === 'card-preview') {
      const media = buildMedia(bm);
      if (media) card.appendChild(media);
    }

    const title = document.createElement('div');
    title.className = 'home-card-title';
    title.textContent = bm.title || bm.url;

    const urlEl = document.createElement('div');
    urlEl.className = 'home-card-url';
    urlEl.textContent = bm.url;
    urlEl.title = bm.url;

    const tagsEl = document.createElement('div');
    tagsEl.className = 'home-card-tags';
    (bm.tags || []).forEach(tid => {
      const tag = allTags.find(x => x.id === tid);
      if (!tag) return;
      const chip = document.createElement('span');
      chip.className = 'home-card-tag';
      chip.textContent = tag.name;
      tagsEl.appendChild(chip);
    });

    card.append(title, urlEl, tagsEl);
    grid.appendChild(card);
  });
}

async function load() {
  const grid = $('#homeGrid');
  const empty = $('#homeEmpty');
  clearGrid(grid);
  empty.style.display = 'none';
  $('#homeCount').textContent = '';

  let res;
  try {
    res = await send('homeBookmarks');
  } catch (e) {
    console.error('[bookmark-tags] homeBookmarks failed:', e);
    lastResult = null;
    return showEmpty(t('home.load_failed'), '', false);
  }

  lastResult = res;
  renderResults();
}

/** 把 home* 偏好写回 bt_config。
 *  先重新 getConfig 再改字段，避免用缓存的旧对象整体覆盖掉其它配置
 *  （saveConfig 是整体替换，不是合并）。 */
async function saveHomePrefs(patch) {
  try {
    const cfg = (await send('getConfig')) || {};
    Object.assign(cfg, patch);
    await send('saveConfig', { config: cfg });
  } catch (e) {
    console.error('[bookmark-tags] saving home prefs failed:', e);
  }
}

async function setViewMode(mode) {
  if (!VIEW_MODES.includes(mode) || mode === viewMode) return;
  viewMode = mode;
  updateViewButtons();
  renderResults();   // 立刻生效（用已有数据重绘，不再请求后台）
  await saveHomePrefs({ homeDisplay: mode });
}

async function setAutoplay(on) {
  if (on === autoplayVideos) return;
  autoplayVideos = on;
  renderResults();   // 直接按新设置重绘，立刻看到效果
  await saveHomePrefs({ homeAutoplay: on });
}

function showEmpty(msg, hint, showBtn) {
  const el = $('#homeEmpty');
  el.innerHTML = '';

  const p = document.createElement('div');
  p.textContent = msg;
  el.appendChild(p);

  if (hint) {
    const h = document.createElement('div');
    h.textContent = hint;
    el.appendChild(h);
  }

  if (showBtn) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'home-btn';
    btn.textContent = t('home.open_options');
    btn.addEventListener('click', () => chrome.runtime.openOptionsPage());
    el.appendChild(btn);
  }

  el.style.display = 'block';
}

async function initHome() {
  try {
    const cfg = await send('getConfig');
    if (cfg && cfg.locale) setLocale(cfg.locale);
    if (cfg && VIEW_MODES.includes(cfg.homeDisplay)) viewMode = cfg.homeDisplay;
    if (cfg && cfg.homeAutoplay) autoplayVideos = true;
  } catch {}
  applyLocale();
  updateViewButtons();
  $('#homeAutoplay').checked = autoplayVideos;

  try {
    allTags = (await send('listTags')) || [];
  } catch {
    allTags = [];
  }

  await load();

  $$('#homeView .home-view-btn').forEach(btn => {
    btn.addEventListener('click', () => setViewMode(btn.dataset.view));
  });
  $('#homeAutoplay').addEventListener('change', (e) => setAutoplay(e.target.checked));
  $('#homeReshuffle').addEventListener('click', load);
  $('#homeOptionsBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());
}

initHome();
