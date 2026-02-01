/**
 * Very small deterministic audit engine for MVP:
 * - credits: array of course IDs user provides e.g. ["CSE11","MATH20A"]
 * - degree: JSON with requirement objects each with courseId
 *
 * Returns satisfied/remaining lists + justification log.
 */

// Helper function for CoursePool requirements (Issue #2)
function satisfyCoursePool(coursePool, completedCreditsSet) {
  const options = (coursePool.options || []).map(c => String(c).toUpperCase());
  const choose = coursePool.choose ?? options.length;

  // ONLY completed courses count toward satisfaction
  const taken = options.filter(c => completedCreditsSet.has(c));
  const satisfied = taken.length >= choose;

  // Suggestions are helpful, but do NOT count as completed
  const remainingCount = Math.max(0, choose - taken.length);
  const suggestions = options
    .filter(c => !completedCreditsSet.has(c))
    .slice(0, remainingCount);

  return {
    satisfied,
    taken,
    remainingCount,
    suggestions
  };
}

// Main audit function
function runAudit(credits, degree) {
  const creditSet = new Set((credits || []).map(c => String(c).toUpperCase()));
  const satisfied = [];
  const remaining = [];
  const log = [];

  for (const req of degree.requirements || []) {
    // Course pool requirement: choose N from options
    if (req.type === 'course_pool') {
      const result = satisfyCoursePool(req, creditSet);

      if (result.satisfied) satisfied.push(req);
      else remaining.push(req);

      // Log each completed course that counts toward the pool
      for (const cid of result.taken) {
        log.push({
          requirementId: req.id,
          matchedBy: cid,
          reason: 'Counts toward course pool'
        });
      }

      // If not satisfied, log what is still needed + deterministic suggestions
      if (!result.satisfied) {
        const suggestionText = result.suggestions.length
          ? ` Suggestions: ${result.suggestions.join(', ')}`
          : '';

        log.push({
          requirementId: req.id,
          matchedBy: 'COURSE_POOL',
          reason: `Needs ${result.remainingCount} more from pool.${suggestionText}`
        });
      }

      continue;
    }

    // Single course requirement: exact match
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
