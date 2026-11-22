import type { Page } from '@playwright/test';

/**
 * Generates a Cutting Plan in millimetres on the Cut Optimizer page (already open) whose layouts
 * show every kind of bar segment: 5 mm Trim, 3 mm Kerf, Offcuts, Waste and a 30 mm spacer, a Part
 * under 2 % of its 2 400 mm Stock.
 */
export async function generateCuttingPlan(page: Page): Promise<void> {
  const stock = page.getByRole('region', { name: 'Stock' });
  await stock.getByRole('group', { name: 'Stock 1' }).getByLabel('Length').fill('2400 mm');

  const cutList = page.getByRole('region', { name: 'Cut List' });
  const parts = [
    ['rail', '900 mm', '2'],
    ['stile', '540 mm', '1'],
    ['spacer', '30 mm', '1'],
    ['shelf', '1100 mm', '1'],
    ['apron', '380 mm', '1'],
  ] as const;
  for (const [index, [name, length, quantity]] of parts.entries()) {
    if (index > 0) {
      await cutList.getByRole('button', { name: 'Add Part' }).click();
    }
    const part = cutList.getByRole('group', { name: `Part ${index + 1}` });
    await part.getByLabel('Name (optional)').fill(name);
    await part.getByLabel('Length').fill(length);
    await part.getByLabel('Quantity').fill(quantity);
  }
  await page.getByLabel('Trim at each end').fill('5 mm');

  await page.getByRole('button', { name: 'Generate Cutting Plan' }).click();
}
