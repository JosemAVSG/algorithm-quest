import { expect, type Page } from '@playwright/test';

/**
 * Shared navigation for the browser suites.
 *
 * The strategy gate and the briefing are part of every path on purpose: a test
 * that jumps straight to the editor would keep passing if those screens broke.
 */

export const EDITOR_NAME = 'Código';

export const CORRECT = `function isOverLimit(temperature, limit) {
  return temperature > limit;
}`;

export function editor(page: Page) {
  return page.getByRole('textbox', { name: EDITOR_NAME });
}

export async function reachLab(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continuar →' }).click();
  await expect(page.getByRole('heading', { name: 'El primer diagnóstico' })).toBeVisible();
  await page.getByRole('button', { name: 'Entendido →' }).click();
  await page.getByLabel('Tu enfoque').fill('Comparo temperatura y límite antes de decidir.');
  await page.getByRole('button', { name: 'Empezar a programar →' }).click();
  await expect(editor(page)).toBeVisible();
}

/** Run a snippet and wait for the run to settle. */
export async function runCode(page: Page, code: string) {
  await editor(page).fill(code);
  await page.getByRole('button', { name: 'Ejecutar' }).click();
  await expect(page.getByRole('button', { name: 'Ejecutar' })).toBeEnabled();
}
