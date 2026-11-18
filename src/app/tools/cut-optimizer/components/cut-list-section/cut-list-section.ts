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
import type { CutListEntryTexts, TypedCutListEntry } from '../../cut-list-entry.calc';
import { emptyCutListEntry, readCutListEntry } from '../../cut-list-entry.calc';
import { entryAfterRemoving } from '../../typed-entry.calc';

/** The id of the name input of the Part `id`, its first field, unique on the page. */
function nameFieldId(id: number): string {
  return `part-${id}-name`;
}

/**
 * The Cut List section of the Cut Optimizer: one entry per Part, each with an optional name, a
 * length and a quantity, which the woodworker adds, edits and removes. Each value that cannot be
 * used shows a message on its own field.
 */
@Component({
  selector: 'wt-cut-list-section',
  imports: [TranslocoPipe, TextField, Button],
  templateUrl: './cut-list-section.html',
  styleUrl: './cut-list-section.css',
})
export class CutListSection {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  private readonly addButton = viewChild.required('addButton', {
    read: ElementRef<HTMLButtonElement>,
  });

  readonly entries = model.required<readonly TypedCutListEntry[]>();

  /** The preferred Unit System, which bare numbers are read in. */
  readonly unitSystem = input.required<UnitSystem>();

  /** Each entry with the ids of its fields and what is wrong with its values. */
  protected readonly readings = computed(() =>
    this.entries().map((entry) => ({
      entry,
      nameId: nameFieldId(entry.id),
      lengthId: `part-${entry.id}-length`,
      quantityId: `part-${entry.id}-quantity`,
      errors: readCutListEntry(entry, this.unitSystem()).errors,
    })),
  );

  protected update(id: number, change: Partial<CutListEntryTexts>): void {
    this.entries.update((entries) =>
      entries.map((entry) => (entry.id === id ? { ...entry, ...change } : entry)),
    );
  }

  /** Adds an empty entry at the end and moves focus to its name. */
  protected add(): void {
    const added = emptyCutListEntry(this.entries());
    this.entries.update((entries) => [...entries, added]);
    this.focusAfterRender(`#${nameFieldId(added.id)}`);
  }

  /**
   * Removes an entry and moves focus to the name of the entry that takes its place, or of the one
   * before it when it was the last, or to "Add Part" when none is left.
   */
  protected remove(id: number): void {
    const next = entryAfterRemoving(this.entries(), id);
    this.entries.update((entries) => entries.filter((entry) => entry.id !== id));
    this.focusAfterRender(next === undefined ? this.addButton() : `#${nameFieldId(next.id)}`);
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
