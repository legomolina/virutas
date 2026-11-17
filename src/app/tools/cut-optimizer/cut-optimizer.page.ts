import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/** The Cut Optimizer's page. */
@Component({
  selector: 'wt-cut-optimizer-page',
  imports: [TranslocoPipe],
  templateUrl: './cut-optimizer.page.html',
  styleUrl: './cut-optimizer.page.css',
})
export default class CutOptimizerPage {}
