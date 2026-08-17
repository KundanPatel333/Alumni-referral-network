require('dotenv').config();
const { faker } = require('@faker-js/faker');
const { getDriver, closeDriver } = require('../db/connection');

// ---- Fixed reference data ----
const COMPANIES = [
  { name: 'Google', industry: 'Tech' },
  { name: 'Microsoft', industry: 'Tech' },
  { name: 'Amazon', industry: 'Tech' },
  { name: 'Flipkart', industry: 'E-commerce' },
  { name: 'Zomato', industry: 'Food Tech' },
  { name: 'TCS', industry: 'IT Services' },
  { name: 'Infosys', industry: 'IT Services' },
  { name: 'Razorpay', industry: 'Fintech' },
  { name: 'Swiggy', industry: 'Food Tech' },
  { name: 'Paytm', industry: 'Fintech' },
  { name: 'Adobe', industry: 'Software' },
  { name: 'Atlassian', industry: 'Software' },
  { name: 'Wexa AI', industry: 'AI/ML' },
  { name: 'Freshworks', industry: 'SaaS' },
  { name: 'CRED', industry: 'Fintech' },
];

const SKILLS = [
  'JavaScript', 'Python', 'React', 'Node.js', 'Java', 'C++', 'Machine Learning',
  'Data Structures', 'System Design', 'SQL', 'Cypher', 'AWS', 'Docker',
  'Kubernetes', 'TensorFlow', 'Figma', 'UI/UX Design', 'MongoDB', 'GraphQL', 'Go',
];

const UNIVERSITIES = [
  'RKGIT Ghaziabad', 'IIT Delhi', 'IIT Bombay', 'NIT Trichy',
  'DTU Delhi', 'BITS Pilani', 'VIT Vellore',
];

const NUM_PEOPLE = 150;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr, count) {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

async function clearDatabase(session) {
  console.log('Clearing existing data...');
  await session.run('MATCH (n) DETACH DELETE n');
}

async function createConstraints(session) {
  console.log('Creating constraints...');
  await session.run('CREATE CONSTRAINT person_id IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE');
  await session.run('CREATE CONSTRAINT company_id IF NOT EXISTS FOR (c:Company) REQUIRE c.id IS UNIQUE');
  await session.run('CREATE CONSTRAINT skill_id IF NOT EXISTS FOR (s:Skill) REQUIRE s.id IS UNIQUE');
  await session.run('CREATE CONSTRAINT university_id IF NOT EXISTS FOR (u:University) REQUIRE u.id IS UNIQUE');
}

async function seedCompanies(session) {
  console.log('Seeding companies...');
  const companies = COMPANIES.map((c, i) => ({ id: `company-${i}`, ...c }));
  await session.run(
    `UNWIND $companies AS c
     CREATE (:Company {id: c.id, name: c.name, industry: c.industry})`,
    { companies }
  );
  return companies;
}

async function seedSkills(session) {
  console.log('Seeding skills...');
  const skills = SKILLS.map((name, i) => ({ id: `skill-${i}`, name }));
  await session.run(
    `UNWIND $skills AS s
     CREATE (:Skill {id: s.id, name: s.name})`,
    { skills }
  );
  return skills;
}

async function seedUniversities(session) {
  console.log('Seeding universities...');
  const universities = UNIVERSITIES.map((name, i) => ({ id: `university-${i}`, name }));
  await session.run(
    `UNWIND $universities AS u
     CREATE (:University {id: u.id, name: u.name})`,
    { universities }
  );
  return universities;
}

async function seedPeople(session, companies, skills, universities) {
  console.log(`Seeding ${NUM_PEOPLE} people...`);
  const people = [];

  for (let i = 0; i < NUM_PEOPLE; i++) {
    const isAlumni = Math.random() > 0.4;
    people.push({
      id: `person-${i}`,
      name: faker.person.fullName(),
      email: faker.internet.email(),
      role: isAlumni ? 'alumni' : 'student',
      graduationYear: isAlumni ? randomInt(2015, 2025) : randomInt(2026, 2028),
    });
  }

  await session.run(
    `UNWIND $people AS p
     CREATE (:Person {id: p.id, name: p.name, email: p.email, role: p.role, graduationYear: p.graduationYear})`,
    { people }
  );

  const studiedAtRels = people.map((p) => ({
    personId: p.id,
    universityId: pickRandom(universities, 1)[0].id,
  }));
  await session.run(
    `UNWIND $rels AS r
     MATCH (p:Person {id: r.personId}), (u:University {id: r.universityId})
     CREATE (p)-[:STUDIED_AT]->(u)`,
    { rels: studiedAtRels }
  );

  const worksAtRels = people
    .filter((p) => p.role === 'alumni')
    .map((p) => ({
      personId: p.id,
      companyId: pickRandom(companies, 1)[0].id,
      since: randomInt(p.graduationYear, 2026),
    }));
  await session.run(
    `UNWIND $rels AS r
     MATCH (p:Person {id: r.personId}), (c:Company {id: r.companyId})
     CREATE (p)-[:WORKS_AT {since: r.since}]->(c)`,
    { rels: worksAtRels }
  );

  const hasSkillRels = [];
  const levels = ['beginner', 'intermediate', 'expert'];
  people.forEach((p) => {
    const personSkills = pickRandom(skills, randomInt(3, 6));
    personSkills.forEach((s) => {
      hasSkillRels.push({
        personId: p.id,
        skillId: s.id,
        level: levels[randomInt(0, 2)],
      });
    });
  });
  await session.run(
    `UNWIND $rels AS r
     MATCH (p:Person {id: r.personId}), (s:Skill {id: r.skillId})
     CREATE (p)-[:HAS_SKILL {level: r.level}]->(s)`,
    { rels: hasSkillRels }
  );

  const knowsRels = [];
  people.forEach((p) => {
    const connections = pickRandom(
      people.filter((other) => other.id !== p.id),
      randomInt(2, 5)
    );
    connections.forEach((other) => {
      knowsRels.push({
        personId: p.id,
        otherId: other.id,
        closeness: randomInt(1, 5),
      });
    });
  });
  await session.run(
    `UNWIND $rels AS r
     MATCH (p:Person {id: r.personId}), (o:Person {id: r.otherId})
     MERGE (p)-[k:KNOWS]-(o)
     ON CREATE SET k.closeness = r.closeness`,
    { rels: knowsRels }
  );

  return people;
}

async function main() {
  const driver = getDriver();
  const session = driver.session();

  try {
    await clearDatabase(session);
    await createConstraints(session);
    const companies = await seedCompanies(session);
    const skills = await seedSkills(session);
    const universities = await seedUniversities(session);
    await seedPeople(session, companies, skills, universities);

    console.log('✅ Seeding complete!');
    console.log(`   ${companies.length} companies, ${skills.length} skills, ${universities.length} universities, ${NUM_PEOPLE} people`);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
  } finally {
    await session.close();
    await closeDriver();
  }
}

main();