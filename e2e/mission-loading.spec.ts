import { expect, test } from '@playwright/test';

const MISSION_FILE = '**/content/missions/m01.json*';

test('una misión que tarda muestra "Cargando misión…" y luego el briefing', async ({
  page,
}) => {
  await page.route(MISSION_FILE, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await page.goto('/');
  await page.getByRole('button', { name: /^Mundo 1/ }).click();
  await page.getByRole('button', { name: /^M01 .*disponible/ }).click();

  await expect(page.getByText('Cargando misión…')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'El primer diagnóstico' }),
  ).toBeVisible();
});

test('si el chunk falla, recargar y reintentar vuelve a abrir la misión', async ({ page }) => {
  // The same failure a player gets after a new deployment, or on a dropped connection.
  await page.route(MISSION_FILE, (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: /^Mundo 1/ }).click();
  await page.getByRole('button', { name: /^M01 .*disponible/ }).click();

  await expect(
    page.getByRole('heading', { name: 'No se pudo cargar la misión' }),
  ).toBeVisible();
  // A failed import is cached by the browser for the life of the page, so the
  // only retry that can work is a reload: it must come back on the mission.
  await page.unroute(MISSION_FILE);
  await page.getByRole('button', { name: 'Recargar y reintentar' }).click();
  await expect(
    page.getByRole('heading', { name: 'El primer diagnóstico' }),
  ).toBeVisible();
});

test('el aviso de error explica las dos causas y no pide solo revisar la conexión', async ({ page }) => {
  await page.route(MISSION_FILE, (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: /^Mundo 1/ }).click();
  await page.getByRole('button', { name: /^M01 .*disponible/ }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('versión nueva');
  await expect(alert).toContainText('Tu progreso no se ha perdido');
});

test('volver al taller desde el error regresa al mapa', async ({ page }) => {
  await page.route(MISSION_FILE, (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: /^Mundo 1/ }).click();
  await page.getByRole('button', { name: /^M01 .*disponible/ }).click();
  await page.getByRole('button', { name: 'Volver al taller' }).click();
  await expect(page.getByRole('list', { name: 'Misiones' })).toBeVisible();
});
