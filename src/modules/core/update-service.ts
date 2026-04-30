/**
 * 应用更新服务
 * 通过 GitHub Releases API 检查最新版本
 * 支持国内代理加速 + 直连 fallback
 * 支持设备 ABI 检测、APK 智能匹配、镜像加速下载 + 降级机制
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { GITHUB_REPO } from '@/modules/core/constants';
import { getAppVersion } from '@/services/app-info';
import { settingsStorage } from '@/services/storage';

// ==================== 代理配置 ====================

/** GitHub API 代理默认列表（国内加速），按测速优先级排序 */
export const DEFAULT_API_PROXIES = [
  // 测速优选（延迟低、带宽稳定）
  'https://ghfile.geekertao.top',       // 1.32s / 4.0Mbps
  'https://gh.felicity.ac.cn',          // 2.03s / 4.1Mbps
  'https://gh.llkk.cc',                 // 默认节点
  'https://github.chenc.dev',           // 4.2Mbps
  'https://github.dpik.top',            // 4.2Mbps
  'https://gh.bugdey.us.kg',            // 4.0Mbps
  'https://gh-proxy.com',               // 3.00s
  'https://ghfast.top',                 // 搜索引擎收录
  'https://ghproxy.net',                // 公益贡献
  'https://cdn.gh-proxy.com',           // 公益贡献
] as const;

/** GitHub Release 文件下载代理默认列表（国内加速），按带宽优先级排序 */
export const DEFAULT_DOWNLOAD_PROXIES = [
  // 高带宽优选
  'https://ghproxy.monkeyray.net',      // 10.1Mbps
  'https://gh.monlor.com',              // 8.3Mbps
  'https://gh.b52m.cn',                 // 5.1Mbps
  // 低延迟 + 稳定带宽
  'https://ghfile.geekertao.top',       // 1.32s / 4.0Mbps
  'https://gh.felicity.ac.cn',          // 2.03s / 4.1Mbps
  'https://github.dpik.top',            // 4.2Mbps
  'https://github.chenc.dev',           // 4.2Mbps
  'https://gh.bugdey.us.kg',            // 4.0Mbps
  'https://git.yylx.win',              // 3.9Mbps
  'https://ghm.078465.xyz',             // 3.9Mbps
  // 常用节点
  'https://gh.llkk.cc',                 // 默认节点
  'https://ghfast.top',                 // 搜索引擎收录
  'https://gh-proxy.com',               // 公益贡献
  'https://ghproxy.net',                // 公益贡献
  'https://cdn.gh-proxy.com',           // 公益贡献
] as const;

/** 单个代理请求超时（毫秒） */
const PROXY_TIMEOUT_MS = 8000;

// ==================== 镜像配置读取 ====================

/**
 * 获取生效的 API 代理镜像列表
 * 用户自定义 > 内置默认
 */
export async function getApiMirrors(): Promise<readonly string[]> {
  const settings = await settingsStorage.get();
  return settings.apiMirrors.length > 0 ? settings.apiMirrors : DEFAULT_API_PROXIES;
}

/**
 * 获取生效的下载代理镜像列表
 * 用户自定义 > 内置默认
 */
export async function getDownloadMirrors(): Promise<readonly string[]> {
  const settings = await settingsStorage.get();
  return settings.downloadMirrors.length > 0 ? settings.downloadMirrors : DEFAULT_DOWNLOAD_PROXIES;
}

// ==================== 类型定义 ====================

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
  downloadAssets: DownloadAsset[];
  /** 检测到的设备 ABI */
  deviceAbi: string;
  /** 推荐的 APK 资产 */
  recommendedAsset: DownloadAsset | null;
}

export interface DownloadAsset {
  name: string;
  url: string;
  size: number;
}

export type DownloadStatus =
  | { state: 'idle' }
  | { state: 'downloading'; progress: number; mirror: string }
  | { state: 'downloaded'; fileUri: string }
  | { state: 'installing' }
  | { state: 'error'; message: string };

export type DownloadProgressCallback = (status: DownloadStatus) => void;

// ==================== 版本比较 ====================

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

// ==================== 网络工具 ====================

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
async function fetchLatestRelease(): Promise<Record<string, unknown>> {
  const apiPath = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
  const mirrors = await getApiMirrors();

  // 先尝试国内代理
  for (const proxy of mirrors) {
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

// ==================== 设备 ABI 检测 ====================

/** ABI 优先级排序（从最优到次优） */
const ABI_PRIORITY = ['arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86'] as const;

/**
 * 获取设备支持的 ABI 架构
 * 在 Android 上通过 Platform.constants 获取，iOS 返回空字符串
 */
export function getDeviceAbi(): string {
  if (Platform.OS !== 'android') return '';

  // React Native 0.71+ 在 Android 上提供 supportedAbis
  const constants = Platform.constants as Record<string, unknown>;
  const supportedAbis = constants?.supportedAbis as string[] | undefined;

  if (supportedAbis && supportedAbis.length > 0) {
    // 返回优先级最高的 ABI
    for (const abi of ABI_PRIORITY) {
      if (supportedAbis.includes(abi)) return abi;
    }
    return supportedAbis[0];
  }

  // 降级：绝大多数现代 Android 设备为 arm64-v8a
  return 'arm64-v8a';
}

/**
 * 从 APK 文件名中检测 ABI 架构
 * 常见命名模式：
 * - app-arm64-v8a-release.apk
 * - app-universal-release.apk
 * - app-release.apk (无 ABI 标识，通常是 universal)
 */
function detectApkAbi(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.includes('arm64') || lower.includes('arm64-v8a')) return 'arm64-v8a';
  if (lower.includes('armeabi') || lower.includes('armeabi-v7a') || lower.includes('armv7')) return 'armeabi-v7a';
  if (lower.includes('x86_64') || lower.includes('x64')) return 'x86_64';
  if (lower.includes('x86') && !lower.includes('x86_64')) return 'x86';
  if (lower.includes('universal')) return 'universal';
  // 无 ABI 标识，可能是 universal
  return 'universal';
}

/**
 * 根据设备 ABI 选择最佳匹配的 APK 资产
 * 优先级：精确匹配 → universal → 第一个 APK
 */
export function selectBestApk(assets: DownloadAsset[], deviceAbi: string): DownloadAsset | null {
  if (assets.length === 0) return null;

  // 1. 精确匹配设备 ABI
  const exactMatch = assets.find((a) => detectApkAbi(a.name) === deviceAbi);
  if (exactMatch) return exactMatch;

  // 2. 查找 universal APK
  const universal = assets.find((a) => detectApkAbi(a.name) === 'universal');
  if (universal) return universal;

  // 3. 降级：如果设备是 arm64，尝试 armeabi-v7a（向后兼容）
  if (deviceAbi === 'arm64-v8a') {
    const armv7 = assets.find((a) => detectApkAbi(a.name) === 'armeabi-v7a');
    if (armv7) return armv7;
  }

  // 4. 最终降级：返回第一个 APK
  return assets[0];
}

// ==================== 检查更新 ====================

/**
 * 检查应用更新
 * @throws 网络错误时抛出异常
 */
export async function checkForUpdate(): Promise<UpdateInfo> {
  const data = await fetchLatestRelease();

  const latestVersion = (data.tag_name as string).replace(/^v/, '');
  const currentVersion = getAppVersion();

  const downloadAssets: DownloadAsset[] = (data.assets as { name: string; browser_download_url: string; size: number }[])
    .filter((a) => a.name.endsWith('.apk'))
    .map((a) => ({ name: a.name, url: a.browser_download_url, size: a.size }));

  const deviceAbi = getDeviceAbi();
  const recommendedAsset = selectBestApk(downloadAssets, deviceAbi);

  return {
    latestVersion,
    hasUpdate: compareVersions(latestVersion, currentVersion) > 0,
    htmlUrl: data.html_url as string,
    publishedAt: data.published_at as string,
    body: (data.body as string) || '',
    downloadAssets,
    deviceAbi,
    recommendedAsset,
  };
}

// ==================== APK 下载与安装 ====================

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 通过代理 URL 下载文件（带进度回调）
 * @returns 下载后的本地文件 URI，失败返回 null
 */
async function downloadFromUrl(
  url: string,
  fileUri: string,
  mirrorName: string,
  onProgress: DownloadProgressCallback
): Promise<string | null> {
  try {
    const downloadResumable = FileSystem.createDownloadResumable(
      url,
      fileUri,
      {},
      (progress) => {
        if (progress.totalBytesExpectedToWrite > 0) {
          const ratio = progress.totalBytesWritten / progress.totalBytesExpectedToWrite;
          onProgress({ state: 'downloading', progress: ratio, mirror: mirrorName });
        }
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (result && result.uri) {
      return result.uri;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 下载 APK 文件
 * 依次尝试：镜像加速 → 直连 GitHub → 降级提示
 */
export async function downloadApk(
  asset: DownloadAsset,
  onProgress: DownloadProgressCallback
): Promise<string> {
  const fileName = `update-${asset.name}`;
  const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

  // 清理旧文件
  try {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(fileUri);
    }
  } catch {
    // 忽略清理错误
  }

  onProgress({ state: 'downloading', progress: 0, mirror: '准备中...' });

  const mirrors = await getDownloadMirrors();

  // 1. 尝试镜像加速下载
  for (const proxy of mirrors) {
    const mirrorName = proxy.replace('https://', '').split('.')[0];
    const mirrorUrl = `${proxy}/${asset.url}`;
    const result = await downloadFromUrl(mirrorUrl, fileUri, mirrorName, onProgress);
    if (result) {
      onProgress({ state: 'downloaded', fileUri: result });
      return result;
    }
  }

  // 2. 直连 GitHub 下载
  onProgress({ state: 'downloading', progress: 0, mirror: 'GitHub 直连' });
  const directResult = await downloadFromUrl(asset.url, fileUri, 'GitHub 直连', onProgress);
  if (directResult) {
    onProgress({ state: 'downloaded', fileUri: directResult });
    return directResult;
  }

  onProgress({ state: 'error', message: '所有下载源均失败，请检查网络后重试' });
  throw new Error('所有下载源均失败');
}

/**
 * 安装已下载的 APK
 * 仅限 Android 平台
 */
export async function installApk(fileUri: string): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new Error('仅支持 Android 平台安装 APK');
  }

  try {
    // 获取 content URI 以供系统安装器访问
    const contentUri = await FileSystem.getContentUriAsync(fileUri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      type: 'application/vnd.android.package-archive',
      flags: 0x10000000, // FLAG_ACTIVITY_NEW_TASK
    });
  } catch (err) {
    throw new Error(`安装失败：${(err as Error).message}`);
  }
}
