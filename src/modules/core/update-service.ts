/**
 * 应用更新服务
 * 通过 GitHub Releases API 检查最新版本
 */

import { GITHUB_REPO } from '@/modules/core/constants';
import { getAppVersion } from '@/services/app-info';

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
 * 检查应用更新
 * @throws 网络错误时抛出异常
 */
export async function checkForUpdate(): Promise<UpdateInfo> {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json' },
  });

  if (!res.ok) {
    throw new Error(`GitHub API 返回 ${res.status}`);
  }

  const data = await res.json();

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
