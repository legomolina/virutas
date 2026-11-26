import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { expectNoAxeViolations } from '../../../../testing/expect-no-axe-violations';
import { translocoTesting } from '../../../../testing/transloco-testing';
import { Dialog } from './dialog';

@Component({
  selector: 'wt-host',
  imports: [Dialog],
  template: `
    <button type="button" (click)="open.set(true)">Reset all settings</button>
    <wt-dialog [heading]="heading()" [(open)]="open">
      <p>Your Settings go back to their defaults.</p>
      <button dialog-action type="button" (click)="open.set(false)">Cancel</button>
      <button dialog-action type="button">Reset</button>
    </wt-dialog>
    <button type="button">Undo</button>
  `,
})
class Host {
  readonly open = signal(false);
  readonly heading = signal('Reset all settings?');
}

function dialog(root: HTMLElement): HTMLDialogElement {
  const match = root.querySelector('dialog');
  if (!match) {
    throw new Error('No dialog rendered.');
  }
  return match;
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

/**
 * Gives a `<dialog>` the part of the dialog API jsdom lacks: `showModal()` and
 * `close()`, which set `open` and fire `close` like the browser does.
 */
function fakeDialog(element: HTMLDialogElement): void {
  Object.assign(element, {
    showModal: (): void => {
      element.setAttribute('open', '');
    },
    close: (): void => {
      if (element.hasAttribute('open')) {
        element.removeAttribute('open');
        element.dispatchEvent(new Event('close'));
      }
    },
  });
}

/** Makes `showModal()` move focus to `target`, as the browser does for an `autofocus` element. */
function focusOnShow(element: HTMLDialogElement, target: HTMLElement): void {
  const showModal = element.showModal.bind(element);
  Object.assign(element, {
    showModal: (): void => {
      showModal();
      target.focus();
    },
  });
}

async function render(): Promise<{ fixture: ComponentFixture<Host>; root: HTMLElement }> {
  TestBed.configureTestingModule({ imports: [translocoTesting()] });
  const fixture = TestBed.createComponent(Host);
  document.body.append(fixture.nativeElement as HTMLElement);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  fakeDialog(dialog(root));
  return { fixture, root };
}

/** Opens the dialog the way a woodworker does: from the button that triggers it. */
async function openFromTrigger(fixture: ComponentFixture<Host>, root: HTMLElement): Promise<void> {
  const trigger = button(root, 'Reset all settings');
  trigger.focus();
  trigger.click();
  await fixture.whenStable();
}

/** The text of the elements an id-list attribute (`aria-labelledby`) points at. */
function referencedText(element: Element, attribute: string): string {
  return (element.getAttribute(attribute) ?? '')
    .split(' ')
    .filter((id) => id !== '')
    .map((id) => document.getElementById(id)?.textContent.trim())
    .join(' ');
}

describe('Dialog', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('stays closed until it is opened', async () => {
    const { root } = await render();

    expect(dialog(root).open).toBe(false);
  });

  it('opens modally when open is set', async () => {
    const { fixture, root } = await render();
    const showModal = vi.spyOn(dialog(root), 'showModal');

    await openFromTrigger(fixture, root);

    expect(showModal).toHaveBeenCalledOnce();
    expect(dialog(root).open).toBe(true);
  });

  it('closes when open is set back to false', async () => {
    const { fixture, root } = await render();
    await openFromTrigger(fixture, root);

    button(root, 'Cancel').click();
    await fixture.whenStable();

    expect(dialog(root).open).toBe(false);
  });

  it('has its heading as an h2 that names it', async () => {
    const { root } = await render();

    expect(root.querySelector('dialog h2')?.textContent.trim()).toBe('Reset all settings?');
    expect(referencedText(dialog(root), 'aria-labelledby')).toBe('Reset all settings?');
  });

  it('follows a change of its heading', async () => {
    const { fixture, root } = await render();

    fixture.componentInstance.heading.set('Delete this Stock?');
    await fixture.whenStable();

    expect(referencedText(dialog(root), 'aria-labelledby')).toBe('Delete this Stock?');
  });

  it('gives each dialog its own heading id', async () => {
    const { root } = await render();
    const other = TestBed.createComponent(Host);
    document.body.append(other.nativeElement as HTMLElement);
    await other.whenStable();

    const ids = [root, other.nativeElement as HTMLElement].map((container) =>
      dialog(container).getAttribute('aria-labelledby'),
    );
    expect(new Set(ids).size).toBe(2);
  });

  it('closes from its close button, setting open back to false', async () => {
    const { fixture, root } = await render();
    await openFromTrigger(fixture, root);

    button(root, 'Close').click();
    await fixture.whenStable();

    expect(dialog(root).open).toBe(false);
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it('names its close button in the active language', async () => {
    const { fixture, root } = await render();

    TestBed.inject(TranslocoService).setActiveLang('es');
    await fixture.whenStable();

    expect(button(root, 'Cerrar').type).toBe('button');
  });

  // jsdom has no Escape handling for dialogs. The browser closes a modal dialog on
  // Escape and fires `close`, as it does for any other way of closing it.
  it('sets open back to false whenever the native dialog closes, as on Escape', async () => {
    const { fixture, root } = await render();
    await openFromTrigger(fixture, root);

    dialog(root).close();
    await fixture.whenStable();

    expect(fixture.componentInstance.open()).toBe(false);
  });

  // jsdom has no backdrop: this checks the attribute that tells the browser to close the
  // dialog on a close request (Escape) and never on a click outside it.
  it('declares that only a close request closes it, not a click on the backdrop', async () => {
    const { root } = await render();

    expect(dialog(root).getAttribute('closedby')).toBe('closerequest');
  });

  it('moves focus into the dialog, to its close button, when it opens', async () => {
    const { fixture, root } = await render();

    await openFromTrigger(fixture, root);

    expect(document.activeElement).toBe(button(root, 'Close'));
  });

  it('keeps focus where the browser put it when that is inside the dialog', async () => {
    const { fixture, root } = await render();
    const cancel = button(root, 'Cancel');
    focusOnShow(dialog(root), cancel);

    await openFromTrigger(fixture, root);

    expect(document.activeElement).toBe(cancel);
  });

  it('gives focus back to the element that had it when it closes', async () => {
    const { fixture, root } = await render();
    focusOnShow(dialog(root), button(root, 'Cancel'));
    await openFromTrigger(fixture, root);

    button(root, 'Close').click();
    await fixture.whenStable();

    expect(document.activeElement).toBe(button(root, 'Reset all settings'));
  });

  it('leaves focus where the page moved it once the dialog closed', async () => {
    const { fixture, root } = await render();
    await openFromTrigger(fixture, root);

    button(root, 'Undo').focus();
    dialog(root).close();
    await fixture.whenStable();

    expect(document.activeElement).toBe(button(root, 'Undo'));
  });

  it('renders its projected body and actions in place', async () => {
    const { root } = await render();

    const body = dialog(root).querySelector('p');
    const actions = [...dialog(root).querySelectorAll('[dialog-action]')];
    expect(body?.textContent.trim()).toBe('Your Settings go back to their defaults.');
    expect(actions.map((action) => action.textContent.trim())).toEqual(['Cancel', 'Reset']);
    expect(actions[0]?.parentElement).not.toBe(body?.parentElement);
    expect(actions[0]?.parentElement).toBe(actions[1]?.parentElement);
  });

  it('has no axe violations while open', async () => {
    const { fixture, root } = await render();
    await openFromTrigger(fixture, root);

    await expectNoAxeViolations(root);
  });
});
