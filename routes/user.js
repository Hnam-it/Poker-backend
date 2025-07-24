const express = require('express');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/profile', verifyToken, (req, res) => {
  res.json({ message: `Hello ${req.user.username}, your role is ${req.user.role}` });
});

router.get('/admin', verifyToken, verifyAdmin, (req, res) => {
  res.json({ message: 'This is admin data only for admins!' });
});

module.exports = router;
