import { expect, test } from '@playwright/test';

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
});
