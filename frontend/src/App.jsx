import React, { useState } from "react";
import ScheduleViewer from "./ScheduleViewer";

export default function App() {
  // PAGE SWITCH
  const [page, setPage] = useState("audit"); // "audit" or "schedule"

  // AUDIT STATE
  const [input, setInput] = useState("");
  const [credits, setCredits] = useState([]);
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(false);

  // AP UI state
  const [apExam, setApExam] = useState("Calculus BC");
  const [apScore, setApScore] = useState("5");

  // ---------- Credit Management ----------
  function addCredit() {
    const val = input.trim().toUpperCase();
    if (!val) return;
    const exists = credits.some(c => typeof c === "string" && c === val);
    if (!exists) setCredits(prev => [...prev, val]);
    setInput("");
  }

  function addApCredit() {
    const exam = apExam.trim();
    const score = String(apScore).trim();
    if (!exam || !/^[1-5]$/.test(score)) return;

    const label = `AP ${exam} (${score})`;
    const exists = credits.some(c => typeof c === "object" && c.kind === "AP" && c.label === label);
    if (!exists) setCredits(prev => [...prev, { kind: "AP", label }]);
  }

  function removeCreditAt(index) {
    setCredits(prev => prev.filter((_, i) => i !== index));
  }

  // ---------- Run Audit ----------
  async function runAudit() {
    setLoading(true);
    setAudit(null);
    try {
      const res = await fetch("http://localhost:3001/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits }),
      });
      const json = await res.json();
      setAudit(json);
    } catch (err) {
      console.error(err);
      setAudit({ error: "Failed to contact backend. Is it running on http://localhost:3001 ?" });
    } finally {
      setLoading(false);
    }
  }

  // ---------- Schedule Page ----------
  if (page === "schedule") {
    return (
      <div style={{ padding: 24 }}>
        <button onClick={() => setPage("audit")} style={{ padding: 8, marginBottom: 16 }}>
          ← Back to Degree Audit
        </button>
        <ScheduleViewer />
      </div>
    );
  }

  // ---------- Audit Page ----------
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 900 }}>
      <h1>UCSD Shadow Degree Audit — Demo</h1>
      <p style={{ color: "#666" }}>Enter course IDs or add AP credits, then run the audit.</p>

      {/* Course ID input */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") addCredit(); }}
          placeholder="Type course ID (e.g. CSE11)"
          style={{ padding: "8px 10px", flex: 1 }}
        />
        <button onClick={addCredit} style={{ padding: "8px 12px" }}>Add</button>
        <button onClick={runAudit} style={{ padding: "8px 12px" }} disabled={loading}>
          {loading ? "Running…" : "Run Audit"}
        </button>
        <button onClick={() => setPage("schedule")} style={{ padding: "8px 12px" }}>
          View Schedules
        </button>
      </div>

      {/* AP credit input */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <span style={{ color: "#666", minWidth: 70 }}>AP Credit:</span>
        <select value={apExam} onChange={e => setApExam(e.target.value)} style={{ padding: "8px 10px" }}>
          <option>Calculus AB</option>
          <option>Calculus BC</option>
          <option>Computer Science A</option>
          <option>Physics C Mechanics</option>
          <option>Physics C Electricity and Magnetism</option>
          <option>Chemistry</option>
          <option>Biology</option>
          <option>Statistics</option>
          <option>English Language and Composition</option>
          <option>Microeconomics</option>
          <option>Macroeconomics</option>
          <option>Environmental Science</option>
        </select>

        <select value={apScore} onChange={e => setApScore(e.target.value)} style={{ padding: "8px 10px", width: 80 }}>
          <option>1</option>
          <option>2</option>
          <option>3</option>
          <option>4</option>
          <option>5</option>
        </select>

        <button onClick={addApCredit} style={{ padding: "8px 12px" }}>Add AP</button>
      </div>

      {/* Credits chips */}
      <div style={{ marginBottom: 18 }}>
        {credits.length === 0 ? <em>No credits added</em> : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {credits.map((c, idx) => {
              const label = typeof c === "string" ? c : (c?.label || "UNKNOWN");
              return (
                <div key={`${label}-${idx}`} style={{ border: "1px solid #ddd", padding: "6px 8px", borderRadius: 6 }}>
                  <strong>{label}</strong>
                  <button onClick={() => removeCreditAt(idx)} style={{ marginLeft: 8 }}>x</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <hr />

      <section style={{ marginTop: 16 }}>
        <h2>Audit result</h2>
        {!audit && <div style={{ color: "#666" }}>No audit run yet.</div>}

        {audit?.error && <div style={{ color: "red" }}>{audit.error}</div>}

        {audit && !audit.error && (
          <div style={{ background: "#fafafa", padding: 12, borderRadius: 6, whiteSpace: "pre-wrap" }}>
            <strong>Major:</strong> {audit.majorId || "—"}{"\n"}
            <strong>Expanded course IDs:</strong>{" "}
            {audit.expandedCourseIds?.length ? audit.expandedCourseIds.join(", ") : "—"}{"\n\n"}

            <strong>Satisfied requirements:</strong>{"\n"}
            {audit.satisfied?.length ? audit.satisfied.map(r => `• ${r.requirementId} — ${r.description || "—"} (${(r.matchedCourseIds || []).join(", ") || "—"})`).join("\n") : "None"}{"\n\n"}

            <strong>Remaining requirements:</strong>{"\n"}
            {audit.remaining?.length ? audit.remaining.map(r => `• ${r.requirementId} — ${r.description || "—"}`).join("\n") : "None"}{"\n\n"}

            <strong>Justification log:</strong>{"\n"}
            {audit.justificationLog?.length ? audit.justificationLog.map((l,i) => `• ${l.requirementId}: ${l.matchedBy ?? "—"} (${l.reason})`).join("\n") : "—"}
          </div>
        )}
      </section>

      <footer style={{ marginTop: 32, color: "#888", fontSize: 13 }}>
        This is an unofficial demo. No UCSD credentials are used or requested.
      </footer>
    </div>
  );
}

