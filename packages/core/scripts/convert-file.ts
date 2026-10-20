// Dev helper, not a shipped CLI: node packages/core/scripts/convert-file.ts <in.3mf> [printer] [slicer]
import { readFileSync, writeFileSync } from 'node:fs';
import { convert, reportToMarkdown, type PrinterId, type SlicerId } from '../src/index.ts';

const [input, printer = 'ad5x-0.4', slicer = 'flashstudio'] = process.argv.slice(2);
if (!input) throw new Error('usage: convert-file.ts <in.3mf> [printer] [slicer]');
const { output, report } = await convert(readFileSync(input), { printer: printer as PrinterId, slicer: slicer as SlicerId });
const out = input.replace(/\.3mf$/i, ` - ${printer}.3mf`);
writeFileSync(out, output);
writeFileSync(out.replace(/\.3mf$/, '.report.md'), reportToMarkdown(report));
console.log(`${out}\n${report.warnings.map((w) => `warning: ${w}`).join('\n')}`);
