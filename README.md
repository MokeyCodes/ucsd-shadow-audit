# UCSD Shadow Degree Audit (Hackathon MVP)

⚠️ **Unofficial tool** — This project is NOT affiliated with UCSD and does NOT access any authenticated UCSD systems.

---

## What is this?

A hackathon web app for UCSD students that:

* Converts **manually entered AP / transfer / college credits** into a **shadow degree audit**
* Generates **valid, conflict-free course schedules**
* Scores schedules for **workload, timing, and “vibe fit”**
* Uses **only public data** and **deterministic, explainable logic**

This is a *planning and exploration tool*, not an authoritative degree audit.

---

## Hard constraints (never violated)

* ❌ No WebReg, TritonLink, Degree Audit, or authenticated UCSD systems
* ❌ No UCSD login or credentials
* ❌ No auto-enrollment or schedule modification
* ✅ Manual user input only
* ✅ Public data only (course catalog, AP equivalencies, CAPEs, RateMyProfessor)
* ✅ Deterministic, rule-based core logic (no AI deciding requirements)

---

## Tech stack

* **Frontend:** React + Vite (JavaScript)
* **Backend:** Node.js + Express
* **Data:** JSON snapshots (course catalog, degree rules, AP equivalencies)
* **Storage:** In-memory / local only (no database for MVP)

---

<!--
```text
ucsd-shadow-audit/
├─ backend/        # Express API + audit logic
├─ frontend/       # React UI
├─ specs/          # Degree model & design notes
├─ .github/        # CI / workflows
└─ README.md
```
-->

---

## Quick start (for teammates)

### 1. Clone

```bash
git clone <repo-url>
cd ucsd-shadow-audit
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run the app

```bash
npm run dev
```

* Backend: [http://localhost:3001](http://localhost:3001)
* Frontend: [http://localhost:5173](http://localhost:5173)

---

## Current MVP features

* Manual credit entry (course IDs for now)
* Deterministic shadow audit against a sample degree
* Clear explanation of which requirements are satisfied vs remaining
* Simple frontend demo UI
* Public-data-only backend API

---

## Planned features (hackathon scope)

* AP & transfer credit equivalency mapping
* Course pool / elective requirements
* Schedule generator (conflict-free, prerequisite-aware)
* Schedule scoring (workload, timing, professor difficulty)
* “Vibe fit” tagging using explainable heuristics

---

## Important disclaimers

* This tool is **not official** and **not guaranteed accurate**
* Degree requirements change — always verify with UCSD official tools
* Ambiguous credits require **manual user confirmation**

---

## Team workflow (suggested)

* `main` branch = stable demo
* Feature branches for audit logic, scheduling, UI polish
* Small, fast commits (hackathon style)

---

## License

MIT License
