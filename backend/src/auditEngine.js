/**
 * Very small deterministic audit engine for MVP:
 * - credits: array of course IDs user provides e.g. ["CSE11","MATH20A"]
 * - degree: JSON with requirement objects
 *
 * Returns satisfied/remaining lists + justification log.
 *
 * Issue #2: CoursePool deterministic matching (audit-correct: only completed credits satisfy).
 * Backward compatible with:
 *  - type: "course_pool", options[], choose
 * Contract compatible with:
 *  - type: "CoursePool", candidates[], count
 */

// Normalize credits to canonical-ish IDs (uppercased strings)
function normalizeCredits(credits) {
  return new Set((credits || []).map(c => String(c).trim().toUpperCase()).filter(Boolean));
}

// Helper for CoursePool requirements
function satisfyCoursePool(req, completedCreditsSet) {
  const options = (req.candidates || req.options || [])
    .map(c => String(c).trim().toUpperCase())
    .filter(Boolean);

  const choose = req.count ?? req.choose ?? options.length;

  // ONLY completed courses count toward satisfaction
  const taken = options.filter(c => completedCreditsSet.has(c));
  const satisfied = taken.length >= choose;

  // Suggestions are helpful, but do NOT count as completed
  const remainingCount = Math.max(0, choose - taken.length);
  const suggestions = options.filter(c => !completedCreditsSet.has(c)).slice(0, remainingCount);

  return { options, choose, satisfied, taken, remainingCount, suggestions };
}

function isCoursePool(req) {
  return req?.type === 'CoursePool' || req?.type === 'course_pool';
}

// Main audit function
function runAudit(credits, degree) {
  const creditSet = normalizeCredits(credits);

  /** @type {Array<{requirementId: string, description?: string, satisfied: boolean, matchedCourseIds?: string[]}>} */
  const satisfied = [];
  /** @type {Array<{requirementId: string, description?: string, satisfied: boolean, matchedCourseIds?: string[]}>} */
  const remaining = [];
  const log = [];

  for (const req of degree.requirements || []) {
    // Course pool requirement: choose N from candidates/options
    if (isCoursePool(req)) {
      const result = satisfyCoursePool(req, creditSet);

      const matched = result.taken.slice(0, result.choose);

      const rr = {
        requirementId: req.id,
        description: req.description,
        satisfied: result.satisfied,
        matchedCourseIds: matched
      };

      (rr.satisfied ? satisfied : remaining).push(rr);

      // Log each completed course that counts toward the pool (slot clarity)
      matched.forEach((cid, i) => {
        log.push({
          requirementId: req.id,
          matchedBy: cid,
          reason: `Filled CoursePool slot ${i + 1}/${result.choose}`
        });
      });

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
    // Backward compatible: req.courseId is used for RequiredCourse style requirements.
    const needed = String(req.courseId || '').trim().toUpperCase();

    const ok = Boolean(needed) && creditSet.has(needed);

    const rr = {
      requirementId: req.id,
      description: req.description,
      satisfied: ok,
      matchedCourseIds: ok ? [needed] : []
    };

    (ok ? satisfied : remaining).push(rr);

    log.push({
      requirementId: req.id,
      matchedBy: ok ? needed : null,
      reason: ok ? 'Exact course match' : 'No matching credit found'
    });
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
