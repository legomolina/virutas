import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { expectNoAxeViolations } from '../../../../testing/expect-no-axe-violations';
import { StockBar } from './stock-bar';
import type { StockBarSegment } from './stock-bar';

/** 1 800 mm Stock: 5 mm Trim, shelf 1 100 mm, apron 380 mm, Offcut 304 mm, 3 mm Kerf. */
const WITH_OFFCUT: readonly StockBarSegment[] = [
  { kind: 'trim', length: 5 },
  { kind: 'part', length: 1100, number: 1, label: '1 100 mm' },
  { kind: 'kerf', length: 3 },
  { kind: 'part', length: 380, number: 2, label: '380 mm' },
  { kind: 'kerf', length: 3 },
  { kind: 'offcut', length: 304, label: '304 mm' },
  { kind: 'trim', length: 5 },
];

/** 2 400 mm Stock with a 30 mm spacer (1.25 % of it) and 8 mm of Waste. */
const WITH_SHORT_PART: readonly StockBarSegment[] = [
  { kind: 'trim', length: 5 },
  { kind: 'part', length: 900, number: 1, label: '900 mm' },
  { kind: 'kerf', length: 3 },
  { kind: 'part', length: 30, number: 2, label: '30 mm' },
  { kind: 'kerf', length: 3 },
  { kind: 'part', length: 900, number: 3, label: '900 mm' },
  { kind: 'kerf', length: 3 },
  { kind: 'part', length: 540, number: 4, label: '540 mm' },
  { kind: 'kerf', length: 3 },
  { kind: 'waste', length: 8 },
  { kind: 'trim', length: 5 },
];

@Component({
  selector: 'wt-host',
  imports: [StockBar],
  template: `<wt-stock-bar [segments]="segments()" [offcutTerm]="offcutTerm()" />`,
})
class Host {
  readonly segments = signal<readonly StockBarSegment[]>(WITH_OFFCUT);
  readonly offcutTerm = signal('Offcut');
}

async function render(
  segments: readonly StockBarSegment[],
): Promise<{ fixture: ComponentFixture<Host>; root: HTMLElement }> {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.segments.set(segments);
  await fixture.whenStable();
  return { fixture, root: fixture.nativeElement as HTMLElement };
}

function bar(root: HTMLElement): HTMLElement {
  const match = root.querySelector<HTMLElement>('wt-stock-bar');
  if (!match) {
    throw new Error('No stock bar rendered.');
  }
  return match;
}

/** Each drawn segment as `[kind, flex-grow, text]`. */
function drawn(root: HTMLElement): [string | null, string, string][] {
  return [...bar(root).querySelectorAll<HTMLElement>('[data-kind]')].map((segment) => [
    segment.getAttribute('data-kind'),
    segment.style.flexGrow,
    [...segment.children].map((child) => child.textContent.trim()).join(' | '),
  ]);
}

/** The numbers moved under the bar, as `[number, offset from the start]`. */
function markers(root: HTMLElement): [string, string][] {
  return [...bar(root).querySelectorAll<HTMLElement>('[data-marker]')].map((marker) => [
    marker.textContent.trim(),
    marker.style.insetInlineStart,
  ]);
}

describe('StockBar', () => {
  it('draws each segment in order, sized in proportion to its length', async () => {
    const { root } = await render(WITH_OFFCUT);

    expect(drawn(root).map(([kind, grow]) => [kind, grow])).toEqual([
      ['trim', '5'],
      ['part', '1100'],
      ['kerf', '3'],
      ['part', '380'],
      ['kerf', '3'],
      ['offcut', '304'],
      ['trim', '5'],
    ]);
  });

  it('labels each Part with its number and length and the Offcut with its name and length', async () => {
    const { root } = await render(WITH_OFFCUT);

    expect(drawn(root).map(([, , text]) => text)).toEqual([
      '',
      '1 | 1 100 mm',
      '',
      '2 | 380 mm',
      '',
      'Offcut | 304 mm',
      '',
    ]);
  });

  it('names the Offcut with the word it is given', async () => {
    const { fixture, root } = await render(WITH_OFFCUT);

    fixture.componentInstance.offcutTerm.set('Retal');
    await fixture.whenStable();

    expect(drawn(root)[5]).toEqual(['offcut', '304', 'Retal | 304 mm']);
  });

  it('keeps Trim, Kerf and Waste as unlabelled segments of their own', async () => {
    const { root } = await render(WITH_SHORT_PART);

    expect(drawn(root).filter(([kind]) => kind === 'waste')).toEqual([['waste', '8', '']]);
  });

  it('moves the number of a Part under 2 % of the Stock under the bar, at its middle', async () => {
    const { root } = await render(WITH_SHORT_PART);

    // The spacer runs from 908 mm to 938 mm of 2 400 mm: its middle is 923 / 2 400 of the way.
    const [[number, offset]] = markers(root);
    expect(number).toBe('2');
    expect(parseFloat(offset)).toBeCloseTo((923 / 2400) * 100, 6);
    expect(offset).toMatch(/%$/);
    expect(drawn(root)[3]).toEqual(['part', '30', '']);
  });

  it('keeps the number of a Part of exactly 2 % of the Stock in the bar', async () => {
    const { root } = await render([
      { kind: 'part', length: 48, number: 1, label: '48 mm' },
      { kind: 'waste', length: 2352 },
    ]);

    expect(markers(root)).toEqual([]);
    expect(drawn(root)[0]).toEqual(['part', '48', '1 | 48 mm']);
  });

  it('shows no markers under the bar when every Part holds its number', async () => {
    const { root } = await render(WITH_OFFCUT);

    expect(bar(root).querySelector('[data-markers]')).toBeNull();
  });

  it('follows new segments', async () => {
    const { fixture, root } = await render(WITH_OFFCUT);

    fixture.componentInstance.segments.set([{ kind: 'part', length: 2400, number: 1, label: 'x' }]);
    await fixture.whenStable();

    expect(drawn(root)).toEqual([['part', '2400', '1 | x']]);
  });

  // The text of the layout says everything the bar does, so assistive technology skips it.
  it('is hidden from assistive technology, with no name of its own', async () => {
    const { root } = await render(WITH_SHORT_PART);

    expect(bar(root).getAttribute('aria-hidden')).toBe('true');
    expect(bar(root).querySelector('[role], [aria-label], [title]')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { root } = await render(WITH_SHORT_PART);

    await expectNoAxeViolations(root);
  });
});
