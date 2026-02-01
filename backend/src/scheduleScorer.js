// backend/src/scheduleScorer.js
// Deterministic, explainable schedule scoring (Issue #4)

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function formatTime(mins) {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = ((h24 + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function countRigorStyles(schedule) {
  let examHeavy = 0;
  let projectHeavy = 0;

  for (const c of schedule.courses || []) {
    const key = (c.courseId || "").toUpperCase();
    const info = COURSE_RIGOR[key];
    if (!info) continue;

    if (info.style === "exam-heavy") examHeavy += 1;
    if (info.style === "project-heavy") projectHeavy += 1;
  }

  return { examHeavy, projectHeavy };
}

function getEarliestMeetingStart(schedule) {
  let earliest = Infinity;
  for (const c of schedule.courses || []) {
    for (const mtg of c.meetings || []) {
      if (Number.isFinite(mtg?.startMin)) {
        earliest = Math.min(earliest, mtg.startMin);
      }
    }
  }
  return earliest === Infinity ? null : earliest; // minutes
}

// Night Owl: 12pm is perfect (0), quadratic penalty as we approach 8am
function nightOwlQuadraticPenalty(earliestMin) {
  if (earliestMin == null) return 0;

  // Convert to hours in 24h: 8.0 .. 12.0
  const h = clamp(earliestMin / 60, 8, 12);

  if (h >= 12) return 0;

  const maxPenalty = 25;         // tweakable intensity
  const t = (12 - h) / 4;        // 0 at 12pm, 1 at 8am
  return Math.round(maxPenalty * t * t);
}

// Early Bird: simple deterministic adjustment (optional to keep symmetric later)
function earlyBirdAdjust(earliestMin) {
  if (earliestMin == null) return 0;
  const h = earliestMin / 60;
  if (h <= 9) return +10;
  if (h <= 10) return +6;
  if (h >= 13) return -6;
  return 0;
}


const DAYS = ["M", "T", "W", "Th", "F"];

/**
 * Static MVP snapshots (deterministic).
 * Expand these later if you want better fidelity.
 */
const COURSE_RIGOR = {
  // courseId: { style: "exam-heavy" | "project-heavy" | "balanced", delta: number }
  // delta: + helps workload score, - hurts workload score (small magnitude)
  MATH20C: { style: "exam-heavy", delta: -4 },
  MATH18: { style: "exam-heavy", delta: -3 },
  CSE11: { style: "project-heavy", delta: -2 },
  CSE12: { style: "project-heavy", delta: -3 },
  // default: balanced
};

// Instructor difficulty snapshot: higher difficulty => lower professor score
// Keep small magnitudes for MVP
const INSTRUCTOR_DIFFICULTY = {
  // "Last, First": { difficulty: 0..10 }
  // Example (fake placeholders):
  "Doe": { difficulty: 4 },
  "Smith": { difficulty: 6 },
  // default: unknown
};

function collectMeetingsByDay(schedule) {
  const byDay = { M: [], T: [], W: [], Th: [], F: [] };

  for (const c of schedule.courses || []) {
    for (const mtg of c.meetings || []) {
      if (!DAYS.includes(mtg.day)) continue;
      byDay[mtg.day].push({
        courseId: c.courseId,
        startMin: mtg.startMin,
        endMin: mtg.endMin,
      });
    }
  }

  for (const d of DAYS) {
    byDay[d].sort((a, b) => a.startMin - b.startMin);
  }
  return byDay;
}

function countTotalMeetings(byDay) {
  let total = 0;
  for (const d of DAYS) total += byDay[d].length;
  return total;
}

function scoreWorkload(schedule, explanations) {
  const units = Number(schedule.totalUnits || 0);

  // Base curve:
  // 12 units => 95, 16 => 75, 20 => 55 (floor at 30)
  let score = 95 - (units - 12) * 5;
  score = clamp(score, 30, 100);

  if (units <= 12) explanations.push(`Workload: ${units} units (light load).`);
  else if (units <= 16) explanations.push(`Workload: ${units} units (moderate load).`);
  else explanations.push(`Workload: ${units} units (heavy load)... 🫡`);

  // Rigor adjustment (exam-heavy vs project-heavy) from static snapshot
  let examHeavy = 0;
  let projectHeavy = 0;
  let rigorDelta = 0;

  for (const c of schedule.courses || []) {
    const key = (c.courseId || "").toUpperCase();
    const info = COURSE_RIGOR[key];
    if (!info) continue;

    rigorDelta += info.delta;
    if (info.style === "exam-heavy") examHeavy += 1;
    else if (info.style === "project-heavy") projectHeavy += 1;
  }

  // Keep this small so units still dominate workload
  if (rigorDelta !== 0) {
    score += rigorDelta;
    const sign = rigorDelta > 0 ? "+" : "";
    explanations.push(
      `Rigor: exam-heavy=${examHeavy}, project-heavy=${projectHeavy} (${sign}${rigorDelta}).`
    );
  } else {
    explanations.push(`Rigor: no snapshot matches (neutral).`);
  }

  return Math.round(clamp(score, 0, 100));
}

function scoreTiming(schedule, explanations) {
  const byDay = collectMeetingsByDay(schedule);
  const meetingTotal = countTotalMeetings(byDay);

  // If no meetings exist, timing can’t be evaluated meaningfully.
  if (meetingTotal === 0) {
    explanations.push("Timing: no meeting data (neutral).");
    return 70;
  }

  let score = 100;

  // counts for explainability
  let earlyCount = 0;
  let bigGapCount = 0;
  let backToBackCount = 0;
  let largeGapPenaltyTotal = 0;

  const EARLY_BEFORE = 540;     // 9:00 AM
  const LATE_REWARD_AT = 600;   // 10:00 AM
  const BIG_GAP_MIN = 120;      // 2 hours+
  const BACK_TO_BACK_MAX = 10;  // <= 10 min gap

  let earliest = Infinity;

  for (const d of DAYS) {
    const mts = byDay[d];
    if (mts.length === 0) continue;

    earliest = Math.min(earliest, mts[0].startMin);

    if (mts[0].startMin < EARLY_BEFORE) {
      earlyCount += 1;
      score -= 8;
    }

    for (let i = 0; i < mts.length - 1; i++) {
      const gap = mts[i + 1].startMin - mts[i].endMin;
      if (gap >= BIG_GAP_MIN) {
        bigGapCount += 1;

        // Continuous penalty: 120 min => -5, 180 => -8, 240 => -11, capped
        const over = gap - BIG_GAP_MIN;
        const extra = Math.floor(over / 30); // every extra 30 min
        const penalty = Math.min(5 + extra * 3, 20); // cap per gap

        score -= penalty;
        largeGapPenaltyTotal += penalty;
        explanations.push(
          `Timing: large gap ${Math.round(gap)} min on ${d} (-${penalty}).`
        );
      } else if (gap >= 0 && gap <= BACK_TO_BACK_MAX) {
        backToBackCount += 1;
        score -= 2;
      }
    }
  }

  // Reward later starts if earliest meeting is >= 10am
  if (earliest !== Infinity && earliest >= LATE_REWARD_AT) {
    score += 6;
    explanations.push(`Timing: no classes before ${formatTime(LATE_REWARD_AT)} (+6).`);
  }

  // Explanations (include positives if no penalties)
  if (earlyCount > 0) {
    explanations.push(
      `Timing: ${earlyCount} day(s) start before ${formatTime(EARLY_BEFORE)} (-${earlyCount * 8}).`
    );
  } else {
    explanations.push(`Timing: no early starts (0 penalty).`);
  }

  if (bigGapCount > 0) {
  explanations.push(
    `Timing: ${bigGapCount} large gap(s) ≥ ${BIG_GAP_MIN} min (-${largeGapPenaltyTotal}).`
    );
  } else {
    explanations.push(`Timing: no large gaps (0 penalty).`);
  }


  if (backToBackCount > 0) {
    explanations.push(
      `Timing: ${backToBackCount} back-to-back transition(s) ≤ ${BACK_TO_BACK_MAX} min (-${backToBackCount * 2}).`
    );
  } else {
    explanations.push(`Timing: no back-to-back rushes (0 penalty).`);
  }

  return Math.round(clamp(score, 0, 100));
}

function scoreProfessor(schedule, explanations) {
  // Deterministic: only uses schedule.instructor + static snapshot
  let score = 60; // slightly above neutral if we have named instructors

  let staffCount = 0;
  let namedCount = 0;

  // difficulty adjustments
  let knownDifficultyCount = 0;
  let difficultyPenalty = 0;

  for (const c of schedule.courses || []) {
    const instRaw = (c.instructor || "").trim();

    if (!instRaw || instRaw.toLowerCase() === "staff") {
      staffCount += 1;
      continue;
    }

    namedCount += 1;

    // Try exact match, then fallback by last token (super MVP)
    const exact = INSTRUCTOR_DIFFICULTY[instRaw];
    const lastToken = instRaw.split(/\s+/).slice(-1)[0];
    const fallback = INSTRUCTOR_DIFFICULTY[lastToken];

    const info = exact || fallback;
    if (info) {
      knownDifficultyCount += 1;
      // difficulty 0..10 -> penalty 0..15
      const p = Math.round((info.difficulty / 10) * 15);
      difficultyPenalty += p;
    }
  }

  // staff/unknown instructors: slightly reduce confidence
  score -= Math.min(staffCount * 3, 12);

  // known difficulty: penalize
  score -= difficultyPenalty;

  // small bonus for having named instructors at all
  if (namedCount > 0) score += Math.min(namedCount * 2, 6);

  explanations.push(
    `Professor: named=${namedCount}, staff/unknown=${staffCount}, difficultyKnown=${knownDifficultyCount}, difficultyPenalty=-${difficultyPenalty}.`
  );

  return Math.round(clamp(score, 0, 100));
}

function scoreVibeFit(schedule, explanations) {
  const byDay = collectMeetingsByDay(schedule);
  const meetingTotal = countTotalMeetings(byDay);

  // Fix: don’t tag “compact” if there are no meetings
  if (meetingTotal === 0) {
    explanations.push("Vibe fit: no meeting data (neutral).");
    return 70;
  }

  let totalGaps = 0;
  let gapCount = 0;

  for (const d of DAYS) {
    const mts = byDay[d];
    if (mts.length === 0) continue;


    for (let i = 0; i < mts.length - 1; i++) {
      const gap = mts[i + 1].startMin - mts[i].endMin;
      if (gap >= 0) {
        totalGaps += gap;
        gapCount += 1;
      }
    }
  }

  const avgGap = gapCount === 0 ? 0 : totalGaps / gapCount;

  const tags = [];


  if (avgGap <= 30) tags.push("compact");
  else if (avgGap >= 90) tags.push("spread-out");

  // Score from tags (deterministic)
  let score = 70;
  if (tags.includes("compact")) score += 10;
  if (tags.includes("spread-out")) score -= 10;

  explanations.push(`Vibe fit tags: ${tags.length ? tags.join(", ") : "none"}.`);

  return Math.round(clamp(score, 0, 100));
}


function scoreSchedule(schedule, preferences = {}) {
  const explanations = [];

  const breakdown = {
    workload: scoreWorkload(schedule, explanations),
    timing: scoreTiming(schedule, explanations),
    professor: scoreProfessor(schedule, explanations),
    shape: scoreVibeFit(schedule, explanations),
  };

  const rigorPref = preferences?.rigorStyle || "NONE";
const { examHeavy, projectHeavy } = countRigorStyles(schedule);

if (rigorPref === "EXAM_BASED") {
  const diff = examHeavy - projectHeavy;
  const bonus = clamp(diff * 4, -8, +8);

  breakdown.workload = clamp(breakdown.workload + bonus, 0, 100);
  explanations.push(
    `Preference (Exam-Based): exam-heavy=${examHeavy}, project-heavy=${projectHeavy} → ${bonus >= 0 ? "+" : ""}${bonus} workload.`
  );
}

if (rigorPref === "PROJECT_BASED") {
  const diff = projectHeavy - examHeavy;
  const bonus = clamp(diff * 4, -8, +8);

  breakdown.workload = clamp(breakdown.workload + bonus, 0, 100);
  explanations.push(
    `Preference (Project-Based): project-heavy=${projectHeavy}, exam-heavy=${examHeavy} → ${bonus >= 0 ? "+" : ""}${bonus} workload.`
  );
}

    // ---- Preference adjustment (deterministic) ----
  const pref = preferences?.timeOfDay || "NEUTRAL";
  const earliestMin = getEarliestMeetingStart(schedule);

  if (pref === "NIGHT_OWL") {
    const p = nightOwlQuadraticPenalty(earliestMin);
    breakdown.timing = clamp(breakdown.timing - p, 0, 100);

    if (earliestMin != null) {
      explanations.push(
        `Preference (Night Owl): earliest start ${formatTime(earliestMin)} → -${p} timing (quadratic).`
      );
    } else {
      explanations.push(`Preference (Night Owl): no meeting data (0).`);
    }
  } else if (pref === "EARLY_BIRD") {
    const adj = earlyBirdAdjust(earliestMin);
    breakdown.timing = clamp(breakdown.timing + adj, 0, 100);

    if (earliestMin != null) {
      explanations.push(
        `Preference (Early Bird): earliest start ${formatTime(earliestMin)} → ${adj >= 0 ? "+" : ""}${adj} timing.`
      );
    } else {
      explanations.push(`Preference (Early Bird): no meeting data (0).`);
    }
  }


  // Weighted total, higher is better
  const totalScore = Math.round(
    breakdown.workload * 0.35 +
    breakdown.timing * 0.35 +
    breakdown.professor * 0.10 +
    breakdown.shape * 0.20
  );

  explanations.unshift(
    "Total score computed from weighted breakdown (workload/timing/schedule-shape/prof)."
  );

  return { totalScore, breakdown, explanations };
}

module.exports = { scoreSchedule };
