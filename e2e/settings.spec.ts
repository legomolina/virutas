import { expect, test } from '@playwright/test';

// An en-GB browser starts in English and Metric.
test.use({ locale: 'en-GB' });

// Reaching it from the header (and from the Menu on narrow screens) is covered by shell.spec.ts.
test('the settings page names itself in the title', async ({ page }) => {
  await page.goto('/settings');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings');
  await expect(page).toHaveTitle('Settings – Virutas');
});

test('the Unit System is chosen with the arrow keys', async ({ page }) => {
  await page.goto('/settings');
  const unitSystem = page.getByRole('radiogroup', { name: 'Unit System' });
  await expect(unitSystem).toHaveAccessibleDescription(
    'Unit for numbers you type without one. You can always type any unit.',
  );
  await unitSystem.getByRole('radio', { name: 'Metric' }).focus();

  await page.keyboard.press('ArrowRight');

  await expect(unitSystem.getByRole('radio', { name: 'Imperial' })).toBeChecked();
  await expect(unitSystem.getByRole('radio', { name: 'Imperial' })).toBeFocused();
});

test('the Imperial precision is described by its hint', async ({ page }) => {
  await page.goto('/settings');

  await expect(page.getByLabel('Imperial precision')).toHaveAccessibleDescription(
    'Smallest fraction shown in Imperial results.',
  );
});

test('the Settings chosen are kept after a reload', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Imperial' }).check();
  await page.getByLabel('Imperial precision').selectOption('32');
  const cutOptimizer = page.getByRole('region', { name: 'Cut Optimizer' });
  await cutOptimizer.getByLabel('Kerf').fill('3/32');
  await cutOptimizer.getByLabel('Trim').fill('1/4');
  await cutOptimizer.getByLabel('Minimum Offcut Length').fill('10');
  await page.getByRole('main').getByLabel('Language').selectOption('es');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ajustes');

  await page.reload();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ajustes');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('radio', { name: 'Imperial' })).toBeChecked();
  await expect(page.getByLabel('Precisión imperial')).toHaveValue('32');
  const cutOptimizerInSpanish = page.getByRole('region', { name: 'Optimizador de cortes' });
  await expect(cutOptimizerInSpanish.getByLabel('Grosor de corte')).toHaveValue('3/32"');
  await expect(cutOptimizerInSpanish.getByLabel('Saneado')).toHaveValue('1/4"');
  await expect(cutOptimizerInSpanish.getByLabel('Longitud mínima de retal')).toHaveValue('10"');
});

test('switching the language translates the page in place, keeping focus on the picker', async ({
  page,
}) => {
  await page.goto('/settings');
  // A reload would reset this marker.
  await page.evaluate(() => {
    document.body.dataset['sameDocument'] = 'yes';
  });
  const language = page.getByRole('main').getByLabel('Language');

  await language.focus();
  await language.selectOption('es');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ajustes');
  await expect(page.getByRole('main').getByLabel('Idioma')).toBeFocused();
  await expect(page.locator('body')).toHaveAttribute('data-same-document', 'yes');
});
