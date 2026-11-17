import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import optimizerEn from '../../../../public/i18n/cut-optimizer/en.json';
import optimizerEs from '../../../../public/i18n/cut-optimizer/es.json';
import { expectNoAxeViolations } from '../../../testing/expect-no-axe-violations';
import { translocoTesting } from '../../../testing/transloco-testing';
import { SettingsStore } from '../../core/settings/settings-store';
import { CutOptimizerSettings } from './cut-optimizer-settings';

async function render(
  unitSystem: 'metric' | 'imperial' = 'metric',
): Promise<{ fixture: ComponentFixture<CutOptimizerSettings>; store: SettingsStore }> {
  TestBed.configureTestingModule({
    imports: [
      translocoTesting({ 'cut-optimizer/en': optimizerEn, 'cut-optimizer/es': optimizerEs }),
    ],
  });
  const store = TestBed.inject(SettingsStore);
  store.setUnitSystem(unitSystem);
  const fixture = TestBed.createComponent(CutOptimizerSettings);
  await fixture.whenStable();
  return { fixture, store };
}

function root(fixture: ComponentFixture<CutOptimizerSettings>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function field(fixture: ComponentFixture<CutOptimizerSettings>, label: string): HTMLInputElement {
  const match = [...root(fixture).querySelectorAll('label')].find(
    (candidate) => candidate.textContent.trim() === label,
  );
  const input = root(fixture).querySelector(`#${match?.getAttribute('for') ?? 'missing'}`);
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`No field labelled "${label}".`);
  }
  return input;
}

async function type(
  fixture: ComponentFixture<CutOptimizerSettings>,
  input: HTMLInputElement,
  text: string,
): Promise<void> {
  input.value = text;
  input.dispatchEvent(new Event('input'));
  await fixture.whenStable();
}

function messages(fixture: ComponentFixture<CutOptimizerSettings>): string[] {
  return [...root(fixture).querySelectorAll('[role="alert"]')].map((alert) =>
    alert.textContent.trim(),
  );
}

function describedBy(
  fixture: ComponentFixture<CutOptimizerSettings>,
  input: HTMLInputElement,
): string {
  return (input.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => root(fixture).querySelector(`#${id}`)?.textContent.trim())
    .join(' ');
}

describe('CutOptimizerSettings', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has a field for the Kerf, the Trim and the minimum Offcut length', async () => {
    const { fixture } = await render();

    expect([...root(fixture).querySelectorAll('label')].map((l) => l.textContent.trim())).toEqual([
      'Kerf',
      'Trim',
      'Minimum Offcut length',
    ]);
  });

  it.each([
    ['metric', ['3 mm', '0 mm', '300 mm']],
    ['imperial', ['1/8"', '0"', '12"']],
  ] as const)('tells the %s defaults on the fields', async (unitSystem, defaults) => {
    const { fixture } = await render(unitSystem);

    const labels = ['Kerf', 'Trim', 'Minimum Offcut length'];
    labels.forEach((label, index) => {
      expect(describedBy(fixture, field(fixture, label))).toContain(defaults[index]);
    });
    expect(labels.map((label) => field(fixture, label).value)).toEqual(['', '', '']);
  });

  it('keeps a valid value in the store as millimetres, read under the Unit System', async () => {
    const { fixture, store } = await render('metric');

    await type(fixture, field(fixture, 'Kerf'), '2.5');
    await type(fixture, field(fixture, 'Trim'), '1 cm');
    await type(fixture, field(fixture, 'Minimum Offcut length'), '2"');

    expect(store.cutOptimizerDefaults()).toEqual({
      kerfMillimetres: 2.5,
      trimMillimetres: 10,
      minimumOffcutLengthMillimetres: 50.8,
    });
    expect(messages(fixture)).toEqual([]);
  });

  it('reads a bare number as inches under Imperial', async () => {
    const { fixture, store } = await render('imperial');

    await type(fixture, field(fixture, 'Kerf'), '1/4');

    expect(store.cutOptimizerDefaults().kerfMillimetres).toBe(6.35);
  });

  it('goes back to the default when the field is emptied', async () => {
    const { fixture, store } = await render('metric');
    await type(fixture, field(fixture, 'Kerf'), '2');

    await type(fixture, field(fixture, 'Kerf'), '');

    expect(store.cutOptimizerSetByUser().kerf).toBe(false);
    expect(store.cutOptimizerDefaults().kerfMillimetres).toBe(3);
    expect(messages(fixture)).toEqual([]);
  });

  it('accepts zero', async () => {
    const { fixture, store } = await render('metric');

    await type(fixture, field(fixture, 'Kerf'), '0');

    expect(store.cutOptimizerDefaults().kerfMillimetres).toBe(0);
    expect(messages(fixture)).toEqual([]);
  });

  it('shows a message on the field of a value that cannot be read, and keeps the store as it was', async () => {
    const { fixture, store } = await render('metric');
    await type(fixture, field(fixture, 'Trim'), '5');

    await type(fixture, field(fixture, 'Trim'), 'abc');

    expect(messages(fixture)).toEqual(['That isn\'t a length. Try 3 mm, 1/8" or 2 1/2".']);
    expect(field(fixture, 'Trim').getAttribute('aria-invalid')).toBe('true');
    expect(describedBy(fixture, field(fixture, 'Trim'))).toContain("That isn't a length");
    expect(store.cutOptimizerDefaults().trimMillimetres).toBe(5);
  });

  it('shows a message on the field of a negative value, and keeps the store as it was', async () => {
    const { fixture, store } = await render('metric');

    await type(fixture, field(fixture, 'Kerf'), '-1');

    expect(messages(fixture)).toEqual(['A length cannot be negative.']);
    expect(field(fixture, 'Kerf').getAttribute('aria-invalid')).toBe('true');
    expect(store.cutOptimizerSetByUser().kerf).toBe(false);
  });

  it('clears the message once the value is fixed', async () => {
    const { fixture } = await render('metric');
    await type(fixture, field(fixture, 'Kerf'), 'abc');

    await type(fixture, field(fixture, 'Kerf'), '3');

    expect(messages(fixture)).toEqual([]);
    expect(field(fixture, 'Kerf').getAttribute('aria-invalid')).toBeNull();
  });

  it('shows a value the user set again when the section is opened anew', async () => {
    const { store } = await render('metric');
    store.setCutOptimizerKerf(2);
    const again = TestBed.createComponent(CutOptimizerSettings);
    await again.whenStable();

    expect(field(again, 'Kerf').value).toBe('2 mm');
    expect(field(again, 'Trim').value).toBe('');
  });

  it('shows a value the user set in the new Unit System when it changes', async () => {
    const { fixture, store } = await render('metric');
    await type(fixture, field(fixture, 'Minimum Offcut length'), '254');

    store.setUnitSystem('imperial');
    await fixture.whenStable();

    expect(field(fixture, 'Minimum Offcut length').value).toBe('10"');
    expect(describedBy(fixture, field(fixture, 'Kerf'))).toContain('1/8"');
  });

  it('is translated to Spanish', async () => {
    const { fixture } = await render('metric');

    TestBed.inject(TranslocoService).setActiveLang('es');
    await fixture.whenStable();
    await type(fixture, field(fixture, 'Grosor de corte'), 'abc');

    expect([...root(fixture).querySelectorAll('label')].map((l) => l.textContent.trim())).toEqual([
      'Grosor de corte',
      'Saneado',
      'Longitud mínima de retal',
    ]);
    expect(describedBy(fixture, field(fixture, 'Grosor de corte'))).toContain(
      'Déjalo vacío para usar el valor por defecto, 3 mm.',
    );
    expect(messages(fixture)[0]).toContain('No es una longitud');
  });

  it('has no accessibility violations, with and without a message', async () => {
    const { fixture } = await render('metric');
    await expectNoAxeViolations(root(fixture));

    await type(fixture, field(fixture, 'Kerf'), 'abc');

    await expectNoAxeViolations(root(fixture));
  });
});
