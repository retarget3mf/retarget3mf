import type { PrinterDefinition } from '@retarget3mf/core';

/** `<name> - <printer model>.3mf`, the same naming as the desktop app. */
export function outputName(fileName: string, printer: PrinterDefinition): string {
  const base = fileName.replace(/\.3mf$/i, '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || 'model';
  return `${base} - ${printer.displayName.replace(new RegExp(`^${printer.vendor} `), '')}.3mf`;
}

export function saveFile(data: BlobPart, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export { stored } from '@retarget3mf/ui';
