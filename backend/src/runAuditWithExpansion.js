const { runAudit } = require("./auditEngine");
const { expandCredits } = require("./data/creditExpansion");

function runAuditWithExpansion(credits, degree) {
  const directCourses = credits.filter(c => typeof c === "string");
  const externalCredits = credits.filter(c => c && typeof c === "object");

  const expandedCourses = expandCredits(externalCredits);
  const expandedCourseIds = [...directCourses, ...expandedCourses];

  const result = runAudit(expandedCourseIds, degree);
  return { ...result, expandedCourseIds };
}

module.exports = { runAuditWithExpansion };

