// ============================================================
// bookmark-tags locales.js — 多语言支持
// v2.4.0 — preview/previewVideo + 冲突解决相关 i18n 键
// ============================================================

const LOCALES = {
  en: {
    // ---- popup ----
    'popup.search_placeholder': 'Search title or tags...',
    'popup.tag_filter': 'Tag Filter',
    'popup.open_options': 'Open Bookmark Manager',
    'popup.favorite_gte': 'Fav ≥',
    'popup.toggle_sort': 'Sort',
    'popup.sort_newest': 'Newest↓',
    'popup.sort_favorite': 'Fav↓',
    'popup.favorite': 'Favorite',
    'popup.unfavorite': 'Unfavorite',
    'popup.title_placeholder': 'Title...',
    'popup.recent_suggest': 'Recent / Suggested',
    'popup.recommended': 'Suggested',
    'popup.new_group_placeholder': 'New group...',
    'popup.add_group': '+ Group',
    'popup.filter_tags': 'Filter Tags',
    'popup.clear': 'Clear',
    'popup.no_results': 'No results',
    'popup.related_bookmarks': 'Bookmarks tagged "{name}"',
    'popup.page_not_supported': 'Page not supported',
    'popup.create_tag': 'Create tag "{name}"',
    'popup.no_group': 'Ungrouped',

    // ---- options nav ----
    'options.title': 'bookmark-tags Options',
    'options.logo': '🔖 bookmark-tags',
    'options.nav_bookmarks': '📚 Bookmarks',
    'options.nav_tags': '🏷️ Tag Manager',
    'options.nav_sites': '🌐 Site Config',
    'options.nav_config': '⚙️ Settings',

    // ---- options bookmarks ----
    'options.bm_title': 'Bookmark Manager',
    'options.bm_search_placeholder': 'Search title or tags...',
    'options.bm_tag_filter': 'Tag Filter',
    'options.bm_favorite_gte': 'Fav ≥',
    'options.bm_sort_newest': 'Newest',
    'options.bm_sort_favorite': 'Top Fav',
    'options.bm_sort_tag_asc': 'Tag ↑',
    'options.bm_sort_tag_desc': 'Tag ↓',
    'options.bm_empty': 'No bookmarks yet',
    'options.bm_count_all': '{n} bookmarks',
    'options.bm_count_filtered': '{n} of {total} bookmarks',
    'options.bm_edit': 'Edit',
    'options.bm_delete': 'Delete',
    'options.bm_confirm_delete': 'Delete this bookmark?',
    'options.bm_edit_title': 'Edit Bookmark',
    'options.bm_field_title': 'Title',
    'options.bm_field_favorite': 'Favorite',
    'options.bm_field_tags': 'Tags (click to toggle)',
    'options.bm_cancel': 'Cancel',
    'options.bm_save': 'Save',

    // ---- options tag manager ----
    'options.tag_title': 'Tag Manager',
    'options.tag_new_group_placeholder': 'New group name...',
    'options.tag_add_group': 'Add Group',
    'options.tag_drag_sort': 'Drag to reorder',
    'options.tag_move_up': 'Move up',
    'options.tag_move_down': 'Move down',
    'options.tag_collapse': 'Collapse',
    'options.tag_expand': 'Expand',
    'options.tag_collapse_all': 'Collapse All',
    'options.tag_expand_all': 'Expand All',
    'options.tag_col_name': 'Name',
    'options.tag_col_group': 'Group',
    'options.tag_col_alias': 'Alias',
    'options.tag_col_marked_tags': 'Marked Tags',
    'options.tag_col_actions': 'Actions',
    'options.tag_no_group': 'Ungrouped',
    'options.tag_delete': 'Delete',
    'options.tag_delete_group': 'Delete Group',
    'options.tag_confirm_delete_group': 'Tags in this group will become ungrouped. Continue?',
    'options.tag_confirm_delete': 'Delete this tag?',
    'options.tag_new_name_placeholder': 'New tag name',
    'options.tag_add': 'Add',
    'options.tag_add_alias_placeholder': '+Alias',
    'options.tag_select': '+ Select',

    // ---- options site config ----
    'options.site_title': 'Site Config',
    'options.site_add': '+ Add Site',
    'options.site_add_title': 'Add Site',
    'options.site_edit_title': 'Edit Site',
    'options.site_url_label': 'URL Pattern (regex)',
    'options.site_url_placeholder': 'e.g. https://github\\.com/.*',
    'options.site_script_label': 'Site Script',
    'options.site_script_hint': 'Available variables: title, labels, tags, preview, previewVideo. Assign to set values. e.g. preview = document.querySelector(\'meta[property="og:image"]\')?.content',
    'options.site_url_required': 'Please enter a URL pattern',
    'options.site_confirm_delete': 'Delete this site config?',
    'options.site_debug': '🧪 Debug',
    'options.site_debug_title': '🧪 Site Config Debug',
    'options.site_debug_run': '▶ Run Script',
    'options.site_debug_close': 'Close',
    'options.site_debug_no_script': 'No script to debug',
    'options.site_debug_no_page': 'Cannot debug on this page (chrome:// URLs are not supported)',
    'options.site_debug_no_match': 'Current page URL does not match pattern',
    'options.bm_field_preview': 'Preview Image URL',
    'options.bm_field_preview_video': 'Preview Video URL',
    'popup.preview_label': '🖼',
    'popup.preview_video_label': '🎬',
    'popup.preview_suggest': 'Site Preview Suggestion',
    'popup.preview_video_suggest': 'Site Preview Video Suggestion',
    'popup.preview_accept': 'Use',
    'popup.preview_video_accept': 'Use',
    'popup.run_site_script': 'Run Site Script',
    'popup.site_suggest_title': 'Title',
    'popup.site_suggest_preview': '🖼',
    'popup.site_suggest_preview_video': '🎬',
    'popup.site_suggest_tags': '🏷',
    'popup.site_suggest_apply': 'Apply',
    'options.bm_autoplay_videos': 'Auto-play videos',
    'options.bm_layout_list': 'List',
    'options.bm_layout_grid': 'Grid',
    'options.bm_tile_size': 'Tile Size',
    'options.bm_preview_only': 'Preview Only',

    // ---- guide ----
    'options.nav_guide': '📖 Guide',
    'options.guide_title': '📖 Usage Guide',
    'options.guide_quick_start': 'Quick Start',
    'options.guide_quick_start_desc': 'After installing the extension, click the extension icon on any page to open the popup. If the page is not bookmarked, you\'ll see the title, suggested tags, and a "Bookmark" button. Click a tag to bookmark the page with that tag.',
    'options.guide_tag_title': 'Tag Management',
    'options.guide_tag_desc1': 'Tags are the core organizing tool. Each tag belongs to a group (or "Ungrouped" if none is specified).',
    'options.guide_tag_li1': '<strong>Create a group:</strong> Go to "Tag Manager" tab, type a group name in the input at the top, and click "Add Group". Groups can be drag-reordered.',
    'options.guide_tag_li2': '<strong>Create a tag:</strong> Click "+" at the bottom of any group, type the tag name and press Enter. Tags can also be drag-reordered within their group.',
    'options.guide_tag_li3': '<strong>Tag aliases:</strong> Click a tag to edit it. In the "Aliases" field, add alternative names. Searching an alias matches the same tag. Example: tag "JavaScript" with alias "JS" — searching "JS" finds all bookmarks tagged "JavaScript".',
    'options.guide_tag_li4': '<strong>Marked Tags:</strong> In the tag edit panel, "Marked Tags" lets you associate one tag with others. When searching for tag A, bookmarks tagged with any of its marked tags will also appear. This creates a hierarchical relationship (e.g., "Frontend" marked with "React", "Vue" — searching "Frontend" also finds "React"/"Vue" bookmarks).',
    'options.guide_tag_note': 'Tip: You can add tags directly from the popup when bookmarking a page, or from the Options search page using the tag picker (🏷️ button).',
    'options.guide_site_title': 'Site Configuration',
    'options.guide_site_desc1': 'Site configs let you write a custom script that runs automatically when you visit a matching page. The script can extract title, tags, preview image, and more.',
    'options.guide_site_li1': '<strong>URL Pattern:</strong> A regular expression. When the current page URL matches, the script runs. Example: <code>youtube\\.com/watch</code>',
    'options.guide_site_li2': '<strong>Script:</strong> JavaScript code that can read and modify these pre-defined variables: <code>title</code>, <code>labels</code>, <code>tags</code>, <code>preview</code>, <code>previewVideo</code>. Assign to them to set values.',
    'options.guide_site_example_title': '<strong>Example — YouTube:</strong>',
    'options.guide_site_example_title2': '<strong>Example — GitHub repo:</strong>',
    'options.guide_site_note': 'Note: Scripts run in the page\'s MAIN world context, so you can access the full DOM. For pages with strict CSP, script execution may fail. Use the "Debug" feature on the Site Config page to test.',
    'options.guide_preview_title': 'Preview & Video',
    'options.guide_preview_desc1': 'Each bookmark can have a preview image (preview) and a preview video (previewVideo). These can be set by:',
    'options.guide_preview_li1': 'Site config scripts (automatically extracted)',
    'options.guide_preview_li2': 'Manual edit in the popup or Options page',
    'options.guide_preview_desc2': 'In the Options search page, previews are displayed as thumbnails. Hovering over a card with a previewVideo will play the video. Enable "Auto-play videos" to play all videos without hovering.',
    'options.guide_sync_title': 'Data Sync',
    'options.guide_sync_desc1': 'Two sync methods are available:',
    'options.guide_sync_li1': '<strong>Chrome Sync:</strong> Uses your Chrome account to sync data across devices. Toggle on in Settings. Limited to ~100KB.',
    'options.guide_sync_li2': '<strong>Google Drive:</strong> Backs up data to your Google Drive app data folder. Supports version tracking and conflict detection. More reliable for large datasets.',

    // ---- options config ----
    'options.config_title': 'Settings',
    'options.config_data': 'Data Management',
    'options.config_backup_hint': 'We recommend exporting backups regularly. Uninstalling the extension will clear all data (including Chrome sync data). You\'ll need to import to restore after reinstalling.',
    'options.config_export': '📦 Export Data',
    'options.config_import': '📥 Import Data',
    'options.config_clear': 'Clear All Data',
    'options.config_clear_confirm': 'Clear all data? This cannot be undone.',
    'options.config_import_confirm': 'Import will overwrite existing data. Continue?',
    'options.config_import_success': 'Import successful',
    'options.config_import_failed': 'Import failed: ',

    // ---- options sync ----
    'options.config_chrome_sync': 'Chrome Sync',
    'options.config_enable_chrome_sync': 'Enable Chrome Sync',
    'options.config_chrome_sync_hint': 'When enabled, data will automatically sync via Chrome to your Google account (chrome.storage.sync). Uninstalling the extension clears this data.',
    'options.config_pull_chrome': 'Pull from Chrome Sync',
    'options.config_last_sync': 'Last sync: ',
    'options.config_sync_disabled': 'Disabled',

    // ---- options Google Drive ----
    'options.config_gd_title': '☁️ Google Drive Backup',
    'options.config_gd_hint': 'Data is stored in Google Drive app data folder (appDataFolder), tied to your Google account. It survives extension uninstall.',
    'options.config_gd_auto': 'Auto-sync to Google Drive',
    'options.config_gd_auto_hint': 'When enabled, data changes are automatically pushed to Google Drive with version tracking and conflict detection.',
    'options.config_gd_auth': '🔑 Authorize Google Account',
    'options.config_gd_push': '📤 Push to Google Drive',
    'options.config_gd_pull': '📥 Pull from Google Drive',
    'options.config_gd_last_sync': 'Last Google Drive sync: ',
    'options.config_gd_authorizing': 'Authorizing...',
    'options.config_gd_auth_success': 'Authorized! You can now push or pull data.',
    'options.config_gd_auth_failed': 'Authorization failed: ',
    'options.config_gd_pushing': 'Pushing...',
    'options.config_gd_push_success': 'Push successful! (',
    'options.config_gd_push_failed': 'Push failed: ',
    'options.config_gd_first_push': 'First push in progress...',
    'options.config_gd_auto_on': 'Auto-sync enabled, push successful',
    'options.config_gd_auto_off': 'Auto-sync disabled',
    'options.config_gd_pulling': 'Pulling...',
    'options.config_gd_pull_confirm': 'Pulling from Google Drive will overwrite local data. Continue?',
    'options.config_gd_pull_success': 'Pull successful, local data updated',
    'options.config_gd_pull_no_data': 'No new data in cloud',
    'options.config_gd_pull_failed': 'Pull failed: ',

    // ---- options language ----
    'options.config_language': 'Language',
    'options.config_language_hint': 'Language preference is synced with your data.',

    // ---- options theme ----
    'options.config_theme': 'Theme',
    'options.config_theme_hint': 'Theme preference is synced with your data.',
    'options.theme_system': 'Follow System',
    'options.theme_light': 'Light',
    'options.theme_dark': 'Dark',

    // ---- options tag picker ----
    'options.tag_picker_search': 'Search tags...',
    'options.tag_picker_close': 'Close',
    'options.tag_picker_create': 'Create tag "{name}"',

    // ---- sync pulling states ----
    'options.sync_pulling': 'Pulling...',
    'options.sync_pull_success': 'Pull successful, updated',
    'options.sync_pull_no_data': 'No new data in cloud',
    'options.sync_pull_failed': 'Pull failed: ',
    'options.sync_pushing': 'Pushing...',
    'options.sync_done': 'Sync enabled and complete',
    'options.sync_enabling': 'Pulling cloud data...',
    'options.sync_pushing_local': 'Pushing local data...',

    // ---- conflict resolution ----
    'options.conflict_title': 'Sync Conflicts',
    'options.conflict_desc': 'The following items have conflicting changes. Please choose which version to keep for each.',
    'options.conflict_keep_local': 'Keep Local',
    'options.conflict_keep_remote': 'Keep Remote',
    'options.conflict_apply': 'Apply',
    'options.conflict_no_conflicts': 'No conflicts',
    'options.conflict_type_bookmark': 'Bookmark',
    'options.conflict_type_tag': 'Tag',
    'options.conflict_type_tagGroup': 'Tag Group',
    'options.conflict_type_siteConfig': 'Site Config',
    'options.config_gd_versioned': 'Version-synced (conflict detection enabled)',
    'options.config_gd_auto_hint': 'When enabled, data changes are automatically pushed to Google Drive with version tracking and conflict detection.',

    // ---- general ----
    'general.auth_failed': 'Authorization failed',
    'general.no_cloud_data': 'No backup data in cloud',
  },

  zh: {
    // ---- popup ----
    'popup.search_placeholder': '搜索标题或标签...',
    'popup.tag_filter': '标签筛选',
    'popup.open_options': '打开收藏管理',
    'popup.favorite_gte': '喜爱度 ≥',
    'popup.toggle_sort': '切换排序',
    'popup.sort_newest': '最新↓',
    'popup.sort_favorite': '最爱↓',
    'popup.favorite': '喜爱度',
    'popup.unfavorite': '取消收藏',
    'popup.title_placeholder': '标题...',
    'popup.recent_suggest': '最近使用 / 推荐',
    'popup.recommended': '推荐',
    'popup.new_group_placeholder': '新分组名...',
    'popup.add_group': '+ 分组',
    'popup.filter_tags': '筛选标签',
    'popup.clear': '清除',
    'popup.no_results': '无结果',
    'popup.related_bookmarks': '标签「{name}」关联的书签',
    'popup.page_not_supported': '当前页面不支持',
    'popup.create_tag': '创建新标签「{name}」',
    'popup.no_group': '未分组',

    // ---- options nav ----
    'options.title': 'bookmark-tags 选项',
    'options.logo': '🔖 bookmark-tags',
    'options.nav_bookmarks': '📚 收藏',
    'options.nav_tags': '🏷️ 标签管理',
    'options.nav_sites': '🌐 站点配置',
    'options.nav_config': '⚙️ 配置',

    // ---- options bookmarks ----
    'options.bm_title': '收藏管理',
    'options.bm_search_placeholder': '搜索标题或标签...',
    'options.bm_tag_filter': '标签筛选',
    'options.bm_favorite_gte': '喜爱度 ≥',
    'options.bm_sort_newest': '最新优先',
    'options.bm_sort_favorite': '最爱优先',
    'options.bm_sort_tag_asc': '标签↑',
    'options.bm_sort_tag_desc': '标签↓',
    'options.bm_empty': '暂无收藏',
    'options.bm_count_all': '共 {n} 条',
    'options.bm_count_filtered': '筛选出 {n} 条 / 共 {total} 条',
    'options.bm_edit': '编辑',
    'options.bm_delete': '删除',
    'options.bm_confirm_delete': '确定删除此收藏？',
    'options.bm_edit_title': '编辑收藏',
    'options.bm_field_title': '标题',
    'options.bm_field_favorite': '喜爱度',
    'options.bm_field_tags': '标签（点击切换）',
    'options.bm_cancel': '取消',
    'options.bm_save': '保存',

    // ---- options tag manager ----
    'options.tag_title': '标签管理',
    'options.tag_new_group_placeholder': '新分组名...',
    'options.tag_add_group': '添加分组',
    'options.tag_drag_sort': '拖拽排序',
    'options.tag_move_up': '上移',
    'options.tag_move_down': '下移',
    'options.tag_collapse': '收起',
    'options.tag_expand': '展开',
    'options.tag_collapse_all': '全部收起',
    'options.tag_expand_all': '全部展开',
    'options.tag_col_name': '名称',
    'options.tag_col_group': '分组',
    'options.tag_col_alias': '别名',
    'options.tag_col_marked_tags': '标记 Tags',
    'options.tag_col_actions': '操作',
    'options.tag_no_group': '未分组',
    'options.tag_delete': '删除',
    'options.tag_delete_group': '删除组',
    'options.tag_confirm_delete_group': '删除分组后，组内标签将变为未分组。确定？',
    'options.tag_confirm_delete': '确定删除此标签？',
    'options.tag_new_name_placeholder': '新标签名',
    'options.tag_add': '添加',
    'options.tag_add_alias_placeholder': '+别名',
    'options.tag_select': '+ 选择',

    // ---- options site config ----
    'options.site_title': '站点配置',
    'options.site_add': '+ 添加站点',
    'options.site_add_title': '添加站点',
    'options.site_edit_title': '编辑站点',
    'options.site_url_label': 'URL 正则 (匹配规则)',
    'options.site_url_placeholder': '例如: https://github\\.com/.*',
    'options.site_script_label': '站点脚本',
    'options.site_script_hint': '可用变量：title, labels, tags, preview, previewVideo。赋值即可设置。例如 preview = document.querySelector(\'meta[property="og:image"]\')?.content',
    'options.site_url_required': '请输入 URL 正则',
    'options.site_confirm_delete': '确定删除此站点配置？',
    'options.site_debug': '🧪 调试',
    'options.site_debug_title': '🧪 站点配置调试',
    'options.site_debug_run': '▶ 运行脚本',
    'options.site_debug_close': '关闭',
    'options.site_debug_no_script': '没有脚本可调试',
    'options.site_debug_no_page': '无法在此页面调试（不支持 chrome:// URL）',
    'options.site_debug_no_match': '当前页面 URL 不匹配规则',
    'options.bm_field_preview': '预览图片 URL',
    'options.bm_field_preview_video': '预览视频 URL',
    'popup.preview_label': '🖼',
    'popup.preview_video_label': '🎬',
    'popup.preview_suggest': '站点预览建议',
    'popup.preview_video_suggest': '站点预览视频建议',
    'popup.preview_accept': '使用',
    'popup.preview_video_accept': '使用',
    'popup.run_site_script': '运行站点脚本',
    'popup.site_suggest_title': '标题',
    'popup.site_suggest_preview': '🖼',
    'popup.site_suggest_preview_video': '🎬',
    'popup.site_suggest_tags': '🏷',
    'popup.site_suggest_apply': '应用',
    'options.bm_autoplay_videos': '自动播放视频',
    'options.bm_layout_list': '列表',
    'options.bm_layout_grid': '平铺',
    'options.bm_tile_size': '卡片大小',
    'options.bm_preview_only': '仅预览',

    // ---- guide ----
    'options.nav_guide': '📖 使用说明',
    'options.guide_title': '📖 使用说明',
    'options.guide_quick_start': '快速上手',
    'options.guide_quick_start_desc': '安装扩展后，在任意页面点击扩展图标打开弹窗。如果页面未收藏，你会看到标题、推荐标签和「收藏」按钮。点击标签即可用该标签收藏页面。',
    'options.guide_tag_title': '标签管理',
    'options.guide_tag_desc1': '标签是核心组织工具。每个标签属于一个分组（未指定则归入「未分组」）。',
    'options.guide_tag_li1': '<strong>创建分组：</strong>进入「标签管理」页，在顶部输入框输入分组名称，点击「添加分组」。分组支持拖拽排序。',
    'options.guide_tag_li2': '<strong>创建标签：</strong>在任意分组底部点击「+」，输入标签名后按回车。标签也支持拖拽排序。',
    'options.guide_tag_li3': '<strong>标签别名：</strong>点击标签进行编辑，在「别名」字段添加替代名称。搜索别名等同于搜索原名。例如：标签 "JavaScript" 添加别名 "JS"，搜索 "JS" 也能找到所有打了 "JavaScript" 标签的书签。',
    'options.guide_tag_li4': '<strong>标记标签：</strong>在标签编辑面板中，「标记标签」可以将一个标签关联到其他标签。搜索标签A时，打了其标记标签的书签也会出现。这创建了层级关系（如 "前端" 标记了 "React"、"Vue" — 搜索 "前端" 也能找到 "React"/"Vue" 的书签）。',
    'options.guide_tag_note': '提示：你可以在弹窗收藏页面时直接添加标签，也可以在 Options 搜索页通过标签选择器（🏷️ 按钮）添加。',
    'options.guide_site_title': '站点配置',
    'options.guide_site_desc1': '站点配置允许你编写自定义脚本，在访问匹配页面时自动运行，提取标题、标签、预览图等。',
    'options.guide_site_li1': '<strong>URL 匹配规则：</strong>正则表达式。当前页面 URL 匹配时脚本自动运行。示例：<code>youtube\\.com/watch</code>',
    'options.guide_site_li2': '<strong>脚本：</strong>JavaScript 代码，可直接读写以下预定义变量：<code>title</code>、<code>labels</code>、<code>tags</code>、<code>preview</code>、<code>previewVideo</code>。赋值即可设置。',
    'options.guide_site_example_title': '<strong>示例 — YouTube：</strong>',
    'options.guide_site_example_title2': '<strong>示例 — GitHub 仓库：</strong>',
    'options.guide_site_note': '注意：脚本在页面的 MAIN world 上下文中执行，可以访问完整 DOM。严格 CSP 的页面可能导致脚本执行失败，可使用站点配置页的「调试」功能测试。',
    'options.guide_preview_title': '预览与视频',
    'options.guide_preview_desc1': '每个书签可以设置预览图（preview）和预览视频（previewVideo）。设置方式：',
    'options.guide_preview_li1': '站点配置脚本自动提取',
    'options.guide_preview_li2': '在弹窗或 Options 页面手动编辑',
    'options.guide_preview_desc2': '在 Options 搜索页，预览以缩略图显示。鼠标悬停带有 previewVideo 的卡片时自动播放视频。开启「自动播放视频」后所有视频无需悬停即可播放。',
    'options.guide_sync_title': '数据同步',
    'options.guide_sync_desc1': '提供两种同步方式：',
    'options.guide_sync_li1': '<strong>Chrome 同步：</strong>使用 Chrome 账号在设备间同步数据，在设置中开启即可。上限约 100KB。',
    'options.guide_sync_li2': '<strong>Google Drive：</strong>备份数据到 Google Drive 应用数据文件夹，支持版本追踪和冲突检测，适合大数据量场景。',

    // ---- options config ----
    'options.config_title': '配置',
    'options.config_data': '数据管理',
    'options.config_backup_hint': '建议定期导出备份。卸载插件将清除所有数据（包括云端同步数据），重新安装后需导入恢复。',
    'options.config_export': '📦 导出数据',
    'options.config_import': '📥 导入数据',
    'options.config_clear': '清除所有数据',
    'options.config_clear_confirm': '清除所有数据不可恢复，确定？',
    'options.config_import_confirm': '导入将覆盖现有数据，确定？',
    'options.config_import_success': '导入成功',
    'options.config_import_failed': '导入失败: ',

    // ---- options sync ----
    'options.config_chrome_sync': 'Google 云端同步',
    'options.config_enable_chrome_sync': '启用 Chrome 同步',
    'options.config_chrome_sync_hint': '启用后，数据将自动通过 Chrome 同步到您的 Google 账号（chrome.storage.sync）。卸载插件会清除此数据。',
    'options.config_pull_chrome': '从 Chrome 同步拉取',
    'options.config_last_sync': '上次同步: ',
    'options.config_sync_disabled': '已禁用',

    // ---- options Google Drive ----
    'options.config_gd_title': '☁️ Google Drive 备份',
    'options.config_gd_hint': '数据存储在 Google Drive 的应用数据区（appDataFolder），与您的 Google 账号绑定，卸载插件也不会丢失。',
    'options.config_gd_auto': '自动同步到 Google Drive',
    'options.config_gd_auto_hint': '开启后，数据变更将自动推送到 Google Drive，带版本追踪和冲突检测。',
    'options.config_gd_auth': '🔑 授权 Google 账号',
    'options.config_gd_push': '📤 推送到 Google Drive',
    'options.config_gd_pull': '📥 从 Google Drive 拉取',
    'options.config_gd_last_sync': '上次 Google Drive 同步: ',
    'options.config_gd_authorizing': '授权中...',
    'options.config_gd_auth_success': '授权成功！可以推送或拉取数据了',
    'options.config_gd_auth_failed': '授权失败: ',
    'options.config_gd_pushing': '推送中...',
    'options.config_gd_push_success': '推送成功！(',
    'options.config_gd_push_failed': '推送失败: ',
    'options.config_gd_first_push': '首次推送中...',
    'options.config_gd_auto_on': '已开启自动同步并推送成功',
    'options.config_gd_auto_off': '已关闭自动同步',
    'options.config_gd_pulling': '拉取中...',
    'options.config_gd_pull_confirm': '从 Google Drive 拉取将覆盖本地数据，确定？',
    'options.config_gd_pull_success': '拉取成功，已更新本地数据',
    'options.config_gd_pull_no_data': '云端无新数据',
    'options.config_gd_pull_failed': '拉取失败: ',

    // ---- options language ----
    'options.config_language': '语言',
    'options.config_language_hint': '语言偏好会随数据同步。',

    // ---- options theme ----
    'options.config_theme': '主题',
    'options.config_theme_hint': '主题偏好会随数据同步。',
    'options.theme_system': '跟随系统',
    'options.theme_light': '浅色',
    'options.theme_dark': '深色',

    // ---- options tag picker ----
    'options.tag_picker_search': '搜索标签...',
    'options.tag_picker_close': '关闭',
    'options.tag_picker_create': '创建新标签「{name}」',

    // ---- sync pulling states ----
    'options.sync_pulling': '拉取中...',
    'options.sync_pull_success': '拉取成功，已更新',
    'options.sync_pull_no_data': '云端无新数据',
    'options.sync_pull_failed': '拉取失败: ',
    'options.sync_pushing': '推送中...',
    'options.sync_done': '已启用并同步完成',
    'options.sync_enabling': '拉取云端数据...',
    'options.sync_pushing_local': '推送本地数据...',

    // ---- conflict resolution ----
    'options.conflict_title': '同步冲突',
    'options.conflict_desc': '以下项目存在冲突变更，请为每项选择保留哪个版本。',
    'options.conflict_keep_local': '保留本地',
    'options.conflict_keep_remote': '保留远程',
    'options.conflict_apply': '应用',
    'options.conflict_no_conflicts': '无冲突',
    'options.conflict_type_bookmark': '书签',
    'options.conflict_type_tag': '标签',
    'options.conflict_type_tagGroup': '标签分组',
    'options.conflict_type_siteConfig': '站点配置',
    'options.config_gd_versioned': '版本同步（已启用冲突检测）',
    'options.config_gd_auto_hint': '开启后，数据变更将自动推送到 Google Drive，带版本追踪和冲突检测。',

    // ---- general ----
    'general.auth_failed': '授权失败',
    'general.no_cloud_data': '云端无备份数据',
  }
};

const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
];

let _currentLocale = 'en';

/** Set current locale */
function setLocale(code) {
  if (LOCALES[code]) {
    _currentLocale = code;
  }
}

/** Get current locale code */
function getLocale() {
  return _currentLocale;
}

/** Translate a key, with optional {param} substitution */
function t(key, params) {
  const dict = LOCALES[_currentLocale] || LOCALES.en;
  let text = dict[key] || LOCALES.en[key] || key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(new RegExp('\\{' + k + '\\}', 'g'), v);
    });
  }
  return text;
}

/** Apply locale to all DOM elements with data-i18n attribute
 *  data-i18n="key" → textContent
 *  data-i18n-html="key" → innerHTML (for keys containing HTML markup)
 *  data-i18n-placeholder="key" → placeholder
 *  data-i18n-title="key" → title attribute
 */
function applyLocale() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
}
