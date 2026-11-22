import type { Locator } from '@playwright/test';
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

/**
 * The whole flow in each language. en-GB and es-ES both default to the Metric Unit System (unlike
 * en-US, used elsewhere in this file), so the
 * worked example reads the same in both: 2400 mm Stock as needed, 3 mm Kerf, no Trim and a
 * 300 mm minimum Offcut length (the defaults).
 * - Six 600 mm legs: four take 2400 mm plus 3 Kerfs, too long, so each Stock holds three and
 *   keeps 2400 - 3 × 600 - 3 × 3 = 591 mm, an Offcut. Two Stock, 6 Kerfs: 18 mm of Waste.
 * - A 2500 mm top is longer than the 2400 mm usable length of every Stock: Unplaced.
 */
const FLOW_LANGUAGES = [
  {
    locale: 'en-GB',
    tool: 'Cut Optimizer',
    stock: 'Stock',
    stockEntry: 'Stock 1',
    cutList: 'Cut List',
    part: (n: number) => `Part ${n}`,
    name: 'Name (optional)',
    length: 'Length',
    quantity: 'Quantity',
    addPart: 'Add Part',
    generate: 'Generate Cutting Plan',
    plan: 'Cutting Plan',
    summary: [
      'Stock used',
      '2 in total',
      '2 × 2400 mm',
      'Waste',
      '18 mm',
      'Leftover Waste, Trim and Kerf added up.',
      'Offcuts to keep',
      '591 mm, 591 mm',
    ],
    unplaced: 'Unplaced Parts (1)',
    unplacedPart:
      '1× top, 2500 mm. Longer than the usable length of every Stock (2400 mm at most). Add longer Stock.',
    layouts: 'Layouts',
    group: '2× Stock 2400 mm',
    showEveryStock: 'Show every Stock',
    everyStock: ['Stock 1 of 2 · 2400 mm', 'Stock 2 of 2 · 2400 mm'],
    outOfDate: 'Out of date',
  },
  {
    locale: 'es-ES',
    tool: 'Optimizador de cortes',
    stock: 'Material',
    stockEntry: 'Material 1',
    cutList: 'Lista de piezas',
    part: (n: number) => `Pieza ${n}`,
    name: 'Nombre (opcional)',
    length: 'Longitud',
    quantity: 'Cantidad',
    addPart: 'Añadir pieza',
    generate: 'Generar plan de corte',
    plan: 'Plan de corte',
    summary: [
      'Material usado',
      '2 en total',
      '2 × 2400 mm',
      'Desperdicio',
      '18 mm',
      'Suma de sobrantes desperdiciados, saneado y grosor de corte.',
      'Retales para guardar',
      '591 mm, 591 mm',
    ],
    unplaced: 'Piezas sin colocar (1)',
    unplacedPart:
      '1× top, 2500 mm. Más larga que la longitud útil de todo el material (2400 mm como máximo). Añade material más largo.',
    layouts: 'Distribución por material',
    group: '2× material de 2400 mm',
    showEveryStock: 'Mostrar cada material por separado',
    everyStock: ['Material 1 de 2 · 2400 mm', 'Material 2 de 2 · 2400 mm'],
    outOfDate: 'Desactualizado',
  },
] as const;

for (const copy of FLOW_LANGUAGES) {
  test.describe(`the whole flow in a ${copy.locale} browser`, () => {
    test.use({ locale: copy.locale });

    test('builds a Cutting Plan from the home page and marks it out of date after an edit', async ({
      page,
    }) => {
      await page.goto('/');
      await page
        .getByRole('main')
        .getByRole('link', { name: new RegExp(copy.tool, 'u') })
        .click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(copy.tool);

      await page
        .getByRole('region', { name: copy.stock, exact: true })
        .getByRole('group', { name: copy.stockEntry })
        .getByLabel(copy.length)
        .fill('2400 mm');
      const cutList = page.getByRole('region', { name: copy.cutList });
      const legs = cutList.getByRole('group', { name: copy.part(1) });
      await legs.getByLabel(copy.name).fill('leg');
      await legs.getByLabel(copy.length).fill('600 mm');
      await legs.getByLabel(copy.quantity).fill('6');
      await cutList.getByRole('button', { name: copy.addPart }).click();
      const top = cutList.getByRole('group', { name: copy.part(2) });
      await top.getByLabel(copy.name).fill('top');
      await top.getByLabel(copy.length).fill('2500 mm');
      await top.getByLabel(copy.quantity).fill('1');
      await page.getByRole('button', { name: copy.generate }).click();

      const summary = page.getByRole('group', { name: copy.plan });
      await expect(summary).toBeFocused();
      await expect(summary.locator('dt, dd')).toHaveText([...copy.summary]);
      const plan = page.getByRole('region', { name: copy.plan });
      await expect(
        plan.getByRole('region', { name: copy.unplaced }).getByRole('listitem'),
      ).toHaveText(copy.unplacedPart, { useInnerText: true });

      const layouts = plan.getByRole('region', { name: copy.layouts });
      const headings = layouts.getByRole('heading', { level: 4 });
      await expect(headings).toHaveText([copy.group]);
      await layouts.getByRole('checkbox', { name: copy.showEveryStock }).check();
      await expect(headings).toHaveText([...copy.everyStock]);

      await expect(plan.getByText(copy.outOfDate, { exact: true })).toHaveCount(0);
      await legs.getByLabel(copy.quantity).fill('5');

      await expect(plan.getByText(copy.outOfDate, { exact: true })).toBeVisible();
      await expect(headings).toHaveText([...copy.everyStock]);
    });
  });
}

test.describe('from the keyboard alone', () => {
  // Metric, so the Stock lengths read in millimetres.
  test.use({ locale: 'en-GB' });

  test('a keyboard-only run adds a Stock and a Part and generates the Cutting Plan', async ({
    page,
  }) => {
    await page.goto('/cut-optimizer');
    const stock = page.getByRole('region', { name: 'Stock', exact: true });
    const stock1 = stock.getByRole('group', { name: 'Stock 1' });
    const stock2 = stock.getByRole('group', { name: 'Stock 2' });
    const cutList = page.getByRole('region', { name: 'Cut List' });
    const part1 = cutList.getByRole('group', { name: 'Part 1' });
    const part2 = cutList.getByRole('group', { name: 'Part 2' });
    const jobSettings = page.getByRole('region', { name: 'Job settings' });
    const generate = page.getByRole('button', { name: 'Generate Cutting Plan' });
    /** Presses Tab and checks it lands on `next`, so every stop of the Tab order is pinned. */
    const tabTo = async (next: Locator): Promise<void> => {
      await page.keyboard.press('Tab');
      await expect(next).toBeFocused();
    };
    // The keyboard starts at the first field of the page.
    await stock1.getByLabel('Length').focus();
    await page.keyboard.type('2400 mm');
    await tabTo(stock1.getByLabel('Quantity'));
    await tabTo(stock1.getByRole('button', { name: 'Remove Stock 1' }));
    await tabTo(stock.getByRole('button', { name: 'Add Stock' }));
    await page.keyboard.press('Enter');
    await expect(stock2.getByLabel('Length')).toBeFocused();
    await page.keyboard.type('1000 mm');
    await tabTo(stock2.getByLabel('Quantity'));
    await page.keyboard.type('1');
    await tabTo(stock2.getByRole('button', { name: 'Remove Stock 2' }));
    await tabTo(stock.getByRole('button', { name: 'Add Stock' }));
    await tabTo(part1.getByLabel('Name (optional)'));
    await page.keyboard.type('leg');
    await tabTo(part1.getByLabel('Length'));
    await page.keyboard.type('600 mm');
    await tabTo(part1.getByLabel('Quantity'));
    await page.keyboard.type('3');
    await tabTo(part1.getByRole('button', { name: 'Remove Part 1' }));
    await tabTo(cutList.getByRole('button', { name: 'Add Part' }));
    await page.keyboard.press('Enter');
    await expect(part2.getByLabel('Name (optional)')).toBeFocused();
    await page.keyboard.type('rail');
    await tabTo(part2.getByLabel('Length'));
    await page.keyboard.type('900 mm');
    await tabTo(part2.getByLabel('Quantity'));
    await page.keyboard.type('1');
    // A disabled button is left out of the Tab order: the input is complete only now.
    await expect(generate).toBeEnabled();
    await tabTo(part2.getByRole('button', { name: 'Remove Part 2' }));
    await tabTo(cutList.getByRole('button', { name: 'Add Part' }));
    await tabTo(jobSettings.getByRole('link', { name: 'Change your defaults in Settings' }));
    await tabTo(jobSettings.getByLabel('Kerf'));
    await tabTo(jobSettings.getByLabel('Trim at each end'));
    await tabTo(jobSettings.getByLabel('Minimum Offcut Length'));
    await tabTo(jobSettings.getByLabel('Strategy'));
    await tabTo(generate);

    await page.keyboard.press('Enter');

    // Three 600 mm legs and a 900 mm rail need two Stock; 2400 mm and the added 1000 mm Stock
    // are less total Stock length than two of 2400 mm.
    const summary = page.getByRole('group', { name: 'Cutting Plan' });
    await expect(summary).toBeFocused();
    await expect(summary).toContainText('2 in total');
    await expect(summary).toContainText('1 × 1000 mm');
    await expect(summary).toContainText('1 × 2400 mm');
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
