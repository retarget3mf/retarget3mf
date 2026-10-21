export { LINKS, releasesUrl } from '@retarget3mf/ui/links';

export const asset = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${path}`;
