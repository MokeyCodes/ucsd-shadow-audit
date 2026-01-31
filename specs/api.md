# API & Data Contracts (Hackathon MVP)

> **Purpose:** This document defines shared data shapes and API contracts so backend, scheduling, scoring, and frontend can be built **in parallel** without breaking each other.
>
> **Rule:** If you change a contract here, you must coordinate with anyone consuming or producing that data.

---

## Base conventions

* `courseId` format: `"CSE11"`, `"MATH20A"` (uppercase, no spaces)
* Time format: `startMin` / `endMin` = **minutes since midnight** (e.g., `600` = 10:00am)
* Days: `"M" | "T" | "W" | "Th" | "F"` (use `"Th"` for Thursday)

---

## Public data snapshots

### GET /data/catalog

Returns a static snapshot of the public UCSD course catalog.

```ts
type Catalog = {
  courses: Course[];
};

type Course = {
  courseId: string;
  title?: string;
  units: number;
  prereqs?: string[]; // courseIds that must be completed first
  sections?: Section[];
};

type Section = {
  sectionId: string;
  meetings: Meeting[];
  instructor?: string;
};

type Meeting = {
  day: "M" | "T" | "W" | "Th" | "F";
  startMin: number;
  endMin: number;
};
```

---

### GET /data/degree

Returns the degree rules snapshot (MVP may support a single major).

```ts
type Degree = {
  majorId: string;
  name: string;
  requirements: Requirement[];
};

type Requirement =
  | {
      id: string;
      type: "RequiredCourse";
      courseId: string;
      units: number;
      description?: string;
    }
  | {
      id: string;
      type: "CoursePool";
      count: number;
      candidates: string[]; // list of courseIds
      description?: string;
    };
```

---

## Audit API

### POST /api/audit

Computes a deterministic shadow degree audit.

#### Input

```ts
type AuditRequest = {
  credits: ManualCredit[];
  targetMajorId?: string;
};

// MVP-friendly credit representation
type ManualCredit =
  | string // canonical courseId, e.g. "CSE11"
  | {
      kind: "COURSE" | "AP" | "TRANSFER";
      label: string;        // e.g. "AP Calculus AB (5)"
      courseIds?: string[]; // mapped canonical courseIds, if known
      units?: number;
    };
```

#### Output

```ts
type AuditResponse = {
  majorId: string | null;

  // canonical courseIds after equivalency expansion
  expandedCourseIds: string[];

  satisfied: RequirementResult[];
  remaining: RequirementResult[];

  justificationLog: JustificationEntry[];
};

type RequirementResult = {
  requirementId: string;
  description?: string;
  satisfied: boolean;
  matchedCourseIds?: string[];
};

type JustificationEntry = {
  requirementId: string;
  matchedBy: string | null; // courseId or credit label
  reason: string;           // deterministic explanation
};
```

---

## Schedule generation API

### POST /api/generate-schedules

Generates valid, conflict-free schedules for a single term.

#### Input

```ts
type GenerateSchedulesRequest = {
  termId: string; // e.g. "SP26" (label only for MVP)
  coursesToTake: string[]; // canonical courseIds
  constraints: {
    maxUnits: number;
    allowWaitlist?: boolean;
    preferredDays?: ("M" | "T" | "W" | "Th" | "F")[];
    noEarlierThanMin?: number; // e.g. 540 = 9am
  };
};
```

#### Output

```ts
type GenerateSchedulesResponse = {
  schedules: Schedule[];
};

type Schedule = {
  scheduleId: string;
  termId: string;
  courses: ScheduledCourse[];
  totalUnits: number;
  notes?: string[]; // optional generator explanations
};

type ScheduledCourse = {
  courseId: string;
  sectionId: string;
  meetings: Meeting[];
  instructor?: string;
};
```

---

## Schedule scoring API

### POST /api/score-schedule

Scores a generated schedule using deterministic heuristics.

#### Input

```ts
type ScoreScheduleRequest = {
  schedule: Schedule;
};
```

#### Output

```ts
type ScoreScheduleResponse = {
  totalScore: number; // higher is better
  breakdown: {
    workload: number;   // 0–100
    timing: number;     // 0–100
    professor: number;  // 0–100
    vibeFit: number;    // 0–100 (rule-based)
  };
  explanations: string[];
};
```

---

## Frontend expectations

* Frontend should treat API responses as the source of truth.
* Frontend may mock `AuditResponse`, `Schedule[]`, and `ScoreScheduleResponse` using the contracts above.
* No frontend logic should infer requirements or prerequisites on its own.

---

## Scope notes (important)

* These contracts are **hackathon-MVP level**, not production-complete.
* Missing or unknown data should be handled conservatively.
* No AI-generated decisions are permitted in audit or scheduling logic.
