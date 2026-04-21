import type { BonusRule } from "@/lib/types";

export function trimBonusProofForSubmit(
  proof: Record<string, Record<string, string>>,
  rules: BonusRule[],
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const rule of rules) {
    const sub = proof[rule.id];
    if (!sub) continue;
    const cleaned: Record<string, string> = {};
    for (const f of rule.proofFields ?? []) {
      const v = (sub[f.id] ?? "").trim().slice(0, 500);
      if (v) cleaned[f.id] = v;
    }
    if (Object.keys(cleaned).length) out[rule.id] = cleaned;
  }
  return out;
}

/** Returns an error message or null if OK. */
export function validateBonusProof(
  proof: Record<string, Record<string, string>>,
  rules: BonusRule[],
  selected: Record<string, boolean>,
): string | null {
  for (const rule of rules) {
    if (!selected[rule.id]) continue;
    for (const f of rule.proofFields ?? []) {
      if (!f.requiredWhenBonus) continue;
      const v = (proof[rule.id]?.[f.id] ?? "").trim();
      if (!v) {
        return `Please fill in “${f.label}” for ${rule.label} (required for those bonus tickets).`;
      }
    }
    for (const f of rule.proofFields ?? []) {
      if (f.input !== "url") continue;
      const v = (proof[rule.id]?.[f.id] ?? "").trim();
      if (!v) continue;
      if (!/^https:\/\//i.test(v)) {
        return `For ${rule.label}, use an https:// link in “${f.label}”.`;
      }
    }
  }
  return null;
}
