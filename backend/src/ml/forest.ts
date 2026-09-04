import type { ServingModel } from "./servingModel.js";

const LEAF = -1;
const ROOT = 0;

/**
 * Runs a feature vector through the forest, returning one probability per class.
 *
 * A random forest's probability is the mean of its trees' leaf distributions,
 * so this walks each tree to a leaf and averages what it finds there.
 *
 * The Math.fround is load-bearing, not defensive. scikit-learn casts features
 * to float32 before comparing them to a split threshold, so a value sitting
 * between a threshold and the next float32 above it takes the *other* branch
 * under a plain float64 comparison - a different leaf, and potentially a
 * different risk category. See forest.test.ts's near-threshold case.
 *
 * @param model The validated serving model.
 * @param features Feature values in model.featureNames order.
 * @returns Probabilities in model.classes order, summing to 1.
 */
export function predictProbabilities(model: ServingModel, features: number[]): number[] {
  const totals = new Array<number>(model.classes.length).fill(0);

  for (const tree of model.trees) {
    let node = ROOT;
    while (tree.left[node] !== LEAF) {
      const value = Math.fround(features[tree.feature[node]!]!);
      node = value <= tree.threshold[node]! ? tree.left[node]! : tree.right[node]!;
    }

    const distribution = tree.value[node]!;
    for (let index = 0; index < totals.length; index++) {
      totals[index] = totals[index]! + distribution[index]!;
    }
  }

  return totals.map((total) => total / model.trees.length);
}
