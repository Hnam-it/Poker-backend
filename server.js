require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin'); // optional

const { authMiddleware, adminOnly } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3001;

connectDB();

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
//app.use('/api/admin', adminRoutes);

// Optional profile and admin test routes
app.get('/api/profile', authMiddleware, (req, res) => {
  res.json({ message: `Hello ${req.user.username}, your role is ${req.user.role}` });
});

app.get('/api/admin-test', authMiddleware, adminOnly, (req, res) => {
  res.json({ message: 'Welcome admin!' });
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});
