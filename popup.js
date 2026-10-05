// ============================================================
// bookmark-tags popup.js
// ============================================================

let currentBookmark = null;
let currentPageInfo = null;
let allTags = [];
let allTagGroups = [];
let searchSort = 'newest';
let filterFavorite = 0;
let selectedTagIds = [];
let newBookmarkFavorite = 0;
let pendingPreview = '';
let pendingPreviewVideo = '';
let autoSelectedTagIds = [];
let relatedSortMode = 'newest';

// Tag picker state
let tagPickerCallback = null;
let tagPickerFilterGroupId = null;
let tagPickerTriggerInput = null;
let tagPickerJustClosed = false;

// Drag state
let dragState = null; // { tagId, sourceGroupId, el }

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

// ---- 初始化 ----
async function init() {
  // 加载语言设置
  try {
    const cfg = await send('getConfig');
    if (cfg && cfg.locale) setLocale(cfg.locale);
    // 主题兜底校正（首屏已由 theme.js 从 localStorage 同步应用过）
    if (cfg) {
      BTTheme.apply(cfg.theme);
      BTTheme.cache(cfg.theme);
    }
  } catch {}
  applyLocale();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || tab.url.startsWith('chrome://')) {
    $('#notBookmarkedView').style.display = 'block';
    $('#newBmTitle').value = t('popup.page_not_supported');
    renderGroupedTags();
    return;
  }

  currentPageInfo = { title: tab.title || tab.url, url: tab.url, labels: [], tags: [], preview: '', previewVideo: '' };

  try {
    const stored = await chrome.storage.local.get('_currentPageInfo');
    if (stored._currentPageInfo) Object.assign(currentPageInfo, stored._currentPageInfo);
  } catch {}

  try {
    const info = await chrome.tabs.sendMessage(tab.id, { action: 'getPageInfo' });
    if (info) Object.assign(currentPageInfo, info);
  } catch {}

  if (!currentPageInfo.url) currentPageInfo.url = tab.url;
  if (!currentPageInfo.title) currentPageInfo.title = tab.title || tab.url;

  allTags = await send('listTags') || [];
  allTagGroups = await send('listTagGroups') || [];

  currentBookmark = await send('getBookmarkByUrl', { url: currentPageInfo.url });

  if (currentBookmark) {
    showBookmarkedView();
  } else {
    showNotBookmarkedView();
  }

  renderGroupedTags();
  bindEvents();
}

// ---- 已收藏视图 ----
function showBookmarkedView() {
  $('#bookmarkedView').style.display = 'block';
  $('#notBookmarkedView').style.display = 'none';
  $('#bmTitle').value = currentBookmark.title;
  // URL 显示/编辑
  const urlInput = $('#bmUrl');
  if (urlInput) urlInput.value = currentBookmark.url;
  renderStarEdit('#starEdit', currentBookmark.favorite);
  renderBmPreview();
  renderBmTags();
  renderBmSiteScriptBtn();
}

function renderBmPreview() {
  const previewArea = $('#bmPreviewArea');
  previewArea.style.display = 'block';
  previewArea.innerHTML = '';

  // 预览图/视频展示
  const hasMedia = currentBookmark && (currentBookmark.preview || currentBookmark.previewVideo);
  if (hasMedia) {
    const mediaDiv = document.createElement('div');
    mediaDiv.className = 'preview-media';
    if (currentBookmark.previewVideo && currentBookmark.preview) {
      // 同时有 preview 和 previewVideo：默认显示图片，hover 播放视频，离开恢复图片
      const img = document.createElement('img');
      img.className = 'popup-preview-img';
      img.src = currentBookmark.preview;
      img.alt = '';
      img.style.display = '';
      const video = document.createElement('video');
      video.className = 'popup-preview-video';
      video.src = currentBookmark.previewVideo;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.style.display = 'none';
      mediaDiv.appendChild(img);
      mediaDiv.appendChild(video);
      mediaDiv.addEventListener('mouseenter', () => {
        img.style.display = 'none';
        video.style.display = '';
        video.play().catch(() => {});
      });
      mediaDiv.addEventListener('mouseleave', () => {
        video.pause();
        video.currentTime = 0;
        video.style.display = 'none';
        img.style.display = '';
      });
    } else if (currentBookmark.previewVideo) {
      // 只有 previewVideo：hover 播放，离开暂停
      const video = document.createElement('video');
      video.className = 'popup-preview-video';
      video.src = currentBookmark.previewVideo;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'auto';
      mediaDiv.addEventListener('mouseenter', () => { video.play().catch(() => {}); });
      mediaDiv.addEventListener('mouseleave', () => { video.pause(); video.currentTime = 0; });
      mediaDiv.appendChild(video);
    } else if (currentBookmark.preview) {
      // 只有 preview 图片
      const img = document.createElement('img');
      img.className = 'popup-preview-img';
      img.src = currentBookmark.preview;
      img.alt = '';
      mediaDiv.appendChild(img);
    }
    previewArea.appendChild(mediaDiv);
  }

  // 可编辑的 preview/previewVideo 输入框
  const editDiv = document.createElement('div');
  editDiv.className = 'preview-edit';
  editDiv.innerHTML = `
    <div class="preview-edit-field">
      <label>${t('popup.preview_label')}</label>
      <input type="text" id="bmPreviewInput" value="${escHtml(currentBookmark?.preview || '')}" placeholder="https://...">
    </div>
    <div class="preview-edit-field">
      <label>${t('popup.preview_video_label')}</label>
      <input type="text" id="bmPreviewVideoInput" value="${escHtml(currentBookmark?.previewVideo || '')}" placeholder="https://...">
    </div>
  `;
  previewArea.appendChild(editDiv);

  const previewInput = editDiv.querySelector('#bmPreviewInput');
  const previewVideoInput = editDiv.querySelector('#bmPreviewVideoInput');
  previewInput?.addEventListener('change', async () => {
    if (!currentBookmark) return;
    const val = previewInput.value.trim();
    currentBookmark.preview = val;
    await send('updateBookmark', { id: currentBookmark.id, patch: { preview: val } });
    renderBmPreview();
  });
  previewVideoInput?.addEventListener('change', async () => {
    if (!currentBookmark) return;
    const val = previewVideoInput.value.trim();
    currentBookmark.previewVideo = val;
    await send('updateBookmark', { id: currentBookmark.id, patch: { previewVideo: val } });
    renderBmPreview();
  });
}

function renderBmTags() {
  const container = $('#bmTags');
  container.innerHTML = '';
  currentBookmark.tags.forEach(tid => {
    const tag = getTagById(tid);
    if (!tag) return;
    const chip = document.createElement('span');
    chip.className = 'tag-chip active';
    chip.innerHTML = `${escHtml(tag.name)}<span class="remove-tag" data-tid="${tid}">✕</span>`;
    chip.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-tag')) removeTagFromBookmark(tid);
      else showTagRelatedBookmarks(tid);
    });
    container.appendChild(chip);
  });

  // 已收藏视图：推荐标题匹配但未添加的 tag
  const titleLower = (currentBookmark.title || '').toLowerCase();
  const suggestIds = allTags
    .filter(t => {
      if (currentBookmark.tags.includes(t.id)) return false;
      if (titleLower.includes(t.name.toLowerCase())) return true;
      if (t.alias.some(a => titleLower.includes(a.toLowerCase()))) return true;
      return false;
    })
    .map(t => t.id);

  if (suggestIds.length > 0) {
    const label = document.createElement('span');
    label.className = 'suggest-label-inline';
    label.textContent = t('popup.recommended');
    container.appendChild(label);
    suggestIds.forEach(tid => {
      const tag = getTagById(tid);
      if (!tag) return;
      const chip = document.createElement('span');
      chip.className = 'tag-chip suggest-title-match';
      chip.textContent = tag.name;
      chip.addEventListener('click', async () => {
        if (!currentBookmark.tags.includes(tag.id)) {
          currentBookmark.tags.push(tag.id);
          await send('updateBookmark', { id: currentBookmark.id, patch: { tags: currentBookmark.tags } });
          renderBmTags();
          renderGroupedTags();
        }
      });
      container.appendChild(chip);
    });
  }
}

async function removeTagFromBookmark(tagId) {
  currentBookmark.tags = currentBookmark.tags.filter(t => t !== tagId);
  await send('updateBookmark', { id: currentBookmark.id, patch: { tags: currentBookmark.tags } });
  renderBmTags();
  renderGroupedTags();
}

// ---- 已收藏视图：站点脚本执行按钮 ----
function renderBmSiteScriptBtn() {
  let container = $('#bmSiteScriptArea');
  if (!container) {
    container = document.createElement('div');
    container.id = 'bmSiteScriptArea';
    container.className = 'site-script-area';
    const bookmarkedView = $('#bookmarkedView');
    // 插入到 preview-area 之后
    const previewArea = $('#bmPreviewArea');
    if (previewArea && previewArea.nextSibling) {
      bookmarkedView.insertBefore(container, previewArea.nextSibling);
    } else {
      bookmarkedView.appendChild(container);
    }
  }
  container.innerHTML = '';
  const btn = document.createElement('button');
  btn.className = 'btn-subtle btn-sm';
  btn.textContent = '🔄 ' + t('popup.run_site_script');
  btn.id = 'runSiteScriptBtn';
  container.appendChild(btn);
}

async function runSiteScriptForBookmarked() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || tab.url.startsWith('chrome://')) return;

  const btn = $('#runSiteScriptBtn');
  if (btn) { btn.textContent = '⏳...'; btn.disabled = true; }

  try {
    const result = await send('executeSitePreview', {
      tabId: tab.id,
      url: tab.url,
      title: currentBookmark.title || tab.title || '',
      labels: currentBookmark.labels || [],
      tags: [],
      preview: currentBookmark.preview || '',
      previewVideo: currentBookmark.previewVideo || '',
    });

    if (!result || typeof result !== 'object') {
      if (btn) { btn.textContent = '🔄 ' + t('popup.run_site_script'); btn.disabled = false; }
      return;
    }

    // 显示每项的"应用"按钮
    renderSiteScriptResults(result);
  } catch (e) {
    console.warn('[popup] site script failed:', e);
  }
  if (btn) { btn.textContent = '🔄 ' + t('popup.run_site_script'); btn.disabled = false; }
}

function renderSiteScriptResults(result) {
  const container = $('#bmSiteScriptArea');
  if (!container) return;
  // 移除之前的结果
  const oldResults = container.querySelector('.site-script-results');
  if (oldResults) oldResults.remove();

  const resultsDiv = document.createElement('div');
  resultsDiv.className = 'site-script-results';

  // title — always show
  if (result.title) {
    const isSame = result.title === currentBookmark.title;
    resultsDiv.appendChild(createSuggestRow(t('popup.site_suggest_title'), result.title,
      isSame ? null : async () => {
        currentBookmark.title = result.title;
        await send('updateBookmark', { id: currentBookmark.id, patch: { title: result.title } });
        $('#bmTitle').value = result.title;
      }, null, null, isSame));
  }

  // preview — always show
  if (result.preview) {
    const isSame = result.preview === currentBookmark.preview;
    resultsDiv.appendChild(createSuggestRow(t('popup.site_suggest_preview'), result.preview,
      isSame ? null : async () => {
        currentBookmark.preview = result.preview;
        await send('updateBookmark', { id: currentBookmark.id, patch: { preview: result.preview } });
        renderBmPreview();
      }, result.preview, null, isSame));
  }

  // previewVideo — always show
  if (result.previewVideo) {
    const isSame = result.previewVideo === currentBookmark.previewVideo;
    resultsDiv.appendChild(createSuggestRow(t('popup.site_suggest_preview_video'), result.previewVideo,
      isSame ? null : async () => {
        currentBookmark.previewVideo = result.previewVideo;
        await send('updateBookmark', { id: currentBookmark.id, patch: { previewVideo: result.previewVideo } });
        renderBmPreview();
      }, null, result.previewVideo, isSame));
  }

  // tags (字符串数组，需要创建或匹配)
  if (Array.isArray(result.tags) && result.tags.length > 0) {
    const tagsRow = document.createElement('div');
    tagsRow.className = 'site-script-suggest-row';
    const label = document.createElement('span');
    label.className = 'site-script-suggest-label';
    label.textContent = t('popup.site_suggest_tags');
    tagsRow.appendChild(label);

    const tagsContainer = document.createElement('span');
    tagsContainer.className = 'site-script-suggest-tags';
    result.tags.forEach(tagName => {
      const existing = allTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
      const alreadyAdded = currentBookmark.tags.includes(existing?.id);
      const chip = document.createElement('span');
      chip.className = 'tag-chip' + (alreadyAdded ? ' active' : ' suggest-title-match');
      chip.textContent = tagName;
      if (!alreadyAdded) {
        chip.addEventListener('click', async () => {
          let tag = existing;
          if (!tag) {
            tag = await send('addTag', { data: { name: tagName, groupId: '' } });
            if (tag) allTags.push(tag);
          }
          if (tag && !currentBookmark.tags.includes(tag.id)) {
            currentBookmark.tags.push(tag.id);
            await send('updateBookmark', { id: currentBookmark.id, patch: { tags: currentBookmark.tags } });
            renderBmTags();
            renderGroupedTags();
            chip.classList.remove('suggest-title-match');
            chip.classList.add('active');
          }
        });
      }
      tagsContainer.appendChild(chip);
    });
    tagsRow.appendChild(tagsContainer);
    resultsDiv.appendChild(tagsRow);
  }

  if (resultsDiv.children.length > 0) {
    container.appendChild(resultsDiv);
  }
}

function createSuggestRow(labelText, value, onApply, imgUrl, videoUrl, isSame) {
  const row = document.createElement('div');
  row.className = 'site-script-suggest-row';
  const label = document.createElement('span');
  label.className = 'site-script-suggest-label';
  label.textContent = labelText;
  row.appendChild(label);

  if (imgUrl) {
    const img = document.createElement('img');
    img.className = 'site-script-suggest-media';
    img.src = imgUrl;
    img.alt = '';
    row.appendChild(img);
  } else if (videoUrl) {
    const video = document.createElement('video');
    video.className = 'site-script-suggest-media';
    video.src = videoUrl;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.addEventListener('mouseenter', () => video.play().catch(() => {}));
    video.addEventListener('mouseleave', () => { video.pause(); video.currentTime = 0; });
    row.appendChild(video);
  } else {
    const valSpan = document.createElement('span');
    valSpan.className = 'site-script-suggest-value';
    valSpan.textContent = value.length > 40 ? value.slice(0, 40) + '...' : value;
    valSpan.title = value;
    row.appendChild(valSpan);
  }

  if (onApply) {
    const applyBtn = document.createElement('button');
    applyBtn.className = 'btn-primary btn-sm';
    applyBtn.textContent = '✓ ' + t('popup.site_suggest_apply');
    applyBtn.addEventListener('click', onApply);
    row.appendChild(applyBtn);
  } else if (isSame) {
    const sameSpan = document.createElement('span');
    sameSpan.className = 'site-script-same';
    sameSpan.textContent = '✓';
    row.appendChild(sameSpan);
  }

  return row;
}

function removeSuggestRow(container, field) {
  // 可以标记已应用
}

async function showTagRelatedBookmarks(tagId) {
  const sort = relatedSortMode;
  const results = await send('searchBookmarks', { params: { title: '', tagIds: [tagId], favorite: 0, sort } });
  const container = $('#tagRelatedBms');
  container.style.display = 'block';
  const tag = getTagById(tagId);
  container.innerHTML = `
    <div class="related-header">
      ${t('popup.related_bookmarks', { name: tag?.name || '' })}
      <span class="related-sort" id="relatedSortBtn">${sort === 'newest' ? t('popup.sort_newest') : t('popup.sort_favorite')}</span>
    </div>
  `;
  results.forEach(bm => {
    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      <span class="result-title">${escHtml(bm.title)}</span>
      <div class="result-meta">
        <span class="result-stars">${'★'.repeat(bm.favorite)}${'☆'.repeat(5 - bm.favorite)}</span>
        <span class="result-tags">${bm.tags.map(t => { const tg = getTagById(t); return tg ? `<span class="result-tag">${escHtml(tg.name)}</span>` : ''; }).join('')}</span>
      </div>
    `;
    item.addEventListener('click', () => chrome.tabs.create({ url: bm.url }));
    container.appendChild(item);
  });
  const sortBtn = container.querySelector('#relatedSortBtn');
  if (sortBtn) {
    sortBtn.addEventListener('click', () => {
      relatedSortMode = relatedSortMode === 'newest' ? 'favorite' : 'newest';
      showTagRelatedBookmarks(tagId);
    });
  }
}

// ---- 未收藏视图 ----
async function showNotBookmarkedView() {
  $('#bookmarkedView').style.display = 'none';
  $('#notBookmarkedView').style.display = 'block';
  // 使用站点脚本返回的 title 作为默认值
  $('#newBmTitle').value = currentPageInfo.title;
  renderStarEdit('#newStarEdit', 0);
  newBookmarkFavorite = 0;
  // 站点脚本返回的 preview/previewVideo 作为 pending 默认值
  if (currentPageInfo.preview && !pendingPreview) pendingPreview = currentPageInfo.preview;
  if (currentPageInfo.previewVideo && !pendingPreviewVideo) pendingPreviewVideo = currentPageInfo.previewVideo;

  // Site script tags: do NOT auto-create, just track names for display as suggestions
  autoSelectedTagIds = [];
  const siteTagNames = Array.isArray(currentPageInfo.tags) ? currentPageInfo.tags : [];
  // For tags that already exist, mark them as auto-selected
  for (const tagName of siteTagNames) {
    const tag = allTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
    if (tag && !autoSelectedTagIds.includes(tag.id)) {
      autoSelectedTagIds.push(tag.id);
    }
  }

  renderSuggestTags();
  renderSuggestPreview();
}

async function renderSuggestPreview() {
  const suggestArea = $('#bmSuggestPreviewArea');
  suggestArea.style.display = 'block';
  suggestArea.innerHTML = '';

  // 站点建议：如果站点脚本返回了 preview/previewVideo，显示建议
  const previewSuggest = currentPageInfo.preview || '';
  const previewVideoSuggest = currentPageInfo.previewVideo || '';

  if (previewSuggest || previewVideoSuggest) {
    let html = '<div class="preview-suggest-items">';
    if (previewSuggest) {
      html += `<div class="preview-suggest-item">
        <span class="preview-suggest-label">${t('popup.preview_suggest')}</span>
        <img class="preview-suggest-img" src="${escHtml(previewSuggest)}" alt="">
        <button class="btn-primary btn-sm preview-accept-btn" data-field="preview" data-value="${escHtml(previewSuggest)}">${t('popup.preview_accept')}</button>
      </div>`;
    }
    if (previewVideoSuggest) {
      html += `<div class="preview-suggest-item">
        <span class="preview-suggest-label">${t('popup.preview_video_suggest')}</span>
        <video class="preview-suggest-video" src="${escHtml(previewVideoSuggest)}" muted preload="metadata"></video>
        <button class="btn-primary btn-sm preview-accept-btn" data-field="previewVideo" data-value="${escHtml(previewVideoSuggest)}">${t('popup.preview_video_accept')}</button>
      </div>`;
    }
    html += '</div>';
    suggestArea.innerHTML = html;

    // Bind accept buttons
    suggestArea.querySelectorAll('.preview-accept-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const field = btn.dataset.field;
        const value = btn.dataset.value;
        if (!currentBookmark) {
          if (field === 'preview') pendingPreview = value;
          if (field === 'previewVideo') pendingPreviewVideo = value;
        } else {
          await send('updateBookmark', { id: currentBookmark.id, patch: { [field]: value } });
          currentBookmark[field] = value;
          renderBmPreview();
        }
        // 更新编辑输入框的值
        const previewInput = suggestArea.querySelector('#newBmPreviewInput');
        const previewVideoInput = suggestArea.querySelector('#newBmPreviewVideoInput');
        if (field === 'preview' && previewInput) previewInput.value = value;
        if (field === 'previewVideo' && previewVideoInput) previewVideoInput.value = value;
      });
    });
  }

  // 可编辑的 preview/previewVideo 输入框
  const editDiv = document.createElement('div');
  editDiv.className = 'preview-edit';
  editDiv.innerHTML = `
    <div class="preview-edit-field">
      <label>${t('popup.preview_label')}</label>
      <input type="text" id="newBmPreviewInput" value="${escHtml(pendingPreview || previewSuggest)}" placeholder="https://...">
    </div>
    <div class="preview-edit-field">
      <label>${t('popup.preview_video_label')}</label>
      <input type="text" id="newBmPreviewVideoInput" value="${escHtml(pendingPreviewVideo || previewVideoSuggest)}" placeholder="https://...">
    </div>
  `;
  suggestArea.appendChild(editDiv);

  // 绑定输入事件更新 pending 值
  const previewInput = editDiv.querySelector('#newBmPreviewInput');
  const previewVideoInput = editDiv.querySelector('#newBmPreviewVideoInput');
  previewInput?.addEventListener('input', () => { pendingPreview = previewInput.value.trim(); });
  previewVideoInput?.addEventListener('input', () => { pendingPreviewVideo = previewVideoInput.value.trim(); });
}

/** 渲染推荐标签：最近使用 + 站点推荐 + 标题匹配 + 站点脚本返回的 tags */
async function renderSuggestTags() {
  const recentIds = await send('recentTags', { limit: 8 });
  const suggestedIds = await send('suggestTags', {
    labels: currentPageInfo.labels || [],
    contentTags: currentPageInfo.tags || []
  });

  // 标题匹配：如果 title 中包含已有 tag 的名称，推荐该 tag
  const titleLower = (currentPageInfo.title || '').toLowerCase();
  const titleMatchedIds = allTags
    .filter(t => {
      if (titleLower.includes(t.name.toLowerCase())) return true;
      // 别名匹配
      if (t.alias.some(a => titleLower.includes(a.toLowerCase()))) return true;
      return false;
    })
    .map(t => t.id);

  const combinedIds = [...new Set([...recentIds, ...suggestedIds, ...titleMatchedIds])];
  const container = $('#suggestTags');
  container.innerHTML = '';

  // 站点脚本返回的 tags（字符串数组）
  const siteTagNames = Array.isArray(currentPageInfo.tags) ? currentPageInfo.tags : [];

  combinedIds.forEach(tid => {
    const tag = getTagById(tid);
    if (!tag) return;
    const chip = document.createElement('span');
    const isAutoSelected = autoSelectedTagIds.includes(tid);
    chip.className = 'tag-chip' + (isAutoSelected ? ' active' : '');
    // 标题匹配的 tag 加视觉标识
    const isTitleMatch = titleMatchedIds.includes(tid);
    if (isTitleMatch && !isAutoSelected) chip.classList.add('suggest-title-match');
    chip.textContent = tag.name;
    if (isAutoSelected) {
      // Click to deselect auto-filled tag
      chip.addEventListener('click', () => {
        autoSelectedTagIds = autoSelectedTagIds.filter(id => id !== tid);
        renderSuggestTags();
      });
    } else {
      chip.addEventListener('click', () => bookmarkWithTag(tid));
    }
    container.appendChild(chip);
  });

  // 站点脚本返回的 tag 名称（未收藏视图：已存在的 tag 显示为已选中，不存在的显示 (+) 点击后创建）
  if (siteTagNames.length > 0) {
    const siteLabel = document.createElement('span');
    siteLabel.className = 'suggest-label-inline';
    siteLabel.textContent = t('popup.site_suggest_tags');
    container.appendChild(siteLabel);

    siteTagNames.forEach(tagName => {
      const existing = allTags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
      if (existing) {
        // 已存在的 tag，如果不在 combinedIds 中则补充显示
        if (!combinedIds.includes(existing.id)) {
          const isAutoSelected = autoSelectedTagIds.includes(existing.id);
          const chip = document.createElement('span');
          chip.className = 'tag-chip' + (isAutoSelected ? ' active' : ' suggest-title-match');
          chip.textContent = existing.name;
          if (isAutoSelected) {
            chip.addEventListener('click', () => {
              autoSelectedTagIds = autoSelectedTagIds.filter(id => id !== existing.id);
              renderSuggestTags();
            });
          } else {
            chip.addEventListener('click', () => bookmarkWithTag(existing.id));
          }
          container.appendChild(chip);
        }
      } else {
        // 不存在的 tag，显示 (+) 标记，点击后创建并添加书签
        const chip = document.createElement('span');
        chip.className = 'tag-chip suggest-title-match';
        chip.textContent = tagName + ' (+)';
        chip.addEventListener('click', async () => {
          const newTag = await send('addTag', { data: { name: tagName, groupId: '' } });
          if (newTag) {
            allTags.push(newTag);
            await bookmarkWithTag(newTag.id);
            renderGroupedTags();
          }
        });
        container.appendChild(chip);
      }
    });
  }
}

async function bookmarkWithTag(tagId) {
  const tag = getTagById(tagId);
  if (!tag) return;
  const title = $('#newBmTitle')?.value?.trim() || currentPageInfo.title;

  // Include all auto-selected tags plus the clicked tag
  const allSelectedTagIds = [...new Set([...autoSelectedTagIds, tagId])];

  currentBookmark = await send('addBookmark', {
    data: {
      url: currentPageInfo.url,
      title,
      tags: allSelectedTagIds,
      favorite: newBookmarkFavorite,
      labels: currentPageInfo.labels || [],
      contentTags: currentPageInfo.tags || [],
      preview: pendingPreview || '',
      previewVideo: pendingPreviewVideo || '',
    }
  });

  if (currentBookmark) {
    await send('refreshIcon');
    autoSelectedTagIds = [];
    showBookmarkedView();
    renderGroupedTags();
  }
}

// ---- 分组 tag 展示（含 inline 添加输入 + 拖拽 + 添加分组） ----
function renderGroupedTags() {
  const container = $('#groupedTags');
  container.innerHTML = '';

  const groupMap = {};
  allTagGroups.sort((a, b) => a.order - b.order).forEach(g => { groupMap[g.id] = { group: g, tags: [] }; });
  groupMap[''] = { group: { id: '', name: t('popup.no_group') }, tags: [] };

  allTags.sort((a, b) => a.order - b.order).forEach(t => {
    const gid = t.groupId || '';
    if (!groupMap[gid]) groupMap[gid] = { group: { id: gid, name: t('popup.no_group') }, tags: [] };
    groupMap[gid].tags.push(t);
  });

  for (const gid of Object.keys(groupMap)) {
    const { group, tags } = groupMap[gid];

    // 组标题行（可添加分组）
    const titleRow = document.createElement('div');
    titleRow.className = 'group-title-row';

    const title = document.createElement('span');
    title.className = 'group-title';
    title.textContent = group.name;
    titleRow.appendChild(title);

    // 拖放目标区域标识
    titleRow.dataset.gid = gid;
    titleRow.addEventListener('dragover', onGroupDragOver);
    titleRow.addEventListener('dragleave', onGroupDragLeave);
    titleRow.addEventListener('drop', onGroupDrop);

    container.appendChild(titleRow);

    const list = document.createElement('div');
    list.className = 'tag-list tag-drag-list';
    list.dataset.gid = gid;
    // 整个 tag-list 也是拖放目标
    list.addEventListener('dragover', onGroupDragOver);
    list.addEventListener('dragleave', onGroupDragLeave);
    list.addEventListener('drop', onGroupDrop);

    tags.forEach(t => {
      const chip = document.createElement('span');
      const isActive = currentBookmark && currentBookmark.tags.includes(t.id);
      chip.className = 'tag-chip' + (isActive ? ' active' : '');
      chip.textContent = t.name;
      chip.dataset.tagId = t.id;
      chip.dataset.groupId = gid;
      chip.draggable = true;
      chip.addEventListener('click', () => toggleTag(t.id));
      // 拖拽事件
      chip.addEventListener('dragstart', onTagDragStart);
      chip.addEventListener('dragend', onTagDragEnd);
      list.appendChild(chip);
    });

    // Inline 添加 tag 输入
    const addInput = document.createElement('input');
    addInput.type = 'text';
    addInput.className = 'tag-inline-input';
    addInput.placeholder = '+';
    addInput.dataset.gid = gid;
    addInput.autocomplete = 'off';

    const handleAdd = async (name) => {
      if (!name) return;
      let tag = allTags.find(t => t.name === name);
      if (!tag) {
        tag = await send('addTag', { data: { name, groupId: gid || '' } });
        if (tag) allTags.push(tag);
      }
      addInput.value = '';
      if (currentBookmark && tag) {
        if (!currentBookmark.tags.includes(tag.id)) {
          currentBookmark.tags.push(tag.id);
          await send('updateBookmark', { id: currentBookmark.id, patch: { tags: currentBookmark.tags } });
        }
        renderBmTags();
      } else if (tag) {
        await bookmarkWithTag(tag.id);
      }
      renderGroupedTags();
    };

    addInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); const name = addInput.value.trim(); if (name) handleAdd(name); closeTagPicker(); }
      if (e.key === 'Escape') closeTagPicker();
    });

    addInput.addEventListener('input', () => {
      if ($('#tagPicker').style.display !== 'none') renderTagPickerContent(addInput.value.trim());
    });

    addInput.addEventListener('focus', () => {
      if (tagPickerJustClosed) return;
      openTagPicker(gid || '', (tagId) => {
        addInput.value = '';
        if (currentBookmark) {
          if (!currentBookmark.tags.includes(tagId)) {
            currentBookmark.tags.push(tagId);
            send('updateBookmark', { id: currentBookmark.id, patch: { tags: currentBookmark.tags } });
          }
          renderBmTags();
        } else { bookmarkWithTag(tagId); }
        renderGroupedTags();
        closeTagPicker();
      }, addInput);
    });

    list.appendChild(addInput);
    container.appendChild(list);
  }

  // 添加分组按钮
  const addGroupRow = document.createElement('div');
  addGroupRow.className = 'add-group-row';
  const groupInput = document.createElement('input');
  groupInput.type = 'text';
  groupInput.id = 'newGroupInput';
  groupInput.placeholder = t('popup.new_group_placeholder');
  groupInput.autocomplete = 'off';
  const groupBtn = document.createElement('button');
  groupBtn.id = 'addGroupBtn';
  groupBtn.className = 'btn-sm btn-primary';
  groupBtn.textContent = t('popup.add_group');
  addGroupRow.appendChild(groupInput);
  addGroupRow.appendChild(groupBtn);
  container.appendChild(addGroupRow);

  // 绑定添加分组
  const addNewGroup = async () => {
    const name = groupInput.value.trim();
    if (!name) return;
    const g = await send('addTagGroup', { name });
    if (g) {
      allTagGroups.push(g);
      groupInput.value = '';
      renderGroupedTags();
    }
  };

  groupBtn.addEventListener('click', addNewGroup);
  groupInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addNewGroup(); });
}

// ---- 拖拽事件处理 ----

function onTagDragStart(e) {
  const chip = e.target.closest('.tag-chip[draggable]');
  if (!chip) return;
  dragState = { tagId: chip.dataset.tagId, sourceGroupId: chip.dataset.groupId, el: chip };
  chip.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', chip.dataset.tagId);
}

function onTagDragEnd(e) {
  if (dragState?.el) dragState.el.classList.remove('dragging');
  dragState = null;
  // 清除所有拖放高亮
  $$('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function onGroupDragOver(e) {
  if (!dragState) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const target = e.currentTarget;
  target.classList.add('drag-over');
}

function onGroupDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

async function onGroupDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!dragState) return;

  const targetGid = e.currentTarget.dataset.gid;
  const newGid = targetGid === '' ? '' : targetGid; // '' = 未分组
  const tagId = dragState.tagId;

  const tag = getTagById(tagId);
  if (!tag) { dragState = null; return; }

  // 同组不处理
  const oldGid = tag.groupId || '';
  if (oldGid === newGid) { dragState = null; return; }

  // 更新分组
  tag.groupId = newGid;
  await send('updateTag', { id: tagId, patch: { groupId: newGid } });

  dragState = null;
  renderGroupedTags();
}

// ---- Toggle tag ----

async function toggleTag(tagId) {
  if (!currentBookmark) {
    const title = $('#newBmTitle')?.value?.trim() || currentPageInfo.title;
    const allSelectedTagIds = [...new Set([...autoSelectedTagIds, tagId])];
    currentBookmark = await send('addBookmark', {
      data: {
        url: currentPageInfo.url, title, tags: allSelectedTagIds, favorite: newBookmarkFavorite,
        labels: currentPageInfo.labels || [], contentTags: currentPageInfo.tags || [],
        preview: pendingPreview || '',
        previewVideo: pendingPreviewVideo || '',
      }
    });
    if (currentBookmark) { await send('refreshIcon'); autoSelectedTagIds = []; showBookmarkedView(); }
  } else {
    if (currentBookmark.tags.includes(tagId)) currentBookmark.tags = currentBookmark.tags.filter(t => t !== tagId);
    else currentBookmark.tags.push(tagId);
    await send('updateBookmark', { id: currentBookmark.id, patch: { tags: currentBookmark.tags } });
    renderBmTags();
  }
  renderGroupedTags();
}

// ---- Tag Picker ----

function openTagPicker(filterGroupId, callback, triggerInput) {
  tagPickerCallback = callback;
  tagPickerFilterGroupId = filterGroupId;
  tagPickerTriggerInput = triggerInput;

  const picker = $('#tagPicker');
  const appRect = $('#app').getBoundingClientRect();
  const inputRect = triggerInput.getBoundingClientRect();
  picker.style.top = (inputRect.bottom - appRect.top + 2) + 'px';
  picker.style.display = 'block';
  renderTagPickerContent(triggerInput.value.trim());
  triggerInput.focus();
}

function closeTagPicker() {
  const picker = $('#tagPicker');
  if (picker) picker.style.display = 'none';
  tagPickerCallback = null;
  tagPickerFilterGroupId = null;
  tagPickerTriggerInput = null;
  tagPickerJustClosed = true;
  setTimeout(() => { tagPickerJustClosed = false; }, 200);
}

function renderTagPickerContent(kw = '') {
  const content = $('#tagPickerContent');
  content.innerHTML = '';
  const lowerKw = kw.toLowerCase();

  const groupMap = {};
  allTagGroups.sort((a, b) => a.order - b.order).forEach(g => { groupMap[g.id] = { group: g, tags: [] }; });
  groupMap[''] = { group: { id: '', name: t('popup.no_group') }, tags: [] };

  allTags.forEach(t => {
    const gid = t.groupId || '';
    if (!groupMap[gid]) groupMap[gid] = { group: { id: gid, name: t('popup.no_group') }, tags: [] };
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
      const isActive = currentBookmark && currentBookmark.tags.includes(t.id);
      chip.className = 'tag-chip' + (isActive ? ' active' : '');
      chip.textContent = t.name;
      chip.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (tagPickerCallback) tagPickerCallback(t.id);
        closeTagPicker();
      });
      tagsDiv.appendChild(chip);
    });
    groupDiv.appendChild(tagsDiv);
    content.appendChild(groupDiv);
  }

  if (lowerKw && !allTags.some(t => t.name.toLowerCase() === lowerKw)) {
    const createDiv = document.createElement('div');
    createDiv.className = 'tag-picker-create';
    createDiv.textContent = t('popup.create_tag', { name: kw });
    createDiv.addEventListener('mousedown', async (e) => {
      e.preventDefault();
      const newTag = await send('addTag', { data: { name: kw, groupId: tagPickerFilterGroupId || '' } });
      if (newTag) { allTags.push(newTag); if (tagPickerCallback) tagPickerCallback(newTag.id); }
      closeTagPicker();
    });
    content.appendChild(createDiv);
  }
}

document.addEventListener('mousedown', (e) => {
  const picker = $('#tagPicker');
  if (picker && picker.style.display !== 'none' && !picker.contains(e.target) && e.target !== tagPickerTriggerInput) closeTagPicker();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('#tagPicker').style.display !== 'none') closeTagPicker();
});

// ---- 星星组件 ----
function renderStarEdit(selector, value) {
  const container = document.querySelector(selector);
  if (!container) return;
  container.querySelectorAll('.star').forEach(s => {
    s.classList.toggle('on', parseInt(s.dataset.val) <= value);
  });
}

// ---- 搜索 ----
async function doSearch() {
  const title = $('#searchInput').value.trim();
  const tagIds = selectedTagIds;
  const fav = filterFavorite;
  const sort = searchSort;
  const results = await send('searchBookmarks', { params: { title, tagIds, favorite: fav, sort } });
  const container = $('#searchResults');
  container.style.display = 'block';
  container.innerHTML = results.length ? '' : `<div style="color:var(--text-dim);padding:8px;text-align:center;">${t('popup.no_results')}</div>`;
  results.forEach(bm => {
    const item = document.createElement('div');
    item.className = 'result-item';
    item.innerHTML = `
      <span class="result-title">${escHtml(bm.title)}</span>
      <div class="result-meta">
        ${bm.favorite > 0 ? `<span class="result-stars">${'★'.repeat(bm.favorite)}${'☆'.repeat(5 - bm.favorite)}</span>` : ''}
        <span class="result-tags">${bm.tags.map(t => { const tg = getTagById(t); return tg ? `<span class="result-tag">${escHtml(tg.name)}</span>` : ''; }).join('')}</span>
      </div>
    `;
    item.addEventListener('click', () => chrome.tabs.create({ url: bm.url }));
    container.appendChild(item);
  });
}

// ---- 搜索标签选择器 ----
function renderTagSelector() {
  const container = $('#tagSelectorList');
  container.innerHTML = '';
  const groupMap = {};
  allTagGroups.sort((a, b) => a.order - b.order).forEach(g => { groupMap[g.id] = { group: g, tags: [] }; });
  groupMap[''] = { group: { id: '', name: t('popup.no_group') }, tags: [] };
  allTags.forEach(t => {
    const gid = t.groupId || '';
    if (!groupMap[gid]) groupMap[gid] = { group: { id: gid, name: t('popup.no_group') }, tags: [] };
    groupMap[gid].tags.push(t);
  });
  for (const gid of Object.keys(groupMap)) {
    const { group, tags } = groupMap[gid];
    if (tags.length === 0) continue;
    if (Object.keys(groupMap).length > 1) {
      const label = document.createElement('div');
      label.className = 'group-title'; label.textContent = group.name;
      container.appendChild(label);
    }
    const list = document.createElement('div');
    list.className = 'tag-list';
    tags.forEach(t => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip' + (selectedTagIds.includes(t.id) ? ' active' : '');
      chip.textContent = t.name;
      chip.addEventListener('click', () => {
        if (selectedTagIds.includes(t.id)) selectedTagIds = selectedTagIds.filter(x => x !== t.id);
        else selectedTagIds.push(t.id);
        renderTagSelector(); doSearch();
      });
      list.appendChild(chip);
    });
    container.appendChild(list);
  }
}

// ---- 事件绑定 ----
function bindEvents() {
  // 喜爱度编辑（已收藏）
  $('#starEdit').addEventListener('click', async (e) => {
    const star = e.target.closest('.star');
    if (!star || !currentBookmark) return;
    const val = parseInt(star.dataset.val);
    currentBookmark.favorite = currentBookmark.favorite === val ? 0 : val;
    await send('updateBookmark', { id: currentBookmark.id, patch: { favorite: currentBookmark.favorite } });
    renderStarEdit('#starEdit', currentBookmark.favorite);
  });

  // 喜爱度编辑（新收藏）
  $('#newStarEdit').addEventListener('click', (e) => {
    const star = e.target.closest('.star'); if (!star) return;
    const val = parseInt(star.dataset.val);
    newBookmarkFavorite = newBookmarkFavorite === val ? 0 : val;
    renderStarEdit('#newStarEdit', newBookmarkFavorite);
  });

  // 标题编辑（已收藏）
  $('#bmTitle').addEventListener('change', async () => {
    if (!currentBookmark) return;
    const title = $('#bmTitle').value.trim();
    if (title) { currentBookmark.title = title; await send('updateBookmark', { id: currentBookmark.id, patch: { title } }); }
  });

  // 取消收藏
  $('#removeBmBtn').addEventListener('click', async () => {
    if (!currentBookmark) return;
    await send('removeBookmark', { id: currentBookmark.id });
    currentBookmark = null;
    await send('refreshIcon');
    showNotBookmarkedView();
    renderGroupedTags();
  });

  // 站点脚本执行按钮（已收藏视图）
  document.addEventListener('click', async (e) => {
    if (e.target.id === 'runSiteScriptBtn' || e.target.closest('#runSiteScriptBtn')) {
      await runSiteScriptForBookmarked();
    }
  });

  // 搜索按钮
  $('#searchBtn').addEventListener('click', () => {
    const sel = $('#tagSelector');
    if (sel.style.display === 'none') { sel.style.display = 'block'; renderTagSelector(); }
    else { sel.style.display = 'none'; }
    doSearch();
  });

  // 搜索输入
  $('#searchInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
  $('#searchInput').addEventListener('input', () => doSearch());

  $('#searchInput').addEventListener('focus', () => {
    if (tagPickerJustClosed) return;
    openTagPicker(null, (tagId) => {
      if (!selectedTagIds.includes(tagId)) selectedTagIds.push(tagId);
      $('#tagSelector').style.display = 'block';
      renderTagSelector(); doSearch(); closeTagPicker();
      setTimeout(() => $('#searchInput').focus(), 50);
    }, $('#searchInput'));
  });

  $('#searchInput').addEventListener('input', () => {
    if ($('#tagPicker').style.display !== 'none') renderTagPickerContent($('#searchInput').value.trim());
  });

  $('#tagSelectorClear').addEventListener('click', () => { selectedTagIds = []; renderTagSelector(); doSearch(); });

  $('#starFilter').addEventListener('click', (e) => {
    const star = e.target.closest('.star'); if (!star) return;
    const val = parseInt(star.dataset.val);
    filterFavorite = filterFavorite === val ? 0 : val;
    $$('#starFilter .star').forEach(s => { s.classList.toggle('on', parseInt(s.dataset.val) <= filterFavorite); });
    doSearch();
  });

  $('#searchModeBtn').addEventListener('click', () => {
    searchSort = searchSort === 'newest' ? 'favorite' : 'newest';
    $('#searchModeBtn').textContent = searchSort === 'newest' ? t('popup.sort_newest') : t('popup.sort_favorite');
    doSearch();
  });
}

// ---- 启动 ----
init();
