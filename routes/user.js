const express = require('express');
const { verifyToken, verifyAdmin, authMiddleware } = require('../middleware/authMiddleware');
const userController = require('../controllers/userController');

const router = express.Router();

router.get('/profile', authMiddleware, (req, res) => {
  res.json({ message: `Hello ${req.user.username}, your role is ${req.user.role}` });
});

router.get('/admin', verifyToken, verifyAdmin, userController.getAdminInfo);

module.exports = router;  // Đảm bảo export đúng router
