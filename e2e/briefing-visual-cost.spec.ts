import { expect, test, type Page } from "@playwright/test";

/**
 * M09 briefing illustration (cost-grid): reachable by its accessible name, and
 * it stays visible while the player moves on to the lab.
 */

async function seedCompleted(page: Page, upTo: number) {
  await page.addInitScript((count: number) => {
    const completed = Array.from({ length: count }, (_, index) => ({
      missionId: `M${String(index + 1).padStart(2, "0")}`,
      completedAt: 1,
      attempts: 1,
      hintsUsed: 0,
      reasoningScore: 3,
      evidence: [],
    }));
    window.localStorage.setItem(
      "algorithm-quest:progress:v2",
      JSON.stringify({
        schemaVersion: 2,
        completed,
        events: [],
        reinforcement: [],
        declinedReinforcement: [],
      }),
    );
  }, upTo);
}

test("el briefing de M09 muestra la cuadrícula de comparaciones", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedCompleted(page, 8);
  await page.goto("/");
  await page.getByRole("button", { name: /^Mundo 1/ }).click();
  await page.getByRole("button", { name: /^M09/ }).click();

  await expect(page.getByRole("heading", { name: "El costo de la inspección" })).toBeVisible();
  const picture = page.getByRole("img", { name: /Cada pareja de órdenes se compara una vez/ });
  await expect(picture).toBeVisible();

  await page.getByRole("button", { name: "Entendido →" }).click();
  await expect(page.getByLabel("Tu enfoque")).toBeVisible();
  await expect(picture).toBeVisible();
});
