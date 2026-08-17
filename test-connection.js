require('dotenv').config();
const neo4j = require('neo4j-driver');

const driver = neo4j.driver(
  process.env.COGNODB_URI,
  neo4j.auth.basic(process.env.COGNODB_USER, process.env.COGNODB_PASSWORD)
);

async function testConnection() {
  const session = driver.session();
  try {
    const result = await session.run('RETURN 1 AS number');
    console.log('✅ Connection successful!');
    console.log('Result:', result.records[0].get('number').toNumber());
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  } finally {
    await session.close();
    await driver.close();
  }
}

testConnection();