import React, { useState } from "react";
import ScheduleViewer from "./ScheduleViewer";
import "./App.css";

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
      <div className="page">
  <button className="btn" onClick={() => setPage("audit")} style={{ marginBottom: 16 }}>
    ← Back to Degree Audit
  </button>
  <ScheduleViewer />
</div>

    );
  }

  // ---------- Audit Page ----------
  return (
    <div className="page">
  <div className="header">
    <div>
      <h1 className="title">UCSD Shadow Degree Audit</h1>
      <p className="subtitle">Enter course IDs or add AP credits, then run the audit.</p>
    </div>
    <span className="pill">Unofficial demo • deterministic rules</span>
  </div>


      <section className="section">
  <h2>Enter Credits</h2>
  <div className="card">
    <div className="row" style={{ marginBottom: 10 }}>
      <input
        className="input"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") addCredit(); }}
        placeholder="Type course ID (e.g. CSE11)"
      />

      <button className="btn" onClick={addCredit}>Add</button>

      <button className="btn btnPrimary" onClick={runAudit} disabled={loading}>
        {loading ? "Running…" : "Run Audit"}
      </button>

      <button className="btn btnGhost" onClick={() => setPage("schedule")}>
        View Schedules →
      </button>
    </div>

    <div className="row">
      <span className="muted" style={{ minWidth: 70 }}>AP Credit</span>

      <select className="select" value={apExam} onChange={e => setApExam(e.target.value)}>
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

      <select className="select" value={apScore} onChange={e => setApScore(e.target.value)} style={{ width: 90 }}>
        <option>1</option><option>2</option><option>3</option><option>4</option><option>5</option>
      </select>

      <button className="btn" onClick={addApCredit}>Add AP</button>
    </div>

    <div style={{ marginTop: 12 }}>
      {credits.length === 0 ? (
        <em className="muted">No credits added</em>
      ) : (
        <div className="chips">
          {credits.map((c, idx) => {
            const label = typeof c === "string" ? c : (c?.label || "UNKNOWN");
            return (
              <div key={`${label}-${idx}`} className="chip">
                <strong>{label}</strong>
                <button onClick={() => removeCreditAt(idx)} aria-label={`Remove ${label}`}>
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>
</section>

      <hr className="divider" />

<section className="section">
  <h2>Audit Results</h2>

  {!audit && <div className="muted">No audit run yet.</div>}

  {audit?.error && (
    <div className="badgeBad">
      <span>❌</span>
      <span>{audit.error}</span>
    </div>
  )}

  {audit && !audit.error && (
    <div className="grid2">
      <div className="card">
        <div className="badgeOk" style={{ marginBottom: 10 }}>
          <span>✅</span>
          <span>Summary</span>
        </div>

        <div className="kv">
          <div>Major</div>
          <div><strong>{audit.majorId || "—"}</strong></div>

          <div>Expanded course IDs</div>
          <div>{audit.expandedCourseIds?.length ? audit.expandedCourseIds.join(", ") : "—"}</div>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <div className="badgeOk">
            <span>✔</span>
            <span>Satisfied</span>
          </div>
          <div className="badgeBad">
            <span>✖</span>
            <span>Remaining</span>
          </div>
        </div>

        <div className="grid2">
          <div>
            {audit.satisfied?.length ? (
              <ul className="list">
                {audit.satisfied.map(r => (
                  <li key={r.requirementId}>
                    <strong>{r.requirementId}</strong> — {r.description || "—"}
                    {r.matchedCourseIds?.length ? (
                      <span className="muted"> ({r.matchedCourseIds.join(", ")})</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="muted">None</div>
            )}
          </div>

          <div>
            {audit.remaining?.length ? (
              <ul className="list">
                {audit.remaining.map(r => (
                  <li key={r.requirementId}>
                    <strong>{r.requirementId}</strong> — {r.description || "—"}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="muted">None</div>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <h3 style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>Justification Log</h3>
        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          {audit.justificationLog?.length ? (
            audit.justificationLog.map((l, i) => (
              <div className="logItem" key={`${l.requirementId}-${i}`}>
                <div style={{ fontSize: 14 }}>
                  <strong>{l.requirementId}</strong>{" "}
                  <span className="muted">matched by</span>{" "}
                  <strong>{l.matchedBy ?? "—"}</strong>
                </div>
                <div className="muted" style={{ marginTop: 4, lineHeight: 1.35 }}>
                  {l.reason}
                </div>
              </div>
            ))
          ) : (
            <div className="muted">—</div>
          )}
        </div>
      </div>
    </div>
  )}
</section>


      <footer className="footer">
        This is an unofficial demo. No UCSD credentials are used or requested.
      </footer>
    </div>
  );
}

