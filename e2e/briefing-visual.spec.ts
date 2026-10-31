import { expect, test } from '@playwright/test';

import { CORRECT, editor, reachLab } from './helpers';

/**
 * The briefing illustration is part of the mission text: a reader has to be
 * able to find it by its accessible name, and it must not block the flow.
 */

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
});

test('el briefing de M01 muestra el termómetro', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continuar →' }).click();
  await expect(page.getByRole('img', { name: /Termómetro con una línea de límite/ })).toBeVisible();
  await page.getByRole('button', { name: 'Entendido →' }).click();
  await expect(page.getByLabel('Tu enfoque')).toBeVisible();
});

test('el briefing de M02 muestra la inspección y el flujo sigue funcionando', async ({ page }) => {
  await reachLab(page);
  await editor(page).fill(CORRECT);
  await page.getByRole('button', { name: 'Ejecutar' }).click();
  await page.getByRole('button', { name: 'Abrir el informe →' }).click();
  await page.getByLabel('Una sola, siempre').check();
  await page.getByLabel('Tu explicación').fill(
    'Comparo la temperatura con el límite y devuelvo true solo cuando la supera; con 90 y límite 90 no se dispara la alarma, y el coste es O(1).',
  );
  await page.getByRole('button', { name: 'Cerrar la misión' }).click();
  await page.getByRole('button', { name: 'Volver al taller →' }).click();
  await page.getByRole('button', { name: /^World 1/ }).click();
  await page.getByRole('button', { name: /^M02/ }).click();

  await expect(page.getByRole('heading', { name: 'La inspección completa' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Cuarenta sensores en fila/ })).toBeVisible();

  await page.getByRole('button', { name: 'Entendido →' }).click();
  await expect(page.getByLabel('Tu enfoque')).toBeVisible();
});
