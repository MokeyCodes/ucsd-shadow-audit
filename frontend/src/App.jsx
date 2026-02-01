import React, { useState } from "react";

export default function App() {
  const [input, setInput] = useState("");
  // credits can be: string courseId OR { kind: "AP", label: string }
  const [credits, setCredits] = useState([]);
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(false);

  // AP UI state
  const [apExam, setApExam] = useState("Calculus BC");
  const [apScore, setApScore] = useState("5");

  function addCredit() {
    const val = input.trim().toUpperCase();
    if (!val) return;

    // avoid duplicates among string credits
    const exists = credits.some(c => typeof c === "string" && c === val);
    if (!exists) {
      setCredits(prev => [...prev, val]);
    }
    setInput("");
  }

  function addApCredit() {
    const exam = apExam.trim();
    const score = String(apScore).trim();

    if (!exam) return;
    if (!/^[1-5]$/.test(score)) return;

    // This format matches your backend parsing: "AP Calculus BC (5)"
    const label = `AP ${exam} (${score})`;

    // avoid duplicates among AP credits by label
    const exists = credits.some(
      c => typeof c === "object" && c?.kind === "AP" && c?.label === label
    );
    if (exists) return;

    setCredits(prev => [...prev, { kind: "AP", label }]);
  }

  // Remove by index (works for strings and objects)
  function removeCreditAt(index) {
    setCredits(prev => prev.filter((_, i) => i !== index));
  }

  async function runAudit() {
    setLoading(true);
    setAudit(null);
    try {
      const res = await fetch("http://localhost:3001/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits })
      });
      const json = await res.json();
      setAudit(json);
    } catch (err) {
      setAudit({ error: "Failed to contact backend. Is it running on http://localhost:3001 ?" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 900 }}>
      <h1>UCSD Shadow Degree Audit — Demo</h1>
      <p style={{ color: "#666" }}>
        Enter course IDs or add AP credits, then run the audit.
      </p>

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
      </div>

      {/* AP credit input */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <span style={{ color: "#666", minWidth: 70 }}>AP Credit:</span>

        <select
          value={apExam}
          onChange={e => setApExam(e.target.value)}
          style={{ padding: "8px 10px" }}
        >
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

        <select
          value={apScore}
          onChange={e => setApScore(e.target.value)}
          style={{ padding: "8px 10px", width: 80 }}
        >
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
                <div
                  key={`${label}-${idx}`}
                  style={{ border: "1px solid #ddd", padding: "6px 8px", borderRadius: 6 }}
                >
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
        {audit ? (
          audit.error ? (
            <div style={{ color: "red" }}>{audit.error}</div>
          ) : (
            <div style={{ whiteSpace: "pre-wrap", background: "#fafafa", padding: 12, borderRadius: 6 }}>
              <strong>Major:</strong> {audit.majorId || "—"}{"\n"}
              <strong>Expanded course IDs:</strong>{" "}
              {audit.expandedCourseIds && audit.expandedCourseIds.length ? audit.expandedCourseIds.join(", ") : "—"}
              {"\n\n"}

              <strong>Satisfied requirements:</strong>{"\n"}
              {audit.satisfied && audit.satisfied.length > 0
                ? audit.satisfied.map(r => `• ${r.requirementId} — ${r.description || "—"} (${(r.matchedCourseIds || []).join(", ") || "—"})`).join("\n")
                : "None"}
              {"\n\n"}

              <strong>Remaining requirements:</strong>{"\n"}
              {audit.remaining && audit.remaining.length > 0
                ? audit.remaining.map(r => `• ${r.requirementId} — ${r.description || "—"}`).join("\n")
                : "None"}
              {"\n\n"}

              <strong>Justification log:</strong>{"\n"}
              {audit.justificationLog && audit.justificationLog.length > 0
                ? audit.justificationLog.map(l => `• ${l.requirementId}: ${l.matchedBy ?? "—"} (${l.reason})`).join("\n")
                : "—"}
            </div>
          )
        ) : (
          <div style={{ color: "#666" }}>No audit run yet.</div>
        )}
      </section>

      <footer style={{ marginTop: 32, color: "#888", fontSize: 13 }}>
        This is an unofficial demo. No UCSD credentials are used or requested.
      </footer>
    </div>
  );
}
