import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
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
  return TestBed.createComponent(CutOptimizerPage);
}

function headings(fixture: ComponentFixture<CutOptimizerPage>): string[] {
  const root = fixture.nativeElement as HTMLElement;
  return [...root.querySelectorAll('h1')].map((h1) => h1.textContent.trim());
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

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Plan how to cut your Parts out of your Stock with the least Waste.',
    );
  });

  it('introduces the Tool in Spanish', async () => {
    const fixture = render();
    TestBed.inject(TranslocoService).setActiveLang('es');
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Planifica cómo cortar tus piezas del material con el mínimo desperdicio.',
    );
  });

  it('has no accessibility violations', async () => {
    const fixture = render();
    await fixture.whenStable();

    await expectNoAxeViolations(fixture.nativeElement as HTMLElement);
  });
});
