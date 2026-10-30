import { describe, expect, it } from 'vitest';
import { buildOpenLink, decodeNativeMessages, encodeNativeMessage, isAllowedDownloadUrl, parseOpenLink, parseSlicerLink, LINK_SCHEMES, linkScheme } from '../src/index.ts';

const signed = 'https://makerworld.bblmw.com/makerworld/model/X/123/instance/abc.3mf?at=1&exp=2&key=k&uid=9';

describe('parseSlicerLink', () => {
  it.each([
    ['bambustudio://open?file=', ''],
    ['bambustudioopen://', ''],
    ['bambusuite://open?file=', '&openMode=prepare'],
  ])('reads %s links', (prefix, suffix) => {
    const href = `${prefix}${encodeURIComponent(`${signed}&name=Carabiner_Heart`)}${suffix}`;
    expect(parseSlicerLink(href)).toEqual({ url: signed, name: 'Carabiner_Heart.3mf' });
  });

  it('reads Printables links the way PrusaSlicer does', () => {
    const url = 'https://files.printables.com/media/prints/1/3mf/2/benchy.3mf';
    expect(parseSlicerLink(`prusaslicer://open?file=${encodeURIComponent(url)}`)).toEqual({ url, name: 'benchy.3mf' });
    expect(parseSlicerLink(`prusaslicer://open/?file=${encodeURIComponent(url)}`)?.url).toBe(url);
    expect(isAllowedDownloadUrl(url)).toBe(true);
    expect(isAllowedDownloadUrl('https://printables.com.evil.example/x.3mf')).toBe(false);
  });

  it('reads Creality Cloud links without forwarding the login code', () => {
    const url = 'https://file2-cdn.creality.com/model/a.3mf?sig=1';
    expect(parseSlicerLink(`crealityprintlink://open?file=${encodeURIComponent(url)}&name=${encodeURIComponent('Skip Bo')}&code=SECRET&lang=en`)).toEqual({ url, name: 'Skip Bo.3mf' });
  });

  it('reads Snapmaker Space links', () => {
    const url = 'https://cdn-model.snapmaker.com/models/x.3mf?token=t';
    expect(parseSlicerLink(`snapmaker-orca://open?${new URLSearchParams({ file: url, name: 'Jumping Spider' })}`)).toEqual({ url, name: 'Jumping Spider.3mf' });
  });

  it('ignores other links', () => {
    expect(parseSlicerLink('https://makerworld.com')).toBeUndefined();
    expect(parseSlicerLink('bambustudio://open?file=%E0%A4%A')).toBeUndefined();
  });
});

describe('isAllowedDownloadUrl', () => {
  it('accepts the MakerWorld CDN over https only', () => {
    expect(isAllowedDownloadUrl(signed)).toBe(true);
    expect(isAllowedDownloadUrl(signed.replace('https', 'http'))).toBe(false);
    expect(isAllowedDownloadUrl('https://evil.example/makerworld.bblmw.com/x.3mf')).toBe(false);
    expect(isAllowedDownloadUrl('https://user:pw@makerworld.bblmw.com/x.3mf')).toBe(false);
    expect(isAllowedDownloadUrl('file:///etc/passwd')).toBe(false);
  });
});

describe('native message framing', () => {
  it('round-trips split frames', () => {
    const a = encodeNativeMessage({ id: 1, type: 'ping' });
    const b = encodeNativeMessage({ id: 2, type: 'open', name: 'ü' });
    const joined = new Uint8Array([...a, ...b.subarray(0, 5)]);
    const first = decodeNativeMessages(joined);
    expect(first.messages).toEqual([{ id: 1, type: 'ping' }]);
    const second = decodeNativeMessages(new Uint8Array([...first.rest, ...b.subarray(5)]));
    expect(second.messages).toEqual([{ id: 2, type: 'open', name: 'ü' }]);
    expect(second.rest).toHaveLength(0);
  });
});

describe('retarget3mf:// links', () => {
  const link = { url: 'https://files.printables.com/media/prints/1/3mf/2/a.3mf', name: 'a.3mf', site: 'printables' as const, pageUrl: 'https://www.printables.com/model/1-a' };

  it('round-trips an open request', () => {
    expect(parseOpenLink(buildOpenLink(link))).toEqual(link);
  });

  it('rejects other hosts and sites and drops off-site page URLs', () => {
    expect(parseOpenLink(buildOpenLink({ ...link, url: 'https://evil.example/a.3mf' }))).toBeUndefined();
    expect(parseOpenLink(buildOpenLink({ ...link, site: 'nope' as never }))).toBeUndefined();
    expect(parseOpenLink(buildOpenLink({ ...link, pageUrl: 'javascript:alert(1)' }))?.pageUrl).toBe('');
    expect(parseOpenLink('bambustudio://open?url=x')).toBeUndefined();
  });
});

describe('linkScheme', () => {
  it('names the slicer scheme of a model site link, case-insensitively', () => {
    expect(linkScheme('PrusaSlicer://open?file=https%3A%2F%2Ffiles.printables.com%2Fa.3mf')).toBe('prusaslicer');
    expect(linkScheme('snapmaker-orca://open?file=x')).toBe('snapmaker-orca');
    expect(linkScheme('retarget3mf://open?url=x')).toBeUndefined();
    expect(linkScheme('https://makerworld.com/')).toBeUndefined();
  });

  it('maps every scheme to the site whose button launches it', () => {
    expect(LINK_SCHEMES.bambustudioopen.site).toBe('makerworld');
    expect(LINK_SCHEMES.crealityprintlink.site).toBe('crealitycloud');
    expect(Object.keys(LINK_SCHEMES).every((s) => linkScheme(`${s}://open`) === s)).toBe(true);
  });
});
