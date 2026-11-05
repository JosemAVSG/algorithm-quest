import { expect, test, type Page } from "@playwright/test";

import { editor } from "./helpers";

/**
 * M06-M08 briefing illustrations are found by their accessible name, and M06's
 * structured debrief works end to end (wrong answer = feedback, then right).
 * Progress is seeded so the missions are open without replaying M01-M05.
 */

const FIX = `function averageTemperature(readings) {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < readings.length; i++) {
    if (readings[i] !== null) {
      sum += readings[i];
      count++;
    }
  }
  return count === 0 ? null : sum / count;
}`;

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => {
    const completed = ["M01", "M02", "M03", "M04", "M05"].map((missionId, index) => ({
      missionId,
      completedAt: 1_700_000_000_000 + index,
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
  });
});

async function openMission(page: Page, prefix: RegExp) {
  await page.goto("/");
  await page.getByRole("button", { name: /^Mundo 1/ }).click();
  await page.getByRole("button", { name: prefix }).click();
}

test("M06 muestra la cinta de lecturas con el sensor sin dato", async ({ page }) => {
  await openMission(page, /^M06/);
  await expect(page.getByRole("img", { name: /Una cinta con tres lecturas/ })).toBeVisible();
});

test("M07 muestra la candidata que solo cambia ante una mejor", async ({ page }) => {
  await page.addInitScript(() => {
    const raw = window.localStorage.getItem("algorithm-quest:progress:v2");
    if (raw === null) return;
    const progress = JSON.parse(raw) as { completed: unknown[] };
    progress.completed.push({
      missionId: "M06",
      completedAt: 1_700_000_000_100,
      attempts: 1,
      hintsUsed: 0,
      reasoningScore: 3,
      evidence: [],
    });
    window.localStorage.setItem("algorithm-quest:progress:v2", JSON.stringify(progress));
  });
  await openMission(page, /^M07/);
  await expect(page.getByRole("img", { name: /Cinco órdenes con su prioridad/ })).toBeVisible();
});

test("M08 muestra las comparaciones entre identificadores", async ({ page }) => {
  await page.addInitScript(() => {
    const raw = window.localStorage.getItem("algorithm-quest:progress:v2");
    if (raw === null) return;
    const progress = JSON.parse(raw) as { completed: unknown[] };
    for (const [index, missionId] of ["M06", "M07"].entries()) {
      progress.completed.push({
        missionId,
        completedAt: 1_700_000_000_100 + index,
        attempts: 1,
        hintsUsed: 0,
        reasoningScore: 3,
        evidence: [],
      });
    }
    window.localStorage.setItem("algorithm-quest:progress:v2", JSON.stringify(progress));
  });
  await openMission(page, /^M08/);
  await expect(page.getByRole("img", { name: /Seis identificadores en fila/ })).toBeVisible();
});

test("M06: el informe estructurado da pista al fallar y cierra al corregir", async ({ page }) => {
  await openMission(page, /^M06/);
  await page.getByRole("button", { name: "Entendido →" }).click();
  await page.getByLabel("Tu enfoque").fill("Cuento solo las lecturas que no son null.");
  await page.getByRole("button", { name: "Empezar a programar →" }).click();
  await editor(page).fill(FIX);
  await page.getByRole("button", { name: "Ejecutar" }).click();
  await page.getByRole("button", { name: "Abrir el informe →" }).click();
  await expect(page.getByRole("heading", { name: "Explica con tus palabras" })).toBeVisible();

  const pick = async (n: number, text: string) =>
    page.getByLabel(`Hueco ${n}`).selectOption(text);
  await pick(1, "cuántas lecturas hay en la lista");
  await pick(2, "NaN");
  await pick(3, "cuántas lecturas son distintas de null");
  await pick(4, "undefined"); // wrong on purpose
  await page
    .getByLabel("El `null` aporta 0 a la suma, pero cuenta como una lectura más en la división", { exact: true })
    .check();
  await page
    .getByLabel("0, porque la lista no está vacía aunque ninguna lectura sea válida", { exact: true })
    .check();
  await page
    .getByLabel("Descarta las lecturas de 0 °C, que son válidas, porque 0 se evalúa como falso", { exact: true })
    .check();
  await page.getByRole("button", { name: "Cerrar la misión" }).click();

  await expect(page.getByRole("status").filter({ hasText: "repensar: hueco 4" })).toBeVisible();
  await expect(page.getByText("Misión completada")).toHaveCount(0);

  await pick(4, "null");
  await page.getByRole("button", { name: "Cerrar la misión" }).click();
  await expect(page.getByText("Misión completada")).toBeVisible();
});
