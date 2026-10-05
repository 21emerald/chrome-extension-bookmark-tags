// ============================================================
// bookmark-tags theme.js — Light / Dark / System 主题
// ============================================================
// 在 <head> 中、样式表之前加载，顶层代码在解析阶段同步执行，
// 因此 data-theme 在首次绘制前就已就位（无闪烁）。
//
// 注意：MV3 默认 CSP 为 script-src 'self'，内联 <script> 会被静默阻止，
// 所以这段逻辑必须是独立文件。
//
// 双层策略：
//   1. localStorage 缓存 —— 同步读取，负责首屏无闪烁
//   2. chrome.storage.local 的 bt_config.theme —— 唯一真源，异步校正

const BT_THEMES = ['system', 'light', 'dark'];
const BT_THEME_LS_KEY = 'btTheme';

/** 非法/缺失的值一律落到 'system' */
function btNormalizeTheme(v) {
  return BT_THEMES.includes(v) ? v : 'system';
}

/** 'system' → 移除属性，交给 CSS 的 prefers-color-scheme */
function btApplyTheme(theme) {
  const t = btNormalizeTheme(theme);
  const el = document.documentElement;
  if (t === 'system') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', t);
}

/** 镜像到 localStorage，供下次加载同步应用 */
function btCacheTheme(theme) {
  try { localStorage.setItem(BT_THEME_LS_KEY, btNormalizeTheme(theme)); } catch (e) {}
}

// ---- 首屏同步应用（localStorage 可能被禁用，失败时静默回落到 system）----
try {
  const cached = localStorage.getItem(BT_THEME_LS_KEY);
  if (cached) btApplyTheme(cached);
} catch (e) {}

// ---- 异步校正为真源 ----
try {
  chrome.storage.local.get('bt_config', r => {
    const t = btNormalizeTheme(r && r.bt_config && r.bt_config.theme);
    btApplyTheme(t);
    btCacheTheme(t);
  });
} catch (e) {}

window.BTTheme = {
  apply: btApplyTheme,
  cache: btCacheTheme,
  normalize: btNormalizeTheme,
  THEMES: BT_THEMES,
};
