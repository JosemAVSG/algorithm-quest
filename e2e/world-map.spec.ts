import { expect, test } from '@playwright/test';

test('el mapa muestra mundos y abre el Mundo 1 con sus misiones', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('list', { name: 'Mundos' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Mundo 1/ })).toBeEnabled();

  await page.getByRole('button', { name: /^Mundo 1/ }).click();
  await expect(page.getByRole('list', { name: 'Misiones' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^M01 .*disponible/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^M02 .*bloqueada/ })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await expect(page.getByLabel('Matriz de sensores: averiado')).toBeVisible();
});

test('el nodo de una misión abre su briefing y el botón vuelve a los mundos', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Mundo 1/ }).click();
  await page.getByRole('button', { name: /^M01 .*disponible/ }).click();
  await expect(page.getByRole('heading', { name: 'El primer diagnóstico' })).toBeVisible();
});

test('volver regresa al camino de mundos', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Mundo 1/ }).click();
  await page.getByRole('button', { name: '← Volver a los mundos' }).click();
  await expect(page.getByRole('list', { name: 'Mundos' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Misiones' })).toHaveCount(0);
});

test('un mundo bloqueado se ve con su razón y no se abre', async ({ page }) => {
  await page.goto('/');
  const locked = page.getByRole('button', { name: /^Arco de transición.*bloqueado/ });
  await expect(locked).toHaveAttribute('aria-disabled', 'true');
  await expect(locked).toContainText('se abre al terminar Mundo 1');

  await locked.click({ force: true });
  await expect(page.getByRole('list', { name: 'Mundos' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Misiones' })).toHaveCount(0);
});

test('la acción principal sigue siendo una sola en ambos niveles', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Continuar →' })).toHaveCount(1);
  await page.getByRole('button', { name: /^Mundo 1/ }).click();
  await expect(page.getByRole('button', { name: 'Continuar →' })).toHaveCount(1);
});

test('el nodo de mundo sigue accesible y clicable con la capa 3D, haya o no WebGL', async ({
  page,
}) => {
  await page.goto('/');
  const node = page.getByRole('button', { name: /^Mundo 1/ });
  await expect(node).toBeEnabled();

  // The canvas (if WebGL worked) is decorative and never part of the name or tab order.
  const canvas = node.locator('canvas');
  const count = await canvas.count();
  expect(count).toBe(1);
  await expect(canvas).toHaveAttribute('aria-hidden', 'true');
  await expect(node).toHaveAccessibleName(/^Mundo 1 .*: en curso, \d+ de \d+ misiones$/);

  await node.click();
  await expect(page.getByRole('list', { name: 'Misiones' })).toBeVisible();
});
