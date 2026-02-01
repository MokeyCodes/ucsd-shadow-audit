import React, { useEffect, useMemo, useState } from "react";
import Picker from "react-mobile-picker";

const TIME_PREF_OPTIONS = ["NIGHT_OWL", "NEUTRAL", "EARLY_BIRD"];
const LABELS = {
  NEUTRAL: "Neutral",
  NIGHT_OWL: "Night Owl",
  EARLY_BIRD: "Early Bird",
};

const RIGOR_PREF_OPTIONS = ["EXAM_BASED", "NONE", "PROJECT_BASED"];
const RIGOR_LABELS = {
  NONE: "No pref",
  EXAM_BASED: "Prefer exams",
  PROJECT_BASED: "Prefer projects",
};


const API_BASE = "http://localhost:3001";

// Backend day keys
const DAY_KEYS = ["M", "T", "W", "Th", "F"];
const DAY_LABELS = { M: "Mon", T: "Tue", W: "Wed", Th: "Thu", F: "Fri" };

// UI time range
const DAY_START_MIN = 8 * 60; // 8:00
const DAY_END_MIN = 20 * 60; // 20:00
const PX_PER_MIN = 1; // 60px per hour

function minToLabel(min) {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const h12 = ((h24 + 11) % 12) + 1;
  const ampm = h24 >= 12 ? "PM" : "AM";
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function flattenMeetings(schedule) {
  // schedule.courses[].meetings[] -> flat blocks
  const blocks = [];
  for (const course of schedule?.courses || []) {
    for (const mtg of course?.meetings || []) {
      blocks.push({
        courseId: course.courseId || "COURSE",
        day: mtg.day,
        startMin: mtg.startMin,
        endMin: mtg.endMin,
      });
    }
  }
  return blocks;
}

// Accepts:
// "CSE11, MATH20A" -> ["CSE11","MATH20A"]
// "CSE 12 MATH 20A" -> ["CSE12","MATH20A"]
function parseCourses(text) {
  const tokens = text
    .split(/[,\n]+/) // split on commas/newlines first
    .flatMap((chunk) => chunk.trim().split(/\s+/)) // then spaces
    .map((s) => s.trim())
    .filter(Boolean);

  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].toUpperCase();

    // If token is just letters and next token starts with digits, merge them:
    // "CSE" + "12" -> "CSE12"
    // "MATH" + "20A" -> "MATH20A"
    if (/^[A-Z]+$/.test(t) && i + 1 < tokens.length && /^\d/.test(tokens[i + 1])) {
      out.push((t + tokens[i + 1]).toUpperCase());
      i += 1;
      continue;
    }

    // Remove spaces inside like "CSE 12" already handled; keep normal tokens
    out.push(t.replace(/\s+/g, ""));
  }

  // final cleanup (remove empties)
  return out.map((x) => x.trim()).filter(Boolean);
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

const DEMO_COURSES = ["CSE11", "MATH20A"];
const DEMO_CONSTRAINTS = { maxUnits: 16 };

export default function ScheduleViewer({
  // still supported, but now used only as initial defaults
  termId = "SP26",
  coursesToTake = DEMO_COURSES,
  constraints = DEMO_CONSTRAINTS,
}) {
  const [timePreference, setTimePreference] = useState("NEUTRAL");
  const [rigorPreference, setRigorPreference] = useState("NONE");
  // ----- Draft inputs (what user is typing) -----
  const [draftTermId, setDraftTermId] = useState(termId);
  const [draftCoursesText, setDraftCoursesText] = useState((coursesToTake || DEMO_COURSES).join(", "));
  const [draftMaxUnits, setDraftMaxUnits] = useState(constraints?.maxUnits ?? DEMO_CONSTRAINTS.maxUnits);

  // ----- Active inputs (what drives API calls) -----
  const [activeTermId, setActiveTermId] = useState(termId);
  const [activeCoursesToTake, setActiveCoursesToTake] = useState(coursesToTake || DEMO_COURSES);
  const [activeConstraints, setActiveConstraints] = useState({
    maxUnits: constraints?.maxUnits ?? DEMO_CONSTRAINTS.maxUnits,
  });

  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [index, setIndex] = useState(0);

  // Debug: show raw response
  const [rawResp, setRawResp] = useState(null);

  // Scoring state
  const [scoresByScheduleId, setScoresByScheduleId] = useState({});
  const [scoreLoading, setScoreLoading] = useState(false);
  const [scoreErr, setScoreErr] = useState("");

  // NEW: Diagnostics for empty schedules
  const [diagnostic, setDiagnostic] = useState("");
  const [showDebug, setShowDebug] = useState(false);

  const selected = schedules[index];

  useEffect(() => {
  setScoresByScheduleId({});
}, [timePreference]);

  // ---- Fetch schedules (driven by ACTIVE inputs) ----
  useEffect(() => {
    let alive = true;

    async function fetchSchedules() {
      setLoading(true);
      setLoadErr("");
      setDiagnostic("");
      setSchedules([]);
      setIndex(0);
      setRawResp(null);

      // reset scoring when schedules change
      setScoresByScheduleId({});
      setScoreErr("");
      setScoreLoading(false);

      try {
        const payload = {
          termId: activeTermId,
          coursesToTake: activeCoursesToTake,
          constraints: activeConstraints,
        };

        const res = await fetch(`${API_BASE}/api/generate-schedules`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const json = await res.json();
        if (!alive) return;

        setRawResp(json);
        const arrRaw = Array.isArray(json?.schedules) ? json.schedules : [];
        const requested = (activeCoursesToTake || []).map((x) => String(x).toUpperCase());
        const requestedSet = new Set(requested);

        const arr = arrRaw.filter((s) => {
          if (!Array.isArray(s?.courses) || s.courses.length === 0) return false;

          const gotSet = new Set(s.courses.map((c) => String(c.courseId || "").toUpperCase()));
          // keep only schedules that cover ALL requested courses
          for (const r of requestedSet) {
            if (!gotSet.has(r)) return false;
          }
          return true;
        });

        setSchedules(arr);

        // If backend returned only partial schedules, surface a helpful message
        if (arr.length === 0 && arrRaw.length > 0) {
          // compute which courses are missing from the first returned schedule (good enough for MVP)
          const first = arrRaw[0];
          const gotSet = new Set((first?.courses || []).map((c) => String(c.courseId || "").toUpperCase()));
          const missingFromReturned = requested.filter((r) => !gotSet.has(r));
          if (missingFromReturned.length) {
            setDiagnostic(`No schedule: some requested courses were not scheduled: ${missingFromReturned.join(", ")}.`);
          }
        }

      } catch (e) {
        if (!alive) return;
        console.error(e);
        setLoadErr(
          "Failed to load schedules. Is backend running on http://localhost:3001 and does /api/generate-schedules exist?"
        );
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    if (Array.isArray(activeCoursesToTake) && activeCoursesToTake.length > 0) {
      fetchSchedules();
    } else {
      setSchedules([]);
      setRawResp({ schedules: [] });
      setDiagnostic("Enter at least one course to generate schedules.");
    }

    return () => {
      alive = false;
    };
  }, [activeTermId, activeCoursesToTake, activeConstraints]);

  // Keep index in bounds
  useEffect(() => {
    if (index >= schedules.length) setIndex(0);
  }, [schedules.length, index]);

  // ---- Fetch score for selected schedule (cached) ----
  useEffect(() => {
    let alive = true;

    async function fetchScoreForSelected() {
      if (!selected?.scheduleId) return;
      if (!Array.isArray(selected?.courses) || selected.courses.length === 0) return;
      if (scoresByScheduleId[selected.scheduleId]) return;

      setScoreLoading(true);
      setScoreErr("");

      try {
        const res = await fetch(`${API_BASE}/api/score-schedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schedule: selected,
            preferences: {
              timeOfDay: timePreference,
              rigorStyle: rigorPreference, 
            },
          }),
        });

        const json = await res.json();
        if (!alive) return;

        setScoresByScheduleId((prev) => ({
          ...prev,
          [selected.scheduleId]: json,
        }));
      } catch (e) {
        if (!alive) return;
        console.error(e);
        setScoreErr("Failed to score schedule. Is /api/score-schedule running?");
      } finally {
        if (!alive) return;
        setScoreLoading(false);
      }
    }

    fetchScoreForSelected();

    return () => {
      alive = false;
    };
  }, [selected, scoresByScheduleId, timePreference]);

  // ---- Diagnose why schedules are empty ----
  useEffect(() => {
    let alive = true;

    async function diagnoseWhyEmpty() {
      // only diagnose when we have no schedules and we aren't currently loading
      if (loading) return;
      if (schedules.length > 0) return;

      if (!Array.isArray(activeCoursesToTake) || activeCoursesToTake.length === 0) return;

      try {
        const res = await fetch(`${API_BASE}/data/catalog`);
        const catalog = await res.json();
        if (!alive) return;

        const courses = Array.isArray(catalog?.courses) ? catalog.courses : [];
        const byId = new Map(courses.map((c) => [String(c.courseId).toUpperCase(), c]));

        // 1) Missing courses
        const missing = activeCoursesToTake.filter((id) => !byId.has(String(id).toUpperCase()));
        if (missing.length) {
          setDiagnostic(`No schedule: course(s) not found in catalog snapshot: ${missing.join(", ")}.`);
          return;
        }

        // 2) Max units exceeded
        const maxUnits = Number(activeConstraints?.maxUnits ?? 0);
        const totalUnits = activeCoursesToTake.reduce((sum, id) => {
          const c = byId.get(String(id).toUpperCase());
          return sum + Number(c?.units ?? 0);
        }, 0);

        if (maxUnits > 0 && totalUnits > maxUnits) {
          setDiagnostic(`No schedule: total units ${totalUnits} exceeds maxUnits ${maxUnits}.`);
          return;
        }

        // 3) Timing conflict check (MVP rule: first section per course)
        const meetingsByCourse = activeCoursesToTake.map((id) => {
          const course = byId.get(String(id).toUpperCase());
          const firstSection = Array.isArray(course?.sections) ? course.sections[0] : null;
          const meetings = Array.isArray(firstSection?.meetings) ? firstSection.meetings : [];
          return {
            courseId: String(id).toUpperCase(),
            meetings: meetings
              .filter((m) => m && m.day && Number.isFinite(m.startMin) && Number.isFinite(m.endMin))
              .map((m) => ({
                day: m.day,
                startMin: m.startMin,
                endMin: m.endMin,
              })),
          };
        });

        for (let i = 0; i < meetingsByCourse.length; i++) {
          for (let j = i + 1; j < meetingsByCourse.length; j++) {
            const A = meetingsByCourse[i];
            const B = meetingsByCourse[j];

            for (const am of A.meetings) {
              for (const bm of B.meetings) {
                if (am.day !== bm.day) continue;
                if (overlaps(am.startMin, am.endMin, bm.startMin, bm.endMin)) {
                  const dayLabel = DAY_LABELS[am.day] || am.day;
                  setDiagnostic(
                    `No schedule: timing conflict (MVP uses first section per course). ` +
                      `${A.courseId} and ${B.courseId} overlap on ${dayLabel} ` +
                      `(${minToLabel(am.startMin)}–${minToLabel(am.endMin)} vs ${minToLabel(bm.startMin)}–${minToLabel(
                        bm.endMin
                      )}).`
                  );
                  return;
                }
              }
            }
          }
        }

        // 4) Fallback: unknown reason
        setDiagnostic(
          "No schedule: no valid combination found under the current snapshot/rules (could be missing sections or meeting data)."
        );
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setDiagnostic("No schedule: unable to run diagnostics (failed to load catalog).");
      }
    }

    diagnoseWhyEmpty();
    return () => {
      alive = false;
    };
  }, [loading, schedules.length, activeCoursesToTake, activeConstraints]);

  const blocks = useMemo(() => flattenMeetings(selected), [selected]);
  const selectedScore = selected?.scheduleId ? scoresByScheduleId[selected.scheduleId] : null;

  // ---- Render states ----
  if (loading) return <div className="card">Loading schedules…</div>;
  if (loadErr) return <div className="badgeBad"><span>❌</span><span>{loadErr}</span></div>;

  // ---- UI ----
  return (
    <div className="section">
      {/* Schedule Inputs */}
      <div className="card" style={{ marginBottom: 16 }}>
  <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
    <div style={{ fontWeight: 800 }}>Schedule Builder</div>
    <div className="pill">Press Enter to generate</div>
  </div>

  <div className="row" style={{ alignItems: "flex-end" }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label className="small">Term</label>
      <input
        className="input"
        value={draftTermId}
        onChange={(e) => setDraftTermId(e.target.value)}
        placeholder="SP26"
        style={{ width: 140 }}
      />
    </div>

    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 280 }}>
      <label className="small">Courses (comma/space separated)</label>
      <input
        className="input"
        value={draftCoursesText}
        onChange={(e) => setDraftCoursesText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const parsed = parseCourses(draftCoursesText);
            if (!parsed.length) {
              setLoadErr("Enter at least one courseId (e.g., CSE11).");
              return;
            }
            setLoadErr("");
            setDiagnostic("");
            setActiveTermId(draftTermId.trim() || "SP26");
            setActiveCoursesToTake(parsed);
            setActiveConstraints({
              maxUnits: Number.isFinite(Number(draftMaxUnits)) ? Number(draftMaxUnits) : 16,
            });
            setIndex(0);
          }
        }}
        placeholder="CSE11, MATH20A, CSE12"
      />
    </div>

    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label className="small">Max Units</label>
      <input
        className="input"
        type="number"
        value={draftMaxUnits}
        onChange={(e) => setDraftMaxUnits(e.target.value)}
        min={0}
        style={{ width: 140 }}
      />
    </div>

<div style={{ display: "flex", gap: 24, alignItems: "flex-end" }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
  <label className="small">Time Preference</label>

  <div className="wheelBox">
    <Picker
      value={{ pref: timePreference }}
      onChange={(val) => setTimePreference(val.pref)}
      height={140}
      itemHeight={36}
    >
      <Picker.Column name="pref">
        {TIME_PREF_OPTIONS.map((opt) => (
          <Picker.Item key={opt} value={opt}>
            {LABELS[opt]}
          </Picker.Item>
        ))}
      </Picker.Column>
    </Picker>
    </div>
  </div>
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
  <label className="small">Learning Style</label>

  <div className="wheelBox">
    <Picker
      value={{ rigor: rigorPreference }}
      onChange={(val) => setRigorPreference(val.rigor)}
      height={140}
      itemHeight={36}
    >
      <Picker.Column name="rigor">
        {RIGOR_PREF_OPTIONS.map((opt) => (
          <Picker.Item key={opt} value={opt}>
            {RIGOR_LABELS[opt]}
          </Picker.Item>
        ))}
      </Picker.Column>
    </Picker>
  </div>
</div>


</div>


    <button
      className="btn btnPrimary"
      onClick={() => {
        const parsed = parseCourses(draftCoursesText);
        if (!parsed.length) {
          setLoadErr("Enter at least one courseId (e.g., CSE11).");
          return;
        }

        setLoadErr("");
        setDiagnostic("");
        setActiveTermId(draftTermId.trim() || "SP26");
        setActiveCoursesToTake(parsed);
        setActiveConstraints({
          maxUnits: Number.isFinite(Number(draftMaxUnits)) ? Number(draftMaxUnits) : 16,
        });
        setIndex(0);
      }}
    >
      Generate
    </button>
  </div>

  <div className="small" style={{ marginTop: 8 }}>
    Tip: <span className="code">CSE12</span> or <span className="code">CSE 12</span> both work.
  </div>

  <div className="small" style={{ marginTop: 6, opacity: 0.9 }}>
    Active: <strong>{activeTermId}</strong> · <strong>{(activeCoursesToTake || []).join(", ")}</strong> · maxUnits{" "}
    <strong>{activeConstraints?.maxUnits}</strong>
  </div>
</div>


      {/* Empty state (after inputs) */}
      {!schedules.length ? (
        <div className="card">
          <div className="muted" style={{ marginBottom: 8 }}>No valid schedules found.</div>

          {diagnostic && (
            <div className="warn" style={{ marginBottom: 12 }}>
              <strong>Why:</strong> {diagnostic}
            </div>
          )}

           <button className="btn" onClick={() => setShowDebug((v) => !v)}>
            {showDebug ? "Hide Debug" : "Show Debug"}
          </button>

          {showDebug && (
            <div className="notice" style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Debug: raw /api/generate-schedules response</div>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                {rawResp ? JSON.stringify(rawResp, null, 2) : "(no response captured)"}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <>
          <h2>
            Schedule Option {index + 1} / {schedules.length}
          </h2>

          {/* Toggle */}
          <div className="btnRow" style={{ marginBottom: 12 }}>
            <button className="btn" onClick={() => setIndex((i) => (i - 1 + schedules.length) % schedules.length)}>Prev</button>
            <button className="btn" onClick={() => setIndex((i) => (i + 1) % schedules.length)}>Next</button>
          </div>


          {/* Score Breakdown */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Score</div>

            {scoreErr ? (
              <div style={{ color: "red" }}>{scoreErr}</div>
            ) : scoreLoading && !selectedScore ? (
              <div style={{ color: "#666" }}>Scoring…</div>
            ) : selectedScore ? (
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
  <div style={{ fontSize: 22, fontWeight: 900 }}>
    {selectedScore.totalScore}
  </div>
  <div className="muted">Total score</div>
</div>

<div className="chips" style={{ marginBottom: 10 }}>
  <div className="chip"><strong>Workload</strong> {selectedScore.breakdown?.workload ?? "—"}</div>
  <div className="chip"><strong>Timing</strong> {selectedScore.breakdown?.timing ?? "—"}</div>
  <div className="chip"><strong>Professor</strong> {selectedScore.breakdown?.professor ?? "—"}</div>
  <div className="chip"><strong>Schedule Shape</strong> {selectedScore.breakdown?.shape ?? "—"}</div>
</div>


                <ul className="list" style={{ color: "#475569" }}>
                  {Array.isArray(selectedScore.explanations) &&
                    selectedScore.explanations.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            ) : (
              <div style={{ color: "#666" }}>Scoring…</div>
            )}
          </div>

          {/* Weekly Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "90px repeat(5, 1fr)", gap: 8 }}>
            {/* Header row */}
            <div />
            {DAY_KEYS.map((d) => (
              <div key={d} className="gridHeader">{DAY_LABELS[d]}</div>
            ))}

            {/* Time column */}
            <div className="timeCol">
              {Array.from({ length: (DAY_END_MIN - DAY_START_MIN) / 60 + 1 }).map((_, i) => {
                const t = DAY_START_MIN + i * 60;
                const top = (t - DAY_START_MIN) * PX_PER_MIN;
                return (
                  <div key={t} style={{ position: "absolute", top, left: 0, right: 0, fontSize: 12, color: "#666" }}>
                    {minToLabel(t)}
                  </div>
                );
              })}
            </div>

            {/* Day columns */}
            {DAY_KEYS.map((day) => {
              const dayBlocks = blocks.filter((b) => b.day === day);

              return (
                <div key={day} className="dayCol">
                  {/* hour lines */}
                  {Array.from({ length: (DAY_END_MIN - DAY_START_MIN) / 60 + 1 }).map((_, i) => {
                    const t = DAY_START_MIN + i * 60;
                    const top = (t - DAY_START_MIN) * PX_PER_MIN;
                    return (
                      <div key={t} className="hourLine" style={{ top }} />
                    );
                  })}

                  {/* blocks */}
                  {dayBlocks.map((b, i) => {
                    const s = clamp(b.startMin, DAY_START_MIN, DAY_END_MIN);
                    const e = clamp(b.endMin, DAY_START_MIN, DAY_END_MIN);
                    const top = (s - DAY_START_MIN) * PX_PER_MIN;
                    const height = Math.max(18, (e - s) * PX_PER_MIN);

                    return (
                      <div
                        key={`${b.courseId}-${day}-${b.startMin}-${i}`}
                        title={`${b.courseId} (${minToLabel(b.startMin)}–${minToLabel(b.endMin)})`}
                        className="block"
                        style={{ top, height }}
                      >
                        <div className="blockTitle">{b.courseId}</div>
                        <div className="blockTime">{minToLabel(b.startMin)}–{minToLabel(b.endMin)}</div>
                      </div>

                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Debug panel (optional) */}
          <button className="btn" onClick={() => setShowDebug((v) => !v)} style={{ marginTop: 16 }}>
            {showDebug ? "Hide Debug" : "Show Debug"}
          </button>

          {showDebug && (
            <div className="notice" style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Debug: raw /api/generate-schedules response</div>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(rawResp, null, 2)}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
