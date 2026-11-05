import { expect, test } from '@playwright/test';

test('la guía de bienvenida sale la primera vez y no vuelve tras cerrarla', async ({ page }) => {
  await page.goto('/');
  const guide = page.getByRole('region', { name: 'Cómo se juega' });
  await expect(guide).toBeVisible();
  await expect(guide.getByRole('listitem')).toHaveCount(3);
  // No compite con la acción principal del mapa.
  await expect(page.getByRole('button', { name: 'Continuar →' })).toHaveCount(1);

  await guide.getByRole('button', { name: 'Entendido' }).click();
  await expect(guide).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('list', { name: 'Mundos' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Cómo se juega' })).toHaveCount(0);
});

test('sin conceptos por repasar no hay aviso de repaso', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Repaso disponible' })).toHaveCount(0);
});
