/**
 * 应用更新服务
 * 通过 GitHub Releases API 检查最新版本
 * 支持国内代理加速 + 直连 fallback
 */

import { GITHUB_REPO } from '@/modules/core/constants';
import { getAppVersion } from '@/services/app-info';

/** GitHub API 代理列表（国内加速），按测速优先级排序 */
const GITHUB_API_PROXIES = [
  'https://github.chenc.dev',
  'https://github.dpik.top',
  'https://gh.bugdey.us.kg',
  'https://gh.felicity.ac.cn',
  'https://gh-proxy.com',
  'https://ghproxy.net',
] as const;

/** 单个代理请求超时（毫秒） */
const PROXY_TIMEOUT_MS = 8000;

export interface UpdateInfo {
  /** 最新版本号（如 "1.0.3"） */
  latestVersion: string;
  /** 是否有更新 */
  hasUpdate: boolean;
  /** Release 页面 URL */
  htmlUrl: string;
  /** 发布日期 */
  publishedAt: string;
  /** 更新说明 */
  body: string;
  /** APK 下载链接列表 */
  downloadAssets: { name: string; url: string; size: number }[];
}

/**
 * 比较 semver 版本号
 * @returns 1 if a > b, -1 if a < b, 0 if equal
 */
function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

/**
 * 带超时的 fetch
 */
function fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/**
 * 尝试通过代理或直连获取 GitHub Release 数据
 * 依次尝试：国内代理 → 直连 GitHub API
 */
async function fetchLatestRelease(): Promise<any> {
  const apiPath = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

  // 先尝试国内代理
  for (const proxy of GITHUB_API_PROXIES) {
    try {
      const proxyUrl = `${proxy}/${apiPath}`;
      const res = await fetchWithTimeout(proxyUrl, PROXY_TIMEOUT_MS, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (res.ok) return await res.json();
    } catch {
      // 此代理不可用，尝试下一个
    }
  }

  // 所有代理都失败，直连 GitHub API
  const res = await fetchWithTimeout(apiPath, 15000, {
    headers: { Accept: 'application/vnd.github+json' },
  });

  if (!res.ok) {
    throw new Error(`GitHub API 返回 ${res.status}`);
  }

  return await res.json();
}

/**
 * 检查应用更新
 * @throws 网络错误时抛出异常
 */
export async function checkForUpdate(): Promise<UpdateInfo> {
  const data = await fetchLatestRelease();

  const latestVersion = (data.tag_name as string).replace(/^v/, '');
  const currentVersion = getAppVersion();

  const downloadAssets = (data.assets as { name: string; browser_download_url: string; size: number }[])
    .filter((a) => a.name.endsWith('.apk'))
    .map((a) => ({ name: a.name, url: a.browser_download_url, size: a.size }));

  return {
    latestVersion,
    hasUpdate: compareVersions(latestVersion, currentVersion) > 0,
    htmlUrl: data.html_url,
    publishedAt: data.published_at,
    body: data.body || '',
    downloadAssets,
  };
}
