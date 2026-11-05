import { expect, test, type Page } from '@playwright/test';

import { editor } from './helpers';

/**
 * Spaced review (docs/05 §8). A concept that was weak is offered a short
 * exercise from the progress screen; solving it records evidence with the
 * `reinforced` role and takes the concept off the queue. Leaving costs nothing.
 */

async function seedQueue(page: Page, conceptId: string) {
  await page.addInitScript((concept: string) => {
    window.localStorage.setItem(
      'algorithm-quest:progress:v2',
      JSON.stringify({
        schemaVersion: 2,
        completed: [
          { missionId: 'M01', completedAt: 1, attempts: 3, hintsUsed: 3, reasoningScore: 1, evidence: [] },
          { missionId: 'M02', completedAt: 2, attempts: 3, hintsUsed: 3, reasoningScore: 1, evidence: [] },
        ],
        events: [],
        reinforcement: [{ conceptId: concept, missionId: 'M02', mastery: 0.2, reason: 'assisted', queuedAt: 2 }],
        declinedReinforcement: [],
      }),
    );
  }, conceptId);
}

async function openProgress(page: Page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ver progreso' }).click();
}

test('un refuerzo pendiente se practica, deja evidencia y sale de la cola', async ({ page }) => {
  await seedQueue(page, 'C04');
  await openProgress(page);

  const pending = page.getByRole('region', { name: 'Refuerzo pendiente' });
  await expect(pending).toContainText('Salida temprana');
  await pending.getByRole('button', { name: /^Practicar · \d+ min/ }).click();

  await expect(page.getByRole('heading', { name: 'El primer saldo en rojo' })).toBeVisible();
  await expect(page.getByText(/^Refuerzo · Salida temprana/)).toBeVisible();

  // Wrong first: the starter does nothing, so the tests fail and nothing is saved.
  await page.getByRole('button', { name: 'Ejecutar' }).click();
  await expect(page.getByText('Resuelto.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ver pista' })).toBeVisible();

  await editor(page).fill(
    'function firstNegative(values) {\n  for (let i = 0; i < values.length; i++) {\n    if (values[i] < 0) return i;\n  }\n  return -1;\n}',
  );
  await page.getByRole('button', { name: 'Ejecutar' }).click();
  await expect(page.getByText('Resuelto.')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar y volver →' }).click();

  // Back on the progress screen, the offer is gone and the evidence is stored.
  await expect(page.getByRole('region', { name: 'Refuerzo pendiente' })).toHaveCount(0);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('algorithm-quest:progress:v2')!));
  expect(stored.reinforcement).toEqual([]);
  expect(stored.declinedReinforcement).toEqual([]);
  expect(stored.events).toHaveLength(1);
  expect(stored.events[0]).toMatchObject({ role: 'reinforced', conceptId: 'C04', missionId: 'R-C04-1' });
  // practising is not completing a mission
  expect(stored.completed.map((record: { missionId: string }) => record.missionId)).toEqual(['M01', 'M02']);
});

test('salir de un refuerzo no guarda nada ni cierra la oferta', async ({ page }) => {
  await seedQueue(page, 'C04');
  await openProgress(page);
  await page.getByRole('button', { name: /^Practicar/ }).click();
  await page.getByRole('button', { name: '← Volver' }).click();

  await expect(page.getByRole('region', { name: 'Refuerzo pendiente' })).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('algorithm-quest:progress:v2')!));
  expect(stored.events).toEqual([]);
  expect(stored.reinforcement).toHaveLength(1);
});

test('sin variante para el concepto se ofrece repetir la misión', async ({ page }) => {
  await seedQueue(page, 'C99');
  await openProgress(page);
  const pending = page.getByRole('region', { name: 'Refuerzo pendiente' });
  await expect(pending.getByRole('button', { name: /^Practicar/ })).toHaveCount(0);
  await pending.getByRole('button', { name: 'Repetir M02' }).click();
  await expect(page.getByRole('heading', { name: 'La inspección completa' })).toBeVisible();
});
