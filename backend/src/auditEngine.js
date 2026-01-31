/**
 * Very small deterministic audit engine for MVP:
 * - credits: array of course IDs user provides e.g. ["CSE11","MATH20A"]
 * - degree: JSON with requirement objects each with courseId
 *
 * Returns satisfied/remaining lists + justification log.
 */
function runAudit(credits, degree) {
  const creditSet = new Set(credits.map(c => String(c).toUpperCase()));
  const satisfied = [];
  const remaining = [];
  const log = [];

  for (const req of degree.requirements || []) {
    const needed = String(req.courseId || '').toUpperCase();
    if (needed && creditSet.has(needed)) {
      satisfied.push(req);
      log.push({ requirementId: req.id, matchedBy: needed, reason: 'Exact course match' });
    } else {
      remaining.push(req);
      log.push({ requirementId: req.id, matchedBy: null, reason: 'No matching credit found' });
    }
  }

  return {
    majorId: degree.majorId || null,
    satisfied,
    remaining,
    justificationLog: log
  };
}

module.exports = { runAudit };
