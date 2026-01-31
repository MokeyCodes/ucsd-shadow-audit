const express = require('express');
const cors = require('cors');
const catalog = require('./data/catalog.json');
const degree = require('./data/sample_degree.json');
const { runAudit } = require('./auditEngine');

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
  const result = runAudit(credits, degree);
  res.json(result);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running: http://localhost:${PORT}`);
});
