# bookmark-tags

[简体中文](README-cn.md) | **English**

A Chrome bookmark manager with tag groups, favorites, site content extraction and Google Drive sync.

[**➜ Install from the Chrome Web Store**](https://chromewebstore.google.com/detail/bookmark-tags/pljamlkjekmanbdoabecjpbiickpohkj)

## Screenshots

| Bookmarks | Popup |
|---|---|
| ![Bookmarks](screenshots/options-bookmarks.png) | ![Popup](screenshots/popup.png) |

**Tag Manager**

![Tag Manager](screenshots/options-tags.png)

## Install

**Option 1 — Chrome Web Store (recommended)**

Open the [Chrome Web Store listing](https://chromewebstore.google.com/detail/bookmark-tags/pljamlkjekmanbdoabecjpbiickpohkj) and click *Add to Chrome*.

**Option 2 — Load from source**

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the project root

## Features

### Popup

- **Already bookmarked** — the toolbar icon is highlighted (purple) and shows the page's tags and rating; click a tag to see related bookmarks
- **Not bookmarked** — the icon is grey; shows recently used and suggested tags for one-click saving
- **Site script autofill** — on an unbookmarked page, extracts title / preview / previewVideo and suggests tags (click to create them)
- **Editable title** — the title can be edited whether or not the page is already bookmarked
- **Search** — search by title and tag keywords (including aliases and linked tags), multi-select tags (OR), filter by rating (>=), combined with AND
- **Grouped tags** — every group (including Ungrouped) has an input at the bottom for new tags; click a tag to add or remove it
- **Quick tags** — tags marked as quick appear as a chip row under the search box; one click searches that tag
- **Tag links** — a tag with a link shows a 🔗 on its chip; click it to open the link (does not toggle the tag)
- **Tag picker** — focusing a tag input opens the full grouped tag picker with search

### Options

1. **Bookmarks** — full-width layout, list/tile view toggle, previews shown by default, hover to play video, adjustable card size
2. **Tag Manager** — Ungrouped always visible; aliases and linked tags participate in search; linked tags chosen via the tag picker. Each row's **Edit** button opens a dialog for three per-tag options: a **jump link** (renders a 🔗 in the row), **⚡ quick tag** (shows it under the search box) and **🏠 home page** (feeds the new tab page)
3. **Site Config** — URL regex matching plus a custom script (can read/write title, labels, tags, preview, previewVideo), with a built-in debug tester
4. **Settings** — theme and language preferences; data export/import/clear; Chrome Sync and versioned Google Drive sync
5. **Guide** — a built-in guide covering tag management, site config, preview videos and data sync

### Home page

- A grid of **randomly sampled bookmarks** drawn from every tag marked 🏠, opened from **Settings → Home Page** or the 🏠 button in the popup
- A fresh sample on every load; **Shuffle** re-samples without reloading
- Deliberately **does not** declare `chrome_url_overrides.newtab`: Chrome offers no runtime way to toggle a new-tab override, and the usual workaround (redirecting to `chrome-search://local-ntp/…`) is an undocumented internal URL with reported breakage in newer Chrome. Your new tab page stays the browser default
- Three display modes — **Cards**, **Cards + preview** and **List** — switched from the header. The choice is stored in `bt_config.homeDisplay`, so it is remembered and travels with Chrome Sync / Google Drive
- Preview mode shows the bookmark's `preview` image, and playable `previewVideo` clips **on hover** (muted, looping). An **Auto-play videos** toggle plays them all straight away instead; it persists as `bt_config.homeAutoplay`
- Read-only: opening new tabs never writes to storage, so it causes no sync churn
- Empty states distinguish "no tag is marked 🏠 yet" (with a shortcut into the Tag Manager) from "home tags have no bookmarks"

### Theme

- The popup and options page share one palette and support **Follow System (default) / Light / Dark**, switchable in Options → Settings → Theme
- In Follow System mode no `data-theme` attribute is written — CSS `light-dark()` plus `color-scheme` respond to OS appearance changes natively, with **no page reload**
- The preference is stored in `bt_config.theme` and syncs with Chrome Sync / Google Drive
- `theme.js` applies the cached value from `localStorage` synchronously on load, so the first paint is already correct (no flash)

> ⚠️ Requires Chrome 123+ (for `light-dark()`). Note also that the popup used to be permanently dark — now that it follows the system, it renders light when your OS is in light mode.

## Quick start

1. Click the extension icon on any page and click a suggested tag to bookmark it
2. Go to Options → Tag Manager to create groups and tags
3. Go to Options → Site Config to set up extraction scripts for the sites you use
4. See Options → 📖 Guide for the full walkthrough

## Data model

| Model | Fields |
|------|--------|
| Bookmark | id, url, title, tags[], favorite(0-5), labels[], contentTags[], preview, previewVideo, createdAt, updatedAt |
| TagGroup | id, name, order |
| Tag | id, name, alias[], tags[] (other tagIds), groupId, order, link, quick, home |
| SiteConfig | id, urlPattern, script, updatedAt |
| Config | syncEnabled, lastSyncAt, gdAutoSync, gdBaseVersion, gdDeviceId, gdDirty, locale, theme |

The three optional `Tag` fields are **not** backfilled on read: a tag created before they existed simply has `undefined`, which every consumer treats as `''` / `false`. Backfilling in `listTags()` would make each legacy tag differ from its synced copy and register as a one-off conflict. `link` is validated against an `http(s)`/`ftp` allowlist on write, so the stored value is always safe to hand to `chrome.tabs.create`.

## Search logic

- **Aliases** — searching a tag's alias is equivalent to searching its name; works in both the popup and options
- **Linked tags** — if tag1 is linked to tag2, searching tag1 also matches pages tagged tag2
- The searched tagIds are expanded (aliases plus linked tags, expanded recursively)

## Site scripts

The `script` field of a site config can read and write these predefined variables:

- `title` — page title
- `labels` — array of label strings
- `tags` — array of tag strings (click to create when not yet bookmarked)
- `preview` — preview image URL
- `previewVideo` — preview video URL

Example:

```js
// URL Pattern: youtube\.com/watch
title = document.querySelector('yt-formatted-string.ytd-watch-metadata')?.textContent?.trim() || title;
preview = document.querySelector('link[rel="thumbnail"]')?.href || '';
previewVideo = location.href;
```

## Sync

- **Chrome Sync** — syncs across devices via `chrome.storage.sync`, limit roughly 100KB
- **Google Drive** — versioned sync to the Drive `appDataFolder`, with conflict detection and resolution

## License

[MIT](LICENSE) © 2026 21emerald
