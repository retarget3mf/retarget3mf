import type { ConversionReport, FilamentMap, PrinterDefinition, PrinterId, ProjectFilament } from '@retarget3mf/core';
import type { SourceSite } from '@retarget3mf/bridge';
import type { Accent, Theme } from '@retarget3mf/ui';

export type SlicerKind = 'flashstudio' | 'orca' | 'bambustudio' | 'crealityprint' | 'qidistudio' | 'elegooslicer' | 'prusaslicer';

export interface SlicerInstall { kind: SlicerKind; name: string; path: string; /** App icon as a data URL, read from the installed app. */ icon?: string }

export type { Accent, Theme };
/** A printer the user owns; each remembers its own slicer. */
export interface SavedPrinter { model: PrinterId; slicer: SlicerKind }
/** Which saved printer a dropped or OS-opened project is converted for. */
export type DropTarget = 'last' | 'default' | 'ask';

/** What happens when a .3mf is opened from the OS (double-click, "Open with") or arrives from the browser extension. */
export type OpenMode = 'auto' | 'review';
export const HISTORY_RETENTION = ['forever', '365', '90', '30'] as const;
export type HistoryRetention = (typeof HISTORY_RETENTION)[number];
/** `{name}`, `{printer}` and `{slicer}` are replaced; `.3mf` is appended. */
export const DEFAULT_FILE_NAME = '{name} - {printer}';

export interface Settings {
  /** The current (last used) printer and its slicer; always one of `printers`. */
  printer?: PrinterId;
  slicer: SlicerKind;
  printers: SavedPrinter[];
  defaultPrinter?: PrinterId;
  dropTarget: DropTarget;
  /** Merge similar colours and convert without asking when a project has more colours than slots. */
  autoCombine: boolean;
  /** Overrides for detected slicer locations. */
  slicerPaths: Partial<Record<SlicerKind, string>>;
  output: 'next-to-original' | 'app-folder';
  /** The folder for `output: 'app-folder'`; Documents/Retarget3MF when unset. */
  outputDir?: string;
  fileNamePattern: string;
  /** Drop filaments no object uses (else they stay while the printer has free slots). */
  removeUnused: boolean;
  /** Files from the browser extension: convert and open, or show the review screen. */
  extensionMode: OpenMode;
  autoUpdate: boolean;
  historyRetention: HistoryRetention;
  openAfterConvert: boolean;
  theme: Theme;
  accent: Accent;
  openMode: OpenMode;
}

/** Whether the browser extension can reach this app from the given browser. */
export interface BrowserStatus { browser: string; registered: boolean }

export interface AppState {
  settings: Settings;
  printers: readonly PrinterDefinition[];
  slicers: SlicerInstall[];
  outputFolder: string;
  browsers: BrowserStatus[];
  version: string;
  /** Installed builds update themselves; development runs do not. */
  packaged: boolean;
}

export interface InspectResult {
  path: string;
  fileName: string;
  title: string;
  sourcePrinter: string;
  sourceSlicer: string;
  filaments: ProjectFilament[];
  plates: { id: number; thumbnail?: string }[];
}

export interface ConvertRequest { path: string; printer: PrinterId; slicer: SlicerKind; filamentMap?: FilamentMap }
export interface ConvertResult { outputPath: string; report: ConversionReport; markdown: string; title: string; thumbnail?: string }

/** Where a project came from, when the browser extension handed it over. */
export interface ProjectOrigin { site: SourceSite; pageUrl: string }

export interface HistoryEntry {
  id: string;
  createdAt: string;
  title: string;
  inputPath: string;
  outputPath: string;
  printer: string;
  slicer: string;
  sourceSlicer: string;
  warnings: number;
  origin?: ProjectOrigin & { siteName: string };
  /** False when the converted file was moved or deleted outside the app. */
  exists: boolean;
  thumbnail?: string;
}

/** Pushed from the main process, e.g. after a file was opened from the OS. */
export type AppEvent =
  | { kind: 'open-project'; path: string; fromExtension?: boolean }
  | { kind: 'show-result'; project: InspectResult; result: ConvertResult; launchError?: string }
  | { kind: 'error'; message: string }
  /** Printer or slicer changed from outside the window (the extension popup). */
  | { kind: 'settings-changed' };

export type UpdateStatus = { kind: 'current' | 'available' | 'unavailable' | 'error'; version?: string; message?: string };

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export interface DesktopApi {
  /** `process.platform` of the main process, for platform-specific chrome (title bar controls). */
  platform: string;
  getState(): Promise<AppState>;
  saveSettings(patch: Partial<Settings>): Promise<AppState>;
  pickFile(): Promise<string | undefined>;
  pickSlicer(kind: SlicerKind): Promise<AppState>;
  refreshSlicers(): Promise<AppState>;
  /** Subscribes to main-process events; events raised before the window was ready are replayed. Returns an unsubscribe. */
  onEvent(listener: (event: AppEvent) => void): () => void;
  pathForFile(file: File): string;
  inspect(path: string): Promise<Result<InspectResult>>;
  convert(request: ConvertRequest): Promise<Result<ConvertResult>>;
  /** Stops the conversion in progress; its `convert` call then fails. */
  cancelConversion(): Promise<void>;
  openInSlicer(path: string, slicer: SlicerKind): Promise<Result<void>>;
  showInFolder(path: string): Promise<void>;
  exportReport(result: ConvertResult, format: 'md' | 'json'): Promise<void>;
  listHistory(): Promise<HistoryEntry[]>;
  historyReport(id: string): Promise<ConvertResult | undefined>;
  removeHistory(id: string, moveFileToTrash: boolean): Promise<HistoryEntry[]>;
  clearHistory(): Promise<HistoryEntry[]>;
  /** Chooses the folder for converted files and switches output to it. */
  pickOutputFolder(): Promise<AppState>;
  checkForUpdates(): Promise<UpdateStatus>;
  /** Opens a model page in the default browser; only known model-site pages are accepted. */
  openSourcePage(id: string): Promise<void>;
}
