import { expect, test } from '@playwright/test';

import { CORRECT, editor, reachLab, runCode } from './helpers';

/**
 * The lab used to be replaced by a "needs 900 px" notice below that width. It
 * now stacks, so a tablet or a phone can run code and read the result.
 */

test('en una pantalla estrecha el editor, las pruebas y el mentor son utilizables', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await reachLab(page);

  await expect(editor(page)).toBeVisible();
  await runCode(page, CORRECT);
  await expect(page.getByText('Las pruebas pasan.')).toBeVisible();

  // The run button stays reachable while the player scrolls through the results.
  const run = page.getByRole('button', { name: 'Ejecutar' });
  await page.mouse.wheel(0, 600);
  await expect(run).toBeInViewport();

  // No horizontal scroll: the layout fits the viewport.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('el editor muestra los operadores tal como se escriben, sin ligaduras', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await reachLab(page);
  const ligatures = await editor(page).evaluate((element) =>
    getComputedStyle(element).fontVariantLigatures,
  );
  expect(ligatures).toBe('none');
});

test('el mentor aparece justo debajo de las pruebas, antes que la consola', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await reachLab(page);
  const order = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('.lab__panel h2'), (h) => h.textContent?.trim().toLowerCase() ?? '');
    return headings;
  });
  const tests = order.findIndex((text) => text.includes('pruebas'));
  const mentor = order.findIndex((text) => text.includes('mentor'));
  const consoleAt = order.findIndex((text) => text.includes('consola'));
  expect(tests).toBeGreaterThanOrEqual(0);
  expect(mentor).toBeGreaterThan(tests);
  expect(consoleAt).toBeGreaterThan(mentor);
});
