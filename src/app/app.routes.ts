import type { Routes } from '@angular/router';
import type { PageMetaData } from './core/page-meta/page-meta';
import type { ToolEntry } from './core/tool-registry/tool-entry';
import { toolRoutes } from './core/tool-registry/tool-routes';
import { TOOLS } from './core/tool-registry/tools';

/**
 * The home page, the settings page, one route per registered Tool, and a not-found page for any
 * other address. Route titles are translation keys (TranslatedTitleStrategy), and so are the descriptions in
 * their data (`providePageMeta`).
 */
export function appRoutes(tools: readonly ToolEntry[]): Routes {
  return [
    {
      path: '',
      pathMatch: 'full',
      data: { description: 'app.description' } satisfies PageMetaData,
      loadComponent: async () => import('./home/home.page'),
    },
    {
      path: 'settings',
      title: 'settings.title',
      data: { description: 'settings.description' } satisfies PageMetaData,
      loadComponent: async () => import('./settings/settings.page'),
    },
    ...toolRoutes(tools),
    {
      path: '**',
      title: 'notFound.title',
      data: { noindex: true } satisfies PageMetaData,
      loadComponent: async () => import('./not-found/not-found.page'),
    },
  ];
}

export const routes: Routes = appRoutes(TOOLS);
