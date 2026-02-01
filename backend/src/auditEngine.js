/**
 * Very small deterministic audit engine for MVP:
 * - credits: array of course IDs user provides e.g. ["CSE11","MATH20A"]
 * - degree: JSON with requirement objects each with courseId
 *
 * Returns satisfied/remaining lists + justification log.
 */
// Helper function for CoursePool requirements
function satisfyCoursePool(coursePool, completedCreditsSet) {
  const options = coursePool.options.map(c => String(c).toUpperCase());
  const choose = coursePool.choose || options.length;

  // Courses already completed from the pool
  const taken = options.filter(c => completedCreditsSet.has(c));
  const slotsFilled = taken.length;

  // Courses still needed (deterministic: pick in order listed)
  const needed = choose - slotsFilled;
  const toTake = options.filter(c => !completedCreditsSet.has(c)).slice(0, needed);

  const satisfiedCourses = [...taken, ...toTake];

  return {
    requirementId: coursePool.id,
    satisfied: satisfiedCourses.length === choose,
    coursesSatisfying: satisfiedCourses
  };
}

// Main audit function
function runAudit(credits, degree) {
  const creditSet = new Set(credits.map(c => String(c).toUpperCase()));
  const satisfied = [];
  const remaining = [];
  const log = [];

  for (const req of degree.requirements || []) {
    if (req.type === 'course_pool') {
      const result = satisfyCoursePool(req, creditSet);
      if (result.satisfied) {
        satisfied.push(req);
      } else {
        remaining.push(req);
      }
      log.push({
        requirementId: req.id,
        matchedBy: result.coursesSatisfying,
        reason: 'Course pool match'
      });
    } else {
      const needed = String(req.courseId || '').toUpperCase();
      if (needed && creditSet.has(needed)) {
        satisfied.push(req);
        log.push({ requirementId: req.id, matchedBy: needed, reason: 'Exact course match' });
      } else {
        remaining.push(req);
        log.push({ requirementId: req.id, matchedBy: null, reason: 'No matching credit found' });
      }
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

// 1️⃣ The problem we’re solving

// You have degree requirements like:

// “Choose 2 of {MATH20A, MATH20B, MATH18}”

// And a student may have:

// Taken some of these courses already (maybe through AP credits)

// Not taken others

// We want your audit engine to:

// Decide which courses satisfy the requirement

// Be predictable, so the same input always gives the same output

// Not use AI — just simple logic

// 2️⃣ Breaking down “Deterministic greedy matching”

// Let’s explain each part:

// Deterministic

// Means no randomness, no guessing.

// Every time the same student credits + the same requirement comes in, the result is always the same.

// Example: if a student has ["MATH18"] and needs 2 courses from {MATH20A, MATH20B, MATH18}, the system will always pick MATH20A as the second course — never MATH20B.

// Greedy

// “Greedy” means: take what you can immediately satisfy first, then fill the rest.

// Step by step for our course pool:

// Look at the student’s completed courses

// Already have MATH18 → ✅ fills 1 slot

// Look at the remaining courses in the pool

// Need 1 more course to satisfy the requirement (choose = 2)

// Pick the first available option from the list that the student hasn’t taken

// The pool is listed as [MATH20A, MATH20B, MATH18]

// MATH18 is already taken → skip

// Pick MATH20A → fills the second slot

// That’s it! Simple, predictable, greedy.
