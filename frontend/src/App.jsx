import React, { useState } from "react";

export default function App() {
  const [input, setInput] = useState("");
  const [credits, setCredits] = useState([]);
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(false);

  function addCredit() {
    const val = input.trim().toUpperCase();
    if (val && !credits.includes(val)) {
      setCredits(prev => [...prev, val]);
      setInput("");
    }
  }

  function removeCredit(c) {
    setCredits(prev => prev.filter(x => x !== c));
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
        Enter course IDs or equivalency tags (e.g. <code>CSE11</code>, <code>MATH20A</code>) and press Enter or Add.
      </p>

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

      <div style={{ marginBottom: 18 }}>
        {credits.length === 0 ? <em>No credits added</em> : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {credits.map(c => (
              <div key={c} style={{ border: "1px solid #ddd", padding: "6px 8px", borderRadius: 6 }}>
                <strong>{c}</strong>
                <button onClick={() => removeCredit(c)} style={{ marginLeft: 8 }}>x</button>
              </div>
            ))}
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
              <strong>Major:</strong> {audit.majorId || "—"}{"\n\n"}
              <strong>Satisfied requirements:</strong>{"\n"}
              {audit.satisfied && audit.satisfied.length > 0 ? audit.satisfied.map(r => `• ${r.id} — ${r.description || r.courseId}`).join("\n") : "None"}
              {"\n\n"}
              <strong>Remaining requirements:</strong>{"\n"}
              {audit.remaining && audit.remaining.length > 0 ? audit.remaining.map(r => `• ${r.id} — ${r.description || r.courseId}`).join("\n") : "None"}
              {"\n\n"}
              <strong>Justification log:</strong>{"\n"}
              {audit.justificationLog && audit.justificationLog.length > 0 ? audit.justificationLog.map(l => `• ${l.requirementId}: ${l.matchedBy ?? "—"} (${l.reason})`).join("\n") : "—"}
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
