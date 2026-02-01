# Degree Data Schema (MVP)

Degree data is stored at:

- `backend/src/data/sample_degree.json`

Course catalog data is stored at:

- `backend/src/data/catalog.json`

This document describes the JSON shapes used by the MVP audit engine.

---

## Degree file: `backend/src/data/sample_degree.json`

### Top-level

```json
{
  "majorId": "string",
  "name": "string",
  "requirements": [ /* Requirement[] */ ]
}
