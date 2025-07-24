const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Test endpoint để kiểm tra kết nối từ máy khác
router.get('/test', (req, res) => {
  console.log('🧪 Test request from IP:', req.ip);
  res.json({ 
    message: 'Backend is working!', 
    clientIp: req.ip,
    timestamp: new Date().toISOString()
  });
});

router.post('/register', async (req, res) => {
  try {
    console.log('📝 Register request received:', req.body);
    const { fullName, dob, username, password, role } = req.body;

    // Validation - only username and password are required
    if (!username || !password) {
      console.log('❌ Missing required fields: username and/or password');
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      console.log('❌ Username already exists:', username);
      return res.status(400).json({ message: 'Username already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      fullName,
      dob,
      username,
      password: hashedPassword,
      role: role || 'user',
    });

    await newUser.save();
    console.log('✅ User created successfully:', username, 'with role:', role || 'user');

    res.status(201).json({ message: 'User registered successfully!' });
  } catch (err) {
    console.error('💥 Registration error:', err);
    res.status(500).json({ message: 'Server error during registration' });
  }
});
router.post('/login', async (req, res) => {
  const startTime = Date.now();
  const { username, password } = req.body;
  
  console.log('🔑 Login attempt for username:', username);
  
  try {
    console.log('📊 Finding user in database...');
    const user = await User.findOne({ username });
    
    if (!user) {
      console.log('❌ User not found:', username);
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    console.log('🔐 Comparing password...');
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('❌ Password mismatch for:', username);
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    console.log('🎫 Generating JWT token...');
    const payload = {
      id: user._id,
      username: user.username,
      role: user.role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    console.log('🍪 Setting cookie...');
    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      sameSite: 'Lax', // Lax for better cross-origin support
      maxAge: 3600000, // 1 hour
    });

    const responseTime = Date.now() - startTime;
    console.log(`✅ Login successful for ${username} in ${responseTime}ms`);

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
      success: true,
      redirect: user.role === 'admin' ? 'http://192.168.20.8:3000/admin' : null
    });
  } catch (err) {
    const responseTime = Date.now() - startTime;
    console.error(`💥 Login error after ${responseTime}ms:`, err);
    res.status(500).json({ message: 'Server error during login' });
  }
});
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

module.exports = router;
