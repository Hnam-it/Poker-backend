// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Admin API Key authentication - chỉ dành cho admin
const verifyAdminApiKey = (req, res, next) => {
  const apiKey = req.headers['x-admin-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ message: 'Admin API key required' });
  }

  // Check against environment variable or hardcoded admin API key
  const validAdminApiKey = process.env.ADMIN_API_KEY || 'admin-poker-key-2025';
  
  if (apiKey !== validAdminApiKey) {
    return res.status(401).json({ message: 'Invalid admin API key' });
  }

  // Set admin user object for API key authentication
  req.user = {
    id: 'admin-api',
    username: 'admin-api',
    role: 'admin',
    isApiAuth: true
  };
  
  next();
};

const verifyAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
};

// Admin-only middleware: chỉ cho phép API key authentication
const verifyAdminOnly = (req, res, next) => {
  const apiKey = req.headers['x-admin-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ 
      message: 'Admin access denied. API key authentication required.',
      hint: 'Use x-admin-api-key header'
    });
  }

  const validAdminApiKey = process.env.ADMIN_API_KEY || 'admin-poker-key-2025';
  
  if (apiKey !== validAdminApiKey) {
    return res.status(401).json({ message: 'Invalid admin API key' });
  }

  req.user = {
    id: 'admin-api',
    username: 'admin-api', 
    role: 'admin',
    isApiAuth: true
  };
  
  next();
};

const authMiddleware = verifyToken;

module.exports = { verifyToken, verifyAdmin, verifyAdminApiKey, verifyAdminOnly, authMiddleware };
