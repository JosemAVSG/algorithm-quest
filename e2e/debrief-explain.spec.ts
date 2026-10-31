import { expect, test } from '@playwright/test';

import { CORRECT, fillM01Explain, reachLab, runCode } from './helpers';

/**
 * The structured debrief (docs/04-mentor.md §6): a wrong answer is feedback,
 * never a lock, and it never reveals the right option.
 */

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
});

async function reachDebrief(page: import('@playwright/test').Page) {
  await reachLab(page);
  await runCode(page, CORRECT);
  await page.getByRole('button', { name: 'Abrir el informe →' }).click();
  await expect(page.getByRole('heading', { name: 'Explica con tus palabras' })).toBeVisible();
}

test('una respuesta incorrecta da pista sin completar ni revelar la solución', async ({ page }) => {
  await reachDebrief(page);
  await fillM01Explain(page, { wrongBlank: true });
  await page.getByRole('button', { name: 'Cerrar la misión' }).click();

  await expect(page.getByRole('status').filter({ hasText: 'repensar: hueco 2' })).toBeVisible();
  await expect(page.getByLabel('Hueco 2')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Misión completada')).toHaveCount(0);
  // The feedback names the item, not the answer.
  await expect(page.getByRole('status')).not.toContainText('estrictamente mayor');
});

test('corregir tras un fallo completa la misión con razonamiento 2 / 3', async ({ page }) => {
  await reachDebrief(page);
  await fillM01Explain(page, { wrongBlank: true });
  await page.getByRole('button', { name: 'Cerrar la misión' }).click();
  await expect(page.getByText('Misión completada')).toHaveCount(0);

  await page.getByLabel('Hueco 2').selectOption('es estrictamente mayor que el límite');
  await page.getByRole('button', { name: 'Cerrar la misión' }).click();
  await expect(page.getByText('Misión completada')).toBeVisible();
  await expect(page.getByText('2 / 3')).toBeVisible();
});

test('faltan respuestas: se avisa sin penalizar', async ({ page }) => {
  await reachDebrief(page);
  await page.getByLabel('Una sola, siempre').check();
  await page.getByRole('button', { name: 'Cerrar la misión' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Falta responder' })).toBeVisible();
  await expect(page.getByText('Misión completada')).toHaveCount(0);
});
