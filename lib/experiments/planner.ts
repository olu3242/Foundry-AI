export type ExperimentPlanInput = {
  baselineRate: number;
  minimumDetectableLift: number;
  power?: number;
  alpha?: number;
};

export type ExperimentPlan = {
  perArm: number;
  total: number;
  baselineRate: number;
  targetRate: number;
  power: number;
  alpha: number;
};

function inverseNormal(p: number) {
  if (!(p > 0 && p < 1)) throw new Error("Probability must be between 0 and 1");
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425, hi = 1 - lo;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  if (p > hi) return -inverseNormal(1 - p);
  const q = p - 0.5, r = q * q;
  return (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q /
    (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
}

/** Two-arm equal-allocation planning for a binary outcome using the normal approximation. */
export function planBinaryExperiment(input: ExperimentPlanInput): ExperimentPlan {
  const power = input.power ?? 0.8;
  const alpha = input.alpha ?? 0.05;
  const p1 = input.baselineRate;
  const p2 = p1 + input.minimumDetectableLift;
  if (!(p1 > 0 && p1 < 1) || !(p2 > 0 && p2 < 1)) throw new Error("Rates must stay between 0 and 1");
  if (!(power > 0.5 && power < 1) || !(alpha > 0 && alpha < 0.5)) throw new Error("Invalid power or alpha");
  const pbar = (p1 + p2) / 2;
  const zAlpha = inverseNormal(1 - alpha / 2);
  const zPower = inverseNormal(power);
  const numerator = zAlpha * Math.sqrt(2 * pbar * (1 - pbar)) +
    zPower * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
  const perArm = Math.ceil((numerator * numerator) / ((p2 - p1) ** 2));
  return { perArm, total: perArm * 2, baselineRate: p1, targetRate: p2, power, alpha };
}
