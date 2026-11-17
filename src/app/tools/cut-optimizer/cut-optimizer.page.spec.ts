import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { SettingsStore } from '../../core/settings/settings-store';
import optimizerEn from '../../../../public/i18n/cut-optimizer/en.json';
import optimizerEs from '../../../../public/i18n/cut-optimizer/es.json';
import { expectNoAxeViolations } from '../../../testing/expect-no-axe-violations';
import { translocoTesting } from '../../../testing/transloco-testing';
import CutOptimizerPage from './cut-optimizer.page';

function render(): ComponentFixture<CutOptimizerPage> {
  TestBed.configureTestingModule({
    imports: [
      translocoTesting({
        'cut-optimizer/en': optimizerEn,
        'cut-optimizer/es': optimizerEs,
      }),
    ],
  });
  TestBed.inject(SettingsStore).setUnitSystem('metric');
  return TestBed.createComponent(CutOptimizerPage);
}

function root(fixture: ComponentFixture<CutOptimizerPage>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

/** The Stock entries, in order. */
function stockEntries(fixture: ComponentFixture<CutOptimizerPage>): HTMLFieldSetElement[] {
  return [...root(fixture).querySelectorAll<HTMLFieldSetElement>('section#stock fieldset')];
}

function stockEntry(
  fixture: ComponentFixture<CutOptimizerPage>,
  legend: string,
): HTMLFieldSetElement {
  const entry = stockEntries(fixture).find(
    (fieldset) => fieldset.querySelector('legend')?.textContent.trim() === legend,
  );
  if (!entry) {
    throw new Error(`No Stock entry "${legend}".`);
  }
  return entry;
}

/** The input inside `entry` whose visible label is `label`. */
function field(entry: HTMLElement, label: string): HTMLInputElement {
  const found = [...entry.querySelectorAll('input')].find((input) =>
    [...(input.labels ?? [])].some((l) => l.textContent.trim() === label),
  );
  if (!found) {
    throw new Error(`No field labelled "${label}".`);
  }
  return found;
}

/** What the woodworker sees in each Stock entry: its legend and its field values. */
function shownStock(fixture: ComponentFixture<CutOptimizerPage>): string[][] {
  return stockEntries(fixture).map((entry) => [
    entry.querySelector('legend')!.textContent.trim(),
    ...[...entry.querySelectorAll('input')].map((input) => input.value),
  ]);
}

async function type(
  fixture: ComponentFixture<CutOptimizerPage>,
  input: HTMLInputElement,
  text: string,
): Promise<void> {
  input.value = text;
  input.dispatchEvent(new Event('input'));
  await fixture.whenStable();
}

async function press(
  fixture: ComponentFixture<CutOptimizerPage>,
  target: HTMLButtonElement,
): Promise<void> {
  target.click();
  await fixture.whenStable();
}

function button(container: HTMLElement, name: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find(
    (b) => (b.getAttribute('aria-label') ?? b.textContent.trim()) === name,
  );
  if (!found) {
    throw new Error(`No button "${name}".`);
  }
  return found;
}

/** The texts that describe `input`, in order. */
function description(fixture: ComponentFixture<CutOptimizerPage>, input: HTMLElement): string[] {
  return (input.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter((id) => id !== '')
    .map((id) => root(fixture).querySelector(`#${id}`)?.textContent.trim() ?? '');
}

function alerts(fixture: ComponentFixture<CutOptimizerPage>): string[] {
  return [...root(fixture).querySelectorAll('[role="alert"]')].map((a) => a.textContent.trim());
}

function headings(fixture: ComponentFixture<CutOptimizerPage>): string[] {
  return [...root(fixture).querySelectorAll('h1')].map((h1) => h1.textContent.trim());
}

describe('CutOptimizerPage', () => {
  it("shows the Tool's name as its only h1 in English", async () => {
    const fixture = render();
    await fixture.whenStable();

    expect(headings(fixture)).toEqual(['Cut Optimizer']);
  });

  it("shows the Tool's name as its only h1 in Spanish", async () => {
    const fixture = render();
    TestBed.inject(TranslocoService).setActiveLang('es');
    await fixture.whenStable();

    expect(headings(fixture)).toEqual(['Optimizador de cortes']);
  });

  it('introduces the Tool in English', async () => {
    const fixture = render();
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('p')?.textContent.trim()).toBe(
      'Plan how to cut your Parts out of your Stock with the least Waste.',
    );
  });

  it('introduces the Tool in Spanish', async () => {
    const fixture = render();
    TestBed.inject(TranslocoService).setActiveLang('es');
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('p')?.textContent.trim()).toBe(
      'Planifica cómo cortar tus piezas del material con el mínimo desperdicio.',
    );
  });

  it('has no accessibility violations', async () => {
    const fixture = render();
    await fixture.whenStable();

    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });

  describe('Stock', () => {
    it('starts with one empty Stock entry with a labelled length and quantity', async () => {
      const fixture = render();
      await fixture.whenStable();

      expect(shownStock(fixture)).toEqual([['Stock 1', '', '']]);
      const entry = stockEntry(fixture, 'Stock 1');
      expect(field(entry, 'Length').value).toBe('');
      expect(description(fixture, field(entry, 'Quantity'))).toEqual([
        'Empty means as many as needed.',
      ]);
    });

    it('adds an empty Stock entry at the end and moves focus to its length', async () => {
      const fixture = render();
      await fixture.whenStable();
      await type(fixture, field(stockEntry(fixture, 'Stock 1'), 'Length'), '2400');

      await press(fixture, button(root(fixture), 'Add Stock'));

      expect(shownStock(fixture)).toEqual([
        ['Stock 1', '2400', ''],
        ['Stock 2', '', ''],
      ]);
      expect(document.activeElement).toBe(field(stockEntry(fixture, 'Stock 2'), 'Length'));
    });

    it('keeps what is typed in each entry', async () => {
      const fixture = render();
      await fixture.whenStable();
      await press(fixture, button(root(fixture), 'Add Stock'));

      await type(fixture, field(stockEntry(fixture, 'Stock 1'), 'Length'), '2400 mm');
      await type(fixture, field(stockEntry(fixture, 'Stock 1'), 'Quantity'), '3');
      await type(fixture, field(stockEntry(fixture, 'Stock 2'), 'Length'), '94 1/2"');
      await type(fixture, field(stockEntry(fixture, 'Stock 1'), 'Length'), '1800 mm');

      expect(shownStock(fixture)).toEqual([
        ['Stock 1', '1800 mm', '3'],
        ['Stock 2', '94 1/2"', ''],
      ]);
    });

    it('removes an entry, numbers the rest in order and focuses the entry that took its place', async () => {
      const fixture = render();
      await fixture.whenStable();
      await type(fixture, field(stockEntry(fixture, 'Stock 1'), 'Length'), '2400');
      await press(fixture, button(root(fixture), 'Add Stock'));
      await type(fixture, field(stockEntry(fixture, 'Stock 2'), 'Length'), '1800');
      await press(fixture, button(root(fixture), 'Add Stock'));
      await type(fixture, field(stockEntry(fixture, 'Stock 3'), 'Length'), '1200');

      await press(fixture, button(root(fixture), 'Remove Stock 2'));

      expect(shownStock(fixture)).toEqual([
        ['Stock 1', '2400', ''],
        ['Stock 2', '1200', ''],
      ]);
      expect(document.activeElement).toBe(field(stockEntry(fixture, 'Stock 2'), 'Length'));
    });

    it('focuses the entry before when the last one is removed', async () => {
      const fixture = render();
      await fixture.whenStable();
      await type(fixture, field(stockEntry(fixture, 'Stock 1'), 'Length'), '2400');
      await press(fixture, button(root(fixture), 'Add Stock'));

      await press(fixture, button(root(fixture), 'Remove Stock 2'));

      expect(shownStock(fixture)).toEqual([['Stock 1', '2400', '']]);
      expect(document.activeElement).toBe(field(stockEntry(fixture, 'Stock 1'), 'Length'));
    });

    it('focuses "Add Stock" when the only entry is removed', async () => {
      const fixture = render();
      await fixture.whenStable();

      await press(fixture, button(root(fixture), 'Remove Stock 1'));

      expect(shownStock(fixture)).toEqual([]);
      expect(document.activeElement).toBe(button(root(fixture), 'Add Stock'));
    });

    it('shows each Remove button as "Remove" and names it after its entry', async () => {
      const fixture = render();
      await fixture.whenStable();

      const remove = button(stockEntry(fixture, 'Stock 1'), 'Remove Stock 1');
      expect(remove.textContent.trim()).toBe('Remove');
    });

    it('accepts an empty quantity as as many as needed, with no message', async () => {
      const fixture = render();
      await fixture.whenStable();
      const entry = stockEntry(fixture, 'Stock 1');

      await type(fixture, field(entry, 'Length'), '2400');
      await type(fixture, field(entry, 'Quantity'), '');

      expect(alerts(fixture)).toEqual([]);
      expect(field(entry, 'Quantity').getAttribute('aria-invalid')).toBeNull();
    });

    it('shows no message while the length is empty', async () => {
      const fixture = render();
      await fixture.whenStable();

      await type(fixture, field(stockEntry(fixture, 'Stock 1'), 'Quantity'), '2');

      expect(alerts(fixture)).toEqual([]);
    });

    it.each([
      ['24oo', 'That length can\'t be read. Try something like 2400, 94 1/2" or 2400 mm.'],
      ['0', 'A length must be greater than zero.'],
      ['-2400 mm', 'A length must be greater than zero.'],
    ])('shows a message for the length %j on the length only', async (length, message) => {
      const fixture = render();
      await fixture.whenStable();
      const entry = stockEntry(fixture, 'Stock 1');

      await type(fixture, field(entry, 'Length'), length);

      expect(alerts(fixture)).toEqual([message]);
      expect(field(entry, 'Length').getAttribute('aria-invalid')).toBe('true');
      expect(description(fixture, field(entry, 'Length'))).toEqual([message]);
      expect(field(entry, 'Quantity').getAttribute('aria-invalid')).toBeNull();
    });

    it.each(['0', '-1', '1.5', 'two'])(
      'shows a message for the quantity %j on the quantity only',
      async (quantity) => {
        const fixture = render();
        await fixture.whenStable();
        const entry = stockEntry(fixture, 'Stock 1');
        const message =
          'The quantity must be a whole number greater than zero, or empty for as many as needed.';

        await type(fixture, field(entry, 'Length'), '2400');
        await type(fixture, field(entry, 'Quantity'), quantity);

        expect(alerts(fixture)).toEqual([message]);
        expect(field(entry, 'Quantity').getAttribute('aria-invalid')).toBe('true');
        expect(description(fixture, field(entry, 'Quantity'))).toEqual([
          'Empty means as many as needed.',
          message,
        ]);
        expect(field(entry, 'Length').getAttribute('aria-invalid')).toBeNull();
      },
    );

    it('shows each message in the entry it belongs to', async () => {
      const fixture = render();
      await fixture.whenStable();
      await press(fixture, button(root(fixture), 'Add Stock'));

      await type(fixture, field(stockEntry(fixture, 'Stock 1'), 'Length'), '2400');
      await type(fixture, field(stockEntry(fixture, 'Stock 2'), 'Length'), '0');

      expect(
        field(stockEntry(fixture, 'Stock 1'), 'Length').getAttribute('aria-invalid'),
      ).toBeNull();
      expect(field(stockEntry(fixture, 'Stock 2'), 'Length').getAttribute('aria-invalid')).toBe(
        'true',
      );
    });

    it('reads a bare length in the preferred Unit System', async () => {
      const fixture = render();
      TestBed.inject(SettingsStore).setUnitSystem('imperial');
      await fixture.whenStable();
      const entry = stockEntry(fixture, 'Stock 1');

      await type(fixture, field(entry, 'Length'), '94 1/2');

      expect(alerts(fixture)).toEqual([]);
    });

    it('is in Spanish, with its messages', async () => {
      const fixture = render();
      TestBed.inject(TranslocoService).setActiveLang('es');
      await fixture.whenStable();
      const entry = stockEntry(fixture, 'Material 1');

      await type(fixture, field(entry, 'Longitud'), 'abc');
      await type(fixture, field(entry, 'Cantidad'), '1,5');

      expect(root(fixture).querySelector('section#stock h2')?.textContent.trim()).toBe('Material');
      expect(description(fixture, field(entry, 'Cantidad'))[0]).toBe(
        'Vacía: tanto material como haga falta.',
      );
      expect(alerts(fixture)).toEqual([
        'No se puede leer esa longitud. Prueba con algo como 2400, 94 1/2" o 2400 mm.',
        'La cantidad debe ser un número entero mayor que cero, o quedar vacía para usar tanto material como haga falta.',
      ]);
      expect(button(entry, 'Quitar material 1').textContent.trim()).toBe('Quitar');
      expect(button(root(fixture), 'Añadir material')).toBeTruthy();
    });

    it('has no accessibility violations with several entries', async () => {
      const fixture = render();
      await fixture.whenStable();
      await type(fixture, field(stockEntry(fixture, 'Stock 1'), 'Length'), '2400');
      await press(fixture, button(root(fixture), 'Add Stock'));

      await expectNoAxeViolations(root(fixture));
    });

    it('has no accessibility violations with a message shown', async () => {
      const fixture = render();
      await fixture.whenStable();
      await type(fixture, field(stockEntry(fixture, 'Stock 1'), 'Length'), 'abc');
      await type(fixture, field(stockEntry(fixture, 'Stock 1'), 'Quantity'), '0');

      await expectNoAxeViolations(root(fixture));
    });
  });
});
