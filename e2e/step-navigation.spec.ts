import { expect, test } from "@playwright/test";

import { editor, editorText, reachLab } from "./helpers";

const IMG = /Termómetro con una línea de límite/;
const STRATEGY = "Comparo temperatura y límite antes de decidir.";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
});

test("el riel navega hacia atrás y adelante sin perder nada", async ({ page }) => {
  await reachLab(page);
  await editor(page).fill("function isOverLimit(t, l) { return t > l; }");
  await page.getByRole("button", { name: "Ejecutar" }).click();
  await expect(page.getByRole("button", { name: "Ejecutar" })).toBeEnabled();
  const code = await editorText(page);

  const rail = page.getByRole("navigation", { name: "Pasos de la misión" });
  await expect(rail.getByRole("button", { name: "Informe" })).toBeDisabled();
  await expect(rail.getByRole("button", { name: "Informe" })).toHaveAttribute(
    "title",
    "Aún no llegas aquí",
  );

  await rail.getByRole("button", { name: "Ir a Briefing" }).click();
  await expect(page.getByRole("heading", { name: "El primer diagnóstico" })).toBeVisible();
  await expect(rail.getByRole("button", { name: "Briefing" })).toHaveAttribute(
    "aria-current",
    "step",
  );

  await rail.getByRole("button", { name: "Ir a Estrategia" }).click();
  await expect(page.getByLabel("Tu enfoque")).toHaveValue(STRATEGY);

  await rail.getByRole("button", { name: "Ir a Laboratorio" }).click();
  expect(await editorText(page)).toBe(code);
  await expect(page.getByText("intentos 1")).toBeVisible();
});

test("«Entendido» desde un briefing releído vuelve al laboratorio", async ({ page }) => {
  await reachLab(page);
  const rail = page.getByRole("navigation", { name: "Pasos de la misión" });
  await rail.getByRole("button", { name: "Ir a Briefing" }).click();
  await page.getByRole("button", { name: "Entendido →" }).click();
  await expect(editor(page)).toBeVisible();
});

test("la ilustración queda a la derecha del formulario y del editor", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Continuar →" }).click();
  await page.getByRole("button", { name: "Entendido →" }).click();
  const img = page.getByRole("img", { name: IMG });
  const form = page.getByLabel("Tu enfoque");
  await expect(img).toBeVisible();
  const imgBox = (await img.boundingBox())!;
  const formBox = (await form.boundingBox())!;
  expect(imgBox.x).toBeGreaterThan(formBox.x + formBox.width - 1);

  await form.fill(STRATEGY);
  await page.getByRole("button", { name: "Empezar a programar →" }).click();
  await expect(img).toBeVisible();
  const labImg = (await img.boundingBox())!;
  const editorBox = (await editor(page).boundingBox())!;
  expect(labImg.x).toBeGreaterThan(editorBox.x + editorBox.width - 1);
  await expect(page.getByRole("heading", { name: "Pruebas" }).or(page.getByText("Pruebas").first())).toBeVisible();
});
