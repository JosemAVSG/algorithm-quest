import { expect, test, type Page } from '@playwright/test';

/**
 * The M1 exit criteria as browser behaviour (docs/10-testing-and-security.md §5).
 *
 * X1–X5 are the documented walkthroughs. X6 covers the reload promise the
 * session store makes mid-mission ("everything except the editor buffer").
 *
 * Selectors go through accessible names on purpose: a test that matches a
 * stylesheet class would stay green while the screen stopped being usable.
 */

const CORRECT = `function isOverLimit(temperature, limit) {
  return temperature > limit;
}`;

const BOUNDARY_BUG = `function isOverLimit(temperature, limit) {
  return temperature >= limit;
}`;

const INFINITE = `function isOverLimit(temperature, limit) {
  while (true) {}
}`;

const REASONING =
  'Comparo la temperatura con el límite y devuelvo true solo cuando la supera; ' +
  'con 90 y límite 90 no se dispara la alarma, y el coste es O(1).';

const EDITOR = 'Código';

function editor(page: Page) {
  return page.getByRole('textbox', { name: EDITOR });
}

async function openWorld1(page: Page) {
  await page.getByRole('button', { name: /^World 1/ }).click();
}

async function openM01(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continuar →' }).click();
  await expect(page.getByRole('heading', { name: 'El primer diagnóstico' })).toBeVisible();
}

async function reachLab(page: Page) {
  await openM01(page);
  await page.getByRole('button', { name: 'Entendido →' }).click();
  await page.getByLabel('Tu enfoque').fill('Comparo temperatura y límite antes de decidir.');
  await page.getByRole('button', { name: 'Empezar a programar →' }).click();
  await expect(editor(page)).toBeVisible();
}

async function runWith(page: Page, code: string) {
  await editor(page).fill(code);
  await page.getByRole('button', { name: 'Ejecutar' }).click();
  await expect(page.getByRole('button', { name: 'Ejecutar' })).toBeEnabled();
}

async function finishDebrief(page: Page) {
  await page.getByLabel('Una sola, siempre').check();
  await page.getByLabel('Tu explicación').fill(REASONING);
  await page.getByRole('button', { name: 'Cerrar la misión' }).click();
  await expect(page.getByText('Misión completada')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
});

test('X1 · recorre la misión de principio a fin y repara el sensor', async ({ page }) => {
  await reachLab(page);
  await runWith(page, CORRECT);

  await expect(page.getByText('Las pruebas pasan.')).toBeVisible();
  await page.getByRole('button', { name: 'Abrir el informe →' }).click();

  await expect(page.getByRole('heading', { name: 'Por qué funciona' })).toBeVisible();
  await finishDebrief(page);
  await expect(page.getByText('3 / 3')).toBeVisible();

  await page.getByRole('button', { name: 'Volver al taller →' }).click();
  await openWorld1(page);
  await expect(page.getByLabel('Sensor array: operativo')).toBeVisible();
  await expect(page.getByText('No queda nada jugable en este corte')).toBeVisible();
});

test('X2 · el fallo en el límite se diagnostica, escala la pista y se repara', async ({ page }) => {
  await reachLab(page);
  await runWith(page, BOUNDARY_BUG);

  // The bug passes every visible test: that is M01's lesson, not an accident.
  await expect(page.getByText('3/3')).toBeVisible();
  await expect(
    page.getByText('Las pruebas visibles pasan. El sistema todavía tiene casos que no ves.'),
  ).toBeVisible();
  await expect(page.getByText('La comparación falla justo en el límite.')).toBeVisible();

  await page.getByRole('button', { name: 'Ver pista' }).click();
  await expect(page.getByText('Pista 1 de 4')).toBeVisible();
  await expect(page.getByText(/¿Qué dos cosas tiene que mirar la función/)).toBeVisible();

  await page.getByRole('button', { name: 'Siguiente pista' }).click();
  await expect(page.getByText('Pista 2 de 4')).toBeVisible();
  await expect(page.locator('.hint__text')).toContainText('90');

  await runWith(page, CORRECT);
  await expect(page.getByText('Las pruebas pasan.')).toBeVisible();
  await page.getByRole('button', { name: 'Abrir el informe →' }).click();
  await expect(page.getByRole('heading', { name: 'Por qué funciona' })).toBeVisible();
  await expect(page.getByText('Lo resolviste en 2 intentos, con 2 pistas.')).toBeVisible();
  await finishDebrief(page);
});

test('X3 · un bucle infinito agota el tiempo y el editor sigue usable', async ({ page }) => {
  await reachLab(page);
  await runWith(page, INFINITE);

  await expect(page.getByText('La ejecución no terminó a tiempo.')).toBeVisible();
  await expect(editor(page)).toBeEnabled();

  await editor(page).fill(CORRECT);
  await page.getByRole('button', { name: 'Ejecutar' }).click();
  await expect(page.getByText('Las pruebas pasan.')).toBeVisible();
});

test('X4 · completar M01 y recargar mantiene el sensor operativo', async ({ page }) => {
  await reachLab(page);
  await runWith(page, CORRECT);
  await page.getByRole('button', { name: 'Abrir el informe →' }).click();
  await finishDebrief(page);
  await page.getByRole('button', { name: 'Volver al taller →' }).click();
  await openWorld1(page);
  await expect(page.getByLabel('Sensor array: operativo')).toBeVisible();

  await page.reload();
  await expect(page.getByText('1 de 12 sistemas')).toBeVisible();
  await openWorld1(page);
  await expect(page.getByLabel('Sensor array: operativo')).toBeVisible();
});

test('X5 · Tab alcanza el editor y Cmd/Ctrl + Enter ejecuta', async ({ page }) => {
  await reachLab(page);

  for (let i = 0; i < 30; i += 1) {
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
    if (focused === EDITOR) break;
    await page.keyboard.press('Tab');
  }
  await expect(editor(page)).toBeFocused();

  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(CORRECT);
  await page.keyboard.press('ControlOrMeta+Enter');

  await expect(page.getByText('intentos 1')).toBeVisible();
  await expect(page.getByText('Las pruebas pasan.')).toBeVisible();
});

test('X6 · recargar a mitad de misión conserva el intento y no el buffer', async ({ page }) => {
  await reachLab(page);
  await runWith(page, BOUNDARY_BUG);

  await page.reload();
  await openWorld1(page);
  await expect(page.getByLabel('Sensor array: averiado')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar →' }).click();

  await expect(editor(page)).toBeVisible();
  await expect(page.getByText('intentos 1')).toBeVisible();
  await expect(page.getByText('La comparación falla justo en el límite.')).toBeVisible();
  await expect(editor(page)).toHaveValue(
    'function isOverLimit(temperature, limit) {\n  // your code here\n}\n',
  );
});

test('X7 · exportar, borrar e importar conserva la maestría', async ({ page }) => {
  await reachLab(page);
  await runWith(page, CORRECT);
  await page.getByRole('button', { name: 'Abrir el informe →' }).click();
  await finishDebrief(page);
  await page.getByRole('button', { name: 'Volver al taller →' }).click();

  await page.getByRole('button', { name: 'Ver progreso' }).click();
  await expect(page.getByLabel('Condición: competente')).toBeVisible();

  await page.getByRole('button', { name: 'Exportar progreso' }).click();
  const exported = await page.getByLabel('Progreso exportado').inputValue();
  expect(exported).toContain('"schemaVersion": 2');

  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Borrar progreso' }).click();
  await expect(page.getByLabel('Condición: sin evidencia')).toBeVisible();

  await page.getByLabel('Importar progreso').fill(exported);
  await page.getByRole('button', { name: 'Importar', exact: true }).click();
  await expect(page.getByLabel('Condición: competente')).toBeVisible();

  await page.getByRole('button', { name: '← Volver al taller' }).click();
  await openWorld1(page);
  await expect(page.getByLabel('Sensor array: operativo')).toBeVisible();
});
