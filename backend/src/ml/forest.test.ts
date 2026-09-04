import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { predictProbabilities } from "./forest.js";
import { loadServingModel } from "./servingModel.js";

interface ParitySet {
  vectors: number[][];
  expected: number[][];
}

const model = loadServingModel(new URL("./model.json", import.meta.url));
const fixture = JSON.parse(
  readFileSync(new URL("./parityFixture.json", import.meta.url), "utf8"),
) as {
  modelVersion: string;
  featureNames: string[];
  real: ParitySet;
  nearThreshold: ParitySet;
};

/** Counts rows where any class probability differs from scikit-learn's at all. */
function inexactRows(set: ParitySet): number {
  let inexact = 0;
  for (const [row, vector] of set.vectors.entries()) {
    const actual = predictProbabilities(model, vector);
    const expected = set.expected[row]!;
    if (actual.some((probability, index) => probability !== expected[index])) inexact++;
  }
  return inexact;
}

describe("predictProbabilities", () => {
  it("was generated from the model currently committed", () => {
    // Guards the pairing: a regenerated model with a stale fixture would
    // otherwise compare predictions against another model's answers.
    expect(fixture.modelVersion).toBe(model.version);
    expect(fixture.featureNames).toEqual(model.featureNames);
  });

  it("reproduces scikit-learn exactly on every real dataset row", () => {
    expect(fixture.real.vectors.length).toBeGreaterThan(600);
    expect(inexactRows(fixture.real)).toBe(0);
  });

  it("reproduces scikit-learn exactly on values that sit against a split threshold", () => {
    // The case real data never reaches: scikit-learn compares features as
    // float32, so a float64 comparison here would route some of these rows
    // down the other branch and return different probabilities entirely.
    expect(fixture.nearThreshold.vectors.length).toBeGreaterThan(400);
    expect(inexactRows(fixture.nearThreshold)).toBe(0);
  });

  it("returns one probability per class, summing to 1", () => {
    const probabilities = predictProbabilities(model, fixture.real.vectors[0]!);
    expect(probabilities).toHaveLength(model.classes.length);
    expect(probabilities.reduce((total, p) => total + p, 0)).toBeCloseTo(1, 12);
  });
});
