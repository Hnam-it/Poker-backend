const express = require('express');
const { verifyToken, verifyAdmin, verifyAdminOnly } = require('../middleware/authMiddleware');
const tableCleanupService = require('../services/tableCleanupService');
const router = express.Router();

// Test API key endpoint
router.get('/test-api-key', verifyAdminOnly, (req, res) => {
  res.json({
    success: true,
    message: 'Admin API key authentication successful!',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

// Route auto-redirect cho admin (GET /api/admin/auto-redirect)
router.get('/auto-redirect', verifyToken, (req, res) => {
  if (req.user.role === 'admin') {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Admin Redirect</title>
        <script>
          localStorage.setItem('user', JSON.stringify(${JSON.stringify(req.user)}));
          window.location.replace('http://localhost:3000/admin');
        </script>
      </head>
      <body>
        <p>Redirecting to Admin Dashboard...</p>
      </body>
      </html>
    `);
  } else {
    res.redirect('http://localhost:3000/profile');
  }
});

// Route kiểm tra admin status (GET /api/admin/check)
router.get('/check', verifyToken, (req, res) => {
  const isAdmin = req.user.role === 'admin';
  res.json({ 
    isAdmin: isAdmin,
    user: req.user,
    shouldRedirect: isAdmin ? '/admin' : '/profile',
    frontendUrl: isAdmin ? 'http://localhost:3000/admin' : 'http://localhost:3000/profile'
  });
});

// Route chính cho admin (GET /api/admin/) - CHỈ API KEY
router.get('/', verifyAdminOnly, (req, res) => {
  res.json({ 
    success: true,
    role: 'admin',
    authMethod: 'API Key',
    message: 'Admin authenticated via API key only'
  });
});


// Get cleanup service statistics - CHỈ API KEY
router.get('/cleanup-stats', verifyAdminOnly, async (req, res) => {
  try {
    const stats = await tableCleanupService.getCleanupStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get cleanup stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get cleanup statistics'
    });
  }
});

// Manually trigger table cleanup - CHỈ API KEY
router.post('/cleanup-tables', verifyAdminOnly, async (req, res) => {
  try {
    const result = await tableCleanupService.manualCleanup();
    res.json({
      success: true,
      message: 'Manual cleanup completed',
      data: result
    });
  } catch (error) {
    console.error('Manual cleanup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform manual cleanup'
    });
  }
});

// Get cleanup service status - CHỈ API KEY
router.get('/cleanup-status', verifyAdminOnly, (req, res) => {
  try {
    const status = tableCleanupService.getServiceStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Get cleanup status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get cleanup service status'
    });
  }
});

// Get server statistics - CHỈ API KEY
router.get('/server-stats', verifyAdminOnly, async (req, res) => {
  try {
    const User = require('../models/User');
    const Game = require('../models/Game');
    
    // Đếm tổng số user
    const totalUsers = await User.countDocuments();
    
    // Đếm số bàn chơi có status active
    const activeTables = await Game.countDocuments({ 
      status: 'active'
    });
    
    // Lấy tất cả games active và đếm players
    const activeGames = await Game.find({ 
      status: 'active'
    });
    
    let totalPlayersInGame = 0;
    let tablesWithPlayers = 0;
    
    activeGames.forEach(game => {
      if (game.players && game.players.length > 0) {
        totalPlayersInGame += game.players.length;
        tablesWithPlayers++;
      }
    });
    
    // Ước tính người online (giả sử 20% total users online)
    const estimatedOnlineUsers = Math.floor(totalUsers * 0.2);
    
    res.json({
      success: true,
      data: {
        totalUsers,
        estimatedOnlineUsers,
        activeTables,
        tablesWithPlayers, // Số bàn thực sự có người chơi
        totalPlayersInGame,
        serverUptime: process.uptime(),
        timestamp: new Date().toISOString(),
        debug: {
          totalActiveGames: activeGames.length,
          gameDetails: activeGames.map(game => ({
            tableId: game.tableId,
            tableName: game.tableName,
            playersCount: game.players ? game.players.length : 0,
            status: game.status
          }))
        }
      }
    });
  } catch (error) {
    console.error('Get server stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get server statistics'
    });
  }
});

module.exports = router;
