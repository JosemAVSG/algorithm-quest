import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { CORRECT, editor, reachLab, runCode } from './helpers';

/**
 * Automated accessibility and layout checks on the screens a player sees, on a
 * desktop and on a phone. axe cannot judge whether a screen is *good*, but it
 * does catch what a review keeps missing: text dimmed below 4.5:1 with
 * `opacity`, a screen with no <main>, a control the keyboard cannot reach.
 */

async function expectClean(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'])
    .analyze();
  const summary = results.violations.map(
    (violation) => `${violation.id} (${violation.nodes.length}): ${violation.help}`,
  );
  expect(summary, `${label} has accessibility violations`).toEqual([]);
}

async function expectFitsViewport(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${label} scrolls sideways`).toBeLessThanOrEqual(1);
}

const SCREENS = [
  { name: 'desktop', size: { width: 1280, height: 900 } },
  { name: 'phone', size: { width: 390, height: 844 } },
];

for (const { name, size } of SCREENS) {
  test.describe(`${name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(size);
    });

    test('mapa, mundo y progreso', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('main')).toBeVisible();
      await expectClean(page, 'el mapa');
      await expectFitsViewport(page, 'el mapa');

      await page.getByRole('button', { name: /^Mundo 1/ }).click();
      await expectClean(page, 'el mundo');

      await page.getByRole('button', { name: '← Volver a los mundos' }).click();
      await page.getByRole('button', { name: 'Ver progreso' }).click();
      await expect(page.getByRole('main')).toBeVisible();
      await expectClean(page, 'el progreso');
      await expectFitsViewport(page, 'el progreso');
    });

    test('briefing, estrategia, laboratorio e informe', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Continuar →' }).click();
      await expect(page.getByRole('heading', { name: 'El primer diagnóstico' })).toBeVisible();
      await expectClean(page, 'el briefing');
      await page.getByRole('button', { name: 'Entendido →' }).click();
      await expectClean(page, 'la estrategia');
      await page.getByLabel('Tu enfoque').fill('Comparo temperatura y límite antes de decidir.');
      await page.getByRole('button', { name: 'Empezar a programar →' }).click();
      await expect(editor(page)).toBeVisible();
      await runCode(page, CORRECT);
      await expect(page.getByText('Las pruebas pasan.')).toBeVisible();
      await expectClean(page, 'el laboratorio');
      await expectFitsViewport(page, 'el laboratorio');

      await page.getByRole('button', { name: 'Abrir el informe →' }).click();
      await expect(page.getByRole('heading', { name: 'Por qué funciona' })).toBeVisible();
      await expectClean(page, 'el informe');
      // The debrief sentence has long <select> options; it used to push the page 20 px wide.
      await expectFitsViewport(page, 'el informe');
    });
  });
}

test('en un móvil los controles táctiles miden lo bastante para un dedo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await reachLab(page);
  const small = await page.evaluate(() =>
    [...document.querySelectorAll('button, select, input[type="range"]')]
      .map((element) => ({ element, box: element.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && box.height < 40)
      .map(({ element, box }) => `${element.tagName.toLowerCase()} "${(element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 24)}" ${Math.round(box.height)}px`),
  );
  expect(small).toEqual([]);
});
