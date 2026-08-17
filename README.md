# Alumni Referral & Career Path Network

A graph-database-backed web app that helps students find warm introduction paths to companies through their alumni/peer network, and discover people with overlapping skills — built for the WEXA AI CognoDB take-home assignment.

## Live demo

**[https://alumni-referral-network.onrender.com/](https://alumni-referral-network.onrender.com/)**

> Note: hosted on Render's free tier, so the first load after inactivity may take 30-50 seconds to spin up.

## Demo video

[Watch the walkthrough](demo/demo.mp4)

## The idea

Students and juniors constantly ask: *"I want to work at Company X — who do I know that can get me a foot in the door?"* This app answers that with a **shortest connection path** (like LinkedIn's "How you're connected", but purpose-built for placements/referrals), and separately surfaces people with the **most overlapping skills**, useful for finding study partners, project collaborators, or people to learn from.

## Why a graph database?

The core questions this app answers are fundamentally about **relationships between people**, not rows in isolated tables:

- *"What's the shortest chain of connections between me and someone at Google?"* — In a relational schema this needs a recursive self-join on a `knows` table with unbounded depth, which is slow and awkward to express in SQL. In Cypher, it's a single `shortestPath()` pattern match.
- *"Who shares the most skills with me?"* — Requires joining `Person → HasSkill → Skill` against every other person and aggregating counts. In a relational DB this is a multi-way self-join with grouping; in Cypher it's one graph pattern with an aggregation.
- As the network grows (more people, more `KNOWS` edges), traversal queries in Neo4j/CognoDB stay fast because relationships are stored as physical pointers (index-free adjacency), while the equivalent relational joins get slower as the `knows` table grows.

## Data model

**Nodes:**
- `Person {id, name, email, role, graduationYear}` — role is `"student"` or `"alumni"`
- `Company {id, name, industry}`
- `Skill {id, name}`
- `University {id, name}`

**Relationships:**
- `(Person)-[:STUDIED_AT]->(University)`
- `(Person)-[:WORKS_AT {since: year}]->(Company)`
- `(Person)-[:HAS_SKILL {level: "beginner" | "intermediate" | "expert"}]->(Skill)`
- `(Person)-[:KNOWS {closeness: 1-5}]->(Person)`

(Person)-[:STUDIED_AT]--------->(University)
|
| --[:WORKS_AT {since}]-->(Company)
|
|--[:HAS_SKILL {level}]----->(Skill)
|
|--[:KNOWS {closeness}]----->(Person)

Seed data: 150 people, 15 companies, 20 skills, 7 universities, with realistic `KNOWS`, `WORKS_AT`, `HAS_SKILL`, and `STUDIED_AT` relationships generated via `seed/seed.js`.

## Key queries

**1. Multi-hop shortest path to a company** (2+ hop traversal — core requirement):
```cypher
MATCH (start:Person {id: $personId})
MATCH (target:Person)-[:WORKS_AT]->(c:Company)
WHERE toLower(c.name) = toLower($companyName)
MATCH path = shortestPath((start)-[:KNOWS*1..4]-(target))
RETURN path, target, c
LIMIT 1
```
This is the kind of query a relational database handles poorly — it needs recursive CTEs to walk an unbounded-depth `knows` chain, whereas Cypher expresses it natively with `shortestPath()`.

**2. Skill overlap** (aggregation across a graph pattern — the "relational DB finds awkward" requirement):
```cypher
MATCH (me:Person {id: $personId})-[:HAS_SKILL]->(s:Skill)<-[:HAS_SKILL]-(other:Person)
WHERE other.id <> $personId
RETURN other.name AS name, other.role AS role,
       collect(s.name) AS sharedSkills, count(s) AS overlap
ORDER BY overlap DESC
LIMIT 10
```

**3. Search:**
```cypher
MATCH (p:Person)
WHERE toLower(p.name) CONTAINS toLower($name)
RETURN p LIMIT 10
```

All queries are parameterized via the official `neo4j-driver` — no string-concatenated Cypher anywhere in the codebase.

## Application & UX

A functional web app (Express backend + plain HTML/JS frontend, served together — no build step needed) lets a non-technical user:

1. **Search** for a person by name
2. Select a person and **find the shortest referral path** to any company
3. See **who shares the most skills** with the selected person

The UI includes loading, empty, and error states throughout (e.g. "No connection path found", "Couldn't reach the server" if the backend/DB is down).

## Project structure

alumni-network/
├── db/
│ └── connection.js # CognoDB (Neo4j driver) connection + query helper
├── routes/
│ └── people.js # /search, /path, /skills/overlap, /ping endpoints
├── seed/
│ └── seed.js # Generates and loads 150 people + relationships
├── public/
│ └── index.html # Frontend (vanilla HTML/CSS/JS)
├── demo/
│ └── demo.mp4 # Screen recording walkthrough
├── .env # COGNODB_URI, COGNODB_USER, COGNODB_PASSWORD (not committed)
├── .gitignore
├── server.js # Express entry point
├── test-connection.js # Standalone DB connectivity check
└── package.json

## Setup & run instructions

### 1. Create a CognoDB instance
1. Go to [console.cognodb.com/signup](https://console.cognodb.com/signup) and sign up (no credit card required)
2. Click **"Create Instance"**, choose the free tier (**c0**), pick any region
3. Save the connection URI (`bolt+s://<instance-id>.databases.cognodb.cloud`), username (`cognodb`), and password shown once at creation

### 2. Configure environment variables
Create a `.env` file in the project root:

COGNODB_URI=bolt+s://<your-instance-id>.databases.cognodb.cloud
COGNODB_USER=cognodb
COGNODB_PASSWORD=<your-password>
PORT=5000

### 3. Install dependencies
```bash
npm install
```

### 4. Seed the database
```bash
node seed/seed.js
```

### 5. Start the server
```bash
node server.js
```
You should see `Server running on port 5000` and `Connected to CognoDB`.

### 6. Open the app
Visit **http://localhost:5000** in your browser.

## API endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | DB connectivity check |
| GET | `/api/people/ping` | Basic liveness check |
| GET | `/api/people/search?name=<query>` | Search people by name |
| GET | `/api/people/path/:personId/:companyName` | Shortest referral path to a company |
| GET | `/api/people/skills/overlap/:personId` | People with the most shared skills |

## Error handling

If the database is unreachable, API routes return `503` with a descriptive error rather than crashing, and the frontend surfaces this as an inline error state instead of a blank screen.

## Screenshots

_(Add screenshots here: search results, path result, skill overlap result)_

