const apEquivalencies = require("./ap_equivalencies.json");

/**
 * Input: ManualCredit[]
 * Output:
 * {
 *   courseIds: string[],
 *   logs: { requirementId: string, matchedBy: string, reason: string }[]
 * }
 */
function expandCredits(credits) {
  const courseIds = [];
  const logs = [];

  for (const credit of credits) {
    if (!credit || credit.kind !== "AP" || typeof credit.label !== "string") continue;

    const label = credit.label.trim();

    // Accept:
    // "AP Calculus AB (5)"
    // "AP:Calculus AB (5)"
    // "AP Calculus AB (Score 5)"
    const match = label.match(/^AP[: ](.+?)\s*\(\s*(?:Score\s*)?(\d)\s*\)\s*$/i);
    if (!match) continue;

    const examName = match[1].trim();
    const score = Number(match[2]);

    const key = `AP:${examName}`;
    const rule = apEquivalencies[key];

    if (!rule) continue;
    if (score < rule.minScore) continue;

    // Add course IDs
    courseIds.push(...rule.courses);

    // Explainability log
    logs.push({
      requirementId: "CREDIT_EXPANSION",
      matchedBy: label,
      reason: `${rule.justification}; expanded to: ${rule.courses.join(", ")}`
    });
  }

  return { courseIds, logs };
}

module.exports = { expandCredits };

