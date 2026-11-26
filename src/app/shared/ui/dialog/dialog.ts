import type { ElementRef } from '@angular/core';
import {
  afterRenderEffect,
  Component,
  DOCUMENT,
  inject,
  input,
  model,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../icon/icon';

let nextId = 0;

/**
 * A modal dialog (design system: Dialog) on a native `<dialog>` opened with
 * `showModal()`: the rest of the page is inert under a scrim until it closes.
 * `heading` names it and shows as its `h2`. Bind `[(open)]`: closing it by any
 * means (Escape, its close button) sets `open` back to false. A click on the
 * backdrop does not close it.
 *
 * On open, focus moves to the element with `autofocus` inside it, or else to
 * its close button; on close, it goes back to the element that had it, unless
 * the page has already moved it elsewhere.
 * Put the body inside it, and mark each action button `dialog-action`: they
 * share a row at the end, in DOM order, and stack full width when the dialog
 * is narrow.
 *
 * ```html
 * <wt-dialog heading="Reset all settings?" [(open)]="confirming">
 *   <p>Your Settings go back to their defaults.</p>
 *   <button wt-button dialog-action type="button">Cancel</button>
 * </wt-dialog>
 * ```
 */
@Component({
  selector: 'wt-dialog',
  imports: [Icon, TranslocoPipe],
  templateUrl: './dialog.html',
  styleUrl: './dialog.css',
})
export class Dialog {
  private readonly document = inject(DOCUMENT);

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  private readonly closeButton = viewChild.required<ElementRef<HTMLButtonElement>>('closeButton');

  /** The element that had focus before the dialog opened, to give focus back to. */
  private opener: HTMLElement | null = null;

  readonly heading = input.required<string>();

  /** Set for a dialog that needs an answer (a destructive confirmation): it gets `role="alertdialog"`. */
  readonly alert = input(false);

  /** Whether the dialog is open. */
  readonly open = model(false);

  protected readonly headingId = `wt-dialog-${String(nextId++)}-heading`;

  constructor() {
    afterRenderEffect({
      write: () => {
        const dialog = this.dialog().nativeElement;
        if (this.open() && !dialog.open) {
          this.show(dialog);
        } else if (!this.open() && dialog.open) {
          dialog.close();
        }
      },
    });
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  /**
   * Handles the native `close` event, whatever closed the dialog (Escape, the close
   * button, `open` set to false): syncs `open` and gives focus back to the opener,
   * unless the page has already moved focus somewhere else.
   */
  protected onDialogClosed(): void {
    this.open.set(false);
    const { opener } = this;
    this.opener = null;
    const active = this.document.activeElement;
    const focusIsLost =
      active === null ||
      active === this.document.body ||
      this.dialog().nativeElement.contains(active);
    if (opener?.isConnected && focusIsLost) {
      opener.focus();
    }
  }

  private show(dialog: HTMLDialogElement): void {
    const active = this.document.activeElement;
    this.opener = active instanceof HTMLElement ? active : null;
    dialog.showModal();
    if (!dialog.contains(this.document.activeElement)) {
      this.closeButton().nativeElement.focus();
    }
  }
}
