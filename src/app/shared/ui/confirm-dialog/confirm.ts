import {
  ApplicationRef,
  createComponent,
  DOCUMENT,
  EnvironmentInjector,
  inject,
  Service,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { ConfirmDialog } from './confirm-dialog';

/** What to ask. Texts are already translated by the caller. */
export interface ConfirmOptions {
  readonly heading: string;
  readonly message: string;
  readonly confirmLabel: string;
  /** Defaults to a translated "Cancel". */
  readonly cancelLabel?: string;
  /** `danger` for destructive actions: an alert dialog with focus on Cancel. Defaults to `primary`. */
  readonly variant?: 'primary' | 'danger';
}

/**
 * Asks the woodworker to confirm an action with a single call. It creates a
 * `wt-confirm-dialog` at runtime, appends it to the page and destroys it when it
 * closes. Only one confirmation can be open at a time.
 */
@Service()
export class ConfirmService {
  private readonly appRef = inject(ApplicationRef);

  private readonly injector = inject(EnvironmentInjector);

  private readonly document = inject(DOCUMENT);

  /** Closes the open confirmation, resolving it with the given answer. */
  private settleOpen: ((confirmed: boolean) => void) | undefined;

  constructor() {
    inject(Router).events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.settleOpen?.(false);
      }
    });
  }

  /**
   * Resolves `true` when the confirm action is chosen, `false` on Cancel, Escape,
   * the close button, or when the page navigates away.
   * @returns a promise rejected with an Error when a confirmation is already open.
   */
  async confirm(options: ConfirmOptions): Promise<boolean> {
    if (this.settleOpen) {
      throw new Error('A confirmation is already open');
    }
    const active = this.document.activeElement;
    const opener = active instanceof HTMLElement ? active : null;
    const host = this.document.body.appendChild(this.document.createElement('wt-confirm-dialog'));
    const ref = createComponent(ConfirmDialog, {
      environmentInjector: this.injector,
      hostElement: host,
    });
    ref.setInput('heading', options.heading);
    ref.setInput('message', options.message);
    ref.setInput('confirmLabel', options.confirmLabel);
    ref.setInput('cancelLabel', options.cancelLabel);
    ref.setInput('variant', options.variant ?? 'primary');

    return new Promise<boolean>((resolve) => {
      const settle = (confirmed: boolean): void => {
        this.settleOpen = undefined;
        ref.destroy();
        host.remove();
        this.restoreFocus(opener);
        resolve(confirmed);
      };
      this.settleOpen = settle;
      ref.instance.answered.subscribe(settle);
      this.appRef.attachView(ref.hostView);
    });
  }

  /** Gives focus back to `opener` unless the page has already moved it somewhere else. */
  private restoreFocus(opener: HTMLElement | null): void {
    const active = this.document.activeElement;
    const focusIsLost = active === null || active === this.document.body;
    if (opener?.isConnected && focusIsLost) {
      opener.focus();
    }
  }
}
