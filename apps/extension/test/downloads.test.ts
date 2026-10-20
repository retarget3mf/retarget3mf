import { describe, expect, it } from 'vitest';
import { projectDownload } from '../src/downloads.ts';

describe('projectDownload', () => {
  it('accepts .3mf files from model CDNs or model pages', () => {
    expect(projectDownload({ filename: '/d/a.3mf', url: 'https://makerworld.bblmw.com/x/a.3mf' })).toEqual({ path: '/d/a.3mf' });
    expect(projectDownload({ filename: '/d/a.3MF', url: 'https://cdn.example/a', referrer: 'https://www.printables.com/model/1-a' }))
      .toEqual({ path: '/d/a.3MF', site: 'printables', pageUrl: 'https://www.printables.com/model/1-a' });
  });

  it('ignores other files and other sites', () => {
    expect(projectDownload({ filename: '/d/a.stl', url: 'https://makerworld.bblmw.com/x/a.stl' })).toBeUndefined();
    expect(projectDownload({ filename: '/d/a.3mf', url: 'https://example.com/a.3mf', referrer: 'https://example.com/' })).toBeUndefined();
  });
});
