import { Component, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { SettingsStore } from '../../core/settings/settings-store';
import type { StockRow } from './components/stock-section/stock-section';
import { emptyStockRow, StockSection } from './components/stock-section/stock-section';

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
  protected readonly stock = signal<readonly StockRow[]>([emptyStockRow()]);
}
