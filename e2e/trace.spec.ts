import { expect, test, type Locator } from '@playwright/test';

import { editor, reachLab } from './helpers';

/**
 * The step-by-step view, run by the real worker: variables at every step, the
 * current line marked in the editor, an endless loop stopped and explained, and
 * a trace that disappears when the code is edited (its lines would be stale).
 */

/** The value cell of a variable in the trace table (the "changed" dot is decoration). */
function valueOf(trace: Locator, name: string) {
  return trace
    .locator('tbody tr')
    .filter({ has: trace.page().locator('th', { hasText: new RegExp(`^${name}$`) }) })
    .locator('td code');
}

const WITH_LOOP = `function isOverLimit(temperature, limit) {
  let n = 0;
  for (let i = 0; i < 3; i++) {
    n += i;
  }
  return temperature > limit;
}`;

test('el paso a paso muestra las variables de cada vuelta y marca la línea en el editor', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await reachLab(page);
  await editor(page).fill(WITH_LOOP);

  const trace = page.getByRole('region', { name: 'Paso a paso' });
  await trace.getByRole('button', { name: 'Ver paso a paso' }).click();

  await expect(trace.getByText(/Paso 1 de 4 · línea 1/)).toBeVisible();
  await expect(valueOf(trace, 'temperature')).toHaveCount(1);
  await expect(page.locator('.cm-trace-line')).toHaveCount(1);

  await trace.getByRole('button', { name: 'Paso siguiente' }).click();
  await expect(trace.getByText(/Paso 2 de 4 · línea 3/)).toBeVisible();
  // n starts at 0 and is shown once the loop has begun
  await expect(valueOf(trace, 'n')).toHaveText('0');

  await trace.getByRole('button', { name: 'Último paso' }).click();
  await expect(trace.getByText(/Paso 4 de 4/)).toBeVisible();
  await expect(valueOf(trace, 'n')).toHaveText('1'); // 0 + 1 after two vueltas
  await expect(trace.getByText(/Termina y devuelve/)).toBeVisible();
});

test('un bucle que no termina se corta y se explica', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await reachLab(page);
  await editor(page).fill(
    'function isOverLimit(temperature, limit) {\n  let i = 0;\n  while (true) {\n    i++;\n  }\n}',
  );

  const trace = page.getByRole('region', { name: 'Paso a paso' });
  await trace.getByRole('button', { name: 'Ver paso a paso' }).click();
  await expect(trace.getByText(/Paso 1 de 400/)).toBeVisible();
  await trace.getByRole('button', { name: 'Último paso' }).click();
  await expect(trace.getByText(/Se paró tras 400 pasos/)).toBeVisible();
  await expect(valueOf(trace, 'i')).toHaveText('398');
});

test('editar el código cierra el paso a paso', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await reachLab(page);
  await editor(page).fill(WITH_LOOP);

  const trace = page.getByRole('region', { name: 'Paso a paso' });
  await trace.getByRole('button', { name: 'Ver paso a paso' }).click();
  await expect(trace.getByText(/Paso 1 de 4/)).toBeVisible();

  await editor(page).fill(`${WITH_LOOP}\n`);
  await expect(trace.getByText(/Paso 1 de 4/)).toHaveCount(0);
  await expect(trace.getByRole('button', { name: 'Ver paso a paso' })).toBeVisible();
});

test('un error de sintaxis no rompe el paso a paso', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await reachLab(page);
  await editor(page).fill('function isOverLimit(temperature, limit) {');
  const trace = page.getByRole('region', { name: 'Paso a paso' });
  await trace.getByRole('button', { name: 'Ver paso a paso' }).click();
  await expect(trace.getByText(/no se puede interpretar/)).toBeVisible();
});
