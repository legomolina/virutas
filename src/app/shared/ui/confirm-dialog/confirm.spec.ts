import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { expectNoAxeViolations } from '../../../../testing/expect-no-axe-violations';
import { translocoTesting } from '../../../../testing/transloco-testing';
import type { ConfirmOptions } from './confirm';
import { ConfirmService } from './confirm';

@Component({ selector: 'wt-page', template: '' })
class Page {}

const DELETE: ConfirmOptions = {
  heading: 'Delete this Stock?',
  message: 'The Stock and its Parts are removed.',
  confirmLabel: 'Delete',
};

/**
 * jsdom lacks `showModal()` and `close()`. This gives every `<dialog>` the browser's
 * behaviour: `showModal()` opens it and focuses its `autofocus` element, `close()` closes
 * it and fires `close`.
 */
function fakeDialogApi(): () => void {
  const { prototype } = HTMLDialogElement;
  Object.assign(prototype, {
    showModal(this: HTMLDialogElement): void {
      this.setAttribute('open', '');
      this.querySelector<HTMLElement>('[autofocus]')?.focus();
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

function setup(): { confirm: ConfirmService; router: Router } {
  TestBed.configureTestingModule({
    imports: [translocoTesting()],
    providers: [
      provideRouter([
        { path: '', component: Page },
        { path: 'other', component: Page },
      ]),
    ],
  });
  return { confirm: TestBed.inject(ConfirmService), router: TestBed.inject(Router) };
}

async function render(): Promise<void> {
  await Promise.resolve();
  TestBed.tick();
  await new Promise<void>((resolve) => {
    setTimeout(resolve);
  });
}

function dialog(): HTMLDialogElement {
  const match = document.querySelector('dialog');
  if (!match) {
    throw new Error('No dialog on the page.');
  }
  return match;
}

function button(name: string): HTMLButtonElement {
  const match = [...document.querySelectorAll('dialog button')].find(
    (candidate) => (candidate.getAttribute('aria-label') ?? candidate.textContent.trim()) === name,
  );
  if (!(match instanceof HTMLButtonElement)) {
    throw new Error(`No button named "${name}".`);
  }
  return match;
}

describe('ConfirmService', () => {
  let restoreDialogApi: () => void;

  beforeEach(() => {
    restoreDialogApi = fakeDialogApi();
  });

  afterEach(() => {
    restoreDialogApi();
    document.body.replaceChildren();
  });

  it('shows the texts it was given in an open modal dialog', async () => {
    const { confirm } = setup();

    void confirm.confirm(DELETE);
    await render();

    expect(dialog().open).toBe(true);
    expect(dialog().querySelector('h2')?.textContent.trim()).toBe('Delete this Stock?');
    expect(dialog().querySelector('p')?.textContent.trim()).toBe(
      'The Stock and its Parts are removed.',
    );
    expect(button('Delete').type).toBe('button');
  });

  it('resolves true when the confirm action is chosen, and removes the dialog', async () => {
    const { confirm } = setup();
    const answer = confirm.confirm(DELETE);
    await render();

    button('Delete').click();

    expect(await answer).toBe(true);
    expect(document.querySelector('dialog')).toBeNull();
  });

  it('resolves false on Cancel', async () => {
    const { confirm } = setup();
    const answer = confirm.confirm(DELETE);
    await render();

    button('Cancel').click();

    expect(await answer).toBe(false);
  });

  it('resolves false on the close button', async () => {
    const { confirm } = setup();
    const answer = confirm.confirm(DELETE);
    await render();

    button('Close').click();

    expect(await answer).toBe(false);
  });

  // jsdom has no Escape handling: the browser closes a modal dialog and fires `close`.
  it('resolves false on Escape', async () => {
    const { confirm } = setup();
    const answer = confirm.confirm(DELETE);
    await render();

    dialog().close();

    expect(await answer).toBe(false);
  });

  it('labels Cancel in the active language unless cancelLabel is given', async () => {
    const { confirm } = setup();
    TestBed.inject(TranslocoService).setActiveLang('es');
    void confirm.confirm(DELETE);
    await render();

    expect(button('Cancelar').type).toBe('button');
  });

  it('uses the cancelLabel it was given', async () => {
    const { confirm } = setup();
    void confirm.confirm({ ...DELETE, cancelLabel: 'Keep it' });
    await render();

    expect(button('Keep it').type).toBe('button');
  });

  it('is a plain dialog with a primary confirm button by default', async () => {
    const { confirm } = setup();
    void confirm.confirm(DELETE);
    await render();

    expect(dialog().hasAttribute('role')).toBe(false);
    expect(button('Delete').getAttribute('variant')).toBe('primary');
  });

  it('is an alert dialog with a danger confirm button and focus on Cancel for danger', async () => {
    const { confirm } = setup();
    void confirm.confirm({ ...DELETE, variant: 'danger' });
    await render();

    expect(dialog().getAttribute('role')).toBe('alertdialog');
    expect(button('Delete').getAttribute('variant')).toBe('danger');
    expect(document.activeElement).toBe(button('Cancel'));
  });

  it('fails with an Error while another confirmation is open', async () => {
    const { confirm } = setup();
    void confirm.confirm(DELETE);
    await render();

    await expect(confirm.confirm(DELETE)).rejects.toThrow(Error);
  });

  it('accepts a new confirmation once the previous one closed', async () => {
    const { confirm } = setup();
    const first = confirm.confirm(DELETE);
    await render();
    button('Cancel').click();
    await first;

    const second = confirm.confirm(DELETE);
    await render();
    button('Delete').click();

    expect(await second).toBe(true);
  });

  it('closes and resolves false when the page navigates elsewhere', async () => {
    const { confirm, router } = setup();
    await router.navigateByUrl('/');
    const answer = confirm.confirm(DELETE);
    await render();

    await router.navigateByUrl('/other');

    expect(await answer).toBe(false);
    expect(document.querySelector('dialog')).toBeNull();
  });

  it('gives focus back to the element that had it before it opened', async () => {
    const { confirm } = setup();
    const trigger = document.body.appendChild(document.createElement('button'));
    trigger.focus();
    const answer = confirm.confirm({ ...DELETE, variant: 'danger' });
    await render();

    button('Delete').click();
    await answer;

    expect(document.activeElement).toBe(trigger);
  });

  it('gives focus back after Escape too', async () => {
    const { confirm } = setup();
    const trigger = document.body.appendChild(document.createElement('button'));
    trigger.focus();
    const answer = confirm.confirm(DELETE);
    await render();

    dialog().close();
    await answer;

    expect(document.activeElement).toBe(trigger);
  });

  it('has no axe violations while open', async () => {
    const { confirm } = setup();
    void confirm.confirm({ ...DELETE, variant: 'danger' });
    await render();

    await expectNoAxeViolations(dialog());
  });
});
