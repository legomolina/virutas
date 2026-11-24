import type { Routes } from '@angular/router';
import type { PageMetaData } from '../page-meta/page-meta';
import type { ToolEntry } from './tool-entry';

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The router's routes for the registered Tools: one lazy route per Tool at
 * `/<path>`, titled with the Tool's name. Throws on a path that is not kebab-case or is taken twice, so a
 * bad registry entry fails at startup and in every test that builds the routes.
 */
export function toolRoutes(tools: readonly ToolEntry[]): Routes {
  const seen = new Set<string>();
  for (const { path } of tools) {
    if (!KEBAB_CASE.test(path)) {
      throw new Error(
        `Tool path ${JSON.stringify(path)} must be kebab-case, such as "unit-converter".`,
      );
    }
    if (seen.has(path)) {
      throw new Error(`Two Tools are registered at the path "${path}".`);
    }
    seen.add(path);
  }
  // The route's title and description are translation keys: TranslatedTitleStrategy and
  // providePageMeta translate them.
  return tools.map(({ path, nameKey, descriptionKey, loadRoutes }) => ({
    path,
    title: nameKey,
    data: { description: descriptionKey } satisfies PageMetaData,
    loadChildren: loadRoutes,
  }));
}
