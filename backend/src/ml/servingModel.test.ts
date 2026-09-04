import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { loadDefaultServingModel, loadServingModel } from "./servingModel.js";

const committed = loadDefaultServingModel();

/** Writes a model variant to a temp file and returns its URL. */
function sourceFor(model: unknown): URL {
  const path = join(mkdtempSync(join(tmpdir(), "serving-model-")), "model.json");
  writeFileSync(path, JSON.stringify(model));
  return pathToFileURL(path);
}

/** The committed model, structurally cloned so a test can corrupt one part. */
function variant(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(committed)) as Record<string, unknown>;
}

describe("loadServingModel", () => {
  it("loads the model committed alongside the code", () => {
    expect(committed.version).toMatch(/^rf-/);
    expect(committed.classes).toEqual(["low", "medium", "high"]);
    expect(committed.trees.length).toBeGreaterThan(0);
    expect(committed.featureNames).toContain("hba1c");
  });

  it("rejects classes that are not the domain's risk categories, in order", () => {
    const reordered = variant();
    reordered.classes = ["high", "medium", "low"];
    expect(() => loadServingModel(sourceFor(reordered))).toThrow(/Invalid serving model/);
  });

  it("rejects a tree whose node arrays are not parallel", () => {
    const ragged = variant();
    const trees = ragged.trees as { threshold: number[] }[];
    trees[0]!.threshold = trees[0]!.threshold.slice(1);
    expect(() => loadServingModel(sourceFor(ragged))).toThrow(/ragged node arrays/);
  });

  it("rejects a node pointing at a child that does not exist", () => {
    const dangling = variant();
    const trees = dangling.trees as { left: number[]; right: number[] }[];
    const rootChild = trees[0]!.left.findIndex((child) => child !== -1);
    trees[0]!.left[rootChild] = 99_999;
    expect(() => loadServingModel(sourceFor(dangling))).toThrow(/child out of range/);
  });

  it("rejects a model missing a median the feature builder reads", () => {
    const incomplete = variant();
    delete (incomplete.medians as Record<string, number>).hdl;
    expect(() => loadServingModel(sourceFor(incomplete))).toThrow(/Invalid serving model/);
  });
});

describe("loadServingModel child index bounds", () => {
  it("rejects a negative child index that is not the leaf marker", () => {
    const model = JSON.parse(JSON.stringify(committed)) as {
      trees: { left: number[] }[];
    };
    const branch = model.trees[0]!.left.findIndex((child) => child !== -1);
    model.trees[0]!.left[branch] = -5;
    expect(() => loadServingModel(sourceFor(model))).toThrow(/child out of range/);
  });
});
