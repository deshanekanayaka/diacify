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

  it("rejects a feature name the builder cannot produce", () => {
    const unknown = variant();
    const names = unknown.featureNames as string[];
    names[0] = "cholesterol";
    expect(() => loadServingModel(sourceFor(unknown))).toThrow(/Invalid serving model/);
  });

  it("rejects a repeated feature name", () => {
    const duplicated = variant();
    const names = duplicated.featureNames as string[];
    names[1] = names[0]!;
    expect(() => loadServingModel(sourceFor(duplicated))).toThrow(/must not repeat/);
  });

  it("rejects a branch splitting on a feature index outside the feature list", () => {
    const model = variant();
    const trees = model.trees as { left: number[]; feature: number[] }[];
    const branch = trees[0]!.left.findIndex((child) => child !== -1);
    trees[0]!.feature[branch] = 999;
    expect(() => loadServingModel(sourceFor(model))).toThrow(/feature out of range/);
  });

  it("rejects a model missing a median the feature builder reads", () => {
    const incomplete = variant();
    delete (incomplete.medians as Record<string, number>).hdl;
    expect(() => loadServingModel(sourceFor(incomplete))).toThrow(/Invalid serving model/);
  });
});

describe("loadServingModel child index bounds", () => {
  /**
   * Corrupts one branch node's left child and returns the resulting load.
   *
   * Deliberately picks a branch below the root: at node 0 a backwards or
   * self reference is also a non-positive index, so these cases would pass
   * under a rule that only bounded the index rather than ordering it.
   */
  function withLeftChild(child: (node: number) => number): () => void {
    const model = variant();
    const trees = model.trees as { left: number[] }[];
    const branch = trees[0]!.left.findIndex(
      (existing, node) => existing !== -1 && node > 1,
    );
    expect(branch).toBeGreaterThan(1);
    trees[0]!.left[branch] = child(branch);
    return () => loadServingModel(sourceFor(model));
  }

  it("rejects a negative child index that is not the leaf marker", () => {
    expect(withLeftChild(() => -5)).toThrow(/child out of range/);
  });

  it("rejects a node pointing at itself", () => {
    // Would spin the traversal's while loop forever rather than reach a leaf.
    expect(withLeftChild((node) => node)).toThrow(/child out of range/);
  });

  it("rejects a node pointing back at an earlier node", () => {
    expect(withLeftChild((node) => node - 1)).toThrow(/child out of range/);
  });
});
