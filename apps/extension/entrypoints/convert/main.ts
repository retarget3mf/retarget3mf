import { isAllowedDownloadUrl, isSitePageUrl, SITE_INFO, type SourceSite } from '@retarget3mf/bridge';
import { ConversionError, PRINTERS, type SlicerId } from '@retarget3mf/core';
import { convertInBrowser, downloadProject, InBrowserError } from '../../src/inBrowser.ts';

const SLICER_NAMES: Record<SlicerId, string> = { flashstudio: 'Flash Studio', orca: 'OrcaSlicer', bambustudio: 'Bambu Studio' };
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const query = new URLSearchParams(location.search);
const url = query.get('url') ?? '';
const name = query.get('name') || 'model.3mf';
const site = query.get('site') as SourceSite;
const pageUrl = query.get('page') ?? '';

const printerSelect = $<HTMLSelectElement>('printer');
const slicerSelect = $<HTMLSelectElement>('slicer');
const button = $<HTMLButtonElement>('convert');
const status = $('status');
const error = $('error');

function describeProject(): void {
  const el = $('project');
  el.textContent = `${name.replace(/\.3mf$/i, '')}`;
  if (site in SITE_INFO && isSitePageUrl(pageUrl, site)) {
    const link = document.createElement('a');
    link.href = pageUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = SITE_INFO[site].name;
    el.append(' from ', link);
  }
}

function fillPrinters(selected: string | undefined): void {
  const vendors = [...new Set(PRINTERS.map((p) => p.vendor))];
  for (const vendor of vendors) {
    const group = document.createElement('optgroup');
    group.label = vendor;
    for (const p of PRINTERS.filter((x) => x.vendor === vendor)) group.append(new Option(p.displayName, p.id, false, p.id === selected));
    printerSelect.append(group);
  }
}

function fillSlicers(selected: string | undefined): void {
  const printer = PRINTERS.find((p) => p.id === printerSelect.value) ?? PRINTERS[0]!;
  const keep = printer.slicers.includes(selected as SlicerId) ? selected : printer.slicers[0];
  slicerSelect.replaceChildren(...printer.slicers.map((s) => new Option(SLICER_NAMES[s], s, false, s === keep)));
}

function showResult(result: Awaited<ReturnType<typeof convertInBrowser>>): void {
  const slicer = SLICER_NAMES[slicerSelect.value as SlicerId];
  $('summary').textContent = `Converted “${result.title}” for ${result.report.target.printer}.`;
  const download = $<HTMLAnchorElement>('download');
  download.href = URL.createObjectURL(new Blob([result.output as BlobPart], { type: 'model/3mf' }));
  download.download = result.fileName;
  download.textContent = `Download ${result.fileName}`;
  $('howto').textContent = `Open it in ${slicer} with File → Open Project.`;
  $('warnings').replaceChildren(...result.report.warnings.map((w) => Object.assign(document.createElement('li'), { textContent: w })));
  $('filaments').querySelector('tbody')!.replaceChildren(...result.report.filaments.map((f) => {
    const row = document.createElement('tr');
    const swatch = Object.assign(document.createElement('span'), { className: 'swatch' });
    swatch.style.background = /^#[0-9a-f]{6,8}$/i.test(f.colour) ? f.colour : 'transparent';
    const cells = [String(f.to), f.type, f.preset].map((t) => Object.assign(document.createElement('td'), { textContent: t }));
    const colour = document.createElement('td');
    colour.append(swatch, f.colour);
    row.append(colour, ...cells);
    return row;
  }));
  $('result').hidden = false;
}

async function run(): Promise<void> {
  button.disabled = true;
  error.hidden = true;
  $('result').hidden = true;
  try {
    await browser.storage.local.set({ printer: printerSelect.value, slicer: slicerSelect.value });
    status.textContent = 'Downloading…';
    const bytes = await downloadProject(url);
    status.textContent = 'Converting…';
    showResult(await convertInBrowser(bytes, name, printerSelect.value, slicerSelect.value as SlicerId));
    status.textContent = '';
  } catch (e) {
    console.error(e);
    status.textContent = '';
    error.textContent = e instanceof InBrowserError || e instanceof ConversionError ? e.message : 'Something went wrong while converting. Please report this model with its link.';
    error.hidden = false;
  } finally {
    button.disabled = false;
  }
}

describeProject();
const saved = (await browser.storage.local.get(['printer', 'slicer'])) as { printer?: string; slicer?: string };
fillPrinters(saved.printer);
fillSlicers(saved.slicer);
printerSelect.addEventListener('change', () => fillSlicers(slicerSelect.value));
button.addEventListener('click', () => void run());
if (!isAllowedDownloadUrl(url)) {
  button.disabled = true;
  error.textContent = 'This page was opened without a supported project link. Start from a model page.';
  error.hidden = false;
}
