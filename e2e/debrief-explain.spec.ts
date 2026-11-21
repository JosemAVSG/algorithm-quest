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

test('faltan respuestas: el botón lo explica y lleva a la primera sin responder', async ({ page }) => {
  await reachDebrief(page);
  await page.getByLabel('Una sola, siempre').check();

  const close = page.getByRole('button', { name: 'Cerrar la misión' });
  await expect(close).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('progressbar', { name: 'Respuestas del informe' })).toHaveAttribute(
    'aria-valuenow',
    '1',
  );
  await expect(page.getByText('Te faltan 5 respuestas.')).toBeVisible();
  await expect(close).toHaveAccessibleDescription('Te faltan 5 respuestas.');

  // aria-disabled keeps the button clickable; Playwright treats it as disabled.
  await close.click({ force: true });
  await expect(page.getByLabel('Hueco 1')).toBeFocused();
  await expect(page.getByText('Misión completada')).toHaveCount(0);
});

test('el botón de cerrar es visible sin desplazarse y se habilita al responder todo', async ({ page }) => {
  await reachDebrief(page);
  const close = page.getByRole('button', { name: 'Cerrar la misión' });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(close).toBeInViewport();
  await fillM01Explain(page);
  await expect(close).toHaveAttribute('aria-disabled', 'false');
  await expect(page.getByText('Todo respondido')).toBeVisible();
  await expect(page.getByText('Completado')).toHaveCount(2);
});

test('el informe muestra tu enfoque como cita y las respuestas parciales sobreviven a una recarga', async ({
  page,
}) => {
  await reachDebrief(page);
  await expect(page.locator('blockquote.debrief__echo')).toContainText('Empezaste diciendo:');
  await expect(page.locator('blockquote.debrief__echo')).toContainText(
    'Comparo temperatura y límite antes de decidir.',
  );

  await page.getByLabel('Una sola, siempre').check();
  await page.getByLabel('Hueco 1').selectOption('la lectura de temperatura');
  await page.reload();
  await page.getByRole('button', { name: 'Continuar →' }).click();
  await expect(page.getByRole('heading', { name: 'Explica con tus palabras' })).toBeVisible();
  await expect(page.getByLabel('Una sola, siempre')).toBeChecked();
  await expect(page.getByLabel('Hueco 1')).toHaveValue('1');
  await expect(page.getByText('2 de 6 respondidas')).toBeVisible();
});

test('la pantalla final explica qué significa Razonamiento sin hablar de puntos', async ({ page }) => {
  await reachDebrief(page);
  await fillM01Explain(page);
  await page.getByRole('button', { name: 'Cerrar la misión' }).click();
  await expect(page.getByText('Misión completada')).toBeVisible();
  await expect(page.getByText(/Razonamiento: 3 significa/)).toBeVisible();
});
