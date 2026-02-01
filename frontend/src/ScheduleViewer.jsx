import React, { useEffect, useMemo, useState } from "react";

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

  const selected = schedules[index];

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
          body: JSON.stringify({ schedule: selected }),
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
  }, [selected, scoresByScheduleId]);

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
  if (loading) return <div style={{ padding: 20 }}>Loading schedules…</div>;
  if (loadErr) return <div style={{ padding: 20, color: "red" }}>{loadErr}</div>;

  // ---- UI ----
  return (
    <div style={{ padding: 20 }}>
      {/* Schedule Inputs */}
      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Schedule Builder</div>

        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: "#666" }}>Term</label>
            <input
              value={draftTermId}
              onChange={(e) => setDraftTermId(e.target.value)}
              placeholder="SP26"
              style={{ padding: "8px 10px", width: 120 }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: "#666" }}>Courses (comma/space separated)</label>
            <input
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
              style={{ padding: "8px 10px", minWidth: 340 }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: "#666" }}>Max Units</label>
            <input
              type="number"
              value={draftMaxUnits}
              onChange={(e) => setDraftMaxUnits(e.target.value)}
              min={0}
              style={{ padding: "8px 10px", width: 110 }}
            />
          </div>

          <button
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
            style={{ padding: "8px 12px" }}
          >
            Generate
          </button>
        </div>

        <div style={{ marginTop: 8, color: "#666", fontSize: 12 }}>
          Tip: <code>CSE12</code> or <code>CSE 12</code> both work. Press Enter to generate.
        </div>

        <div style={{ marginTop: 6, fontSize: 12, color: "#888" }}>
          Active: <strong>{activeTermId}</strong> · <strong>{(activeCoursesToTake || []).join(", ")}</strong> · maxUnits{" "}
          <strong>{activeConstraints?.maxUnits}</strong>
        </div>
      </div>

      {/* Empty state (after inputs) */}
      {!schedules.length ? (
        <div style={{ padding: 20 }}>
          <div style={{ color: "#666", marginBottom: 8 }}>No valid schedules found.</div>

          {diagnostic && (
            <div style={{ marginBottom: 12, color: "#b45309" }}>
              <strong>Why:</strong> {diagnostic}
            </div>
          )}

          {/* Debug panel */}
          <div style={{ background: "#fafafa", border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Debug: raw /api/generate-schedules response</div>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
              {rawResp ? JSON.stringify(rawResp, null, 2) : "(no response captured)"}
            </pre>
          </div>
        </div>
      ) : (
        <>
          <h2>
            Schedule Option {index + 1} / {schedules.length}
          </h2>

          {/* Toggle */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button onClick={() => setIndex((i) => (i - 1 + schedules.length) % schedules.length)}>Prev</button>
            <button onClick={() => setIndex((i) => (i + 1) % schedules.length)}>Next</button>
          </div>

          {/* Score Breakdown */}
          <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Score</div>

            {scoreErr ? (
              <div style={{ color: "red" }}>{scoreErr}</div>
            ) : scoreLoading && !selectedScore ? (
              <div style={{ color: "#666" }}>Scoring…</div>
            ) : selectedScore ? (
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Total: {selectedScore.totalScore}</div>

                <div style={{ color: "#333", marginBottom: 8 }}>
                  Workload: {selectedScore.breakdown?.workload ?? "—"} · Timing: {selectedScore.breakdown?.timing ?? "—"} ·
                  Professor: {selectedScore.breakdown?.professor ?? "—"} · Vibe: {selectedScore.breakdown?.vibeFit ?? "—"}
                </div>

                <ul style={{ margin: 0, paddingLeft: 18, color: "#555" }}>
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
              <div key={d} style={{ fontWeight: 700, textAlign: "center" }}>
                {DAY_LABELS[d]}
              </div>
            ))}

            {/* Time column */}
            <div style={{ position: "relative", height: (DAY_END_MIN - DAY_START_MIN) * PX_PER_MIN }}>
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
                <div
                  key={day}
                  style={{
                    position: "relative",
                    height: (DAY_END_MIN - DAY_START_MIN) * PX_PER_MIN,
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    overflow: "hidden",
                    background: "white",
                  }}
                >
                  {/* hour lines */}
                  {Array.from({ length: (DAY_END_MIN - DAY_START_MIN) / 60 + 1 }).map((_, i) => {
                    const t = DAY_START_MIN + i * 60;
                    const top = (t - DAY_START_MIN) * PX_PER_MIN;
                    return (
                      <div
                        key={t}
                        style={{
                          position: "absolute",
                          top,
                          left: 0,
                          right: 0,
                          borderTop: "1px solid #f0f0f0",
                        }}
                      />
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
                        style={{
                          position: "absolute",
                          top,
                          left: 6,
                          right: 6,
                          height,
                          borderRadius: 8,
                          border: "1px solid #cbd5e1",
                          background: "#e2e8f0",
                          padding: "6px 8px",
                          fontSize: 12,
                          overflow: "hidden",
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>{b.courseId}</div>
                        <div style={{ color: "#475569" }}>
                          {minToLabel(b.startMin)}–{minToLabel(b.endMin)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Debug panel (optional) */}
          <div style={{ marginTop: 16, background: "#fafafa", border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Debug: raw /api/generate-schedules response</div>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(rawResp, null, 2)}</pre>
          </div>
        </>
      )}
    </div>
  );
}
