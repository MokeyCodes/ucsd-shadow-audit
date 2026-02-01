const express = require('express');
const cors = require('cors');
const catalog = require('./data/catalog.json');
const degree = require('./data/sample_degree.json');
const { runAuditWithExpansion } = require("./runAuditWithExpansion");
const { generateSchedules } = require('./scheduleGenerator'); // Issue #3
const { scoreSchedule } = require("./scheduleScorer");


const app = express();
app.use(cors());
app.use(express.json());

app.get('/data/catalog', (_req, res) => {
  res.json(catalog);
});

app.get('/data/degree', (_req, res) => {
  res.json(degree);
});

// Accept manual credits array and return deterministic audit
app.post('/api/audit', (req, res) => {
  const credits = req.body.credits || [];
  const result = runAuditWithExpansion(credits, degree);
  res.json(result);
});

app.post('/api/generate-schedules', (req, res) => {
  const termId = req.body.termId || 'SP26';
  const coursesToTake = req.body.coursesToTake || [];
  const constraints = req.body.constraints || { maxUnits: 16 };

  const schedules = generateSchedules({ termId, coursesToTake, constraints, catalog });

  res.json({ schedules });
});

app.post("/api/score-schedule", (req, res) => {
  try {
    const { schedule } = req.body || {};
    if (!schedule) {
      return res.status(400).json({ error: "Missing 'schedule' in request body" });
    }
    const result = scoreSchedule(schedule);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: "Failed to score schedule" });
  }
});



const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running: http://localhost:${PORT}`);
});
