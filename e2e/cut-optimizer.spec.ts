import { expect, test } from '@playwright/test';
import { generateCuttingPlan } from './cutting-plan';

test.use({ locale: 'en-US' });

test('the Cut Optimizer is bookmarkable at its own address', async ({ page }) => {
  await page.goto('/cut-optimizer');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cut Optimizer');
  await expect(
    page.getByText('Plan how to cut your Parts out of your Stock with the least Waste.'),
  ).toBeVisible();
  await expect(page).toHaveTitle('Cut Optimizer – Woodworking Tools');
});

test('the home page lists the Cut Optimizer and opens it', async ({ page }) => {
  await page.goto('/');

  await page
    .getByRole('main')
    .getByRole('link', { name: /Cut Optimizer/ })
    .click();

  await expect(page).toHaveURL('/cut-optimizer');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cut Optimizer');
});

test.describe('on a wide screen', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the navigation lists the Cut Optimizer', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');

    await page
      .getByRole('navigation', { name: 'Tools' })
      .getByRole('link', { name: 'Cut Optimizer' })
      .click();

    await expect(page).toHaveURL('/cut-optimizer');
  });
});

test.describe('on a narrow screen', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('the Menu lists the Cut Optimizer', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
    await page.getByRole('button', { name: 'Menu' }).click();

    await page
      .getByRole('navigation', { name: 'Tools' })
      .getByRole('link', { name: 'Cut Optimizer' })
      .click();

    await expect(page).toHaveURL('/cut-optimizer');
  });
});

test.describe('the settings', () => {
  test('have a Cut Optimizer section whose defaults follow the Unit System', async ({ page }) => {
    await page.goto('/settings');
    const section = page.getByRole('region', { name: 'Cut Optimizer' });

    await expect(section.getByLabel('Kerf')).toHaveAccessibleDescription(/1\/8"/);

    await page.getByRole('radio', { name: 'Metric' }).check();

    await expect(section.getByLabel('Kerf')).toHaveAccessibleDescription(/3 mm/);
    await expect(section.getByLabel('Minimum Offcut Length')).toHaveAccessibleDescription(/300 mm/);
  });

  test('show a message on a field with a value that is not a length', async ({ page }) => {
    await page.goto('/settings');
    const trim = page.getByRole('region', { name: 'Cut Optimizer' }).getByLabel('Trim');

    await trim.fill('abc');

    await expect(page.getByRole('alert')).toContainText("That isn't a length");
    await expect(trim).toHaveAttribute('aria-invalid', 'true');

    await trim.fill('1/4');

    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});

test.describe('the Cut List', () => {
  test('takes Parts from the keyboard and shows a message on a field that cannot be used', async ({
    page,
  }) => {
    await page.goto('/cut-optimizer');
    const cutList = page.getByRole('region', { name: 'Cut List' });
    const part1 = cutList.getByRole('group', { name: 'Part 1' });

    await part1.getByLabel('Name (optional)').fill('leg');
    await part1.getByLabel('Length').fill('720 mm');
    await part1.getByLabel('Quantity').fill('1.5');

    await expect(part1.getByRole('alert')).toHaveText(
      'The quantity must be a whole number greater than zero.',
    );
    await expect(part1.getByLabel('Quantity')).toHaveAttribute('aria-invalid', 'true');

    await cutList.getByRole('button', { name: 'Add Part' }).press('Enter');

    const part2 = cutList.getByRole('group', { name: 'Part 2' });
    await expect(part2.getByLabel('Name (optional)')).toBeFocused();

    await part2.getByRole('button', { name: 'Remove Part 2' }).press('Enter');

    await expect(part1.getByLabel('Name (optional)')).toBeFocused();
    await expect(cutList.getByRole('group')).toHaveCount(1);
  });
});

test.describe('the Cutting Plan', () => {
  test('is built in a Web Worker and takes focus once it is shown', async ({ page }) => {
    const workers: string[] = [];
    page.on('worker', (worker) => workers.push(worker.url()));
    await page.goto('/cut-optimizer');
    await page
      .getByRole('region', { name: 'Stock' })
      .getByRole('group', { name: 'Stock 1' })
      .getByLabel('Length')
      .fill('2400 mm');
    const part1 = page
      .getByRole('region', { name: 'Cut List' })
      .getByRole('group', { name: 'Part 1' });
    await part1.getByLabel('Name (optional)').fill('leg');
    await part1.getByLabel('Length').fill('720 mm');
    await part1.getByLabel('Quantity').fill('6');

    await page.getByRole('button', { name: 'Generate Cutting Plan' }).click();

    const summary = page.getByRole('group', { name: 'Cutting Plan' });
    await expect(summary).toBeFocused();
    await expect(summary).toContainText('2 in total');
    expect(workers).toEqual([expect.stringMatching(/cut-optimizer.*worker|worker-/u)]);
  });

  test('"Show every Stock" expands and collapses the layouts from the keyboard', async ({
    page,
  }) => {
    await page.goto('/cut-optimizer');
    await page.getByRole('region', { name: 'Stock' }).getByLabel('Length').fill('2400 mm');
    const cutList = page.getByRole('region', { name: 'Cut List' });
    const legs = cutList.getByRole('group', { name: 'Part 1' });
    await legs.getByLabel('Name (optional)').fill('leg');
    await legs.getByLabel('Length').fill('800 mm');
    await legs.getByLabel('Quantity').fill('6');
    await cutList.getByRole('button', { name: 'Add Part' }).click();
    const rails = cutList.getByRole('group', { name: 'Part 2' });
    await rails.getByLabel('Name (optional)').fill('rail');
    await rails.getByLabel('Length').fill('700 mm');
    await rails.getByLabel('Quantity').fill('3');
    await page.getByRole('button', { name: 'Generate Cutting Plan' }).click();

    const layouts = page.getByRole('region', { name: 'Layouts' });
    const headings = layouts.getByRole('heading', { level: 4 });
    const toggle = layouts.getByRole('checkbox', { name: 'Show every Stock' });
    await expect(headings).toHaveCount(1);

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Print Cutting Plan' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Space');

    await expect(toggle).toBeChecked();
    await expect(headings).toHaveCount(3);
    await expect(headings).toHaveText([
      'Stock 1 of 3 · ≈ 94 1/2"',
      'Stock 2 of 3 · ≈ 94 1/2"',
      'Stock 3 of 3 · ≈ 94 1/2"',
    ]);

    await page.keyboard.press('Space');

    await expect(toggle).not.toBeChecked();
    await expect(headings).toHaveCount(1);
  });

  test('draws each Part and Offcut as wide as its share of the Stock', async ({ page }) => {
    await page.goto('/cut-optimizer');
    await generateCuttingPlan(page);
    const bars = page.locator('article wt-stock-bar');
    await expect(bars.first()).toBeVisible();

    // Kerf, Trim and Waste have a minimum width; every other segment shares what is left by its
    // length (its flex-grow). How far, in pixels, each one is from its exact share:
    const offsets = await bars.evaluateAll((elements) =>
      elements.flatMap((bar) => {
        const segments = [
          ...bar.querySelectorAll<HTMLElement>('[data-kind="part"], [data-kind="offcut"]'),
        ].map((segment) => ({
          length: Number(segment.style.flexGrow),
          width: segment.getBoundingClientRect().width,
        }));
        const pixelsPerUnit =
          segments.reduce((sum, { width }) => sum + width, 0) /
          segments.reduce((sum, { length }) => sum + length, 0);
        return segments.map(({ length, width }) => Math.abs(width - length * pixelsPerUnit));
      }),
    );

    expect(offsets.length).toBeGreaterThan(4);
    expect(Math.max(...offsets)).toBeLessThan(1);
  });

  test('keeps Kerf, Trim and Waste visible however short they are', async ({ page }) => {
    await page.goto('/cut-optimizer');
    await generateCuttingPlan(page);
    await expect(page.locator('article wt-stock-bar').first()).toBeVisible();

    const narrowest = (kind: string): Promise<number> =>
      page
        .locator(`article wt-stock-bar [data-kind="${kind}"]`)
        .evaluateAll((segments) =>
          Math.min(...segments.map((segment) => segment.getBoundingClientRect().width)),
        );

    // A 3 mm Kerf, 5 mm Trim and a few mm of Waste are well under a pixel per mm of their Stock.
    expect(await narrowest('kerf')).toBeGreaterThanOrEqual(2);
    expect(await narrowest('trim')).toBeGreaterThanOrEqual(5);
    expect(await narrowest('waste')).toBeGreaterThanOrEqual(4);
  });
});

test.describe('printing', () => {
  test.use({ colorScheme: 'dark' });

  test('prints only the Cutting Plan, in ink on white paper, even when it is out of date', async ({
    page,
  }) => {
    await page.goto('/cut-optimizer');
    // One Stock: a rail fits, the second rail runs out of Stock and the top is too long.
    const stock1 = page
      .getByRole('region', { name: 'Stock' })
      .getByRole('group', { name: 'Stock 1' });
    await stock1.getByLabel('Length').fill('1800 mm');
    await stock1.getByLabel('Quantity').fill('1');
    const cutList = page.getByRole('region', { name: 'Cut List' });
    const rails = cutList.getByRole('group', { name: 'Part 1' });
    await rails.getByLabel('Name (optional)').fill('rail');
    await rails.getByLabel('Length').fill('1000 mm');
    await rails.getByLabel('Quantity').fill('2');
    await cutList.getByRole('button', { name: 'Add Part' }).click();
    const top = cutList.getByRole('group', { name: 'Part 2' });
    await top.getByLabel('Name (optional)').fill('top');
    await top.getByLabel('Length').fill('2000 mm');
    await top.getByLabel('Quantity').fill('1');
    await page.getByRole('button', { name: 'Generate Cutting Plan' }).click();
    const plan = page.getByRole('region', { name: 'Cutting Plan' });
    await expect(plan).toBeVisible();
    await stock1.getByLabel('Quantity').fill('2');
    const masthead = page.getByText('Woodworking Tools · Cut Optimizer', { exact: true });
    await expect(masthead).toBeHidden();
    // Everything that stays on screen, each one shown before printing so its check below means something.
    const screenOnly = [
      page.getByRole('banner'),
      page.getByRole('contentinfo'),
      page.getByRole('heading', { level: 1 }),
      page.getByText('Plan how to cut your Parts out of your Stock with the least Waste.'),
      page.getByRole('region', { name: 'Stock', exact: true }),
      page.getByRole('region', { name: 'Cut List' }),
      page.getByRole('region', { name: 'Job settings' }),
      page.getByRole('button', { name: 'Generate Cutting Plan' }),
      page.getByRole('button', { name: 'Print Cutting Plan' }),
      page.getByRole('checkbox', { name: 'Show every Stock' }),
    ];
    for (const shown of screenOnly) {
      await expect(shown).toBeVisible();
    }

    await page.emulateMedia({ media: 'print' });

    await expect(masthead).toBeVisible();
    await expect(plan).toBeVisible();
    await expect(plan.getByText('Out of date.')).toBeVisible();
    await expect(plan.getByRole('region', { name: 'Unplaced Parts (2)' })).toBeVisible();
    await expect(
      plan.getByRole('region', { name: 'Layouts' }).locator('wt-stock-bar'),
    ).toBeVisible();
    for (const hidden of screenOnly) {
      await expect(hidden).toBeHidden();
    }
    // Trim and Waste hatches are drawn as content, filling their swatch or segment, so they print
    // even where a browser drops background images. Each as [hatch width, height, box width, height]:
    const hatches = await plan
      .locator('wt-hatch')
      .evaluateAll((elements) =>
        elements.map((hatch) => [
          hatch.getBoundingClientRect().width,
          hatch.getBoundingClientRect().height,
          hatch.parentElement?.clientWidth ?? 0,
          hatch.parentElement?.clientHeight ?? 0,
        ]),
      );
    expect(hatches.length).toBeGreaterThanOrEqual(2);
    for (const [width, height, boxWidth, boxHeight] of hatches) {
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
      expect([width, height]).toEqual([boxWidth, boxHeight]);
    }
    // The light theme's ink, never the dark theme's light text, which white paper would hide.
    await expect(plan.getByRole('heading', { level: 2 })).toHaveCSS('color', 'rgb(42, 32, 23)');

    await page.emulateMedia({ media: 'screen' });

    await expect(masthead).toBeHidden();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(plan.getByRole('heading', { level: 2 })).toHaveCSS('color', 'rgb(243, 235, 224)');
  });
});

test('the job and its Cutting Plan are still there after visiting the home page and coming back', async ({
  page,
}) => {
  await page.goto('/cut-optimizer');
  const stock1 = page
    .getByRole('region', { name: 'Stock' })
    .getByRole('group', { name: 'Stock 1' });
  const part1 = page
    .getByRole('region', { name: 'Cut List' })
    .getByRole('group', { name: 'Part 1' });
  const cuttingPlan = page.getByRole('region', { name: 'Cutting Plan' });
  await stock1.getByLabel('Length').fill('2400 mm');
  await part1.getByLabel('Name (optional)').fill('leg');
  await part1.getByLabel('Length').fill('720 mm');
  await part1.getByLabel('Quantity').fill('3');
  await page.getByRole('button', { name: 'Generate Cutting Plan' }).click();
  await expect(cuttingPlan).toBeVisible();

  await page
    .getByRole('banner')
    .getByRole('link', { name: /Woodworking Tools/ })
    .first()
    .click();
  await expect(page).toHaveURL('/');
  await page
    .getByRole('main')
    .getByRole('link', { name: /Cut Optimizer/ })
    .click();

  await expect(stock1.getByLabel('Length')).toHaveValue('2400 mm');
  await expect(part1.getByLabel('Name (optional)')).toHaveValue('leg');
  await expect(part1.getByLabel('Quantity')).toHaveValue('3');
  await expect(cuttingPlan).toBeVisible();
  await expect(cuttingPlan.getByText('Out of date', { exact: true })).toHaveCount(0);

  await page.reload();

  await expect(stock1.getByLabel('Length')).toHaveValue('');
  await expect(part1.getByLabel('Name (optional)')).toHaveValue('');
  await expect(cuttingPlan).toHaveCount(0);
});
