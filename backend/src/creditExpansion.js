
/*
// Temporary stub to prevent backend crash
// Issue #6: credit expansion not yet implemented

module.exports = function expandCredits(credits) {
  if (!Array.isArray(credits)) return [];
  return credits;
};


*/

/**
 * Expand external credits (AP, transfer, etc.) into course IDs.
 * For now, this is a stub so the backend does not crash.
 */
function expandCredits(externalCredits = []) {
  // Later: map AP exams → courses
  // For now: return empty array
  return [];
}

module.exports = { expandCredits };