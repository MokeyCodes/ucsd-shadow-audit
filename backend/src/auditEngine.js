const { expandCredits } = require("./creditExpansion");

/**
 * credits:
 * - string courseIds (e.g. "MATH20A")
 * - OR ManualCredit objects (AP / TRANSFER)
 */
function runAudit(credits, degree) {
  const directCourses = credits.filter(c => typeof c === "string");
  const externalCredits = credits.filter(c => typeof c === "object");

  const expandedCourses = expandCredits(externalCredits);
  const allCourses = [...directCourses, ...expandedCourses];

  const creditSet = new Set(allCourses.map(c => c.toUpperCase()));

  const satisfied = [];
  const remaining = [];
  const log = [];

  for (const req of degree.requirements || []) {
    const needed = req.courseId.toUpperCase();

    if (creditSet.has(needed)) {
      satisfied.push({
        requirementId: req.id,
        description: req.description,
        satisfied: true,
        matchedCourseIds: [needed]
      });

      log.push({
        requirementId: req.id,
        matchedBy: needed,
        reason: "Exact course match"
      });
    } else {
      remaining.push({
        requirementId: req.id,
        description: req.description,
        satisfied: false
      });

      log.push({
        requirementId: req.id,
        matchedBy: null,
        reason: "No matching credit found"
      });
    }
  }

  return {
    majorId: degree.majorId || null,
    expandedCourseIds: Array.from(creditSet),
    satisfied,
    remaining,
    justificationLog: log
  };
}

module.exports = { runAudit };