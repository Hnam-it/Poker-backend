const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const jwt = require('jsonwebtoken');


const router = express.Router();
router.post('/register', async (req, res) => {
  try {
    const { fullName, dob, username, password,role } = req.body;

    // Check nếu user đã tồn tại
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Lưu vào DB
    const newUser = new User({
      fullName,
      dob,
      username,
      password: hashedPassword,
      role: role || 'user', // Default role for new users
    });

    await newUser.save(); // Save user to the database

    res.json({ message: 'User registered successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during registration' });
  }
});
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    // Tạo JWT token
    const payload = {
      id: user._id,
      username: user.username,
      role: user.role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Set cookie (SAU khi đã có token)
    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // đặt true nếu dùng HTTPS
      sameSite: 'Lax',
      maxAge: 3600000, // 1h
    });

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        dob: user.dob,
        role: user.role,
      },
      message: 'Login successful',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during login' });
  }
});


module.exports = router;
