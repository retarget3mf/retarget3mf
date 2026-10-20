import type { ConversionReport, FilamentMap, PrinterDefinition, PrinterId, ProjectFilament } from '@retarget3mf/core';

export type SlicerKind = 'flashstudio' | 'orca';

export interface SlicerInstall { kind: SlicerKind; name: string; path: string }

export interface Settings {
  printer?: PrinterId;
  slicer: SlicerKind;
  /** Overrides for detected slicer locations. */
  slicerPaths: Partial<Record<SlicerKind, string>>;
  output: 'next-to-original' | 'app-folder';
  openAfterConvert: boolean;
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

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export interface DesktopApi {
  getState(): Promise<AppState>;
  saveSettings(patch: Partial<Settings>): Promise<AppState>;
  pickFile(): Promise<string | undefined>;
  pickSlicer(kind: SlicerKind): Promise<AppState>;
  pathForFile(file: File): string;
  inspect(path: string): Promise<Result<InspectResult>>;
  convert(request: ConvertRequest): Promise<Result<ConvertResult>>;
  openInSlicer(path: string, slicer: SlicerKind): Promise<Result<void>>;
  showInFolder(path: string): Promise<void>;
  exportReport(result: ConvertResult, format: 'md' | 'json'): Promise<void>;
}
