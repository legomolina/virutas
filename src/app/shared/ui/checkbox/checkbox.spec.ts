import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { expectNoAxeViolations } from '../../../../testing/expect-no-axe-violations';
import { Checkbox } from './checkbox';

@Component({
  selector: 'wt-host',
  imports: [Checkbox],
  template: `<wt-checkbox [label]="label()" [(checked)]="everyStock" />`,
})
class Host {
  readonly label = signal('Show every Stock');
  readonly everyStock = signal(false);
}

async function render(): Promise<{ fixture: ComponentFixture<Host>; root: HTMLElement }> {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  return { fixture, root: fixture.nativeElement as HTMLElement };
}

/** The checkbox whose visible label is `label`. */
function checkbox(root: HTMLElement, label: string): HTMLInputElement {
  const match = [...root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find(
    (input) => [...(input.labels ?? [])].some((l) => l.textContent.trim() === label),
  );
  if (!match) {
    throw new Error(`No checkbox labelled "${label}".`);
  }
  return match;
}

describe('Checkbox', () => {
  it('is a native checkbox named by the label it is given', async () => {
    const { fixture, root } = await render();
    expect(checkbox(root, 'Show every Stock')).toBeInstanceOf(HTMLInputElement);

    fixture.componentInstance.label.set('Mostrar cada material por separado');
    await fixture.whenStable();

    expect(checkbox(root, 'Mostrar cada material por separado')).toBeInstanceOf(HTMLInputElement);
    expect(root.querySelectorAll('input[type="checkbox"]')).toHaveLength(1);
  });

  it('shows the bound state', async () => {
    const { fixture, root } = await render();
    expect(checkbox(root, 'Show every Stock').checked).toBe(false);

    fixture.componentInstance.everyStock.set(true);
    await fixture.whenStable();

    expect(checkbox(root, 'Show every Stock').checked).toBe(true);
  });

  it('updates the bound state when it is checked and unchecked', async () => {
    const { fixture, root } = await render();

    checkbox(root, 'Show every Stock').click();
    await fixture.whenStable();
    expect(fixture.componentInstance.everyStock()).toBe(true);

    checkbox(root, 'Show every Stock').click();
    await fixture.whenStable();
    expect(fixture.componentInstance.everyStock()).toBe(false);
  });

  it('can be checked by clicking its label', async () => {
    const { fixture, root } = await render();

    const label = root.querySelector('label');
    expect(label?.textContent.trim()).toBe('Show every Stock');
    label?.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.everyStock()).toBe(true);
  });

  it('has no accessibility violations, unchecked or checked', async () => {
    const { fixture, root } = await render();
    await expectNoAxeViolations(root);

    fixture.componentInstance.everyStock.set(true);
    await fixture.whenStable();

    await expectNoAxeViolations(root);
  });
});
