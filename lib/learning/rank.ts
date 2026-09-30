export type Candidate = { version_id: string; key: string; completed: number; verified_improved: number; catalogue_order: number };
export type Ranked = Candidate & { score: number; method: "evidence" | "prior" };

/**
 * Beta-binomial smoothing of "verified improvement per completed plan". The prior comes from the
 * whole network; with fewer than `minEvidence` completions a candidate is ranked on the prior
 * (catalogue order breaks ties), so sparse data never outranks proven evidence by luck.
 * This ranks what has been associated with results; it does not claim a solution caused them.
 */
export function rankSolutions(candidates: Candidate[], opts: { priorStrength?: number; minEvidence?: number } = {}): Ranked[] {
  const k = opts.priorStrength ?? 4;
  const minEvidence = opts.minEvidence ?? 3;
  const totalC = candidates.reduce((s, c) => s + c.completed, 0);
  const totalV = candidates.reduce((s, c) => s + c.verified_improved, 0);
  const priorMean = totalC > 0 ? totalV / totalC : 0.3;
  return candidates
    .map((c) => {
      const evidence = c.completed >= minEvidence;
      // Unproven candidates get the network mean less an uncertainty discount.
      const score = evidence ? (c.verified_improved + k * priorMean) / (c.completed + k) : priorMean * 0.9;
      return { ...c, score: Number(score.toFixed(4)), method: evidence ? ("evidence" as const) : ("prior" as const) };
    })
    .sort((a, b) => b.score - a.score || (a.method === b.method ? a.catalogue_order - b.catalogue_order : a.method === "evidence" ? -1 : 1));
}
