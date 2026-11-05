import { expect, test, type Page } from '@playwright/test';

import { CORRECT, editor, reachLab, runCode } from './helpers';

/**
 * Cost is measured in steps (D13), by the real worker. These cover the three
 * things the player can see: the cost line, the verdict on a solution that is
 * too expensive to finish, and the advice on one that works but is wasteful.
 */

async function seedCompleted(page: Page, count: number) {
  await page.addInitScript((upTo: number) => {
    const completed = Array.from({ length: upTo }, (_, index) => ({
      missionId: `M${String(index + 1).padStart(2, '0')}`,
      completedAt: 1,
      attempts: 1,
      hintsUsed: 0,
      reasoningScore: 3,
      evidence: [],
    }));
    window.localStorage.setItem(
      'algorithm-quest:progress:v2',
      JSON.stringify({ schemaVersion: 2, completed, events: [], reinforcement: [], declinedReinforcement: [] }),
    );
  }, count);
}

async function openNextMissionLab(page: Page, world: RegExp) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: world }).click();
  await page.getByRole('button', { name: 'Continuar →' }).click();
  await page.getByRole('button', { name: 'Entendido →' }).click();
  await page.getByLabel('Tu enfoque').fill('Pienso qué hay que recordar y qué se repite en cada vuelta.');
  await page.getByRole('button', { name: 'Empezar a programar →' }).click();
  await expect(editor(page)).toBeVisible();
}

test('el panel de pruebas muestra el coste en pasos de la última ejecución', async ({ page }) => {
  await reachLab(page);
  await expect(page.getByText(/Coste del caso más grande/)).toHaveCount(0);
  await runCode(page, CORRECT);
  await expect(page.getByText(/Coste del caso más grande: \d+ pasos/)).toBeVisible();
});

test('M10: una búsqueda por parejas se corta con el veredicto de coste, y un conjunto pasa', async ({ page }) => {
  await seedCompleted(page, 9);
  await openNextMissionLab(page, /^Mundo 1/);

  await runCode(
    page,
    `function findFirstDuplicateValue(ids) {
  for (let j = 0; j < ids.length; j++) {
    for (let i = 0; i < j; i++) {
      if (ids[i] === ids[j]) return ids[j];
    }
  }
  return null;
}`,
  );
  const mentor = page.getByRole('region', { name: 'Mentor' });
  await expect(mentor).toContainText('El coste se pasa del presupuesto.');
  await expect(mentor).toContainText('pasos');
  await expect(page.getByText(/Coste del caso más grande/)).toHaveAttribute('data-over', 'true');

  await runCode(
    page,
    `function findFirstDuplicateValue(ids) {
  const seen = new Set();
  for (let i = 0; i < ids.length; i++) {
    if (seen.has(ids[i])) return ids[i];
    seen.add(ids[i]);
  }
  return null;
}`,
  );
  await expect(page.getByText('Las pruebas pasan.')).toBeVisible();
  await expect(page.getByTestId('cost-advice')).toHaveCount(0);
  await expect(page.getByText(/Coste del caso más grande/)).toHaveAttribute('data-over', 'false');
});

test('M21: una búsqueda lineal funciona, pero el mentor avisa del coste', async ({ page }) => {
  await seedCompleted(page, 20);
  await openNextMissionLab(page, /^Mundo 3/);

  await runCode(
    page,
    `function firstValidBatch(dates, today) {
  for (let i = 0; i < dates.length; i++) {
    if (dates[i] >= today) return i;
  }
  return dates.length;
}`,
  );
  await expect(page.getByText('Las pruebas pasan.')).toBeVisible();
  await expect(page.getByTestId('cost-advice')).toContainText('Pero el coste se pasa.');

  await runCode(
    page,
    `function firstValidBatch(dates, today) {
  let lo = 0;
  let hi = dates.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid] < today) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}`,
  );
  await expect(page.getByText('Las pruebas pasan.')).toBeVisible();
  await expect(page.getByTestId('cost-advice')).toHaveCount(0);
});
