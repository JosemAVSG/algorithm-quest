import { expect, test, type Page } from "@playwright/test";

import { editor, runCode } from "./helpers";

/**
 * M03-M05 briefing illustrations. Earlier missions are marked as completed
 * through the progress blob so the test opens each briefing directly.
 */

const PROGRESS_KEY = "algorithm-quest:progress:v2";

async function seedCompleted(page: Page, ids: string[]) {
  await page.addInitScript(
    ([key, missionIds]) => {
      const completed = missionIds.map((missionId, index) => ({
        missionId,
        completedAt: 1_700_000_000_000 + index,
        attempts: 1,
        hintsUsed: 0,
        reasoningScore: 1,
        evidence: [],
      }));
      localStorage.setItem(
        key,
        JSON.stringify({
          schemaVersion: 2,
          completed,
          events: [],
          reinforcement: [],
          declinedReinforcement: [],
        }),
      );
    },
    [PROGRESS_KEY, ids] as const,
  );
}

const CASES = [
  { id: "M03", before: ["M01", "M02"], heading: "El lote defectuoso", image: /Fila de seis unidades/ },
  { id: "M04", before: ["M01", "M02", "M03"], heading: "La auditoría del inventario", image: /Seis líneas de inventario/ },
  { id: "M05", before: ["M01", "M02", "M03", "M04"], heading: "El registro de reparaciones", image: /Cuatro reparaciones del registro original/ },
];

for (const { id, before, heading, image } of CASES) {
  test(`el briefing de ${id} muestra su ilustración y el flujo sigue`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await seedCompleted(page, before);
    await page.goto("/");
    await page.getByRole("button", { name: /^World 1/ }).click();
    await page.getByRole("button", { name: new RegExp(`^${id} `) }).click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByRole("img", { name: image })).toBeVisible();

    await page.getByRole("button", { name: "Entendido →" }).click();
    await expect(page.getByLabel("Tu enfoque")).toBeVisible();
    await expect(page.getByRole("img", { name: image })).toBeVisible();
  });
}

const M05_CODE = `function normalizeRepairs(repairs) {
  const result = [];
  for (const repair of repairs) {
    result.push({
      id: repair.id,
      device: repair.device,
      resolved: repair.resolved,
      hours: repair.hours,
      status: repair.resolved ? "closed" : "open",
      priority: repair.hours > 8 ? "high" : "normal",
    });
  }
  return result;
}`;

test("el informe estructurado de M05: un hueco mal da pista, corregirlo cierra la misión", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedCompleted(page, ["M01", "M02", "M03", "M04"]);
  await page.goto("/");
  await page.getByRole("button", { name: /^World 1/ }).click();
  await page.getByRole("button", { name: /^M05 / }).click();
  await page.getByRole("button", { name: "Entendido →" }).click();
  await page.getByLabel("Tu enfoque").fill("Recorro todo y creo un objeto nuevo por cada reparación.");
  await page.getByRole("button", { name: "Empezar a programar →" }).click();
  await expect(editor(page)).toBeVisible();
  await runCode(page, M05_CODE);
  await page.getByRole("button", { name: "Abrir el informe →" }).click();

  await page.getByLabel("Una pasada y n objetos nuevos").check();
  await page.getByLabel("Hueco 1").selectOption("todas las reparaciones, sin saltarme ninguna");
  await page
    .getByLabel("Hueco 2")
    .selectOption("creo un objeto nuevo con los campos copiados y los dos añadidos");
  await page.getByLabel("Hueco 3").selectOption("una comparación de horas con >= 8");
  await page.getByLabel("Hueco 4").selectOption("una lista nueva con tantos objetos como reparaciones");
  await page
    .getByLabel("Se asignaron los campos a los mismos objetos recibidos, en vez de crear objetos nuevos")
    .check();
  await page
    .getByLabel("5, porque cada reparación produce un objeto, esté abierta o no")
    .check();
  await page.getByLabel("normal, porque el panel pide «más de» 8 horas").check();
  await page.getByRole("button", { name: "Cerrar la misión" }).click();

  await expect(page.getByRole("status").filter({ hasText: "repensar: hueco 3" })).toBeVisible();
  await expect(page.getByText("Misión completada")).toHaveCount(0);

  await page.getByLabel("Hueco 3").selectOption("una comparación de horas con > 8");
  await page.getByRole("button", { name: "Cerrar la misión" }).click();
  await expect(page.getByText("Misión completada")).toBeVisible();
});
