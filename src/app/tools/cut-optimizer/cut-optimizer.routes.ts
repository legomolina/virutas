import type { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';

const routes: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('cut-optimizer')],
    loadComponent: async () => import('./cut-optimizer.page'),
  },
];

export default routes;
