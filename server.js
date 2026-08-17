require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { verifyConnection, closeDriver } = require('./db/connection');
const peopleRoutes = require('./routes/people');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use('/api/people', peopleRoutes);

app.get('/api/health', async (req, res) => {
  const connected = await verifyConnection();
  res.json({ status: connected ? 'ok' : 'db_unreachable' });
});

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await verifyConnection();
});

process.on('SIGINT', async () => {
  await closeDriver();
  process.exit(0);
});