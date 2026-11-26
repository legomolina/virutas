import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { expectNoAxeViolations } from '../../../../testing/expect-no-axe-violations';
import { translocoTesting } from '../../../../testing/transloco-testing';
import { ConfirmDialog } from './confirm-dialog';

@Component({
  selector: 'wt-host',
  imports: [ConfirmDialog],
  template: `
    <wt-confirm-dialog
      heading="Delete this Stock?"
      message="The Stock and its Parts are removed."
      confirmLabel="Delete"
      (answered)="answers.push($event)"
    />
  `,
})
class Host {
  readonly answers: boolean[] = [];
}

function fakeDialogApi(): () => void {
  const { prototype } = HTMLDialogElement;
  Object.assign(prototype, {
    showModal(this: HTMLDialogElement): void {
      this.setAttribute('open', '');
    },
    close(this: HTMLDialogElement): void {
      if (this.hasAttribute('open')) {
        this.removeAttribute('open');
        this.dispatchEvent(new Event('close'));
      }
    },
  });
  return () => {
    Reflect.deleteProperty(prototype, 'showModal');
    Reflect.deleteProperty(prototype, 'close');
  };
}

function button(root: HTMLElement, name: string): HTMLButtonElement {
  const match = [...root.querySelectorAll('button')].find(
    (candidate) => (candidate.getAttribute('aria-label') ?? candidate.textContent.trim()) === name,
  );
  if (!match) {
    throw new Error(`No button named "${name}".`);
  }
  return match;
}

async function render(): Promise<{ fixture: ComponentFixture<Host>; root: HTMLElement }> {
  TestBed.configureTestingModule({ imports: [translocoTesting()] });
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  return { fixture, root: fixture.nativeElement as HTMLElement };
}

describe('ConfirmDialog', () => {
  let restoreDialogApi: () => void;

  beforeEach(() => {
    restoreDialogApi = fakeDialogApi();
  });

  afterEach(() => {
    restoreDialogApi();
  });

  it('opens as soon as it renders, with its heading and message', async () => {
    const { root } = await render();

    expect(root.querySelector('dialog')?.open).toBe(true);
    expect(root.querySelector('h2')?.textContent.trim()).toBe('Delete this Stock?');
    expect(root.querySelector('p')?.textContent.trim()).toBe(
      'The Stock and its Parts are removed.',
    );
  });

  it('answers true once when the confirm action is chosen', async () => {
    const { fixture, root } = await render();

    button(root, 'Delete').click();
    button(root, 'Cancel').click();

    expect(fixture.componentInstance.answers).toEqual([true]);
  });

  it('answers false when closed from its close button', async () => {
    const { fixture, root } = await render();

    button(root, 'Close').click();
    await fixture.whenStable();

    expect(fixture.componentInstance.answers).toEqual([false]);
  });

  it('has no axe violations', async () => {
    const { root } = await render();

    await expectNoAxeViolations(root);
  });
});
