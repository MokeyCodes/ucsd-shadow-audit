/**
 * Schedule generator (Issue #3)
 * MVP: returns a valid Schedule[] shape per specs/api.md
 * Current behavior:
 * - Enforces maxUnits
 * - Picks the first section for each course (if sections exist)
 * - Does NOT check for time conflicts yet (next step)
 */
function generateSchedules({ termId, coursesToTake, constraints, catalog }) {
  const courseMap = new Map((catalog.courses || []).map((c) => [c.courseId, c]));

  // 1) Compute total units
  let totalUnits = 0;
  for (const courseId of coursesToTake) {
    const course = courseMap.get(courseId);
    if (course) totalUnits += course.units;
  }

  // 2) Enforce maxUnits
  if (totalUnits > constraints.maxUnits) {
    return []; // no valid schedules
  }

  // 3) Build scheduled courses (MVP: pick first section only)
  const scheduledCourses = [];

  for (const courseId of coursesToTake) {
    const course = courseMap.get(courseId);
    if (!course) continue;

    const section = (course.sections && course.sections[0]) || null;
    if (!section) continue;

    scheduledCourses.push({
      courseId,
      sectionId: section.sectionId,
      meetings: section.meetings || [],
      instructor: section.instructor,
    });
  }

  return [
    {
      scheduleId: "schedule-1",
      termId,
      courses: scheduledCourses,
      totalUnits,
      notes: ["First-section placement (conflicts not checked yet)"],
    },
  ];
}

module.exports = { generateSchedules };
