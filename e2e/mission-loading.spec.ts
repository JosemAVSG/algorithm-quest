import { expect, test } from '@playwright/test';

const MISSION_FILE = '**/content/missions/m01.json*';

test('una misión que tarda muestra "Cargando misión…" y luego el briefing', async ({ page }) => {
  await page.route(MISSION_FILE, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await page.goto('/');
  await page.getByRole('button', { name: /^World 1/ }).click();
  await page.getByRole('button', { name: /^M01 .*disponible/ }).click();

  await expect(page.getByText('Cargando misión…')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'El primer diagnóstico' })).toBeVisible();
});

test('si el chunk falla se ofrece reintentar y el reintento abre la misión', async ({ page }) => {
  await page.route(MISSION_FILE, (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: /^World 1/ }).click();
  await page.getByRole('button', { name: /^M01 .*disponible/ }).click();

  await expect(page.getByRole('heading', { name: 'No se pudo cargar la misión' })).toBeVisible();

  await page.unroute(MISSION_FILE);
  await page.getByRole('button', { name: 'Reintentar' }).click();
  await expect(page.getByRole('heading', { name: 'El primer diagnóstico' })).toBeVisible();
});

test('volver al taller desde el error regresa al mapa', async ({ page }) => {
  await page.route(MISSION_FILE, (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: /^World 1/ }).click();
  await page.getByRole('button', { name: /^M01 .*disponible/ }).click();
  await page.getByRole('button', { name: 'Volver al taller' }).click();
  await expect(page.getByRole('list', { name: 'Mundos' })).toBeVisible();
});
