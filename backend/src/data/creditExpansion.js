const apEquivalencies = require("./data/ap_equivalencies.json");

/**
 * Input: ManualCredit[]
 * Output: string[] (canonical UCSD courseIds)
 */
function expandCredits(credits) {
  const expanded = [];

  for (const credit of credits) {
    if (credit.kind !== "AP") continue;

    // Example label: "AP Calculus AB (5)"
    const match = credit.label.match(/^AP (.+) \((\d)\)$/);
    if (!match) continue;

    const examName = match[1];
    const score = Number(match[2]);

    const key = `AP:${examName}`;
    const rule = apEquivalencies[key];

    if (!rule) continue;
    if (score < rule.minScore) continue;

    expanded.push(...rule.courses);
  }

  return expanded;
}

module.exports = { expandCredits };