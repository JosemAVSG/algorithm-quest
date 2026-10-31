import { expect, test, type Page } from '@playwright/test';

import { editor, reachLab, runCode } from './helpers';

/**
 * Console panel (docs/08-code-execution.md §6). The pedagogical rule under test:
 * what the player prints while running a *visible* test is shown, labelled with
 * that test; what is printed while running a hidden or edge case never is.
 * M01's hidden group contains the input [91, 90] (h1) and its edge group [-5, -10].
 */

function consolePanel(page: Page) {
  return page.getByRole('region', { name: 'Consola' });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
});

test('C1 · console.log aparece en la consola, etiquetado con la prueba visible', async ({ page }) => {
  await reachLab(page);
  await expect(
    consolePanel(page).getByText('Aquí aparece lo que imprimas con console.log'),
  ).toBeVisible();

  await runCode(
    page,
    `function isOverLimit(temperature, limit) {
  console.log('temp =', temperature, { limit });
  console.warn('cuidado');
  return temperature > limit;
}`,
  );

  const lines = consolePanel(page).getByRole('listitem');
  await expect(lines).toHaveCount(6);
  await expect(lines.nth(0)).toContainText('v1');
  await expect(lines.nth(0)).toContainText('temp = 95 { limit: 90 }');
  await expect(lines.nth(1)).toContainText('cuidado');
  await expect(lines.nth(2)).toContainText('v2');
  await expect(lines.nth(2)).toContainText('temp = 85');

  await consolePanel(page).getByRole('button', { name: 'Limpiar' }).click();
  await expect(consolePanel(page).getByRole('listitem')).toHaveCount(0);
  await expect(
    consolePanel(page).getByText('Aquí aparece lo que imprimas con console.log'),
  ).toBeVisible();
});

test('C2 · lo que se imprime solo con entradas ocultas o de borde no se muestra', async ({ page }) => {
  await reachLab(page);
  await runCode(
    page,
    `function isOverLimit(temperature, limit) {
  if (temperature === 91) console.log('SECRETO-H1', temperature);
  if (temperature === -5) console.log('SECRETO-ED2', limit);
  if (temperature === 95) console.log('visible-ok');
  return temperature > limit;
}`,
  );

  const panel = consolePanel(page);
  await expect(panel.getByText('visible-ok')).toBeVisible();
  await expect(panel.getByText('También hubo salida en pruebas ocultas (no se muestra).')).toBeVisible();
  const text = (await panel.textContent()) ?? '';
  expect(text).not.toContain('SECRETO');
  expect(text).not.toMatch(/\b91\b/);
  expect(text).not.toContain('-10');
});

test('C3 · imprimir un valor distinto en cada llamada no rompe el diagnóstico', async ({ page }) => {
  await reachLab(page);
  await runCode(
    page,
    `function isOverLimit(temperature, limit) {
  console.log(Date.now(), Math.random());
  return temperature > limit;
}`,
  );

  await expect(page.getByRole('region', { name: 'Mentor' }).getByText('Las pruebas pasan.')).toBeVisible();
  await expect(editor(page)).toBeEnabled();
});

test('C4 · una consola hostil o enorme no rompe la ejecución', async ({ page }) => {
  await reachLab(page);
  await runCode(
    page,
    `function isOverLimit(temperature, limit) {
  const loop = {}; loop.self = loop;
  console.log(loop, new Proxy({}, { ownKeys() { throw new Error('x'); } }), 10n, Symbol('s'));
  for (let i = 0; i < 100000; i += 1) console.log('línea', i);
  return temperature > limit;
}`,
  );

  await expect(page.getByRole('region', { name: 'Mentor' }).getByText('Las pruebas pasan.')).toBeVisible();
  await expect(consolePanel(page).getByText(/Salida recortada/)).toBeVisible();
  await expect(consolePanel(page).getByText('[Circular]').first()).toBeVisible();
});
