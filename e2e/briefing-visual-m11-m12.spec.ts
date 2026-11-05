import { expect, test, type Page } from '@playwright/test';

import { editor } from './helpers';

/**
 * M11 and M12 briefing illustrations are reachable by accessible name and
 * actually move. Progress is seeded so the missions are unlocked.
 */

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
});

async function openMission(page: Page, id: 'M11' | 'M12') {
  const done = Array.from({ length: Number(id.slice(1)) - 1 }, (_, i) => ({
    missionId: `M${String(i + 1).padStart(2, '0')}`,
    completedAt: 1_700_000_000_000 + i,
    attempts: 1,
    hintsUsed: 0,
    reasoningScore: 1,
    evidence: [],
  }));
  await page.addInitScript((completed) => {
    if (localStorage.getItem('seeded') === null) {
      localStorage.setItem(
        'algorithm-quest:progress:v2',
        JSON.stringify({ schemaVersion: 2, completed, events: [], reinforcement: [], declinedReinforcement: [] }),
      );
      localStorage.setItem('seeded', '1');
    }
  }, done);
  await page.goto('/');
  await page.getByRole('button', { name: /^Transition Arc/ }).click();
  await page.getByRole('button', { name: new RegExp(`^${id}`) }).click();
}

test('M11 muestra las cajas de categorías y la animación avanza', async ({ page }) => {
  await openMission(page, 'M11');
  const visual = page.getByRole('img', { name: /Órdenes que llegan una a una/ });
  await expect(visual).toBeVisible();
  const first = await visual.innerHTML();
  await expect.poll(async () => visual.innerHTML(), { timeout: 5_000 }).not.toBe(first);
});

test('M12 muestra las tres preguntas y la animación avanza', async ({ page }) => {
  await openMission(page, 'M12');
  const visual = page.getByRole('img', { name: /Una cola de órdenes mezcladas/ });
  await expect(visual).toBeVisible();
  const first = await visual.innerHTML();
  await expect.poll(async () => visual.innerHTML(), { timeout: 5_000 }).not.toBe(first);
});

const M11_SOLUTION = `function mostFrequentCategory(orders) {
  if (orders.length === 0) return null;
  const counts = new Map();
  for (const order of orders) counts.set(order.category, (counts.get(order.category) || 0) + 1);
  let best = null;
  let top = 0;
  for (const [category, count] of counts) {
    if (count > top || (count === top && category < best)) { best = category; top = count; }
  }
  return best;
}`;

test('el informe de M11: una respuesta incorrecta da pista y la correcta cierra', async ({ page }) => {
  await openMission(page, 'M11');
  await page.getByRole('button', { name: 'Entendido →' }).click();
  await page.getByLabel('Tu enfoque').fill('Cuento cada categoría y después elijo la mayor.');
  await page.getByRole('button', { name: 'Empezar a programar →' }).click();
  await editor(page).fill(M11_SOLUTION);
  await page.getByRole('button', { name: 'Ejecutar' }).click();
  await page.getByRole('button', { name: 'Abrir el informe →' }).click();
  await expect(page.getByRole('heading', { name: 'Explica con tus palabras' })).toBeVisible();

  const answerQuestions = async () => {
    await page.getByLabel('a, porque en un empate gana la que va antes alfabéticamente').check();
    await page
      .getByLabel('Descarta el valor asignado sin avisar y la respuesta sale mal sin ningún error')
      .check();
    await page.getByLabel('null, porque no existe ninguna categoría que pueda devolverse').check();
    await page.getByLabel('Obtiene NaN, porque undefined + 1 no da un número válido').check();
  };
  await answerQuestions();
  await page.getByLabel('Hueco 1').selectOption('cuántas órdenes han llegado de ella');
  await page.getByLabel('Hueco 2').selectOption('ordene solas las claves según su cantidad al guardar');
  await page
    .getByLabel('Hueco 3')
    .selectOption('puede descartar el valor guardado sin avisar de nada');
  await page.getByLabel('Hueco 4').selectOption('la que va primero alfabéticamente');
  await page.getByRole('button', { name: 'Cerrar la misión' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'repensar: hueco 2' })).toBeVisible();
  await expect(page.getByText('Misión completada')).toHaveCount(0);

  await page.getByLabel('Hueco 2').selectOption('acepte cualquier texto como clave, sin heredar nada');
  await page.getByRole('button', { name: 'Cerrar la misión' }).click();
  await expect(page.getByText('Misión completada')).toBeVisible();
});
