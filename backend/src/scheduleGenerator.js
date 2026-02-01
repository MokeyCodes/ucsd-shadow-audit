/**
 * Schedule generator (Issue #3)
 * MVP: returns a valid Schedule[] shape per specs/api.md
 * Current behavior:
 * - Enforces maxUnits
 * - Picks the first section for each course (if sections exist)
 * - Checks for time conflicts across different courses' meetings
 */

function meetingsOverlap(a, b) {
  if (a.day !== b.day) return false;
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

function scheduleHasConflict(scheduledCourses) {
  const allMeetings = [];

  for (const sc of scheduledCourses) {
    for (const m of sc.meetings || []) {
      allMeetings.push({ ...m, courseId: sc.courseId });
    }
  }

  for (let i = 0; i < allMeetings.length; i++) {
    for (let j = i + 1; j < allMeetings.length; j++) {
      const A = allMeetings[i];
      const B = allMeetings[j];

      // only compare across different courses
      if (A.courseId === B.courseId) continue;

      if (meetingsOverlap(A, B)) return true;
    }
  }

  return false;
}

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

  // 4) Conflict detection across courses
  if (scheduleHasConflict(scheduledCourses)) {
    return []; // chosen sections overlap, so no valid schedule under current strategy
  }

  return [
    {
      scheduleId: "schedule-1",
      termId,
      courses: scheduledCourses,
      totalUnits,
      notes: ["First-section placement (conflicts checked)"],
    },
  ];
}

module.exports = { generateSchedules };
