const { runAudit } = require("./auditEngine");
const { expandCredits } = require("./data/creditExpansion");

function dedupePreserveOrder(items) {
  const seen = new Set();
  const out = [];
  for (const x of items) {
    const v = String(x).toUpperCase();
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function runAuditWithExpansion(credits, degree) {
  const directCourses = credits.filter(c => typeof c === "string");
  const externalCredits = credits.filter(c => c && typeof c === "object");

  const { courseIds: expandedCourses, logs: expansionLogs } = expandCredits(externalCredits);

  const expandedCourseIds = dedupePreserveOrder([...directCourses, ...expandedCourses]);

  const result = runAudit(expandedCourseIds, degree);

  // Merge logs (keep audit engine logs intact)
  const justificationLog = [...(expansionLogs || []), ...(result.justificationLog || [])];

  return { ...result, expandedCourseIds, justificationLog };
}

module.exports = { runAuditWithExpansion };
