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
