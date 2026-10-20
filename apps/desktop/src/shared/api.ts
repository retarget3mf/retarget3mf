import type { ConversionReport, FilamentMap, PrinterDefinition, PrinterId, ProjectFilament } from '@retarget3mf/core';

export type SlicerKind = 'flashstudio' | 'orca';

export interface SlicerInstall { kind: SlicerKind; name: string; path: string; /** App icon as a data URL, read from the installed app. */ icon?: string }

export type Theme = 'system' | 'light' | 'dark';
/** What happens when a .3mf is opened from the OS (double-click, "Open with"). */
export type OpenMode = 'auto' | 'review';

export interface Settings {
  printer?: PrinterId;
  slicer: SlicerKind;
  /** Overrides for detected slicer locations. */
  slicerPaths: Partial<Record<SlicerKind, string>>;
  output: 'next-to-original' | 'app-folder';
  openAfterConvert: boolean;
  theme: Theme;
  openMode: OpenMode;
}

export interface AppState {
  settings: Settings;
  printers: readonly PrinterDefinition[];
  slicers: SlicerInstall[];
  outputFolder: string;
}

export interface InspectResult {
  path: string;
  fileName: string;
  title: string;
  sourcePrinter: string;
  filaments: ProjectFilament[];
  plates: { id: number; thumbnail?: string }[];
}

export interface ConvertRequest { path: string; printer: PrinterId; slicer: SlicerKind; filamentMap?: FilamentMap }
export interface ConvertResult { outputPath: string; report: ConversionReport; markdown: string }

/** Pushed from the main process, e.g. after a file was opened from the OS. */
export type AppEvent =
  | { kind: 'open-project'; path: string }
  | { kind: 'show-result'; project: InspectResult; result: ConvertResult; launchError?: string }
  | { kind: 'error'; message: string };

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export interface DesktopApi {
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
  openInSlicer(path: string, slicer: SlicerKind): Promise<Result<void>>;
  showInFolder(path: string): Promise<void>;
  exportReport(result: ConvertResult, format: 'md' | 'json'): Promise<void>;
}
