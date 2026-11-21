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
  // The rich editor loads on demand; until it does a textarea stands in for it.
  // Check both, and the rich one once it is there.
  await expect(page.locator('.cm-editor, textarea.editor__area').first()).toBeVisible();
  await expect(page.locator('.cm-editor')).toBeVisible();
  const ligatures = await page
    .locator('.cm-content')
    .evaluate((element) => getComputedStyle(element).fontVariantLigatures);
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

test('al pasar las pruebas aparece un único aviso con «Abrir el informe» arriba del laboratorio', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await reachLab(page);
  await runCode(page, CORRECT);
  await expect(page.getByText('¡Las pruebas pasan!')).toBeVisible();
  const open = page.getByRole('button', { name: 'Abrir el informe →' });
  await expect(open).toHaveCount(1);
  await expect(open).toBeInViewport();
});

test('Ejecutar vive en la barra del editor con su atajo y Pruebas y Mentor caben sin desplazarse', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await reachLab(page);
  const editorBar = page.locator('.code__head');
  await expect(editorBar.getByRole('button', { name: 'Ejecutar' })).toBeVisible();
  await expect(editorBar.locator('.code__kbd')).toHaveText(/⌘↵|Ctrl\+Enter/);
  await expect(page.getByRole('heading', { name: 'Pruebas' })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('heading', { name: 'Mentor' })).toBeInViewport({ ratio: 1 });
});

test('el editor crece con el código y ajusta las líneas largas', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await reachLab(page);
  const box = page.locator('.editor--cm .cm-editor, textarea.editor__area').first();
  const short = (await box.boundingBox())!.height;
  const longLine = `function isOverLimit(temperature, limit) {\n  // ${'una línea muy larga '.repeat(20)}\n${'  let x = 1;\n'.repeat(15)}  return temperature > limit;\n}`;
  await editor(page).fill(longLine);
  const grown = (await box.boundingBox())!.height;
  expect(grown).toBeGreaterThan(short);
  expect(grown).toBeLessThanOrEqual(900 * 0.6 + 2);
  const sideways = await page.locator('.cm-scroller, textarea.editor__area').first().evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(sideways).toBeLessThanOrEqual(1);
});
