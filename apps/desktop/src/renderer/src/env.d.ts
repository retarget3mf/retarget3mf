/// <reference types="vite/client" />
import type { DesktopApi } from '../../shared/api.ts';

declare global {
  interface Window { desktop: DesktopApi }
}
