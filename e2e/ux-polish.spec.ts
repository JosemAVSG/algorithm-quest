import { expect, test } from '@playwright/test';

import { CORRECT, editor, editorText, fillM01Explain, reachLab, runCode } from './helpers';

test('texto grande y alto contraste se aplican y se recuerdan', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-text', 'large');

  await page.getByRole('button', { name: 'Texto grande' }).click();
  await page.getByRole('button', { name: 'Alto contraste' }).click();
  await expect(html).toHaveAttribute('data-text', 'large');
  await expect(html).toHaveAttribute('data-contrast', 'high');

  await page.reload();
  await expect(html).toHaveAttribute('data-text', 'large');
  await expect(page.getByRole('button', { name: 'Texto grande' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('buscar por concepto lista las misiones y no abre las bloqueadas', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Buscar misiones por concepto').selectOption({ label: 'Condición' });
  await expect(page.getByRole('button', { name: /^M01 · / })).toBeEnabled();
  await page.getByRole('button', { name: /^M01 · / }).click();
  await expect(page.getByRole('heading', { name: 'El primer diagnóstico' })).toBeVisible();
});

test('una prueba fallida marca dónde empieza la diferencia', async ({ page }) => {
  await reachLab(page);
  await runCode(page, 'function isOverLimit(temperature, limit) {\n  return true;\n}');
  await expect(page.locator('.diff__mark').first()).toBeVisible();
});

test('en un móvil la barra de símbolos inserta en el cursor', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await reachLab(page);
  await editor(page).fill('');
  const before = await editorText(page);
  await page.getByRole('button', { name: 'Llave que abre' }).click();
  await expect.poll(() => editorText(page)).toBe(`${before}{`);
  const key = page.getByRole('button', { name: 'Punto y coma' });
  const box = await key.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
});

test('en un escritorio no se muestra la barra de símbolos', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await reachLab(page);
  await expect(page.getByRole('toolbar', { name: 'Símbolos de código' })).toBeHidden();
});

test('al terminar una misión se ofrece la siguiente', async ({ page }) => {
  await reachLab(page);
  await editor(page).fill(CORRECT);
  await page.getByRole('button', { name: 'Ejecutar' }).click();
  await page.getByRole('button', { name: 'Abrir el informe →' }).click();
  await fillM01Explain(page);
  await page.getByRole('button', { name: 'Cerrar la misión' }).click();

  const next = page.getByRole('button', { name: /^Siguiente: .* →$/ });
  await expect(next).toHaveCount(1);
  await next.click();
  await expect(page.getByRole('heading', { name: 'La inspección completa' })).toBeVisible();
});

test('el resumen de la semana aparece tras completar una misión y no habla de rachas', async ({
  page,
}) => {
  await reachLab(page);
  await editor(page).fill(CORRECT);
  await page.getByRole('button', { name: 'Ejecutar' }).click();
  await page.getByRole('button', { name: 'Abrir el informe →' }).click();
  await fillM01Explain(page);
  await page.getByRole('button', { name: 'Cerrar la misión' }).click();
  await page.getByRole('button', { name: 'Volver al taller →' }).click();
  await page.getByRole('button', { name: 'Ver progreso' }).click();
  const week = page.getByRole('region', { name: 'Esta semana' });
  await expect(week).toBeVisible();
  await expect(week).toContainText('Reparaste 1 sistema');
  await expect(week).not.toContainText(/racha|streak|días seguidos/i);
});
