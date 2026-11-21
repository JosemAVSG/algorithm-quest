import { expect, test } from '@playwright/test';

import { CORRECT, editor, editorText, fillM01Explain, openSettings, reachLab, runCode } from './helpers';

test('texto grande y alto contraste se aplican y se recuerdan', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-text', 'large');

  await openSettings(page);
  await page.getByRole('button', { name: 'Texto grande' }).click();
  await page.getByRole('button', { name: 'Alto contraste' }).click();
  await expect(html).toHaveAttribute('data-text', 'large');
  await expect(html).toHaveAttribute('data-contrast', 'high');

  await page.reload();
  await expect(html).toHaveAttribute('data-text', 'large');
  await openSettings(page);
  await expect(page.getByRole('button', { name: 'Texto grande' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('buscar por concepto lista las misiones y no abre las bloqueadas', async ({ page }) => {
  await page.goto('/');
  const search = page.getByRole('combobox', { name: 'Buscar misiones por concepto' });
  await search.fill('condicion');
  await page.getByRole('option', { name: 'Condición' }).click();
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

test('el menú de ajustes se maneja con teclado y devuelve el foco', async ({ page }) => {
  await page.goto('/');
  const gear = page.getByRole('button', { name: 'Ajustes de lectura' });
  await expect(gear).toHaveAttribute('aria-expanded', 'false');
  await gear.focus();
  await page.keyboard.press('Enter');
  await expect(gear).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Texto grande' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(gear).toHaveAttribute('aria-expanded', 'false');
  await expect(gear).toBeFocused();
  await expect(page.getByRole('button', { name: 'Texto grande' })).toBeHidden();
});

test('la cabecera mantiene la navegación en una sola fila en móvil', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: /^Mundo 1/ }).click();
  const boxes = await Promise.all(
    [
      page.getByRole('button', { name: '← Volver a los mundos' }),
      page.getByRole('button', { name: 'Ver progreso' }),
      page.getByRole('button', { name: 'Ajustes de lectura' }),
    ].map((locator) => locator.boundingBox()),
  );
  // Same row: the vertical centres line up (heights differ slightly).
  const centres = boxes.map((box) => box!.y + box!.height / 2);
  expect(Math.max(...centres) - Math.min(...centres)).toBeLessThan(4);
});

test('la barra de progreso global dice cuántos sistemas están reparados', async ({ page }) => {
  await page.goto('/');
  const bar = page.getByRole('progressbar');
  await expect(bar).toHaveAttribute('aria-valuenow', '0');
  await expect(bar).toHaveAttribute('aria-valuemin', '0');
  await expect(page.getByText(/^0 de \d+ sistemas reparados$/)).toBeVisible();
  await page.getByRole('button', { name: /^Mundo 1/ }).click();
  await expect(page.getByRole('progressbar')).toBeVisible();
});

test('el buscador de conceptos funciona con flechas, Enter y Escape', async ({ page }) => {
  await page.goto('/');
  const search = page.getByRole('combobox', { name: 'Buscar misiones por concepto' });
  await search.focus();
  await expect(search).toHaveAttribute('aria-expanded', 'true');
  await search.fill('cond');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(search).toHaveValue('Condición');
  await expect(page.getByRole('button', { name: /^M01 · / })).toBeEnabled();
  await search.fill('zzz');
  await expect(page.getByText('Ningún concepto coincide.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(search).toHaveAttribute('aria-expanded', 'false');
});

test('un mundo bloqueado muestra candado y la razón completa', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/');
  const locked = page.getByRole('button', { name: /^Arco de transición.*bloqueado/ });
  await expect(locked.locator('svg.lock-icon')).toBeVisible();
  const hint = locked.locator('.stop__state');
  await expect(hint).toHaveText('se abre al terminar Mundo 1');
  const clipped = await hint.evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(clipped).toBe(false);
});

test('cada mundo pinta su color de identidad en el nodo y en la cabecera de la misión', async ({ page }) => {
  await page.goto('/');
  const first = page.getByRole('button', { name: /^Mundo 1/ }).locator('..');
  await expect(first).toHaveCSS('--world-accent', '#58a6ff');
  await page.getByRole('button', { name: /^Mundo 1/ }).click();
  await page.getByRole('button', { name: /^M01 .*disponible/ }).click();
  await expect(page.locator('.mission__bar')).toHaveCSS('border-top-color', 'rgb(88, 166, 255)');
});

test('al volver tras completar una misión, la siguiente se anima una sola vez', async ({ page }) => {
  await reachLab(page);
  await editor(page).fill(CORRECT);
  await page.getByRole('button', { name: 'Ejecutar' }).click();
  await page.getByRole('button', { name: 'Abrir el informe →' }).click();
  await fillM01Explain(page);
  await page.getByRole('button', { name: 'Cerrar la misión' }).click();
  await page.getByRole('button', { name: 'Volver al taller →' }).click();
  await expect(page.getByRole('button', { name: /^M02 / })).toHaveClass(/stop--unlocking/);
  await expect(page.locator('.path__item--lit')).toHaveCount(1);

  // A second visit to the map no longer animates it.
  await page.getByRole('button', { name: 'Ver progreso' }).click();
  await page.getByRole('button', { name: '← Volver al taller' }).click();
  await expect(page.locator('.stop--unlocking')).toHaveCount(0);
});

test('con movimiento reducido no hay animación de desbloqueo', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await reachLab(page);
  await editor(page).fill(CORRECT);
  await page.getByRole('button', { name: 'Ejecutar' }).click();
  await page.getByRole('button', { name: 'Abrir el informe →' }).click();
  await fillM01Explain(page);
  await page.getByRole('button', { name: 'Cerrar la misión' }).click();
  await page.getByRole('button', { name: 'Volver al taller →' }).click();
  await expect(page.getByRole('button', { name: /^M02 / })).toHaveCSS('animation-name', 'none');
});
