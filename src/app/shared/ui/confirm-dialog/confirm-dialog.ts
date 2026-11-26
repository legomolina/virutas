import {
  afterNextRender,
  Component,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Button } from '../button/button';
import { Dialog } from '../dialog/dialog';

/**
 * The dialog behind `ConfirmService.confirm()` (design system: ConfirmDialog), on
 * `wt-dialog`. It is created at runtime by the service, never declared in a
 * template. It opens as soon as it renders and emits `answered` once: `true` for
 * the confirm action, `false` for Cancel, Escape or the close button.
 *
 * With `variant="danger"` it is an alert dialog, focus starts on Cancel and the
 * confirm button is `danger`. With `primary` focus stays where the native dialog puts it.
 */
@Component({
  selector: 'wt-confirm-dialog',
  imports: [Button, Dialog, TranslocoPipe],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.css',
})
export class ConfirmDialog {
  private readonly cancel = viewChild.required('cancel', {
    read: ElementRef<HTMLButtonElement>,
  });

  private done = false;

  readonly heading = input.required<string>();

  readonly message = input.required<string>();

  readonly confirmLabel = input.required<string>();

  /** Defaults to the translated "Cancel". */
  readonly cancelLabel = input<string>();

  readonly variant = input<'primary' | 'danger'>('primary');

  readonly answered = output<boolean>();

  protected readonly open = signal(true);

  constructor() {
    // The read phase runs after the dialog opened (its write phase), so this wins over
    // the dialog's own initial focus.
    afterNextRender({
      read: () => {
        const cancel: unknown = this.cancel().nativeElement;
        if (this.variant() === 'danger' && cancel instanceof HTMLElement) {
          cancel.focus();
        }
      },
    });
  }

  protected answer(confirmed: boolean): void {
    if (this.done) {
      return;
    }
    this.done = true;
    this.answered.emit(confirmed);
  }

  protected onOpenChange(open: boolean): void {
    if (!open) {
      this.answer(false);
    }
  }
}
