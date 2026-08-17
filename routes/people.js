const express = require('express');
const router = express.Router();
const { runQuery } = require('../db/connection');

router.get('/ping', (req, res) => res.json({ ok: true }));

router.get('/search', async (req, res) => {
  const { name } = req.query;
  try {
    const records = await runQuery(
      `MATCH (p:Person)
       WHERE toLower(p.name) CONTAINS toLower($name)
       RETURN p LIMIT 10`,
      { name: name || '' }
    );
    res.json(records.map((r) => r.get('p').properties));
  } catch (error) {
    res.status(503).json({ error: 'Database unreachable', details: error.message });
  }
});

router.get('/path/:personId/:companyName', async (req, res) => {
  const { personId, companyName } = req.params;
  try {
    const records = await runQuery(
      `MATCH (start:Person {id: $personId})
       MATCH (target:Person)-[:WORKS_AT]->(c:Company)
       WHERE toLower(c.name) = toLower($companyName)
       MATCH path = shortestPath((start)-[:KNOWS*1..4]-(target))
       RETURN path, target, c
       LIMIT 1`,
      { personId, companyName }
    );
    if (records.length === 0) {
      return res.json({ found: false, message: 'No path found within 4 hops' });
    }
    const record = records[0];
    const path = record.get('path');
    const nodes = path.segments.map((seg) => seg.start.properties.name)
      .concat([path.end.properties.name]);
    res.json({
      found: true,
      hops: path.length,
      chain: nodes,
      targetCompany: record.get('c').properties.name,
    });
  } catch (error) {
    res.status(503).json({ error: 'Database unreachable', details: error.message });
  }
});

router.get('/skills/overlap/:personId', async (req, res) => {
  const { personId } = req.params;
  try {
    const records = await runQuery(
      `MATCH (me:Person {id: $personId})-[:HAS_SKILL]->(s:Skill)<-[:HAS_SKILL]-(other:Person)
       WHERE other.id <> $personId
       WITH other, collect(s.name) AS sharedSkills, count(s) AS overlap
       WHERE overlap >= 2
       RETURN other.name AS name, other.role AS role, sharedSkills, overlap
       ORDER BY overlap DESC
       LIMIT 10`,
      { personId }
    );
    res.json(records.map((r) => ({
      name: r.get('name'),
      role: r.get('role'),
      sharedSkills: r.get('sharedSkills'),
      overlap: r.get('overlap').toNumber(),
    })));
  } catch (error) {
    res.status(503).json({ error: 'Database unreachable', details: error.message });
  }
});

module.exports = router;