process.env.TZ = 'Asia/Kolkata';

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const apiRoutes = require('./routes/apiRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------- SAFETY (NO CRASH) --------------------
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
});

// -------------------- MIDDLEWARE --------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// -------------------- ROOT --------------------
app.get('/', (req, res) => {
  res.send('🚀 VyapaarIQ running');
});

// -------------------- HEALTH --------------------
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'running'
  });
});

// -------------------- API ROUTES --------------------
app.use('/api', apiRoutes);

// -------------------- START SERVER --------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
