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
import type { StockEntryTexts } from '../../stock-entry.calc';
import { readStockEntry } from '../../stock-entry.calc';

/** A Stock entry as typed, with an id that stays the same while the entry exists. */
export interface StockRow extends StockEntryTexts {
  readonly id: number;
}

/** A new, empty Stock entry whose id is not used by any of `rows`. */
export function emptyStockRow(rows: readonly StockRow[] = []): StockRow {
  return { id: Math.max(0, ...rows.map((row) => row.id)) + 1, length: '', quantity: '' };
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

  readonly entries = model.required<readonly StockRow[]>();

  /** The preferred Unit System, which bare numbers are read in. */
  readonly unitSystem = input.required<UnitSystem>();

  /** Each entry with what is wrong with its values. */
  protected readonly rows = computed(() =>
    this.entries().map((row) => ({
      row,
      errors: readStockEntry(row, this.unitSystem()).errors,
    })),
  );

  protected setLength(id: number, length: string): void {
    this.entries.update((rows) => rows.map((row) => (row.id === id ? { ...row, length } : row)));
  }

  protected setQuantity(id: number, quantity: string): void {
    this.entries.update((rows) => rows.map((row) => (row.id === id ? { ...row, quantity } : row)));
  }

  /** Adds an empty entry at the end and moves focus to its length. */
  protected add(): void {
    const added = emptyStockRow(this.entries());
    this.entries.update((rows) => [...rows, added]);
    this.focusAfterRender(`#stock-${added.id}-length`);
  }

  /**
   * Removes an entry and moves focus to the length of the entry that takes its place, or of the
   * one before it when it was the last, or to "Add Stock" when none is left.
   */
  protected remove(id: number): void {
    const rows = this.entries();
    const index = rows.findIndex((row) => row.id === id);
    const remaining = rows.filter((row) => row.id !== id);
    const next = remaining.at(Math.min(index, remaining.length - 1));
    this.entries.set(remaining);
    this.focusAfterRender(next === undefined ? this.addButton() : `#stock-${next.id}-length`);
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
