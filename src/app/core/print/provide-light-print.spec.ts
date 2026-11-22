import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideLightPrint } from './provide-light-print';

/** A stand-in for the browser's `print` media query, which jsdom does not evaluate. */
class PrintMedia extends EventTarget {
  matches = false;

  /** Switches print media on or off, as print preview or an emulated media type does. */
  set(matches: boolean): void {
    this.matches = matches;
    this.dispatchEvent(Object.assign(new Event('change'), { matches }));
  }
}

function setUp(): { root: HTMLElement; printMedia: PrintMedia } {
  const printMedia = new PrintMedia();
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => (query === 'print' ? printMedia : undefined)),
  );
  TestBed.configureTestingModule({ providers: [provideLightPrint()] });
  // Creating the injector runs the provider.
  return { root: TestBed.inject(DOCUMENT).documentElement, printMedia };
}

describe('provideLightPrint', () => {
  beforeEach(() => {
    // <html> outlives each test: start with no forced theme.
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it('prints in the light theme and goes back to the screen theme afterwards', () => {
    const { root } = setUp();

    window.dispatchEvent(new Event('beforeprint'));
    expect(root.getAttribute('data-theme')).toBe('light');

    window.dispatchEvent(new Event('afterprint'));
    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  it('uses the light theme while print media is on, as when it is emulated', () => {
    const { root, printMedia } = setUp();

    printMedia.set(true);
    expect(root.getAttribute('data-theme')).toBe('light');

    printMedia.set(false);
    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  it('gives back a theme forced on the screen once printing ends', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    const { root, printMedia } = setUp();

    window.dispatchEvent(new Event('beforeprint'));
    printMedia.set(true);
    expect(root.getAttribute('data-theme')).toBe('light');

    window.dispatchEvent(new Event('afterprint'));
    printMedia.set(false);
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('stops following printing once the app is destroyed', () => {
    const { root, printMedia } = setUp();

    TestBed.resetTestingModule();
    window.dispatchEvent(new Event('beforeprint'));
    printMedia.set(true);

    expect(root.hasAttribute('data-theme')).toBe(false);
  });
});
