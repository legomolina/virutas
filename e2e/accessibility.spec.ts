import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { WCAG_AA_TAGS } from '../src/testing/wcag-aa-tags';
import { generateCuttingPlan } from './cutting-plan';
import { appRoutes } from './routes';

/**
 * Both themes are first-class: every route is audited in each. `surface` is
 * the theme's page background from src/styles/tokens.json, as computed RGB.
 */
const THEMES = [
  { colorScheme: 'light', surface: 'rgb(247, 241, 232)' }, // #f7f1e8
  { colorScheme: 'dark', surface: 'rgb(27, 23, 19)' }, // #1b1713
] as const;

/**
 * Pages in a state their first load does not show, such as a result, audited
 * after `prepare` brings them there.
 */
const PAGE_STATES: readonly {
  readonly name: string;
  readonly path: string;
  readonly heading: string;
  readonly prepare: (page: Page) => Promise<void>;
}[] = [
  {
    name: 'the Cut Optimizer with a Cutting Plan',
    path: '/cut-optimizer',
    heading: 'Cut Optimizer',
    prepare: async (page) => {
      await generateCuttingPlan(page);
      // Every kind of segment, and the marker of a very short Part, is on the page.
      for (const kind of ['part', 'kerf', 'trim', 'offcut', 'waste']) {
        await expect(page.locator(`wt-stock-bar [data-kind="${kind}"]`).first()).toBeVisible();
      }
      await expect(page.locator('wt-stock-bar [data-marker]').first()).toBeVisible();
    },
  },
  {
    name: 'the Settings page with the reset confirmation open',
    path: '/settings',
    heading: 'Settings',
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Reset all settings' }).click();
      await expect(page.getByRole('alertdialog', { name: 'Reset all settings?' })).toBeVisible();
    },
  },
];

/**
 * Opens `path`, checks the right page rendered in the theme in use, lets `prepare` act on it,
 * then returns its axe violations and any page or console errors.
 */
async function audit(
  page: Page,
  {
    path,
    heading,
    colorScheme,
    surface,
    prepare,
  }: {
    path: string;
    heading: string;
    colorScheme: string;
    surface: string;
    prepare?: (page: Page) => Promise<void>;
  },
): Promise<{
  violations: { rule: string; impact: unknown; help: string; elements: string[] }[];
  errors: string[];
}> {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const consoleMessages: { type: string; text: string }[] = [];
  page.on('console', (message) =>
    consoleMessages.push({ type: message.type(), text: message.text() }),
  );

  await page.goto(path);

  // Proves this route's own page rendered: a blank page or a fallback page
  // (e.g. a mistyped path) would otherwise pass every accessibility rule.
  await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
  // Exactly one h1 per page: the shell must not add its own on a Tool page.
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

  // Proves the theme under test is the one applied, both its scheme and its
  // palette, so a broken dark theme cannot pass as a second light run.
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(
    colorScheme,
  );
  await expect(page.locator('body')).toHaveCSS('background-color', surface);

  await prepare?.(page);

  const { violations, incomplete } = await new AxeBuilder({ page })
    .withTags([...WCAG_AA_TAGS])
    .analyze();

  // axe reports contrast it cannot compute (gradients, background images)
  // as incomplete: surface it for a human to check instead of dropping it.
  for (const result of incomplete) {
    test.info().annotations.push({
      type: 'axe-incomplete',
      description: `${result.id}: ${result.nodes.map((node) => node.target.join(' ')).join(', ')}`,
    });
  }

  const consoleErrors = consoleMessages.filter((message) => message.type === 'error');
  return {
    // A compact summary keeps failures readable for humans and agents.
    violations: violations.map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      help: violation.help,
      elements: violation.nodes.map((node) => node.target.join(' ')),
    })),
    errors: [...pageErrors, ...consoleErrors.map((message) => message.text)],
  };
}

for (const { colorScheme, surface } of THEMES) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });

    for (const { path, heading } of appRoutes) {
      test(`${path} renders and has no WCAG AA violations`, async ({ page }) => {
        const { violations, errors } = await audit(page, { path, heading, colorScheme, surface });

        expect(violations).toEqual([]);
        expect(errors).toEqual([]);
      });
    }

    test.describe('page states', () => {
      // `prepare` steps find controls by their English names.
      test.use({ locale: 'en-US' });

      for (const { name, path, heading, prepare } of PAGE_STATES) {
        test(`${name} has no WCAG AA violations`, async ({ page }) => {
          const { violations, errors } = await audit(page, {
            path,
            heading,
            colorScheme,
            surface,
            prepare,
          });

          expect(violations).toEqual([]);
          expect(errors).toEqual([]);
        });
      }
    });
  });
}
