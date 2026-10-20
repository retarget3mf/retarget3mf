import { describe, expect, it } from 'vitest';
import { decodeNativeMessages, encodeNativeMessage, isAllowedDownloadUrl, parseSlicerLink } from '../src/index.ts';

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
