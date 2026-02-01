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
        // Contract: courseId exists; do not rely on non-contract fields like "title"
        courseId: course.courseId || "COURSE",
        day: mtg.day,
        startMin: mtg.startMin,
        endMin: mtg.endMin,
      });
    }
  }
  return blocks;
}

export default function ScheduleViewer({
  // DEMO DEFAULTS: App.jsx should pass real values later.
  termId = "SP26",
  coursesToTake = ["CSE11", "MATH20A"],
  constraints = { maxUnits: 16 },
}) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [index, setIndex] = useState(0);

  // Debug: show raw response
  const [rawResp, setRawResp] = useState(null);

  const selected = schedules[index];

  // ---- Fetch schedules ----
  useEffect(() => {
    let alive = true;

    async function fetchSchedules() {
      setLoading(true);
      setLoadErr("");
      setSchedules([]);
      setIndex(0);
      setRawResp(null);

      try {
        // DEMO NOTE: these come from props (defaults above).
        const payload = { termId, coursesToTake, constraints };

        const res = await fetch(`${API_BASE}/api/generate-schedules`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const json = await res.json();
        if (!alive) return;

        setRawResp(json);

        // API returns { schedules: Schedule[] }
        const arr = Array.isArray(json?.schedules) ? json.schedules : [];
        setSchedules(arr);
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

    fetchSchedules();
    return () => {
      alive = false;
    };
  }, [termId, coursesToTake, constraints]);

  // Keep index in bounds
  useEffect(() => {
    if (index >= schedules.length) setIndex(0);
  }, [schedules.length, index]);

  const blocks = useMemo(() => flattenMeetings(selected), [selected]);

  // ---- Render states ----
  if (loading) return <div style={{ padding: 20 }}>Loading schedules…</div>;
  if (loadErr) return <div style={{ padding: 20, color: "red" }}>{loadErr}</div>;

  if (!schedules.length) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ color: "#666", marginBottom: 12 }}>No valid schedules found.</div>

        {/* Debug panel to help you immediately see why */}
        <div style={{ background: "#fafafa", border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Debug: raw /api/generate-schedules response</div>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {rawResp ? JSON.stringify(rawResp, null, 2) : "(no response captured)"}
          </pre>
        </div>
      </div>
    );
  }

  // ---- UI ----
  return (
    <div style={{ padding: 20 }}>
      <h2>
        Schedule Option {index + 1} / {schedules.length}
      </h2>

      {/* Toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => setIndex((i) => (i - 1 + schedules.length) % schedules.length)}>Prev</button>
        <button onClick={() => setIndex((i) => (i + 1) % schedules.length)}>Next</button>
      </div>

      {/* Score Breakdown (Issue #4 will wire real scoring later) */}
      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Score</div>
        <div style={{ color: "#666" }}>Score breakdown coming soon.</div>
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

      {/* Debug panel (optional, remove later) */}
      <div style={{ marginTop: 16, background: "#fafafa", border: "1px solid #eee", padding: 12, borderRadius: 8 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Debug: raw /api/generate-schedules response</div>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify(rawResp, null, 2)}</pre>
      </div>
    </div>
  );
}
