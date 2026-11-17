import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { UnitSystem } from '../../../../shared/measurement/unit-system';
import { Button } from '../../../../shared/ui/button/button';
import { TextField } from '../../../../shared/ui/text-field/text-field';
import type { StockEntryTexts, TypedStockEntry } from '../../stock-entry.calc';
import { emptyStockEntry, readStockEntry } from '../../stock-entry.calc';

/** The id of the length input of the Stock entry `id`, unique on the page. */
function lengthFieldId(id: number): string {
  return `stock-${id}-length`;
}

/**
 * The Stock section of the Cut Optimizer: one entry per Stock, each with a length and an optional
 * quantity, which the woodworker adds, edits and removes. Each value that cannot be used shows a
 * message on its own field.
 */
@Component({
  selector: 'wt-stock-section',
  imports: [TranslocoPipe, TextField, Button],
  templateUrl: './stock-section.html',
  styleUrl: './stock-section.css',
})
export class StockSection {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  private readonly addButton = viewChild.required('addButton', {
    read: ElementRef<HTMLButtonElement>,
  });

  readonly entries = model.required<readonly TypedStockEntry[]>();

  /** The preferred Unit System, which bare numbers are read in. */
  readonly unitSystem = input.required<UnitSystem>();

  /** Each entry with the ids of its fields and what is wrong with its values. */
  protected readonly readings = computed(() =>
    this.entries().map((entry) => ({
      entry,
      lengthId: lengthFieldId(entry.id),
      quantityId: `stock-${entry.id}-quantity`,
      errors: readStockEntry(entry, this.unitSystem()).errors,
    })),
  );

  protected update(id: number, change: Partial<StockEntryTexts>): void {
    this.entries.update((entries) =>
      entries.map((entry) => (entry.id === id ? { ...entry, ...change } : entry)),
    );
  }

  /** Adds an empty entry at the end and moves focus to its length. */
  protected add(): void {
    const added = emptyStockEntry(this.entries());
    this.entries.update((entries) => [...entries, added]);
    this.focusAfterRender(`#${lengthFieldId(added.id)}`);
  }

  /**
   * Removes an entry and moves focus to the length of the entry that takes its place, or of the
   * one before it when it was the last, or to "Add Stock" when none is left.
   */
  protected remove(id: number): void {
    const entries = this.entries();
    const index = entries.findIndex((entry) => entry.id === id);
    const remaining = entries.filter((entry) => entry.id !== id);
    const next = remaining.at(Math.min(index, remaining.length - 1));
    this.entries.set(remaining);
    this.focusAfterRender(next === undefined ? this.addButton() : `#${lengthFieldId(next.id)}`);
  }

  /** Focuses `target`, or the element inside this section it selects, once the view is updated. */
  private focusAfterRender(target: string | ElementRef<HTMLElement>): void {
    afterNextRender(
      () => {
        const element =
          typeof target === 'string'
            ? this.host.nativeElement.querySelector<HTMLElement>(target)
            : target.nativeElement;
        element?.focus();
      },
      { injector: this.injector },
    );
  }
}
