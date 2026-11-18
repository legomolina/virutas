import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
    providers: [provideRouter([])],
  });
  TestBed.inject(SettingsStore).setUnitSystem('metric');
  return TestBed.createComponent(CutOptimizerPage);
}

function root(fixture: ComponentFixture<CutOptimizerPage>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

/** The entries of the section `section` (`stock` or `cut-list`), in order. */
function entries(
  fixture: ComponentFixture<CutOptimizerPage>,
  section: string,
): HTMLFieldSetElement[] {
  return [...root(fixture).querySelectorAll<HTMLFieldSetElement>(`section#${section} fieldset`)];
}

function entryIn(
  fixture: ComponentFixture<CutOptimizerPage>,
  section: string,
  legend: string,
): HTMLFieldSetElement {
  const found = entries(fixture, section).find(
    (fieldset) => fieldset.querySelector('legend')?.textContent.trim() === legend,
  );
  if (!found) {
    throw new Error(`No entry "${legend}".`);
  }
  return found;
}

function stockEntry(
  fixture: ComponentFixture<CutOptimizerPage>,
  legend: string,
): HTMLFieldSetElement {
  return entryIn(fixture, 'stock', legend);
}

function part(fixture: ComponentFixture<CutOptimizerPage>, legend: string): HTMLFieldSetElement {
  return entryIn(fixture, 'cut-list', legend);
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

/** What the woodworker sees in each entry of `section`: its legend and its field values. */
function shown(fixture: ComponentFixture<CutOptimizerPage>, section: string): string[][] {
  return entries(fixture, section).map((fieldset) => [
    fieldset.querySelector('legend')!.textContent.trim(),
    ...[...fieldset.querySelectorAll('input')].map((input) => input.value),
  ]);
}

function shownStock(fixture: ComponentFixture<CutOptimizerPage>): string[][] {
  return shown(fixture, 'stock');
}

function shownParts(fixture: ComponentFixture<CutOptimizerPage>): string[][] {
  return shown(fixture, 'cut-list');
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

/** The job settings section. */
function jobSettings(fixture: ComponentFixture<CutOptimizerPage>): HTMLElement {
  const section = root(fixture).querySelector<HTMLElement>('section#job-settings');
  if (!section) {
    throw new Error('No job settings section.');
  }
  return section;
}

/** The value of each job setting, in order: Kerf, Trim, minimum Offcut length. */
function shownJobSettings(fixture: ComponentFixture<CutOptimizerPage>): string[] {
  return [...jobSettings(fixture).querySelectorAll('input')].map((input) => input.value);
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

    it('shows no length message while the length is empty', async () => {
      const fixture = render();
      await fixture.whenStable();
      const entry = stockEntry(fixture, 'Stock 1');

      await type(fixture, field(entry, 'Quantity'), '0');

      expect(alerts(fixture)).toEqual([
        'The quantity must be a whole number greater than zero, or empty for as many as needed.',
      ]);
      expect(field(entry, 'Length').getAttribute('aria-invalid')).toBeNull();
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

      const first = field(stockEntry(fixture, 'Stock 1'), 'Length');
      const second = field(stockEntry(fixture, 'Stock 2'), 'Length');
      expect(first.getAttribute('aria-invalid')).toBeNull();
      expect(description(fixture, first)).toEqual([]);
      expect(second.getAttribute('aria-invalid')).toBe('true');
      expect(description(fixture, second)).toEqual(['A length must be greater than zero.']);
    });

    it('reads a bare length in the preferred Unit System', async () => {
      const fixture = render();
      TestBed.inject(SettingsStore).setUnitSystem('imperial');
      await fixture.whenStable();
      const entry = stockEntry(fixture, 'Stock 1');

      await type(fixture, field(entry, 'Length'), '94 1/2');
      expect(alerts(fixture)).toEqual([]);

      TestBed.inject(SettingsStore).setUnitSystem('metric');
      await fixture.whenStable();
      expect(alerts(fixture)).toEqual([
        'That length can\'t be read. Try something like 2400, 94 1/2" or 2400 mm.',
      ]);
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

  describe('Cut List', () => {
    const quantityMessage = 'The quantity must be a whole number greater than zero.';

    it('starts with one empty Part with a labelled name, length and quantity', async () => {
      const fixture = render();
      await fixture.whenStable();

      expect(root(fixture).querySelector('section#cut-list h2')?.textContent.trim()).toBe(
        'Cut List',
      );
      expect(shownParts(fixture)).toEqual([['Part 1', '', '', '']]);
      const first = part(fixture, 'Part 1');
      expect(field(first, 'Name (optional)').value).toBe('');
      expect(field(first, 'Length').value).toBe('');
      expect(field(first, 'Quantity').value).toBe('');
    });

    it('adds a Part at the end and moves focus to its name', async () => {
      const fixture = render();
      await fixture.whenStable();
      await type(fixture, field(part(fixture, 'Part 1'), 'Length'), '720 mm');
      await type(fixture, field(part(fixture, 'Part 1'), 'Quantity'), '6');

      await press(fixture, button(root(fixture), 'Add Part'));

      expect(shownParts(fixture)).toEqual([
        ['Part 1', '', '720 mm', '6'],
        ['Part 2', '', '', ''],
      ]);
      expect(document.activeElement).toBe(field(part(fixture, 'Part 2'), 'Name (optional)'));
    });

    it('keeps what is typed in each Part, with and without a name', async () => {
      const fixture = render();
      await fixture.whenStable();
      await press(fixture, button(root(fixture), 'Add Part'));

      await type(fixture, field(part(fixture, 'Part 1'), 'Length'), '720 mm');
      await type(fixture, field(part(fixture, 'Part 1'), 'Quantity'), '6');
      await type(fixture, field(part(fixture, 'Part 2'), 'Name (optional)'), 'rail');
      await type(fixture, field(part(fixture, 'Part 2'), 'Length'), '21 1/4"');
      await type(fixture, field(part(fixture, 'Part 2'), 'Quantity'), '4');

      expect(shownParts(fixture)).toEqual([
        ['Part 1', '', '720 mm', '6'],
        ['Part 2', 'rail', '21 1/4"', '4'],
      ]);
      expect(alerts(fixture)).toEqual([]);
    });

    it('edits a Part, adding and clearing its name', async () => {
      const fixture = render();
      await fixture.whenStable();
      const first = part(fixture, 'Part 1');
      await type(fixture, field(first, 'Length'), '720');
      await type(fixture, field(first, 'Quantity'), '6');

      await type(fixture, field(first, 'Name (optional)'), 'leg');
      expect(shownParts(fixture)).toEqual([['Part 1', 'leg', '720', '6']]);

      await type(fixture, field(first, 'Name (optional)'), '');
      await type(fixture, field(first, 'Length'), '700');
      await type(fixture, field(first, 'Quantity'), '4');
      expect(shownParts(fixture)).toEqual([['Part 1', '', '700', '4']]);
      expect(alerts(fixture)).toEqual([]);
    });

    it('keeps the Cut List apart from the Stock', async () => {
      const fixture = render();
      await fixture.whenStable();

      await type(fixture, field(stockEntry(fixture, 'Stock 1'), 'Length'), '2400');
      await type(fixture, field(part(fixture, 'Part 1'), 'Length'), '720');

      expect(shownStock(fixture)).toEqual([['Stock 1', '2400', '']]);
      expect(shownParts(fixture)).toEqual([['Part 1', '', '720', '']]);
    });

    it('removes a Part, numbers the rest in order and focuses the Part that took its place', async () => {
      const fixture = render();
      await fixture.whenStable();
      await type(fixture, field(part(fixture, 'Part 1'), 'Name (optional)'), 'leg');
      await press(fixture, button(root(fixture), 'Add Part'));
      await type(fixture, field(part(fixture, 'Part 2'), 'Name (optional)'), 'rail');
      await press(fixture, button(root(fixture), 'Add Part'));
      await type(fixture, field(part(fixture, 'Part 3'), 'Name (optional)'), 'shelf');

      await press(fixture, button(root(fixture), 'Remove Part 2'));

      expect(shownParts(fixture)).toEqual([
        ['Part 1', 'leg', '', ''],
        ['Part 2', 'shelf', '', ''],
      ]);
      expect(document.activeElement).toBe(field(part(fixture, 'Part 2'), 'Name (optional)'));
    });

    it('focuses the Part before when the last one is removed', async () => {
      const fixture = render();
      await fixture.whenStable();
      await type(fixture, field(part(fixture, 'Part 1'), 'Name (optional)'), 'leg');
      await press(fixture, button(root(fixture), 'Add Part'));

      await press(fixture, button(root(fixture), 'Remove Part 2'));

      expect(shownParts(fixture)).toEqual([['Part 1', 'leg', '', '']]);
      expect(document.activeElement).toBe(field(part(fixture, 'Part 1'), 'Name (optional)'));
    });

    it('focuses "Add Part" when the only Part is removed', async () => {
      const fixture = render();
      await fixture.whenStable();

      await press(fixture, button(root(fixture), 'Remove Part 1'));

      expect(shownParts(fixture)).toEqual([]);
      expect(document.activeElement).toBe(button(root(fixture), 'Add Part'));
    });

    it('shows each Remove button as "Remove" and names it after its Part', async () => {
      const fixture = render();
      await fixture.whenStable();

      expect(button(part(fixture, 'Part 1'), 'Remove Part 1').textContent.trim()).toBe('Remove');
    });

    it('shows no message while the length and the quantity are empty', async () => {
      const fixture = render();
      await fixture.whenStable();
      const first = part(fixture, 'Part 1');

      await type(fixture, field(first, 'Name (optional)'), 'leg');

      expect(alerts(fixture)).toEqual([]);
      expect(field(first, 'Length').getAttribute('aria-invalid')).toBeNull();
      expect(field(first, 'Quantity').getAttribute('aria-invalid')).toBeNull();
    });

    it.each([
      ['72o', 'That length can\'t be read. Try something like 2400, 94 1/2" or 2400 mm.'],
      ['0', 'A length must be greater than zero.'],
      ['-720 mm', 'A length must be greater than zero.'],
    ])('shows a message for the length %j on the length only', async (length, message) => {
      const fixture = render();
      await fixture.whenStable();
      const first = part(fixture, 'Part 1');

      await type(fixture, field(first, 'Quantity'), '2');
      await type(fixture, field(first, 'Length'), length);

      expect(alerts(fixture)).toEqual([message]);
      expect(field(first, 'Length').getAttribute('aria-invalid')).toBe('true');
      expect(description(fixture, field(first, 'Length'))).toEqual([message]);
      expect(field(first, 'Quantity').getAttribute('aria-invalid')).toBeNull();
      expect(field(first, 'Name (optional)').getAttribute('aria-invalid')).toBeNull();
    });

    it.each(['0', '-1', '1.5', 'two'])(
      'shows a message for the quantity %j on the quantity only',
      async (quantity) => {
        const fixture = render();
        await fixture.whenStable();
        const first = part(fixture, 'Part 1');

        await type(fixture, field(first, 'Length'), '720');
        await type(fixture, field(first, 'Quantity'), quantity);

        expect(alerts(fixture)).toEqual([quantityMessage]);
        expect(field(first, 'Quantity').getAttribute('aria-invalid')).toBe('true');
        expect(description(fixture, field(first, 'Quantity'))).toEqual([quantityMessage]);
        expect(field(first, 'Length').getAttribute('aria-invalid')).toBeNull();
      },
    );

    it('shows each message in the Part it belongs to', async () => {
      const fixture = render();
      await fixture.whenStable();
      await press(fixture, button(root(fixture), 'Add Part'));

      await type(fixture, field(part(fixture, 'Part 1'), 'Quantity'), '2');
      await type(fixture, field(part(fixture, 'Part 2'), 'Quantity'), '0');

      const first = field(part(fixture, 'Part 1'), 'Quantity');
      const second = field(part(fixture, 'Part 2'), 'Quantity');
      expect(first.getAttribute('aria-invalid')).toBeNull();
      expect(description(fixture, first)).toEqual([]);
      expect(second.getAttribute('aria-invalid')).toBe('true');
      expect(description(fixture, second)).toEqual([quantityMessage]);
    });

    it('shows a message on a field while the other one is still empty', async () => {
      const fixture = render();
      await fixture.whenStable();
      await press(fixture, button(root(fixture), 'Add Part'));

      await type(fixture, field(part(fixture, 'Part 1'), 'Length'), 'abc');
      await type(fixture, field(part(fixture, 'Part 2'), 'Quantity'), '0');

      expect(alerts(fixture)).toEqual([
        'That length can\'t be read. Try something like 2400, 94 1/2" or 2400 mm.',
        quantityMessage,
      ]);
      expect(field(part(fixture, 'Part 1'), 'Length').getAttribute('aria-invalid')).toBe('true');
      expect(field(part(fixture, 'Part 2'), 'Quantity').getAttribute('aria-invalid')).toBe('true');
    });

    it('keeps a message with its Part when a Part before it is removed', async () => {
      const fixture = render();
      await fixture.whenStable();
      await type(fixture, field(part(fixture, 'Part 1'), 'Quantity'), '2');
      await press(fixture, button(root(fixture), 'Add Part'));
      await type(fixture, field(part(fixture, 'Part 2'), 'Quantity'), '0');

      await press(fixture, button(root(fixture), 'Remove Part 1'));

      expect(shownParts(fixture)).toEqual([['Part 1', '', '', '0']]);
      const quantity = field(part(fixture, 'Part 1'), 'Quantity');
      expect(quantity.getAttribute('aria-invalid')).toBe('true');
      expect(description(fixture, quantity)).toEqual([quantityMessage]);
    });

    it('adds an empty Part after a removal, leaving the others as they were', async () => {
      const fixture = render();
      await fixture.whenStable();
      await type(fixture, field(part(fixture, 'Part 1'), 'Name (optional)'), 'leg');
      await press(fixture, button(root(fixture), 'Add Part'));
      await type(fixture, field(part(fixture, 'Part 2'), 'Name (optional)'), 'rail');
      await press(fixture, button(root(fixture), 'Add Part'));
      await type(fixture, field(part(fixture, 'Part 3'), 'Name (optional)'), 'shelf');
      await press(fixture, button(root(fixture), 'Remove Part 2'));

      await press(fixture, button(root(fixture), 'Add Part'));

      expect(shownParts(fixture)).toEqual([
        ['Part 1', 'leg', '', ''],
        ['Part 2', 'shelf', '', ''],
        ['Part 3', '', '', ''],
      ]);
      expect(document.activeElement).toBe(field(part(fixture, 'Part 3'), 'Name (optional)'));
    });

    it('reads a bare length in the preferred Unit System', async () => {
      const fixture = render();
      TestBed.inject(SettingsStore).setUnitSystem('imperial');
      await fixture.whenStable();
      const first = part(fixture, 'Part 1');

      await type(fixture, field(first, 'Length'), '28 3/8');
      expect(alerts(fixture)).toEqual([]);

      TestBed.inject(SettingsStore).setUnitSystem('metric');
      await fixture.whenStable();
      expect(alerts(fixture)).toEqual([
        'That length can\'t be read. Try something like 2400, 94 1/2" or 2400 mm.',
      ]);
    });

    it('is in Spanish, with its messages', async () => {
      const fixture = render();
      TestBed.inject(TranslocoService).setActiveLang('es');
      await fixture.whenStable();
      const first = part(fixture, 'Pieza 1');

      await type(fixture, field(first, 'Nombre (opcional)'), 'pata');
      await type(fixture, field(first, 'Longitud'), 'abc');
      await type(fixture, field(first, 'Cantidad'), '1,5');

      expect(root(fixture).querySelector('section#cut-list h2')?.textContent.trim()).toBe(
        'Lista de piezas',
      );
      expect(alerts(fixture)).toEqual([
        'No se puede leer esa longitud. Prueba con algo como 2400, 94 1/2" o 2400 mm.',
        'La cantidad debe ser un número entero mayor que cero.',
      ]);
      expect(button(first, 'Quitar pieza 1').textContent.trim()).toBe('Quitar');
      expect(button(root(fixture), 'Añadir pieza')).toBeTruthy();
    });

    it('has no accessibility violations with several Parts', async () => {
      const fixture = render();
      await fixture.whenStable();
      await type(fixture, field(part(fixture, 'Part 1'), 'Name (optional)'), 'leg');
      await press(fixture, button(root(fixture), 'Add Part'));

      await expectNoAxeViolations(root(fixture));
    });

    it('has no accessibility violations with a message shown', async () => {
      const fixture = render();
      await fixture.whenStable();
      await type(fixture, field(part(fixture, 'Part 1'), 'Length'), 'abc');
      await type(fixture, field(part(fixture, 'Part 1'), 'Quantity'), '0');

      await expectNoAxeViolations(root(fixture));
    });
  });

  describe('Job settings', () => {
    const kerfLabel = 'Kerf';
    const trimLabel = 'Trim at each end';
    const minimumOffcutLengthLabel = 'Minimum Offcut Length';

    it('shows labelled Kerf, Trim and minimum Offcut length under a heading', async () => {
      const fixture = render();
      await fixture.whenStable();
      const section = jobSettings(fixture);

      expect(section.querySelector('h2')?.textContent.trim()).toBe('Job settings');
      expect(
        [kerfLabel, trimLabel, minimumOffcutLengthLabel].map((label) =>
          description(fixture, field(section, label)),
        ),
      ).toEqual([
        ['Material lost in every Cut.'],
        ['Cut off both ends of every Stock before placing Parts.'],
        ['Shorter leftovers count as Waste.'],
      ]);
    });

    it.each([
      ['metric', ['3 mm', '0 mm', '300 mm']],
      ['imperial', ['1/8"', '0"', '12"']],
    ] as const)('starts from the %s defaults', async (unitSystem, defaults) => {
      const fixture = render();
      TestBed.inject(SettingsStore).setUnitSystem(unitSystem);
      await fixture.whenStable();

      expect(shownJobSettings(fixture)).toEqual(defaults);
    });

    it('starts from the defaults the woodworker set', async () => {
      const fixture = render();
      const store = TestBed.inject(SettingsStore);
      store.setCutOptimizerKerf(2);
      store.setCutOptimizerTrim(5);
      store.setCutOptimizerMinimumOffcutLength(500);
      await fixture.whenStable();

      expect(shownJobSettings(fixture)).toEqual(['2 mm', '5 mm', '500 mm']);
    });

    it('changes only the current job, never the defaults', async () => {
      const fixture = render();
      await fixture.whenStable();
      const store = TestBed.inject(SettingsStore);

      await type(fixture, field(jobSettings(fixture), kerfLabel), '2.5 mm');
      await type(fixture, field(jobSettings(fixture), trimLabel), '10 mm');
      await type(fixture, field(jobSettings(fixture), minimumOffcutLengthLabel), '150 mm');

      expect(shownJobSettings(fixture)).toEqual(['2.5 mm', '10 mm', '150 mm']);
      expect(store.cutOptimizerDefaults()).toEqual({
        kerfMillimetres: 3,
        trimMillimetres: 0,
        minimumOffcutLengthMillimetres: 300,
      });
      expect(store.cutOptimizerSetByUser()).toEqual({
        kerf: false,
        trim: false,
        minimumOffcutLength: false,
      });
    });

    it('keeps a changed value when the Unit System changes, and follows it elsewhere', async () => {
      const fixture = render();
      await fixture.whenStable();

      await type(fixture, field(jobSettings(fixture), kerfLabel), '2.5 mm');
      TestBed.inject(SettingsStore).setUnitSystem('imperial');
      await fixture.whenStable();

      expect(shownJobSettings(fixture)).toEqual(['2.5 mm', '0"', '12"']);
      expect(alerts(fixture)).toEqual([]);
    });

    it('keeps the Imperial defaults when a value is changed in Imperial', async () => {
      const fixture = render();
      const store = TestBed.inject(SettingsStore);
      store.setUnitSystem('imperial');
      await fixture.whenStable();

      await type(fixture, field(jobSettings(fixture), kerfLabel), '1/4');

      expect(shownJobSettings(fixture)).toEqual(['1/4', '0"', '12"']);
      expect(alerts(fixture)).toEqual([]);
      expect(store.cutOptimizerDefaults()).toEqual({
        kerfMillimetres: 3.175,
        trimMillimetres: 0,
        minimumOffcutLengthMillimetres: 304.8,
      });
      expect(store.cutOptimizerSetByUser().kerf).toBe(false);
    });

    it.each([kerfLabel, trimLabel, minimumOffcutLengthLabel])(
      'accepts zero for %s with no message',
      async (label) => {
        const fixture = render();
        await fixture.whenStable();

        await type(fixture, field(jobSettings(fixture), label), '0');

        expect(alerts(fixture)).toEqual([]);
        expect(field(jobSettings(fixture), label).getAttribute('aria-invalid')).toBeNull();
      },
    );

    it.each([
      {
        label: kerfLabel,
        name: 'a negative Kerf',
        text: '-1 mm',
        message: "A length can't be negative. Use 0 or more.",
        hint: 'Material lost in every Cut.',
      },
      {
        label: trimLabel,
        name: 'an unreadable Trim',
        text: '5oo',
        message: 'That length can\'t be read. Try something like 5 mm, 1/8" or 0.',
        hint: 'Cut off both ends of every Stock before placing Parts.',
      },
      {
        name: 'an empty minimum Offcut length',
        label: minimumOffcutLengthLabel,
        text: '',
        message: 'Enter a length, or 0 for none.',
        hint: 'Shorter leftovers count as Waste.',
      },
    ])('shows a message for $name on its field only', async ({ label, text, message, hint }) => {
      const fixture = render();
      await fixture.whenStable();
      const section = jobSettings(fixture);

      await type(fixture, field(section, label), text);

      expect(alerts(fixture)).toEqual([message]);
      expect(field(section, label).getAttribute('aria-invalid')).toBe('true');
      expect(description(fixture, field(section, label))).toEqual([hint, message]);
      expect(section.querySelectorAll('[aria-invalid="true"]')).toHaveLength(1);
    });

    it('links to the settings, where the defaults are changed', async () => {
      const fixture = render();
      await fixture.whenStable();

      const link = jobSettings(fixture).querySelector('a');
      expect(link?.textContent.trim()).toBe('Change your defaults in Settings');
      expect(link?.getAttribute('href')).toBe('/settings');
    });

    it('is in Spanish, with its messages', async () => {
      const fixture = render();
      TestBed.inject(TranslocoService).setActiveLang('es');
      await fixture.whenStable();
      const section = jobSettings(fixture);

      await type(fixture, field(section, 'Grosor de corte'), '-1');
      await type(fixture, field(section, 'Saneado en cada extremo'), 'abc');
      await type(fixture, field(section, 'Longitud mínima de retal'), '');

      expect(section.querySelector('h2')?.textContent.trim()).toBe('Ajustes del trabajo');
      expect(description(fixture, field(section, 'Grosor de corte'))[0]).toBe(
        'Material que se pierde en cada corte.',
      );
      expect(alerts(fixture)).toEqual([
        'Una longitud no puede ser negativa. Usa 0 o más.',
        'No se puede leer esa longitud. Prueba con algo como 5 mm, 1/8" o 0.',
        'Escribe una longitud, o 0 para ninguna.',
      ]);
      expect(section.querySelector('a')?.textContent.trim()).toBe(
        'Cambia tus valores por defecto en Ajustes',
      );
    });

    it('has no accessibility violations with a message shown', async () => {
      const fixture = render();
      await fixture.whenStable();
      await type(fixture, field(jobSettings(fixture), kerfLabel), '-1');

      await expectNoAxeViolations(root(fixture));
    });
  });
});
