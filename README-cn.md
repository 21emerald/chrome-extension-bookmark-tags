# bookmark-tags

**简体中文** | [English](README.md)

Chrome 书签管理插件 — 支持标签分组、喜爱度评分、站点内容提取与 Google 云端同步。

[**➜ 从 Chrome 应用商店安装**](https://chromewebstore.google.com/detail/bookmark-tags/pljamlkjekmanbdoabecjpbiickpohkj)

## 截图

| 收藏管理 | 弹窗 |
|---|---|
| ![收藏管理](screenshots/options-bookmarks.png) | ![弹窗](screenshots/popup.png) |

**标签管理**

![标签管理](screenshots/options-tags.png)

## 安装

**方式一：Chrome 应用商店（推荐）**

直接前往 [Chrome 应用商店页面](https://chromewebstore.google.com/detail/bookmark-tags/pljamlkjekmanbdoabecjpbiickpohkj) 点击「添加至 Chrome」。

**方式二：从源码加载**

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本项目根目录

## 功能

### Popup 弹窗
- **已收藏页面**：图标高亮（紫色），显示已打标签和喜爱度，点击标签查看关联书签
- **未收藏页面**：图标灰色，显示最近使用/推荐标签，快速收藏
- **站点脚本自动填充**：未收藏页面自动提取 title/preview/previewVideo，建议 tag（点击后创建）
- **标题可编辑**：收藏和未收藏状态的标题都可以直接修改
- **搜索**：支持标题+标签关键词搜索（含 alias 和标记 tags），标签多选（OR），喜爱度筛选（>=），三者 AND 逻辑
- **分组标签**：每个分组（含未分组）底部可添加新标签，点击标签直接添加/移除
- **Tag Picker**：在添加标签输入框 focus 时弹出完整分组标签选择器，搜索+点击

### Options 管理页
1. **收藏管理**：全宽布局，支持列表/平铺模式切换，preview 默认显示，hover 播放视频，卡片大小可调
2. **标签管理**：未分组始终显示；别名和标记 Tags 在搜索中生效；标记 Tags 用 tag picker 选择
3. **站点配置**：URL 正则匹配 + 自定义脚本（可读写 title/labels/tags/preview/previewVideo），内置 Debug 测试
4. **配置**：主题与语言偏好；数据导出/导入/清除；Chrome 同步 + Google Drive 版本化同步
5. **使用说明**：内置 Guide 页面，覆盖标签管理、站点配置、预览视频、数据同步

### 主题
- popup 与 options 共用同一套配色，支持 **跟随系统（默认）/ 浅色 / 深色**，在 Options → Settings → Theme 中切换
- 跟随系统时不写 `data-theme` 属性，由 CSS `light-dark()` + `color-scheme` 原生响应系统外观变化，**无需刷新页面**
- 主题偏好存于 `bt_config.theme`，随 Chrome 同步 / Google Drive 一起同步
- 首屏由 `theme.js` 从 `localStorage` 缓存同步应用，避免加载瞬间闪烁

> ⚠️ 需要 Chrome 123+（`light-dark()` 支持）。另外注意：popup 此前固定为深色，改为跟随系统后，系统为浅色时 popup 会显示为浅色。

## 快速上手

1. 安装后在任意页面点击扩展图标，看到推荐标签点击即可收藏
2. 进入 Options → Tag Manager，创建分组和标签来组织书签
3. 进入 Options → Site Config，配置常用网站的自动提取脚本
4. 详见 Options → 📖 Guide

## 数据模型

| 模型 | 字段 |
|------|------|
| Bookmark | id, url, title, tags[], favorite(0-5), labels[], contentTags[], preview, previewVideo, createdAt, updatedAt |
| TagGroup | id, name, order |
| Tag | id, name, alias[], tags[]（其他 tagId）, groupId, order |
| SiteConfig | id, urlPattern, script, updatedAt |
| Config | syncEnabled, lastSyncAt, gdAutoSync, gdBaseVersion, gdDeviceId, gdDirty, locale, theme |

## 搜索逻辑

- **alias**：搜索 tag 的别名等同于搜索原名，popup 和 options 均生效
- **标记 Tags**：搜索 tag1 时，如果 tag1 被标记了 tag2，搜索 tag1 也能命中打 tag2 的页面
- 搜索 tagIds 会被展开（alias + 标记关联递归展开）

## 站点脚本

站点配置的 `script` 字段可直接读写以下预定义变量：
- `title` — 页面标题
- `labels` — 标签数组（字符串）
- `tags` — 标签数组（字符串，未收藏时点击创建）
- `preview` — 预览图 URL
- `previewVideo` — 预览视频 URL

示例：
```js
// URL Pattern: youtube\.com/watch
title = document.querySelector('yt-formatted-string.ytd-watch-metadata')?.textContent?.trim() || title;
preview = document.querySelector('link[rel="thumbnail"]')?.href || '';
previewVideo = location.href;
```

## 同步

- **Chrome Sync**：通过 chrome.storage.sync 在设备间同步，上限约 100KB
- **Google Drive**：版本化同步到 Google Drive appDataFolder，支持冲突检测和解决

## 许可

[MIT](LICENSE) © 2026 21emerald
