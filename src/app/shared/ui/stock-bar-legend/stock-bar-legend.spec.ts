import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { expectNoAxeViolations } from '../../../../testing/expect-no-axe-violations';
import { StockBarLegend } from './stock-bar-legend';
import type { StockBarLegendLabels } from './stock-bar-legend';

const ENGLISH: StockBarLegendLabels = {
  part: 'Part, numbered in Cut order',
  kerf: 'Kerf',
  trim: 'Trim',
  offcut: 'Offcut, keep it',
  waste: 'Waste',
};

@Component({
  selector: 'wt-host',
  imports: [StockBarLegend],
  template: `<wt-stock-bar-legend [labels]="labels()" />`,
})
class Host {
  readonly labels = signal(ENGLISH);
}

async function render(): Promise<{ fixture: ComponentFixture<Host>; root: HTMLElement }> {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  return { fixture, root: fixture.nativeElement as HTMLElement };
}

function legend(root: HTMLElement): HTMLElement {
  const match = root.querySelector<HTMLElement>('wt-stock-bar-legend');
  if (!match) {
    throw new Error('No legend rendered.');
  }
  return match;
}

/** Each entry as `[swatch kind, swatch text, label]`. */
function entries(root: HTMLElement): [string | null, string, string][] {
  return [...legend(root).querySelectorAll('li')].map((item) => {
    const swatch = item.querySelector('[data-kind]');
    return [
      swatch?.getAttribute('data-kind') ?? null,
      swatch?.textContent.trim() ?? '',
      item.textContent.replace(swatch?.textContent ?? '', '').trim(),
    ];
  });
}

describe('StockBarLegend', () => {
  it('shows a swatch of each kind of segment with its label, a Part numbered as in the bar', async () => {
    const { root } = await render();

    expect(entries(root)).toEqual([
      ['part', '1', 'Part, numbered in Cut order'],
      ['kerf', '', 'Kerf'],
      ['trim', '', 'Trim'],
      ['offcut', '', 'Offcut, keep it'],
      ['waste', '', 'Waste'],
    ]);
  });

  it('follows new labels', async () => {
    const { fixture, root } = await render();

    fixture.componentInstance.labels.set({
      part: 'Pieza, numerada en orden de corte',
      kerf: 'Grosor de corte',
      trim: 'Saneado',
      offcut: 'Retal, guárdalo',
      waste: 'Desperdicio',
    });
    await fixture.whenStable();

    expect(entries(root).map(([, , label]) => label)).toEqual([
      'Pieza, numerada en orden de corte',
      'Grosor de corte',
      'Saneado',
      'Retal, guárdalo',
      'Desperdicio',
    ]);
  });

  // It explains the bars, which assistive technology skips: the text of each layout says it all.
  it('is hidden from assistive technology', async () => {
    const { root } = await render();

    expect(legend(root).getAttribute('aria-hidden')).toBe('true');
  });

  it('has no accessibility violations', async () => {
    const { root } = await render();

    await expectNoAxeViolations(root);
  });
});
