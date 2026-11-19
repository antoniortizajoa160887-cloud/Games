import { isNative, openExternal } from './platform';

declare const __BUILD_ID__: string;
declare const __APP_VERSION__: string;

/** The id of the build that is running now (see vite.config.ts). */
export const BUILD_ID = __BUILD_ID__;
export const APP_VERSION = __APP_VERSION__;

// The Android app is updated by downloading the newest APK, which CI publishes on this release.
export const RELEASE_PAGE = 'https://github.com/antoniortizajoa160887-cloud/Games/releases/tag/apk-latest';
const APK_RELEASE = 'https://api.github.com/repos/antoniortizajoa160887-cloud/Games/releases/tags/apk-latest';
const CHECK_EVERY_MS = 10 * 60 * 1000;

let shown = false;
let lastCheck = 0;

export interface Latest { build: string; download: string }

export async function fetchLatest(): Promise<Latest | null> {
  const r = await fetch(APK_RELEASE, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json' } });
  if (!r.ok) return null;
  const rel = (await r.json()) as { body?: string; assets?: { name: string; browser_download_url: string }[] };
  const build = /build:\s*([0-9a-f]+)/.exec(rel.body ?? '')?.[1];
  const apk = rel.assets?.find(a => a.name.endsWith('.apk'));
  return build && apk ? { build, download: apk.browser_download_url } : null;
}

function banner(latest: Latest) {
  if (shown) return;
  shown = true;
  const el = document.createElement('div');
  el.id = 'update-bar';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span>✨ A new version of Stellar Drop is ready.</span>`;
  const go = document.createElement('button');
  go.textContent = 'Download';
  go.onclick = () => openExternal(latest.download);
  const later = document.createElement('button');
  later.className = 'later';
  later.setAttribute('aria-label', 'Later');
  later.textContent = '✕';
  later.onclick = () => el.remove();
  el.append(go, later);
  document.body.append(el);
}

/** 'new' when a newer build exists, 'same' when up to date, 'unknown' when it can't tell. */
export async function checkForUpdate(force = false): Promise<'new' | 'same' | 'unknown'> {
  if (!force && (shown || !navigator.onLine || Date.now() - lastCheck < 30_000)) return 'unknown';
  lastCheck = Date.now();
  try {
    const latest = await fetchLatest();
    if (!latest) return 'unknown';
    if (latest.build !== BUILD_ID) {
      banner(latest);
      return 'new';
    }
    return 'same';
  } catch {
    return 'unknown'; // offline or rate-limited: try again later
  }
}

/** Checks now, every few minutes, and whenever the game comes back to the foreground. */
export function watchForUpdates() {
  if (import.meta.env.DEV || !isNative) return;
  void checkForUpdate();
  window.setInterval(() => void checkForUpdate(), CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void checkForUpdate(); });
}
