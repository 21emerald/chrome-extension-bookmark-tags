// ============================================================
// bookmark-tags options.js
// ============================================================

let allTags = [];
let allTagGroups = [];
let allBookmarks = [];
let allSiteConfigs = [];
let currentConfig = {};
let editingSiteId = null;
let tagPickerCallback = null;
let conflictResolutions = [];

// ---- 工具 ----
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }
function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function send(action, data = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action, ...data }, resp => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve(resp);
    });
  });
}

function getTagById(id) { return allTags.find(t => t.id === id); }
function getGroupById(id) { return allTagGroups.find(g => g.id === id); }
function formatDate(ts) {
  const d = new Date(ts);
  const locale = getLocale() === 'zh' ? 'zh-CN' : 'en-US';
  return d.toLocaleDateString(locale) + ' ' + d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

// ---- 初始化 ----
async function init() {
  try {
    await loadAll();
  } catch (e) {
    console.error('[bookmark-tags] loadAll failed:', e);
  }
  // 设置语言
  if (currentConfig.locale) setLocale(currentConfig.locale);
  applyLocale();
  populateLocaleSelect();
  populateThemeSelect();
  bindNav();
  filterAndRenderBookmarks();
  renderTagManager();
  renderSiteConfigs();
  loadConfig();
  bindGlobalEvents();
  checkConflicts();

  // 监听 storage 变化，实时刷新收藏列表
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    // 主题被其他标签页/设备改动时实时跟随
    if (changes.bt_config) {
      const cfg = changes.bt_config.newValue || {};
      BTTheme.apply(cfg.theme);
      BTTheme.cache(cfg.theme);
      populateThemeSelect();
    }

    const relevantKeys = ['bt_bookmarks', 'bt_tags', 'bt_tagGroups'];
    const changed = relevantKeys.some(k => changes[k]);
    if (changed) {
      loadAll().then(() => {
        filterAndRenderBookmarks();
        renderTagManager();
      });
    }
  });
}

async function loadAll() {
  [allBookmarks, allTags, allTagGroups, allSiteConfigs, currentConfig] = await Promise.all([
    send('listBookmarks'),
    send('listTags'),
    send('listTagGroups'),
    send('listSiteConfigs'),
    send('getConfig'),
  ]);
  allBookmarks = allBookmarks || [];
  allTags = allTags || [];
  allTagGroups = allTagGroups || [];
  allSiteConfigs = allSiteConfigs || [];
  currentConfig = currentConfig || { syncEnabled: true, lastSyncAt: 0 };
}

// ---- 语言选择器 ----
function populateLocaleSelect() {
  const sel = $('#localeSelect');
  if (!sel) return;
  sel.innerHTML = '';
  SUPPORTED_LOCALES.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.code;
    opt.textContent = l.label;
    if (l.code === getLocale()) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ---- 主题选择器 ----
function populateThemeSelect() {
  const sel = $('#themeSelect');
  if (!sel) return;
  const current = BTTheme.normalize(currentConfig && currentConfig.theme);
  sel.innerHTML = '';
  [['system', 'options.theme_system'], ['light', 'options.theme_light'], ['dark', 'options.theme_dark']]
    .forEach(([value, key]) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = t(key);
      if (value === current) opt.selected = true;
      sel.appendChild(opt);
    });
}

// ---- 导航 ----
function bindNav() {
  $$('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      $$('.nav-item').forEach(i => i.classList.remove('active'));
      $$('.tab-panel').forEach(p => p.classList.remove('active'));
      item.classList.add('active');
      $(`#tab-${item.dataset.tab}`).classList.add('active');
    });
  });
}

// ================ Tag Picker（全局弹层） ================

function openTagPicker(callback, { excludeIds = [], activeIds = [], multi = false, allowCreate = false, createGroupId = '' } = {}) {
  tagPickerCallback = callback;
  tagPickerMeta = { excludeIds, activeIds, multi, selected: [...activeIds], allowCreate, createGroupId };
  $('#tagPickerOverlay').style.display = 'flex';
  $('#tagPickerSearch').value = '';
  $('#tagPickerSearch').focus();
  renderTagPickerContent('');
}

function closeTagPicker() {
  $('#tagPickerOverlay').style.display = 'none';
  tagPickerCallback = null;
  tagPickerMeta = null;
}

let tagPickerMeta = null;

function renderTagPickerContent(kw = '') {
  const content = $('#tagPickerContent');
  content.innerHTML = '';
  const lowerKw = kw.toLowerCase();

  const groupMap = {};
  allTagGroups.sort((a, b) => a.order - b.order).forEach(g => { groupMap[g.id] = { group: g, tags: [] }; });
  groupMap['__nogroup__'] = { group: { id: '', name: t('options.tag_no_group') }, tags: [] };

  allTags.forEach(t => {
    const gid = t.groupId || '__nogroup__';
    if (!groupMap[gid]) groupMap[gid] = { group: { id: '', name: t('options.tag_no_group') }, tags: [] };
    if (tagPickerMeta?.excludeIds?.includes(t.id)) return;
    if (lowerKw) {
      const match = t.name.toLowerCase().includes(lowerKw) || t.alias.some(a => a.toLowerCase().includes(lowerKw));
      if (!match) return;
    }
    groupMap[gid].tags.push(t);
  });

  for (const gid of Object.keys(groupMap)) {
    const { group, tags } = groupMap[gid];
    if (tags.length === 0) continue;

    const groupDiv = document.createElement('div');
    groupDiv.className = 'tag-picker-group';

    const groupTitle = document.createElement('div');
    groupTitle.className = 'tag-picker-group-title';
    groupTitle.textContent = group.name;
    groupDiv.appendChild(groupTitle);

    const tagsDiv = document.createElement('div');
    tagsDiv.className = 'tag-picker-tags';
    tags.forEach(t => {
      const chip = document.createElement('span');
      const isActive = tagPickerMeta?.selected?.includes(t.id);
      chip.className = 'tag-chip' + (isActive ? ' active' : '');
      chip.textContent = t.name;
      chip.addEventListener('click', () => {
        if (tagPickerMeta?.multi) {
          if (tagPickerMeta.selected.includes(t.id)) {
            tagPickerMeta.selected = tagPickerMeta.selected.filter(x => x !== t.id);
          } else {
            tagPickerMeta.selected.push(t.id);
          }
          renderTagPickerContent($('#tagPickerSearch').value.trim());
        } else {
          // 单选：直接回调
          if (tagPickerCallback) tagPickerCallback(t.id);
          closeTagPicker();
        }
      });
      tagsDiv.appendChild(chip);
    });
    groupDiv.appendChild(tagsDiv);
    content.appendChild(groupDiv);
  }

  // "创建新标签"选项（allowCreate 且搜索词无精确匹配时）
  if (tagPickerMeta?.allowCreate && lowerKw && !allTags.some(t => t.name.toLowerCase() === lowerKw)) {
    const createDiv = document.createElement('div');
    createDiv.className = 'tag-picker-create';
    createDiv.textContent = t('options.tag_picker_create', { name: kw });
    createDiv.addEventListener('click', async () => {
      const gid = tagPickerMeta.createGroupId === '__nogroup__' ? '' : tagPickerMeta.createGroupId;
      const newTag = await send('addTag', { data: { name: kw, groupId: gid } });
      if (newTag) {
        await loadAll();
        if (tagPickerCallback) tagPickerCallback(newTag.id);
      }
      closeTagPicker();
    });
    content.appendChild(createDiv);
  }
}

// ================ 收藏模块 ================

let bmSearchFav = 0;
let bmSelectedTagIds = [];
let bmTagPanelOpen = false;
let bmFilteredBms = [];
let bmRenderedCount = 0;
let bmLoading = false;
let bmScrollObserver = null;
let bmLayout = 'list'; // 'list' or 'grid'
let bmTileSize = 320;
let bmPreviewOnly = false; // grid preview-only mode
const BM_PAGE_SIZE = 50;

// ---- 标签面板 ----

function toggleBmTagPanel() {
  bmTagPanelOpen = !bmTagPanelOpen;
  const panel = $('#bmTagPanel');
  const btn = $('#bmTagPanelToggle');
  if (bmTagPanelOpen) {
    renderBmTagPanel();
    panel.style.display = 'block';
    btn.classList.add('active');
  } else {
    panel.style.display = 'none';
    btn.classList.remove('active');
  }
}

function renderBmTagPanel() {
  const panel = $('#bmTagPanel');
  panel.innerHTML = '';

  const groupMap = {};
  allTagGroups.sort((a, b) => a.order - b.order).forEach(g => { groupMap[g.id] = { group: g, tags: [] }; });
  groupMap['__nogroup__'] = { group: { id: '', name: t('options.tag_no_group') }, tags: [] };

  allTags.forEach(t => {
    const gid = t.groupId || '__nogroup__';
    if (!groupMap[gid]) groupMap[gid] = { group: { id: '', name: t('options.tag_no_group') }, tags: [] };
    groupMap[gid].tags.push(t);
  });

  for (const gid of Object.keys(groupMap)) {
    const { group, tags } = groupMap[gid];
    if (tags.length === 0) continue;

    const groupDiv = document.createElement('div');
    groupDiv.className = 'bm-tp-group';

    const groupTitle = document.createElement('div');
    groupTitle.className = 'bm-tp-group-title';
    groupTitle.textContent = group.name;
    groupDiv.appendChild(groupTitle);

    const tagsDiv = document.createElement('div');
    tagsDiv.className = 'bm-tp-tags';
    tags.forEach(t => {
      const chip = document.createElement('span');
      const isSelected = bmSelectedTagIds.includes(t.id);
      chip.className = 'bm-tp-tag' + (isSelected ? ' selected' : '');
      chip.textContent = t.name;
      chip.addEventListener('click', () => toggleBmSearchTag(t.id));
      tagsDiv.appendChild(chip);
    });
    groupDiv.appendChild(tagsDiv);
    panel.appendChild(groupDiv);
  }
}

function toggleBmSearchTag(tagId) {
  if (bmSelectedTagIds.includes(tagId)) {
    bmSelectedTagIds = bmSelectedTagIds.filter(x => x !== tagId);
  } else {
    bmSelectedTagIds.push(tagId);
  }
  renderBmTagPanel();
  renderBmSelectedTags();
  filterAndRenderBookmarks();
}

function renderBmSelectedTags() {
  const container = $('#bmSelectedTags');
  container.innerHTML = '';
  if (bmSelectedTagIds.length === 0) return;

  bmSelectedTagIds.forEach(tid => {
    const t = getTagById(tid);
    if (!t) return;
    const chip = document.createElement('span');
    chip.className = 'bm-sel-tag';
    chip.innerHTML = `${escHtml(t.name)}<span class="bm-sel-tag-remove" data-tid="${tid}">✕</span>`;
    container.appendChild(chip);
  });
  container.querySelectorAll('.bm-sel-tag-remove').forEach(el => {
    el.addEventListener('click', () => toggleBmSearchTag(el.dataset.tid));
  });
}

// ---- 标签排序辅助 ----

function bmFirstTagName(bm) {
  if (bm.tags.length === 0) return '';
  const t = getTagById(bm.tags[0]);
  return t ? t.name.toLowerCase() : '';
}

// ---- 筛选 + 排序 ----

function getFilteredBookmarks() {
  let bms = [...allBookmarks];
  const kw = ($('#bmSearchInput')?.value || '').trim().toLowerCase();

  if (kw) {
    const matchedGroupTagIds = new Set();
    allTagGroups.forEach(g => {
      if (g.name.toLowerCase().includes(kw)) {
        // 直接属于该分组的 tag
        allTags.forEach(t => {
          if (t.groupId === g.id) matchedGroupTagIds.add(t.id);
        });
        // 标记Tags 指向该分组 tag 的 tag 也应匹配
        allTags.forEach(t => {
          if (t.tags && t.tags.some(stid => matchedGroupTagIds.has(stid))) {
            matchedGroupTagIds.add(t.id);
          }
        });
      }
    });

    bms = bms.filter(b => {
      if (b.title.toLowerCase().includes(kw)) return true;
      return b.tags.some(tid => {
        if (matchedGroupTagIds.has(tid)) return true;
        const t = getTagById(tid);
        if (!t) return false;
        if (t.name.toLowerCase().includes(kw)) return true;
        if (t.alias.some(a => a.toLowerCase().includes(kw))) return true;
        return t.tags.some(stid => {
          const st = getTagById(stid);
          return st && st.name.toLowerCase().includes(kw);
        });
      });
    });
  }

  // 标签 AND 筛选
  if (bmSelectedTagIds.length > 0) {
    bms = bms.filter(b => bmSelectedTagIds.every(tid => b.tags.includes(tid)));
  }

  if (bmSearchFav > 0) {
    bms = bms.filter(b => b.favorite >= bmSearchFav);
  }

  const sort = $('#bmSortSelect')?.value || 'newest';
  if (sort === 'newest') {
    bms.sort((a, b) => b.createdAt - a.createdAt);
  } else if (sort === 'favorite') {
    bms.sort((a, b) => b.favorite - a.favorite || b.createdAt - a.createdAt);
  } else if (sort === 'tagAsc') {
    bms.sort((a, b) => bmFirstTagName(a).localeCompare(bmFirstTagName(b)) || b.createdAt - a.createdAt);
  } else if (sort === 'tagDesc') {
    bms.sort((a, b) => bmFirstTagName(b).localeCompare(bmFirstTagName(a)) || b.createdAt - a.createdAt);
  }

  return bms;
}

// ---- 条目数量统计 ----

function updateBmCount() {
  const el = $('#bmCount');
  if (!el) return;
  const kw = ($('#bmSearchInput')?.value || '').trim();
  const hasFilter = !!kw || bmSelectedTagIds.length > 0 || bmSearchFav > 0;
  el.textContent = hasFilter
    ? t('options.bm_count_filtered', { n: bmFilteredBms.length, total: allBookmarks.length })
    : t('options.bm_count_all', { n: allBookmarks.length });
}

// ---- 分页渲染 ----

function filterAndRenderBookmarks() {
  bmFilteredBms = getFilteredBookmarks();
  bmRenderedCount = 0;
  updateBmCount();
  const list = $('#bookmarkList');
  list.innerHTML = '';

  if (bmFilteredBms.length === 0) {
    list.innerHTML = `<div style="color:var(--text-dim);text-align:center;padding:20px;">${t('options.bm_empty')}</div>`;
    updateScrollObserver();
    return;
  }

  appendBookmarkPage();
  updateScrollObserver();
}

function appendBookmarkPage() {
  if (bmLoading) return;
  const startIdx = bmRenderedCount;
  const end = Math.min(bmRenderedCount + BM_PAGE_SIZE, bmFilteredBms.length);
  if (startIdx >= bmFilteredBms.length) return;

  const list = $('#bookmarkList');
  const fragment = document.createDocumentFragment();

  for (let i = startIdx; i < end; i++) {
    const bm = bmFilteredBms[i];
    const card = document.createElement('div');
    const isGrid = bmLayout === 'grid';
    const isPreviewOnly = isGrid && bmPreviewOnly;
    card.className = 'bm-card' + (isGrid ? ' bm-card-tile' : '') + (isPreviewOnly ? ' bm-card-preview-only' : '');
    card.dataset.bmId = bm.id;
    const hasPreview = !!(bm.preview || bm.previewVideo);
    const previewHtml = hasPreview ? `<div class="bm-card-preview" data-href="${escHtml(bm.url)}">${bm.previewVideo ? `<img class="bm-preview-img bm-preview-thumb" src="${escHtml(bm.preview || bm.previewVideo)}" alt="" loading="lazy"><video class="bm-preview-video bm-preview-hover" src="${escHtml(bm.previewVideo)}" muted loop playsinline preload="auto"></video>` : `<img class="bm-preview-img" src="${escHtml(bm.preview)}" alt="" loading="lazy">`}</div>` : (isGrid ? `<div class="bm-card-preview-empty" data-href="${escHtml(bm.url)}">🔖</div>` : '');
    const bodyHtml = `
      <div class="bm-card-body">
        <div class="bm-card-title"><a href="${escHtml(bm.url)}" target="_blank">${escHtml(bm.title)}</a><div class="bm-title-full">${escHtml(bm.title)}</div></div>
        <div class="bm-card-url">${escHtml(bm.url)}</div>
        <div class="bm-card-meta">
          ${bm.favorite > 0 ? `<span class="bm-card-stars">${'★'.repeat(bm.favorite)}${'☆'.repeat(5 - bm.favorite)}</span>` : ''}
          <span class="bm-card-tags">
            ${bm.tags.map(tid => {
              const t = getTagById(tid);
              return t ? `<span class="bm-card-tag">${escHtml(t.name)}</span>` : '';
            }).join('')}
          </span>
        </div>
        <div class="bm-card-date">${formatDate(bm.createdAt)}</div>
      </div>`;
    const actionsHtml = `
      <div class="bm-card-actions">
        <button class="btn-secondary btn-sm edit-bm" data-id="${bm.id}">${t('options.bm_edit')}</button>
        <button class="btn-danger btn-sm del-bm" data-id="${bm.id}">${t('options.bm_delete')}</button>
      </div>`;

    // Grid: preview on top, then body, then actions. List: body, preview, actions (current order)
    // Preview-only: wrap body+actions in hover panel that expands below card on hover
    if (isGrid) {
      if (isPreviewOnly) {
        card.innerHTML = previewHtml + `<div class="bm-card-hover-panel">${bodyHtml}${actionsHtml}</div>`;
      } else {
        card.innerHTML = previewHtml + bodyHtml + actionsHtml;
      }
    } else {
      card.innerHTML = bodyHtml + previewHtml + actionsHtml;
    }

    // 直接绑定事件（避免索引计算问题）
    card.querySelector('.edit-bm').addEventListener('click', () => editBookmark(bm.id));
    card.querySelector('.del-bm').addEventListener('click', async () => {
      if (confirm(t('options.bm_confirm_delete'))) {
        await send('removeBookmark', { id: bm.id });
        allBookmarks = allBookmarks.filter(b => b.id !== bm.id);
        filterAndRenderBookmarks();
      }
    });

    // 预览视频：根据自动播放开关决定行为
    if (hasPreview && bm.previewVideo) {
      const previewDiv = card.querySelector('.bm-card-preview');
      const thumbImg = previewDiv.querySelector('.bm-preview-thumb');
      const hoverVideo = previewDiv.querySelector('.bm-preview-hover');
      if (thumbImg && hoverVideo) {
        const autoplay = $('#bmAutoplayVideos')?.checked;
        if (autoplay) {
          // 自动播放模式：直接显示视频并播放，隐藏缩略图
          thumbImg.style.opacity = '0';
          thumbImg.style.zIndex = '0';
          hoverVideo.style.opacity = '1';
          hoverVideo.style.zIndex = '2';
          hoverVideo.play().catch(() => {});
        } else {
          // hover 模式：默认显示缩略图
          thumbImg.style.opacity = '1';
          thumbImg.style.zIndex = '1';
          hoverVideo.style.opacity = '0';
          hoverVideo.style.zIndex = '0';
          previewDiv.addEventListener('mouseenter', () => {
            hoverVideo.style.opacity = '1';
            hoverVideo.style.zIndex = '2';
            thumbImg.style.opacity = '0';
            thumbImg.style.zIndex = '0';
            hoverVideo.play().catch(() => {});
          });
          previewDiv.addEventListener('mouseleave', () => {
            hoverVideo.pause();
            hoverVideo.currentTime = 0;
            hoverVideo.style.opacity = '0';
            hoverVideo.style.zIndex = '0';
            thumbImg.style.opacity = '1';
            thumbImg.style.zIndex = '1';
          });
        }
      }
    }

    // 点击 preview 区域打开页面（含视频点击也打开）
    const previewArea = card.querySelector('.bm-card-preview, .bm-card-preview-empty');
    if (previewArea) {
      previewArea.style.cursor = 'pointer';
      previewArea.addEventListener('click', (e) => {
        e.preventDefault();
        const href = previewArea.dataset.href;
        if (href) window.open(href, '_blank');
      });
    }

    fragment.appendChild(card);
  }

  list.appendChild(fragment);
  bmRenderedCount = end;
}

function setupScrollObserver() {
  if (bmScrollObserver) bmScrollObserver.disconnect();
  const sentinel = $('#bmScrollSentinel');
  if (!sentinel) return;
  bmScrollObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && bmRenderedCount < bmFilteredBms.length && !bmLoading) {
      appendBookmarkPage();
    }
  }, { rootMargin: '200px' });
  bmScrollObserver.observe(sentinel);
}

function updateScrollObserver() {
  setupScrollObserver();
}

function editBookmark(id) {
  const bm = allBookmarks.find(b => b.id === id);
  if (!bm) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  // 按分组渲染 tag chips
  let tagChipsHtml = '';
  const groupMap = {};
  allTagGroups.sort((a, b) => a.order - b.order).forEach(g => { groupMap[g.id] = { group: g, tags: [] }; });
  groupMap['__nogroup__'] = { group: { id: '', name: t('options.tag_no_group') }, tags: [] };
  allTags.forEach(t => {
    const gid = t.groupId || '__nogroup__';
    if (!groupMap[gid]) groupMap[gid] = { group: { id: '', name: t('options.tag_no_group') }, tags: [] };
    groupMap[gid].tags.push(t);
  });
  for (const gid of Object.keys(groupMap)) {
    const { group, tags } = groupMap[gid];
    if (tags.length === 0) continue;
    if (Object.keys(groupMap).length > 1) {
      tagChipsHtml += `<div class="group-title">${escHtml(group.name)}</div>`;
    }
    tags.forEach(t => {
      tagChipsHtml += `<span class="tag-chip ${bm.tags.includes(t.id) ? 'active' : ''}" data-tid="${t.id}">${escHtml(t.name)}</span>`;
    });
  }

  overlay.innerHTML = `
    <div class="modal">
      <h3>${t('options.bm_edit_title')}</h3>
      <div class="form-field">
        <label>${t('options.bm_field_title')}</label>
        <input type="text" id="editBmTitle" value="${escHtml(bm.title)}">
      </div>
      <div class="form-field">
        <label>${t('options.bm_field_favorite')}</label>
        <div class="star-edit" id="editBmStars">
          ${[1,2,3,4,5].map(v => `<span class="star ${v <= bm.favorite ? 'on' : ''}" data-val="${v}">${v <= bm.favorite ? '★' : '☆'}</span>`).join('')}
        </div>
      </div>
      <div class="form-field">
        <label>${t('options.bm_field_tags')}</label>
        <div class="tag-chips" id="editBmTags">${tagChipsHtml}</div>
      </div>
      <div class="form-field">
        <label>${t('options.bm_field_preview')}</label>
        <input type="text" id="editBmPreview" value="${escHtml(bm.preview || '')}" placeholder="https://example.com/image.jpg">
      </div>
      <div class="form-field">
        <label>${t('options.bm_field_preview_video')}</label>
        <input type="text" id="editBmPreviewVideo" value="${escHtml(bm.previewVideo || '')}" placeholder="https://example.com/video.mp4">
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" id="editBmCancel">${t('options.bm_cancel')}</button>
        <button class="btn-primary" id="editBmSave">${t('options.bm_save')}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // 点击 overlay 外部空白处关闭弹窗
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  // ESC 键关闭（与 tag picker 行为一致；不需要可删掉下面这段）
  const escHandler = (e) => {
    if (e.key === 'Escape' && document.body.contains(overlay)) {
      overlay.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  let editFav = bm.favorite;
  let editTags = [...bm.tags];

  overlay.querySelectorAll('#editBmStars .star').forEach(s => {
    s.addEventListener('click', () => {
      const v = parseInt(s.dataset.val);
      editFav = editFav === v ? 0 : v;
      overlay.querySelectorAll('#editBmStars .star').forEach(x => {
        const xv = parseInt(x.dataset.val);
        x.classList.toggle('on', xv <= editFav);
        x.textContent = xv <= editFav ? '★' : '☆';
      });
    });
  });

  overlay.querySelectorAll('#editBmTags .tag-chip').forEach(c => {
    c.addEventListener('click', () => {
      const tid = c.dataset.tid;
      if (editTags.includes(tid)) {
        editTags = editTags.filter(x => x !== tid);
        c.classList.remove('active');
      } else {
        editTags.push(tid);
        c.classList.add('active');
      }
    });
  });

  overlay.querySelector('#editBmCancel').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#editBmSave').addEventListener('click', async () => {
    const title = overlay.querySelector('#editBmTitle').value.trim();
    const preview = overlay.querySelector('#editBmPreview').value.trim();
    const previewVideo = overlay.querySelector('#editBmPreviewVideo').value.trim();
    await send('updateBookmark', { id: bm.id, patch: { title, favorite: editFav, tags: editTags, preview, previewVideo } });
    Object.assign(bm, { title, favorite: editFav, tags: editTags, preview, previewVideo });
    overlay.remove();
    filterAndRenderBookmarks();
  });
}

// ================ 标签管理模块 ================

// 分组的收起状态（键为 groupId，未分组用 '__nogroup__'）。
// 仅存活于当前会话，不落库 —— 纯视图状态，刷新页面即恢复全部展开。
// 必须存模块变量：renderTagManager() 每次都会重建整个 DOM，
// 若只改 DOM，下一次重渲染（上移/拖拽/删除都会触发）就会把收起状态丢掉。
let collapsedTagGroups = new Set();

function renderTagManager() {
  const container = $('#tagManagerContent');
  container.innerHTML = '';

  // 安全网：按 id 去重，防止本地数组出现重复条目
  const seenTagIds = new Set();
  allTags = allTags.filter(t => {
    if (seenTagIds.has(t.id)) return false;
    seenTagIds.add(t.id);
    return true;
  });
  const seenGroupIds = new Set();
  allTagGroups = allTagGroups.filter(g => {
    if (seenGroupIds.has(g.id)) return false;
    seenGroupIds.add(g.id);
    return true;
  });

  // 按组排列，未分组始终显示
  const sortedGroups = [...allTagGroups].sort((a, b) => a.order - b.order);
  const groupMap = {};
  sortedGroups.forEach(g => { groupMap[g.id] = []; });
  groupMap['__nogroup__'] = [];

  allTags.forEach(t => {
    const gid = t.groupId || '__nogroup__';
    if (!groupMap[gid]) groupMap[gid] = [];
    groupMap[gid].push(t);
  });

  // 渲染分组（包括空的未分组）
  const renderGroup = (groupId, groupName, tags, isNoGroup = false) => {
    const block = document.createElement('div');
    const isCollapsed = collapsedTagGroups.has(groupId);
    block.className = 'tag-group-block' + (isCollapsed ? ' collapsed' : '');
    if (!isNoGroup) {
      // 注意：拖拽能力挂在 ⠿ 手柄上（见下方 header），而非整张卡片，
      // 否则选中分组名文字时会被误判为拖拽。
      block.dataset.gid = groupId;
    }

    const header = document.createElement('div');
    header.className = 'tag-group-header';
    // 布局：左侧只留拖拽手柄 ⠿，分组名居中撑开，其余操作（↑↓ 收起/展开 删除组）
    // 全部靠右。h3 的 flex:1 把它们推到右侧，各控件自带 flex-shrink:0。
    header.innerHTML = `
      ${!isNoGroup ? `<span class="tag-group-drag-handle" draggable="true" title="${t('options.tag_drag_sort')}">⠿</span>` : ''}
      <h3 contenteditable="true" class="group-name-edit" data-gid="${groupId}">${escHtml(groupName)}</h3>
      ${!isNoGroup ? `<span class="tag-group-order-btns">
        <button type="button" class="tag-group-move" data-dir="up" data-gid="${groupId}" title="${t('options.tag_move_up')}">↑</button>
        <button type="button" class="tag-group-move" data-dir="down" data-gid="${groupId}" title="${t('options.tag_move_down')}">↓</button>
      </span>` : ''}
      <button type="button" class="tag-group-toggle" data-gid="${groupId}" title="${isCollapsed ? t('options.tag_expand') : t('options.tag_collapse')}">${isCollapsed ? '▸' : '▾'}</button>
      ${!isNoGroup ? `<button class="btn-danger btn-sm del-group" data-gid="${groupId}">${t('options.tag_delete_group')}</button>` : ''}
    `;
    block.appendChild(header);

    if (tags.length > 0) {
      const table = document.createElement('table');
      table.className = 'tag-table';
      // 固定列宽：每个分组各是一张独立表格，auto 布局会按各自内容算列宽，
      // 于是各卡片列宽互不相同、表头无法纵向对齐。这里给所有表格同一套百分比列宽。
      table.innerHTML = `<colgroup>
          <col style="width:22%"><col style="width:14%"><col style="width:24%"><col style="width:28%"><col style="width:12%">
        </colgroup><thead><tr><th>${t('options.tag_col_name')}</th><th>${t('options.tag_col_group')}</th><th>${t('options.tag_col_alias')}</th><th>${t('options.tag_col_marked_tags')}</th><th>${t('options.tag_col_actions')}</th></tr></thead><tbody></tbody>`;
      const tbody = table.querySelector('tbody');

      tags.sort((a, b) => a.order - b.order).forEach(tag => {
        const tr = document.createElement('tr');

        // 名称
        const tdName = document.createElement('td');
        tdName.innerHTML = `<input type="text" value="${escHtml(tag.name)}" class="tag-name-input" data-tid="${tag.id}">`;
        tr.appendChild(tdName);

        // 分组下拉选择
        const tdGroup = document.createElement('td');
        const groupSelect = document.createElement('select');
        groupSelect.className = 'tag-group-select';
        groupSelect.dataset.tid = tag.id;
        const noGroupOpt = document.createElement('option');
        noGroupOpt.value = '';
        noGroupOpt.textContent = t('options.tag_no_group');
        if (!tag.groupId) noGroupOpt.selected = true;
        groupSelect.appendChild(noGroupOpt);
        sortedGroups.forEach(g => {
          const opt = document.createElement('option');
          opt.value = g.id;
          opt.textContent = g.name;
          if (tag.groupId === g.id) opt.selected = true;
          groupSelect.appendChild(opt);
        });
        tdGroup.appendChild(groupSelect);
        tr.appendChild(tdGroup);

        // 别名
        const tdAlias = document.createElement('td');
        const aliasDiv = document.createElement('div');
        aliasDiv.className = 'tag-alias-list';
        tag.alias.forEach((a, i) => {
          aliasDiv.innerHTML += `<span class="tag-alias-chip">${escHtml(a)}<span class="remove" data-tid="${tag.id}" data-ai="${i}">✕</span></span>`;
        });
        aliasDiv.innerHTML += `<input type="text" placeholder="${t('options.tag_add_alias_placeholder')}" class="add-alias-input" data-tid="${tag.id}" style="width:60px;">`;
        tdAlias.appendChild(aliasDiv);
        tr.appendChild(tdAlias);

        // 标记 tags（用 chip + 添加按钮）
        const tdTags = document.createElement('td');
        const tagsDiv = document.createElement('div');
        tagsDiv.className = 'tag-tags-list';
        tagsDiv.dataset.tid = tag.id;
        tag.tags.forEach(stid => {
          const st = getTagById(stid);
          if (!st) return;
          tagsDiv.innerHTML += `<span class="tag-tags-chip" data-stid="${stid}">${escHtml(st.name)}<span class="remove" data-tid="${tag.id}" data-stid="${stid}">✕</span></span>`;
        });
        const addBtn = document.createElement('span');
        addBtn.className = 'tag-tags-add';
        addBtn.textContent = t('options.tag_select');
        addBtn.dataset.tid = tag.id;
        tagsDiv.appendChild(addBtn);
        tdTags.appendChild(tagsDiv);
        tr.appendChild(tdTags);

        // 操作
        const tdAct = document.createElement('td');
        tdAct.innerHTML = `<button class="btn-danger btn-sm del-tag" data-tid="${tag.id}">${t('options.tag_delete')}</button>`;
        tr.appendChild(tdAct);

        tbody.appendChild(tr);
      });

      block.appendChild(table);
    }

    // 添加 tag 行
    const addRow = document.createElement('div');
    addRow.className = 'add-tag-row';
    addRow.innerHTML = `
      <input type="text" placeholder="${t('options.tag_new_name_placeholder')}" class="new-tag-name" data-gid="${groupId}">
      <button class="btn-primary btn-sm add-tag-in-group" data-gid="${groupId}">${t('options.tag_add')}</button>
    `;
    block.appendChild(addRow);

    container.appendChild(block);
  };

  sortedGroups.forEach(g => {
    renderGroup(g.id, g.name, groupMap[g.id] || []);
  });
  // 未分组始终显示
  renderGroup('__nogroup__', t('options.tag_no_group'), groupMap['__nogroup__'] || [], true);

  // 首个分组的 ↑ 与末个分组的 ↓ 置灰（DOM 顺序即 sortedGroups 顺序）
  const orderBlocks = [...container.querySelectorAll('.tag-group-block[data-gid]')];
  orderBlocks.forEach((b, i) => {
    const up = b.querySelector('.tag-group-move[data-dir="up"]');
    const down = b.querySelector('.tag-group-move[data-dir="down"]');
    if (up && i === 0) up.disabled = true;
    if (down && i === orderBlocks.length - 1) down.disabled = true;
  });

  bindTagManagerEvents();
  updateTagCollapseAllBtn();
}

// 所有可收起单元的 id（含未分组）——「全部收起 / 展开」以此为全集
function allTagGroupIds() {
  return [...allTagGroups.map(g => g.id), '__nogroup__'];
}

// 全局按钮的文案依赖折叠状态，而它位于 #tagManagerContent 之外、
// 不会随重渲染刷新，所以要由 renderTagManager() 与单卡片切换各调一次。
function updateTagCollapseAllBtn() {
  const btn = $('#toggleAllGroupsBtn');
  if (!btn) return;
  const ids = allTagGroupIds();
  const allCollapsed = ids.length > 0 && ids.every(id => collapsedTagGroups.has(id));
  btn.textContent = allCollapsed ? t('options.tag_expand_all') : t('options.tag_collapse_all');
}

// 分组上/下移一位（与拖拽排序共用同一套 order 重排 + 持久化逻辑）
async function moveTagGroup(gid, dir) {
  const sorted = [...allTagGroups].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex(g => g.id === gid);
  if (idx === -1) return;
  const target = dir === 'up' ? idx - 1 : idx + 1;
  if (target < 0 || target >= sorted.length) return;

  [sorted[idx], sorted[target]] = [sorted[target], sorted[idx]];
  for (let i = 0; i < sorted.length; i++) sorted[i].order = i;

  await send('saveTagGroups', { groups: sorted });
  await loadAll();
  renderTagManager();
}

function bindTagManagerEvents() {
  // 删除组
  $$('.del-group').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(t('options.tag_confirm_delete_group'))) return;
      const gid = btn.dataset.gid;
      await send('removeTagGroup', { id: gid });
      allTagGroups = allTagGroups.filter(g => g.id !== gid);
      allTags.forEach(t => { if (t.groupId === gid) t.groupId = ''; });
      renderTagManager();
    });
  });

  // 组名编辑
  $$('.group-name-edit').forEach(el => {
    el.addEventListener('blur', async () => {
      const gid = el.dataset.gid;
      if (gid === '__nogroup__') return;
      const newName = el.textContent.trim();
      if (!newName) return;
      await send('updateTagGroup', { id: gid, patch: { name: newName } });
      const g = getGroupById(gid);
      if (g) g.name = newName;
    });
  });

  // 分组下拉选择
  $$('.tag-group-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const tid = sel.dataset.tid;
      const newGid = sel.value; // '' = 未分组
      await send('updateTag', { id: tid, patch: { groupId: newGid } });
      // 从 storage 刷新，确保本地数据一致
      await loadAll();
      renderTagManager();
      filterAndRenderBookmarks();
    });
  });

  // 标签名编辑
  $$('.tag-name-input').forEach(input => {
    input.addEventListener('change', async () => {
      const tid = input.dataset.tid;
      const newName = input.value.trim();
      if (!newName) return;
      await send('updateTag', { id: tid, patch: { name: newName } });
      const t = getTagById(tid);
      if (t) t.name = newName;
      filterAndRenderBookmarks();
    });
  });

  // 别名删除
  $$('.tag-alias-chip .remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tid = btn.dataset.tid;
      const ai = parseInt(btn.dataset.ai);
      const tag = getTagById(tid);
      if (!tag) return;
      tag.alias.splice(ai, 1);
      await send('updateTag', { id: tid, patch: { alias: tag.alias } });
      renderTagManager();
    });
  });

  // 添加别名
  $$('.add-alias-input').forEach(input => {
    input.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter') return;
      const tid = input.dataset.tid;
      const val = input.value.trim();
      if (!val) return;
      const tag = getTagById(tid);
      if (!tag) return;
      if (!tag.alias.includes(val)) {
        tag.alias.push(val);
        await send('updateTag', { id: tid, patch: { alias: tag.alias } });
      }
      input.value = '';
      renderTagManager();
    });
  });

  // 标记 tags 删除
  $$('.tag-tags-chip .remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tid = btn.dataset.tid;
      const stid = btn.dataset.stid;
      const tag = getTagById(tid);
      if (!tag) return;
      tag.tags = tag.tags.filter(t => t !== stid);
      await send('updateTag', { id: tid, patch: { tags: tag.tags } });
      renderTagManager();
    });
  });

  // 标记 tags 添加（打开 tag picker）
  $$('.tag-tags-add').forEach(btn => {
    btn.addEventListener('click', () => {
      const tid = btn.dataset.tid;
      const tag = getTagById(tid);
      if (!tag) return;
      openTagPicker((selectedTagId) => {
        if (!tag.tags.includes(selectedTagId)) {
          tag.tags.push(selectedTagId);
          send('updateTag', { id: tid, patch: { tags: tag.tags } }).then(() => {
            renderTagManager();
          });
        }
      }, { excludeIds: [tid], activeIds: tag.tags, multi: false });
    });
  });

  // 删除标签
  $$('.del-tag').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(t('options.tag_confirm_delete'))) return;
      const tid = btn.dataset.tid;
      await send('removeTag', { id: tid });
      allTags = allTags.filter(t => t.id !== tid);
      allBookmarks.forEach(b => { b.tags = b.tags.filter(x => x !== tid); });
      renderTagManager();
      filterAndRenderBookmarks();
    });
  });

  // 在组内添加标签（检查重名）
  $$('.add-tag-in-group').forEach(btn => {
    const doAdd = async () => {
      const gid = btn.dataset.gid === '__nogroup__' ? '' : btn.dataset.gid;
      const input = btn.previousElementSibling;
      const name = input.value.trim();
      if (!name) return;
      // 检查是否已存在同名 tag
      const existing = allTags.find(t => t.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        // 同名 tag 已存在，如果不在当前分组则移过来
        if (existing.groupId !== gid) {
          await send('updateTag', { id: existing.id, patch: { groupId: gid } });
        }
      } else {
        await send('addTag', { data: { name, groupId: gid } });
      }
      input.value = '';
      // 从 storage 刷新，避免手动 push 导致本地数组与 storage 不一致产生重复
      await loadAll();
      renderTagManager();
    };
    btn.addEventListener('click', doAdd);
    // 支持 Enter 键
    const input = btn.previousElementSibling;
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doAdd(); } });
  });

  // 添加新分组
  $('#addGroupBtn').addEventListener('click', async () => {
    const name = $('#newGroupName').value.trim();
    if (!name) return;
    await send('addTagGroup', { name });
    $('#newGroupName').value = '';
    await loadAll();
    renderTagManager();
  });

  // 分组上/下移
  $$('.tag-group-move').forEach(btn => {
    btn.addEventListener('click', () => moveTagGroup(btn.dataset.gid, btn.dataset.dir));
  });

  // 分组收起 / 展开（只切 class，不整表重渲染，以保留滚动位置）
  $$('.tag-group-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const gid = btn.dataset.gid;
      const nowCollapsed = !collapsedTagGroups.has(gid);
      if (nowCollapsed) collapsedTagGroups.add(gid);
      else collapsedTagGroups.delete(gid);

      btn.closest('.tag-group-block').classList.toggle('collapsed', nowCollapsed);
      btn.textContent = nowCollapsed ? '▸' : '▾';
      btn.title = nowCollapsed ? t('options.tag_expand') : t('options.tag_collapse');
      updateTagCollapseAllBtn();
    });
  });

  // 分组拖拽排序（拖拽能力在 ⠿ 手柄上，事件冒泡到卡片）
  let dragSrcGroup = null;
  const groupBlocks = $$('.tag-group-block[data-gid]');
  groupBlocks.forEach(block => {
    block.addEventListener('dragstart', (e) => {
      dragSrcGroup = block;
      block.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', block.dataset.gid);
      // 幽灵图用整张卡片，否则默认只会拖出 ⠿ 这个小图标
      e.dataTransfer.setDragImage(block, 20, 20);
    });
    block.addEventListener('dragend', () => {
      block.classList.remove('dragging');
      $$('.tag-group-block.drag-over').forEach(b => b.classList.remove('drag-over'));
      dragSrcGroup = null;
    });
    block.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (block !== dragSrcGroup) {
        block.classList.add('drag-over');
      }
    });
    block.addEventListener('dragleave', () => {
      block.classList.remove('drag-over');
    });
    block.addEventListener('drop', async (e) => {
      e.preventDefault();
      block.classList.remove('drag-over');
      if (!dragSrcGroup || dragSrcGroup === block) return;

      // 获取拖拽源和目标的 groupId
      const srcGid = dragSrcGroup.dataset.gid;
      const dstGid = block.dataset.gid;
      if (!srcGid || !dstGid) return;

      // 计算新顺序：把 src 插到 dst 前面
      const sorted = [...allTagGroups].sort((a, b) => a.order - b.order);
      const srcIdx = sorted.findIndex(g => g.id === srcGid);
      const dstIdx = sorted.findIndex(g => g.id === dstGid);
      if (srcIdx === -1 || dstIdx === -1) return;

      // 从数组中移除 src，插入到 dst 前面
      const [moved] = sorted.splice(srcIdx, 1);
      const newDstIdx = sorted.findIndex(g => g.id === dstGid);
      sorted.splice(newDstIdx, 0, moved);

      // 重新分配 order
      for (let i = 0; i < sorted.length; i++) {
        sorted[i].order = i;
      }
      // 批量保存到 storage
      await send('saveTagGroups', { groups: sorted });
      await loadAll();
      renderTagManager();
    });
  });
}

// ================ 站点配置模块 ================

function renderSiteConfigs() {
  const list = $('#siteList');
  list.innerHTML = '';

  if (editingSiteId === '__new__') {
    const form = createSiteFormEl('__new__', { urlPattern: '', script: '' });
    list.appendChild(form);
    return;
  }

  allSiteConfigs.forEach(sc => {
    if (editingSiteId === sc.id) {
      const form = createSiteFormEl(sc.id, sc);
      list.appendChild(form);
    } else {
      const card = document.createElement('div');
      card.className = 'site-card';
      card.innerHTML = `
        <div class="site-card-header">
          <code>${escHtml(sc.urlPattern)}</code>
          <div>
            <button class="btn-secondary btn-sm edit-site" data-id="${sc.id}">${t('options.bm_edit')}</button>
            <button class="btn-danger btn-sm del-site" data-id="${sc.id}">${t('options.bm_delete')}</button>
            <button class="btn-secondary btn-sm debug-site" data-id="${sc.id}">🧪 Debug</button>
          </div>
        </div>
        <pre style="font-size:12px;overflow:hidden;text-overflow:ellipsis;max-height:60px;color:var(--text-dim);">${escHtml(sc.script || '')}</pre>
      `;
      list.appendChild(card);
    }
  });

  list.querySelectorAll('.edit-site').forEach(btn => {
    btn.addEventListener('click', () => { editingSiteId = btn.dataset.id; renderSiteConfigs(); });
  });
  list.querySelectorAll('.del-site').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm(t('options.site_confirm_delete'))) {
        await send('removeSiteConfig', { id: btn.dataset.id });
        allSiteConfigs = allSiteConfigs.filter(s => s.id !== btn.dataset.id);
        renderSiteConfigs();
      }
    });
  });
  list.querySelectorAll('.debug-site').forEach(btn => {
    btn.addEventListener('click', () => debugSiteConfig(btn.dataset.id));
  });
}

function createSiteFormEl(id, data) {
  const form = document.createElement('div');
  form.className = 'site-form';
  form.innerHTML = `
    <h4>${id === '__new__' ? t('options.site_add_title') : t('options.site_edit_title')}</h4>
    <div class="form-field">
      <label>${t('options.site_url_label')}</label>
      <input type="text" id="siteUrlPattern" value="${escHtml(data.urlPattern)}" placeholder="${t('options.site_url_placeholder')}">
    </div>
    <div class="form-field">
      <label>${t('options.site_script_label')}</label>
      <textarea id="siteScript">${escHtml(data.script || '')}</textarea>
      <div class="site-card-hint">${t('options.site_script_hint')}</div>
    </div>
    <div class="site-form-actions">
      <button class="btn-secondary" id="siteCancelBtn">${t('options.bm_cancel')}</button>
      <button class="btn-primary" id="siteSaveBtn">${t('options.bm_save')}</button>
    </div>
    <div id="siteDebugOutput" class="site-debug-output" style="display:none;"></div>
  `;

  form.querySelector('#siteCancelBtn').addEventListener('click', () => { editingSiteId = null; renderSiteConfigs(); });
  form.querySelector('#siteSaveBtn').addEventListener('click', async () => {
    const urlPattern = form.querySelector('#siteUrlPattern').value.trim();
    const script = form.querySelector('#siteScript').value;
    if (!urlPattern) { alert(t('options.site_url_required')); return; }
    if (editingSiteId === '__new__') {
      const sc = await send('addSiteConfig', { data: { urlPattern, script } });
      allSiteConfigs.push(sc);
    } else {
      await send('updateSiteConfig', { id: editingSiteId, patch: { urlPattern, script } });
      const sc = allSiteConfigs.find(s => s.id === editingSiteId);
      if (sc) { sc.urlPattern = urlPattern; sc.script = script; }
    }
    editingSiteId = null;
    await loadAll();
    renderSiteConfigs();
  });

  return form;
}

async function debugSiteConfig(siteId) {
  const sc = allSiteConfigs.find(s => s.id === siteId);
  if (!sc || !sc.script) {
    alert('No script to debug');
    return;
  }

  // 获取当前活动 tab 作为默认 URL
  let defaultUrl = '';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && !tab.url.startsWith('chrome://')) defaultUrl = tab.url;
  } catch {}

  // 检查默认 URL 是否匹配
  let defaultMatches = false;
  try { defaultMatches = defaultUrl && new RegExp(sc.urlPattern).test(defaultUrl); } catch {}

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:700px;">
      <h3>🧪 Site Config Debug</h3>
      <div class="site-debug-info">
        <div><strong>URL Pattern:</strong> <code>${escHtml(sc.urlPattern)}</code></div>
      </div>
      <div class="form-field">
        <label>Test URL:</label>
        <div style="display:flex;gap:6px;align-items:center;">
          <input type="text" id="debugUrlInput" value="${escHtml(defaultUrl)}" placeholder="https://example.com/page" style="flex:1;">
          <span id="debugUrlMatch" style="font-size:12px;flex-shrink:0;">${defaultUrl ? (defaultMatches ? '✅ Match' : '❌ No match') : ''}</span>
        </div>
      </div>
      <div class="form-field">
        <label>Script:</label>
        <pre style="background:var(--bg);padding:8px;border-radius:4px;font-size:12px;overflow:auto;max-height:120px;">${escHtml(sc.script)}</pre>
      </div>
      <div class="form-field">
        <label>Result:</label>
        <pre id="debugResult" style="background:var(--bg);padding:8px;border-radius:4px;font-size:12px;overflow:auto;max-height:200px;color:var(--text-dim);">Enter a URL and click Run</pre>
      </div>
      <div class="modal-actions">
        <button class="btn-primary" id="debugRunBtn">▶ Run Script</button>
        <button class="btn-secondary" id="debugCloseBtn">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const urlInput = overlay.querySelector('#debugUrlInput');
  const matchIndicator = overlay.querySelector('#debugUrlMatch');
  const resultEl = overlay.querySelector('#debugResult');

  // URL 输入时实时检查匹配
  urlInput.addEventListener('input', () => {
    const url = urlInput.value.trim();
    if (!url) { matchIndicator.textContent = ''; return; }
    let m = false;
    try { m = new RegExp(sc.urlPattern).test(url); } catch {}
    matchIndicator.textContent = m ? '✅ Match' : '❌ No match';
  });

  const runDebug = async () => {
    const url = urlInput.value.trim();
    if (!url) { alert('Please enter a URL to test'); return; }

    // 检查匹配
    let matches = false;
    try { matches = new RegExp(sc.urlPattern).test(url); } catch {}
    matchIndicator.textContent = matches ? '✅ Match' : '❌ No match';

    resultEl.textContent = 'Executing...';
    resultEl.style.color = 'var(--text-dim)';

    try {
      // 查找匹配 URL 的 tab
      const tabs = await chrome.tabs.query({ url: url });
      let tab = tabs.length > 0 ? tabs[0] : null;

      // 如果没找到精确匹配，尝试在当前窗口查找
      if (!tab) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab && activeTab.url === url) tab = activeTab;
      }

      if (!tab) {
        resultEl.textContent = `No open tab found for URL: ${url}\n\nPlease open the page in a tab first, then run debug again.`;
        resultEl.style.color = 'var(--danger)';
        return;
      }

      const result = await send('executeSitePreview', {
        scriptStr: sc.script,
        tabId: tab.id,
        title: tab.title || '',
        labels: [],
        tags: [],
        preview: '',
        previewVideo: '',
      });
      if (result && typeof result === 'object') {
        resultEl.textContent = JSON.stringify(result, null, 2);
        resultEl.style.color = '#4caf50';
      } else {
        resultEl.textContent = 'Script returned null or no result.\n\nPossible causes:\n- Page CSP blocks eval in MAIN world\n- Script threw an error\n- chrome.scripting.executeScript failed';
        resultEl.style.color = 'var(--danger)';
      }
    } catch (e) {
      resultEl.textContent = 'Error: ' + (e.message || String(e));
      resultEl.style.color = 'var(--danger)';
    }
  };

  overlay.querySelector('#debugRunBtn').addEventListener('click', runDebug);
  overlay.querySelector('#debugCloseBtn').addEventListener('click', () => overlay.remove());
}

// ================ 配置模块 ================

async function loadConfig() {
  currentConfig = await send('getConfig');
  if (currentConfig.locale) setLocale(currentConfig.locale);
  // 主题：缺失/非法值一律落到 system
  const theme = BTTheme.normalize(currentConfig.theme);
  BTTheme.apply(theme);
  BTTheme.cache(theme);
  populateThemeSelect();
  $('#syncEnabled').checked = currentConfig.syncEnabled || false;
  if (currentConfig.lastSyncAt) {
    $('#syncStatus').textContent = t('options.config_last_sync') + formatDate(currentConfig.lastSyncAt);
  }
  // Google Drive 配置
  const gdAutoSync = $('#gdAutoSync');
  if (gdAutoSync) gdAutoSync.checked = currentConfig.gdAutoSync || false;
  const gdStatus = $('#gdStatus');
  if (gdStatus && currentConfig.gdLastSyncAt) {
    gdStatus.textContent = t('options.config_gd_last_sync') + formatDate(currentConfig.gdLastSyncAt);
  }
}

// ================ 全局事件 ================

function bindGlobalEvents() {
  // 全部收起 / 全部展开
  // 注意：这里只绑一次（bindGlobalEvents 由 init() 调一次）。不要挪进
  // bindTagManagerEvents() —— 那个函数每次 renderTagManager() 都会执行，
  // 而本按钮在 #tagManagerContent 之外、不会被重建，监听器会不断累积。
  $('#toggleAllGroupsBtn').addEventListener('click', () => {
    const ids = allTagGroupIds();
    const allCollapsed = ids.length > 0 && ids.every(id => collapsedTagGroups.has(id));
    if (allCollapsed) collapsedTagGroups.clear();
    else ids.forEach(id => collapsedTagGroups.add(id));
    renderTagManager(); // 统一重建，保证 class 与按钮文案一致
  });

  // 语言切换
  $('#localeSelect').addEventListener('change', async () => {
    const locale = $('#localeSelect').value;
    setLocale(locale);
    currentConfig.locale = locale;
    await send('saveConfig', { config: currentConfig });
    applyLocale();
    // 重新渲染动态内容
    renderTagManager();
    filterAndRenderBookmarks();
    renderSiteConfigs();
    loadConfig();
  });

  // 主题切换 — 纯 CSS 变量生效，无需重渲染 DOM
  const themeSelect = $('#themeSelect');
  if (themeSelect) {
    themeSelect.addEventListener('change', async () => {
      const theme = BTTheme.normalize(themeSelect.value);
      currentConfig.theme = theme;
      BTTheme.apply(theme);
      BTTheme.cache(theme);   // 保持同步缓存新鲜，避免下次打开闪烁
      await send('saveConfig', { config: currentConfig });
    });
  }

  // 收藏搜索 — 纯文本输入，不弹窗
  const searchInput = $('#bmSearchInput');
  const sortSelect = $('#bmSortSelect');
  const tagToggle = $('#bmTagPanelToggle');

  if (searchInput) {
    searchInput.addEventListener('input', () => filterAndRenderBookmarks());
  }
  if (sortSelect) {
    sortSelect.addEventListener('change', () => filterAndRenderBookmarks());
  }
  if (tagToggle) {
    tagToggle.addEventListener('click', toggleBmTagPanel);
  }

  // 预览视频自动播放开关
  const autoplayCb = $('#bmAutoplayVideos');
  if (autoplayCb) {
    autoplayCb.addEventListener('change', () => filterAndRenderBookmarks());
  }

  // 布局切换（列表/平铺）
  const layoutToggle = $('#bmLayoutToggle');
  if (layoutToggle) {
    layoutToggle.addEventListener('click', () => {
      bmLayout = bmLayout === 'list' ? 'grid' : 'list';
      layoutToggle.textContent = bmLayout === 'list' ? '📋' : '📄';
      const sizeControl = $('#bmTileSizeControl');
      if (sizeControl) sizeControl.style.display = bmLayout === 'grid' ? 'flex' : 'none';
      const list = $('#bookmarkList');
      if (list) {
        list.classList.toggle('grid', bmLayout === 'grid');
        list.style.setProperty('--tile-size', bmTileSize + 'px');
      }
      filterAndRenderBookmarks();
    });
  }

  // 平铺卡片大小滑块
  const tileSizeSlider = $('#bmTileSizeSlider');
  if (tileSizeSlider) {
    tileSizeSlider.addEventListener('input', () => {
      bmTileSize = parseInt(tileSizeSlider.value);
      const sizeValue = $('#bmTileSizeValue');
      if (sizeValue) sizeValue.textContent = bmTileSize;
      const list = $('#bookmarkList');
      if (list) list.style.setProperty('--tile-size', bmTileSize + 'px');
    });
  }

  // Preview-only 模式切换
  const previewOnlyCb = $('#bmPreviewOnly');
  if (previewOnlyCb) {
    previewOnlyCb.addEventListener('change', () => {
      bmPreviewOnly = previewOnlyCb.checked;
      const list = $('#bookmarkList');
      if (list) list.classList.toggle('preview-only', bmPreviewOnly);
      filterAndRenderBookmarks();
    });
  }

  // 收藏喜爱度筛选
  $('#bmStarFilter').addEventListener('click', (e) => {
    const star = e.target.closest('.star');
    if (!star) return;
    const val = parseInt(star.dataset.val);
    bmSearchFav = bmSearchFav === val ? 0 : val;
    $$('#bmStarFilter .star').forEach(s => {
      s.classList.toggle('on', parseInt(s.dataset.val) <= bmSearchFav);
    });
    filterAndRenderBookmarks();
  });

  // 站点配置
  $('#addSiteBtn').addEventListener('click', () => { editingSiteId = '__new__'; renderSiteConfigs(); });

  // 导出
  $('#exportBtn').addEventListener('click', async () => {
    const data = { bookmarks: allBookmarks, tags: allTags, tagGroups: allTagGroups, siteConfigs: allSiteConfigs, config: currentConfig };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'bookmark-tags-backup.json'; a.click();
    URL.revokeObjectURL(url);
  });

  // 导入
  $('#importBtn').addEventListener('click', () => { $('#importFile').click(); });
  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (confirm(t('options.config_import_confirm'))) {
        if (Array.isArray(data.bookmarks)) await chrome.storage.local.set({ bt_bookmarks: data.bookmarks });
        if (Array.isArray(data.tags)) await chrome.storage.local.set({ bt_tags: data.tags });
        if (Array.isArray(data.tagGroups)) await chrome.storage.local.set({ bt_tagGroups: data.tagGroups });
        if (Array.isArray(data.siteConfigs)) await chrome.storage.local.set({ bt_siteConfigs: data.siteConfigs });
        if (data.config) await chrome.storage.local.set({ bt_config: data.config });
        await loadAll();
        filterAndRenderBookmarks(); renderTagManager(); renderSiteConfigs(); loadConfig();
        alert(t('options.config_import_success'));
      }
    } catch (err) { alert(t('options.config_import_failed') + err.message); }
    e.target.value = '';
  });

  // 清除
  $('#clearBtn').addEventListener('click', async () => {
    if (!confirm(t('options.config_clear_confirm'))) return;
    await chrome.storage.local.clear();
    await loadAll();
    filterAndRenderBookmarks(); renderTagManager(); renderSiteConfigs(); loadConfig();
  });

  // 同步开关
  $('#syncEnabled').addEventListener('change', async () => {
    const enabled = $('#syncEnabled').checked;
    currentConfig.syncEnabled = enabled;
    await send('saveConfig', { config: currentConfig });
    if (enabled) {
      // 启用时：先从云端拉取（合并已有数据），再推送
      $('#syncStatus').textContent = t('options.sync_enabling');
      const pullResult = await send('syncPull');
      if (pullResult.ok) {
        await loadAll();
        filterAndRenderBookmarks(); renderTagManager(); renderSiteConfigs();
      }
      $('#syncStatus').textContent = t('options.sync_pushing_local');
      await send('syncPush');
      $('#syncStatus').textContent = t('options.sync_done');
    } else {
      $('#syncStatus').textContent = t('options.config_sync_disabled');
    }
  });

  // 从云端拉取
  $('#syncPullBtn').addEventListener('click', async () => {
    $('#syncStatus').textContent = t('options.sync_pulling');
    const r = await send('syncPull');
    if (r.ok) {
      $('#syncStatus').textContent = r.pulled ? t('options.sync_pull_success') : t('options.sync_pull_no_data');
      await loadAll();
      filterAndRenderBookmarks(); renderTagManager(); renderSiteConfigs(); loadConfig();
    } else {
      $('#syncStatus').textContent = t('options.sync_pull_failed') + (r.error || '');
    }
  });

  // ================ Google Drive 同步 ================

  // 自动同步开关
  const gdAutoSyncCb = $('#gdAutoSync');
  if (gdAutoSyncCb) {
    gdAutoSyncCb.addEventListener('change', async () => {
      currentConfig.gdAutoSync = gdAutoSyncCb.checked;
      await send('saveConfig', { config: currentConfig });
      if (currentConfig.gdAutoSync) {
        // 开启自动同步时，先推送一次
        $('#gdStatus').textContent = t('options.config_gd_first_push');
        const r = await send('gdPush', { interactive: true });
        if (r.ok) {
          $('#gdStatus').textContent = t('options.config_gd_auto_on');
          await loadAll();
        } else {
          $('#gdStatus').textContent = t('options.config_gd_push_failed') + (r.error || '');
          gdAutoSyncCb.checked = false;
          currentConfig.gdAutoSync = false;
          await send('saveConfig', { config: currentConfig });
        }
      } else {
        $('#gdStatus').textContent = t('options.config_gd_auto_off');
      }
    });
  }

  // 授权 Google 账号
  const gdAuthBtn = $('#gdAuthBtn');
  if (gdAuthBtn) {
    gdAuthBtn.addEventListener('click', async () => {
      $('#gdStatus').textContent = t('options.config_gd_authorizing');
      const r = await send('gdAuth');
      if (r.ok) {
        $('#gdStatus').textContent = t('options.config_gd_auth_success');
      } else {
        $('#gdStatus').textContent = t('options.config_gd_auth_failed') + (r.error || '');
      }
    });
  }

  // 推送到 Google Drive
  const gdPushBtn = $('#gdPushBtn');
  if (gdPushBtn) {
    gdPushBtn.addEventListener('click', async () => {
      $('#gdStatus').textContent = t('options.config_gd_pushing');
      const r = await send('gdPush', { interactive: true });
      if (r.ok) {
        $('#gdStatus').textContent = t('options.config_gd_push_success') + formatDate(Date.now()) + ')';
      } else {
        $('#gdStatus').textContent = t('options.config_gd_push_failed') + (r.error || '');
      }
    });
  }

  // 从 Google Drive 拉取
  const gdPullBtn = $('#gdPullBtn');
  if (gdPullBtn) {
    gdPullBtn.addEventListener('click', async () => {
      if (!confirm(t('options.config_gd_pull_confirm'))) return;
      $('#gdStatus').textContent = t('options.config_gd_pulling');
      const r = await send('gdPull', { interactive: true });
      if (r.ok) {
        await loadAll();
        filterAndRenderBookmarks();
        renderTagManager();
        renderSiteConfigs();
        loadConfig();
        $('#gdStatus').textContent = r.pulled ? t('options.config_gd_pull_success') : t('options.config_gd_pull_no_data');
      } else {
        $('#gdStatus').textContent = t('options.config_gd_pull_failed') + (r.error || '');
      }
    });
  }

  // Tag picker 事件
  $('#tagPickerSearch').addEventListener('input', () => {
    renderTagPickerContent($('#tagPickerSearch').value.trim());
  });
  $('#tagPickerClose').addEventListener('click', closeTagPicker);
  // 点击 overlay 空白区域关闭
  $('#tagPickerOverlay').addEventListener('mousedown', (e) => {
    if (e.target === $('#tagPickerOverlay')) {
      closeTagPicker();
    }
  });
  // ESC 关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('#tagPickerOverlay').style.display !== 'none') {
      closeTagPicker();
    }
  });

  // 冲突解决事件
  $('#conflictClose')?.addEventListener('click', closeConflictModal);
  $('#conflictApplyBtn')?.addEventListener('click', applyConflictResolutions);
  $('#conflictOverlay')?.addEventListener('mousedown', (e) => {
    if (e.target === $('#conflictOverlay')) closeConflictModal();
  });

  // 监听冲突消息
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'gdConflictsDetected') {
      showConflictModal();
    }
  });
}

// ================ 冲突解决模块 ================

async function checkConflicts() {
  const conflicts = await send('gdGetConflicts');
  if (conflicts && conflicts.length > 0) {
    showConflictModal();
  }
}

async function showConflictModal() {
  const conflicts = await send('gdGetConflicts');
  if (!conflicts || conflicts.length === 0) {
    alert(t('options.conflict_no_conflicts'));
    return;
  }
  conflictResolutions = [];
  const content = $('#conflictContent');
  content.innerHTML = '';

  conflicts.forEach((c, idx) => {
    const typeLabel = t('options.conflict_type_' + c.type);
    const name = c.local.name || c.local.title || c.local.urlPattern || c.id;

    const card = document.createElement('div');
    card.className = 'conflict-card';
    card.innerHTML = `
      <div class="conflict-header">
        <span class="conflict-type">${escHtml(typeLabel)}</span>
        <span class="conflict-name">${escHtml(name)}</span>
      </div>
      <div class="conflict-choices">
        <label class="conflict-choice">
          <input type="radio" name="conflict_${idx}" value="local" checked>
          <span>${t('options.conflict_keep_local')}</span>
          <pre class="conflict-preview">${escHtml(JSON.stringify(c.local, null, 2))}</pre>
        </label>
        <label class="conflict-choice">
          <input type="radio" name="conflict_${idx}" value="remote">
          <span>${t('options.conflict_keep_remote')}</span>
          <pre class="conflict-preview">${escHtml(JSON.stringify(c.remote, null, 2))}</pre>
        </label>
      </div>
    `;
    content.appendChild(card);
  });

  $('#conflictOverlay').style.display = 'flex';
}

function closeConflictModal() {
  $('#conflictOverlay').style.display = 'none';
  conflictResolutions = [];
}

async function applyConflictResolutions() {
  const conflicts = await send('gdGetConflicts');
  if (!conflicts || conflicts.length === 0) return;

  const resolutions = conflicts.map((c, idx) => {
    const radio = document.querySelector(`input[name="conflict_${idx}"]:checked`);
    return {
      type: c.type,
      id: c.id,
      choice: radio ? radio.value : 'local',
    };
  });

  const result = await send('gdResolveConflicts', { resolutions });
  if (result.ok) {
    closeConflictModal();
    await loadAll();
    filterAndRenderBookmarks();
    renderTagManager();
    renderSiteConfigs();
    loadConfig();
  } else {
    alert('Error: ' + (result.error || 'unknown'));
  }
}

// ---- 启动 ----
init();

