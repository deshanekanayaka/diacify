import { readFileSync } from "node:fs";

import { z } from "zod";

import { SUPPORTED_FEATURE_NAMES } from "./features.js";
import { RISK_CATEGORIES } from "./riskCategory.js";

const LEAF = -1;

// Mirrors machine-learning/serving_export.py::SERVING_MEDIAN_FIELDS. Spelled
// out rather than accepted as an open record so that if the training side ever
// stops exporting a median the feature builder reads, this fails at boot
// instead of silently imputing undefined.
const medianSchema = z.object({
  age: z.number(),
  systolic: z.number(),
  diastolic: z.number(),
  bmi: z.number(),
  rbs: z.number(),
  trig: z.number(),
  hdl: z.number(),
  ldl: z.number(),
  hba1c: z.number(),
});

const treeSchema = z.object({
  left: z.array(z.number().int()),
  right: z.array(z.number().int()),
  feature: z.array(z.number().int()),
  threshold: z.array(z.number()),
  value: z.array(z.array(z.number())),
});

const servingModelSchema = z
  .object({
    version: z.string().min(1),
    // Every name must be one buildFeatureVector can actually produce, and no
    // name may repeat: a duplicate would fill two vector slots with the same
    // value while silently dropping whichever feature it displaced.
    featureNames: z
      .array(z.enum(SUPPORTED_FEATURE_NAMES))
      .min(1)
      .refine(
        (names) => new Set(names).size === names.length,
        "featureNames must not repeat a feature",
      ),
    // Pinned to the domain's own categories, in order: a model whose classes
    // disagree is one whose probability columns would be read as the wrong
    // risk levels, which is worse than refusing to start.
    classes: z
      .array(z.enum(RISK_CATEGORIES))
      .length(RISK_CATEGORIES.length)
      .refine(
        (classes) => classes.every((name, index) => name === RISK_CATEGORIES[index]),
        `classes must be exactly ${RISK_CATEGORIES.join(", ")}`,
      ),
    medians: medianSchema,
    ratioMedians: z.object({ tg_hdl_ratio: z.number(), ldl_hdl_ratio: z.number() }),
    trees: z.array(treeSchema).min(1),
  })
  .superRefine((model, ctx) => {
    for (const [index, tree] of model.trees.entries()) {
      const nodeCount = tree.left.length;
      const parallel =
        tree.right.length === nodeCount &&
        tree.feature.length === nodeCount &&
        tree.threshold.length === nodeCount &&
        tree.value.length === nodeCount;
      if (!parallel) {
        ctx.addIssue({ code: "custom", message: `tree ${index} has ragged node arrays` });
        continue;
      }
      for (let node = 0; node < nodeCount; node++) {
        const left = tree.left[node]!;
        const right = tree.right[node]!;
        const isLeaf = left === LEAF;
        // A child is always a later node - verified against the exported
        // forest, where no branch points at itself or backwards. Requiring it
        // rather than merely bounding the index is what makes the traversal
        // provably terminate: a malformed artifact cannot describe a cycle.
        // It also rules out every negative index except the -1 marking a leaf.
        const childrenInRange =
          left > node && right > node && left < nodeCount && right < nodeCount;
        if (!isLeaf && !childrenInRange) {
          ctx.addIssue({ code: "custom", message: `tree ${index} node ${node} has a child out of range` });
          return;
        }
        // Leaves carry scikit-learn's -2 placeholder here, so only a branch's
        // split feature has to index into the feature vector.
        const feature = tree.feature[node]!;
        if (!isLeaf && (feature < 0 || feature >= model.featureNames.length)) {
          ctx.addIssue({
            code: "custom",
            message: `tree ${index} node ${node} splits on a feature out of range`,
          });
          return;
        }
        if (isLeaf && tree.value[node]!.length !== model.classes.length) {
          ctx.addIssue({ code: "custom", message: `tree ${index} leaf ${node} has the wrong class count` });
          return;
        }
      }
    }
  });

export type ServingModel = z.infer<typeof servingModelSchema>;

/**
 * Reads and validates the exported model the application predicts with.
 *
 * Validation is structural, not cosmetic: the traversal in forest.ts indexes
 * these parallel arrays directly, and this is what makes those lookups safe.
 * Called at startup so a malformed artifact crashes the process rather than
 * producing quietly wrong predictions (same reasoning as ADR-010).
 *
 * @param source Location of the exported model.json.
 */
export function loadServingModel(source: URL): ServingModel {
  const parsed = servingModelSchema.safeParse(JSON.parse(readFileSync(source, "utf8")));
  if (!parsed.success) {
    throw new Error(`Invalid serving model at ${source.pathname}: ${parsed.error.message}`);
  }
  return parsed.data;
}

// Resolved from this module rather than the caller so the artifact's location
// stays an implementation detail of the module that owns it. Note the build
// copies model.json into dist alongside the compiled file.
const DEFAULT_MODEL_SOURCE = new URL("./model.json", import.meta.url);

/** Loads the model committed alongside this code. Call once, at startup. */
export function loadDefaultServingModel(): ServingModel {
  return loadServingModel(DEFAULT_MODEL_SOURCE);
}
