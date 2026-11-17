import { Component, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { SettingsStore } from '../../core/settings/settings-store';
import { StockSection } from './components/stock-section/stock-section';
import type { TypedStockEntry } from './stock-entry.calc';
import { emptyStockEntry } from './stock-entry.calc';

/** The Cut Optimizer's page. */
@Component({
  selector: 'wt-cut-optimizer-page',
  imports: [TranslocoPipe, StockSection],
  templateUrl: './cut-optimizer.page.html',
  styleUrl: './cut-optimizer.page.css',
})
export default class CutOptimizerPage {
  protected readonly settings = inject(SettingsStore);

  /** The Stock entries as typed; the page starts with one empty entry. */
  protected readonly stock = signal<readonly TypedStockEntry[]>([emptyStockEntry([])]);
}
