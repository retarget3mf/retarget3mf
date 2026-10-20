import { isAllowedDownloadUrl, isSitePageUrl, SITE_INFO, type SourceSite } from '@retarget3mf/bridge';

/** Optional permissions for passive mode, granted from the popup. */
export const WATCH_PERMISSIONS = { permissions: ['downloads', 'notifications'] } satisfies Browser.permissions.Permissions;
export const NOTIFICATION_PREFIX = 'retarget3mf-download-';

export interface DownloadInfo { filename: string; url: string; finalUrl?: string; referrer?: string }
export interface ProjectDownload { path: string; site?: SourceSite; pageUrl?: string }

/** A finished .3mf from a model site (its CDN, or a download started on one of its pages); anything else is ignored. */
export function projectDownload(item: DownloadInfo): ProjectDownload | undefined {
  if (!/\.3mf$/i.test(item.filename)) return undefined;
  const referrer = item.referrer ?? '';
  const site = (Object.keys(SITE_INFO) as SourceSite[]).find((s) => isSitePageUrl(referrer, s));
  if (!site && !isAllowedDownloadUrl(item.finalUrl || item.url)) return undefined;
  return { path: item.filename, ...(site && { site, pageUrl: referrer }) };
}
