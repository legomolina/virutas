import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { expectNoAxeViolations } from '../../../../testing/expect-no-axe-violations';
import { Hatch } from './hatch';
import type { HatchPattern } from './hatch';

@Component({
  selector: 'wt-host',
  imports: [Hatch],
  template: `<span><wt-hatch [pattern]="pattern()" /></span
    ><span><wt-hatch pattern="cross" /></span>`,
})
class Host {
  readonly pattern = signal<HatchPattern>('single');
}

async function render(): Promise<{ fixture: ComponentFixture<Host>; root: HTMLElement }> {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  return { fixture, root: fixture.nativeElement as HTMLElement };
}

function hatches(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('wt-hatch')];
}

/**
 * What a hatch draws: the pattern its fill points at, as the direction of each of its lines.
 * A line along the pattern's height is drawn as a tall rect, one along its width as a wide rect.
 */
function drawing(hatch: HTMLElement): string[] {
  const fill = hatch.querySelector('svg > rect')?.getAttribute('fill') ?? '';
  const id = /^url\(#(?<id>[^)]+)\)$/u.exec(fill)?.groups?.['id'] ?? '';
  const pattern = hatch.querySelector(`pattern[id="${id}"]`);
  if (!pattern) {
    throw new Error(`The fill "${fill}" points at no pattern in this hatch.`);
  }
  return [...pattern.querySelectorAll('rect')].map((line) =>
    Number(line.getAttribute('height')) > Number(line.getAttribute('width')) ? 'along' : 'across',
  );
}

describe('Hatch', () => {
  it('draws diagonal lines one way for a single hatch and both ways for a cross hatch', async () => {
    const { root } = await render();
    const [single, cross] = hatches(root);

    expect(drawing(single)).toEqual(['along']);
    expect(drawing(cross)).toEqual(['along', 'across']);
    for (const hatch of [single, cross]) {
      expect(hatch.querySelector('pattern')?.getAttribute('patternTransform')).toBe('rotate(-45)');
    }
  });

  it('draws in the text colour, so it follows the ink of the theme and forced colours', async () => {
    const { root } = await render();

    for (const hatch of hatches(root)) {
      const lines = [...hatch.querySelectorAll('pattern rect')];
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.map((line) => line.getAttribute('fill'))).toEqual(
        lines.map(() => 'currentColor'),
      );
    }
  });

  it('keeps each hatch on a pattern of its own, so several on one page never mix up', async () => {
    const { root } = await render();
    const ids = hatches(root).map((hatch) => hatch.querySelector('pattern')?.id);

    expect(new Set(ids).size).toBe(2);
    expect(ids.every((id) => id !== undefined && id !== '')).toBe(true);
  });

  it('follows a new pattern and reflects it on the host for styling', async () => {
    const { fixture, root } = await render();

    fixture.componentInstance.pattern.set('cross');
    await fixture.whenStable();

    expect(drawing(hatches(root)[0])).toEqual(['along', 'across']);
    expect(hatches(root)[0].getAttribute('pattern')).toBe('cross');
  });

  it('is hidden from assistive technology', async () => {
    const { root } = await render();

    expect(hatches(root).map((hatch) => hatch.getAttribute('aria-hidden'))).toEqual([
      'true',
      'true',
    ]);
  });

  it('has no accessibility violations', async () => {
    const { root } = await render();

    await expectNoAxeViolations(root);
  });
});
