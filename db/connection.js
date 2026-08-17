require('dotenv').config();
const neo4j = require('neo4j-driver');

let driver;

function getDriver() {
  if (!driver) {
    driver = neo4j.driver(
      process.env.COGNODB_URI,
      neo4j.auth.basic(process.env.COGNODB_USER, process.env.COGNODB_PASSWORD),
      { maxConnectionLifetime: 3 * 60 * 60 * 1000 }
    );
  }
  return driver;
}

async function verifyConnection() {
  const d = getDriver();
  try {
    await d.verifyConnectivity();
    console.log('Connected to CognoDB');
    return true;
  } catch (error) {
    console.error('Could not connect to CognoDB:', error.message);
    return false;
  }
}

async function runQuery(cypher, params = {}) {
  const session = getDriver().session();
  try {
    const result = await session.run(cypher, params);
    return result.records;
  } finally {
    await session.close();
  }
}

async function closeDriver() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

module.exports = { getDriver, verifyConnection, runQuery, closeDriver };