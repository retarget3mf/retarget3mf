import { describe, expect, it } from 'vitest';
import { bambuProject } from '../../../packages/core/test/fixtures.ts';
import { convertInBrowser, downloadProject } from '../src/inBrowser.ts';

const URL_OK = 'https://files.printables.com/media/prints/1/3mf/2/cube.3mf';
const fakeFetch = (body: Uint8Array, url = URL_OK, status = 200) =>
  (async () => Object.defineProperty(new Response(body as BodyInit, { status }), 'url', { value: url })) as unknown as typeof fetch;

describe('in-browser conversion', () => {
  it('downloads only zip bodies from allowlisted hosts', async () => {
    const project = bambuProject();
    expect(await downloadProject(URL_OK, fakeFetch(project))).toEqual(project);
    await expect(downloadProject('https://evil.example/a.3mf', fakeFetch(project))).rejects.toThrow(/not from a supported/);
    await expect(downloadProject(URL_OK, fakeFetch(project, 'https://evil.example/a.3mf'))).rejects.toThrow(/redirected/);
    await expect(downloadProject(URL_OK, fakeFetch(new TextEncoder().encode('<html>')))).rejects.toThrow(/not a 3MF/);
    await expect(downloadProject(URL_OK, fakeFetch(project, URL_OK, 403))).rejects.toThrow(/HTTP 403/);
  });

  it('converts with merged colours and names the file for the printer', async () => {
    const r = await convertInBrowser(bambuProject(), 'cube.3mf', 'adventurer-5m-0.4', 'orca');
    expect(r.fileName).toBe('cube - Adventurer 5M.3mf');
    expect(r.report.target.printer).toBe('Flashforge Adventurer 5M');
    expect(r.output[0]).toBe(0x50);
  });
});
