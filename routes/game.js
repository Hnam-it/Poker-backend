const express = require('express');
const router = express.Router();
const Game = require('../models/Game');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/authMiddleware');

// Get all lobby games (public games waiting for players)
router.get('/lobby', async (req, res) => {
  try {
    const { 
      gameType = '', 
      minBuyIn = 0, 
      maxBuyIn = 999999, 
      maxPlayers = 9,
      page = 1,
      limit = 20 
    } = req.query;

    const filter = {
      isPrivate: false,
      gameState: 'waiting',
      'buyIn.min': { $gte: parseInt(minBuyIn) },
      'buyIn.max': { $lte: parseInt(maxBuyIn) },
      maxPlayers: { $lte: parseInt(maxPlayers) }
    };

    if (gameType) {
      filter.gameType = gameType;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const games = await Game.find(filter)
      .populate('createdBy', 'username')
      .populate('currentPlayers.userId', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalGames = await Game.countDocuments(filter);

    const lobbyData = games.map(game => ({
      tableId: game.tableId,
      tableName: game.tableName,
      gameType: game.gameType,
      currentPlayersCount: game.currentPlayers.length,
      maxPlayers: game.maxPlayers,
      blinds: game.blinds,
      buyIn: game.buyIn,
      createdBy: game.createdBy.username,
      createdAt: game.createdAt
    }));

    res.json({
      success: true,
      data: {
        games: lobbyData,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalGames / parseInt(limit)),
          totalGames,
          hasNext: skip + parseInt(limit) < totalGames,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching lobby games:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách bàn chơi',
      error: error.message
    });
  }
});

// Get table details by ID
router.get('/table/:tableId', async (req, res) => {
  try {
    const { tableId } = req.params;
    
    const game = await Game.findOne({ tableId })
      .populate('createdBy', 'username fullName')
      .populate('currentPlayers.userId', 'username fullName');

    if (!game) {
      return res.status(404).json({ message: 'Table not found' });
    }

    res.json({
      tableId: game.tableId,
      tableName: game.tableName,
      gameType: game.gameType,
      maxPlayers: game.maxPlayers,
      currentPlayers: game.currentPlayers,
      blinds: game.blinds,
      buyIn: game.buyIn,
      isPrivate: game.isPrivate,
      gameState: game.gameState,
      createdBy: game.createdBy,
      communityCards: game.communityCards,
      pot: game.pot,
      currentPlayerTurn: game.currentPlayerTurn,
      createdAt: game.createdAt
    });

  } catch (error) {
    console.error('Error fetching table details:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new table/game
router.post('/create-table', authMiddleware, async (req, res) => {
  try {
    const {
      tableName,
      gameType = 'texas-holdem',
      maxPlayers = 6,
      smallBlind,
      bigBlind,
      minBuyIn,
      maxBuyIn,
      isPrivate = false,
      password = null
    } = req.body;

    // Validate required fields
    if (!tableName || !smallBlind || !bigBlind || !minBuyIn || !maxBuyIn) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ thông tin bàn chơi'
      });
    }

    // Generate unique table ID
    const tableId = `table_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const newGame = new Game({
      tableId,
      tableName,
      gameType,
      maxPlayers,
      blinds: {
        smallBlind: parseInt(smallBlind),
        bigBlind: parseInt(bigBlind)
      },
      buyIn: {
        min: parseInt(minBuyIn),
        max: parseInt(maxBuyIn)
      },
      isPrivate,
      password: isPrivate ? password : null,
      createdBy: req.user.id
    });

    await newGame.save();

    res.status(201).json({
      success: true,
      message: 'Tạo bàn chơi thành công',
      data: {
        tableId: newGame.tableId,
        tableName: newGame.tableName,
        gameType: newGame.gameType,
        maxPlayers: newGame.maxPlayers,
        blinds: newGame.blinds,
        buyIn: newGame.buyIn,
        isPrivate: newGame.isPrivate
      }
    });

  } catch (error) {
    console.error('Error creating table:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo bàn chơi',
      error: error.message
    });
  }
});

// Join table
router.post('/join-table/:tableId', authMiddleware, async (req, res) => {
  try {
    const { tableId } = req.params;
    const { buyInAmount, password } = req.body;

    const game = await Game.findOne({ tableId });

    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bàn chơi'
      });
    }

    // Check if table is full
    if (game.currentPlayers.length >= game.maxPlayers) {
      return res.status(400).json({
        success: false,
        message: 'Bàn chơi đã đầy'
      });
    }

    // Check if user is already in the game
    const isAlreadyInGame = game.currentPlayers.some(
      player => player.userId.toString() === req.user.id
    );

    if (isAlreadyInGame) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã ở trong bàn chơi này'
      });
    }

    // Check private table password
    if (game.isPrivate && game.password !== password) {
      return res.status(401).json({
        success: false,
        message: 'Mật khẩu không đúng'
      });
    }

    // Validate buy-in amount
    if (buyInAmount < game.buyIn.min || buyInAmount > game.buyIn.max) {
      return res.status(400).json({
        success: false,
        message: `Số tiền vào bàn phải từ ${game.buyIn.min} đến ${game.buyIn.max}`
      });
    }

    // Check user balance
    const user = await User.findById(req.user.id);
    if (user.balance < buyInAmount) {
      return res.status(400).json({
        success: false,
        message: 'Số dư không đủ'
      });
    }

    // Add player to game
    const newPosition = game.currentPlayers.length;
    game.currentPlayers.push({
      userId: req.user.id,
      username: req.user.username,
      chips: buyInAmount,
      position: newPosition,
      isActive: true
    });

    // Deduct buy-in from user balance
    user.balance -= buyInAmount;
    await user.save();

    game.lastActivity = new Date();
    await game.save();

    res.json({
      success: true,
      message: 'Tham gia bàn chơi thành công',
      data: {
        tableId: game.tableId,
        position: newPosition,
        chips: buyInAmount
      }
    });

  } catch (error) {
    console.error('Error joining table:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tham gia bàn chơi',
      error: error.message
    });
  }
});

// Leave table
router.post('/leave-table/:tableId', authMiddleware, async (req, res) => {
  try {
    const { tableId } = req.params;

    const game = await Game.findOne({ tableId });

    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bàn chơi'
      });
    }

    // Find player in game
    const playerIndex = game.currentPlayers.findIndex(
      player => player.userId.toString() === req.user.id
    );

    if (playerIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'Bạn không ở trong bàn chơi này'
      });
    }

    const playerChips = game.currentPlayers[playerIndex].chips;

    // Return chips to user balance
    const user = await User.findById(req.user.id);
    user.balance += playerChips;
    await user.save();

    // Remove player from game
    game.currentPlayers.splice(playerIndex, 1);

    // Update positions
    game.currentPlayers.forEach((player, index) => {
      player.position = index;
    });

    game.lastActivity = new Date();
    await game.save();

    res.json({
      success: true,
      message: 'Rời bàn chơi thành công',
      data: {
        returnedChips: playerChips
      }
    });

  } catch (error) {
    console.error('Error leaving table:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi rời bàn chơi',
      error: error.message
    });
  }
});

// Get user's active games
router.get('/my-games', authMiddleware, async (req, res) => {
  try {
    const games = await Game.find({
      'currentPlayers.userId': req.user.id,
      gameState: { $ne: 'finished' }
    })
    .populate('createdBy', 'username')
    .sort({ lastActivity: -1 });

    const myGames = games.map(game => {
      const myPlayer = game.currentPlayers.find(
        player => player.userId.toString() === req.user.id
      );

      return {
        tableId: game.tableId,
        tableName: game.tableName,
        gameType: game.gameType,
        gameState: game.gameState,
        myChips: myPlayer.chips,
        myPosition: myPlayer.position,
        currentPlayersCount: game.currentPlayers.length,
        maxPlayers: game.maxPlayers,
        pot: game.pot,
        lastActivity: game.lastActivity
      };
    });

    res.json({
      success: true,
      data: myGames
    });

  } catch (error) {
    console.error('Error fetching user games:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách game của bạn',
      error: error.message
    });
  }
});

// Get lobby statistics
router.get('/lobby/stats', async (req, res) => {
  try {
    const totalGames = await Game.countDocuments({ gameState: { $ne: 'finished' } });
    const waitingGames = await Game.countDocuments({ gameState: 'waiting' });
    const activeGames = await Game.countDocuments({ 
      gameState: { $in: ['pre-flop', 'flop', 'turn', 'river', 'showdown'] } 
    });
    
    const totalPlayers = await Game.aggregate([
      { $match: { gameState: { $ne: 'finished' } } },
      { $group: { _id: null, totalPlayers: { $sum: { $size: '$currentPlayers' } } } }
    ]);

    const gameTypeStats = await Game.aggregate([
      { $match: { gameState: { $ne: 'finished' } } },
      { $group: { _id: '$gameType', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        totalGames,
        waitingGames,
        activeGames,
        totalPlayers: totalPlayers[0]?.totalPlayers || 0,
        gameTypeStats: gameTypeStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {})
      }
    });

  } catch (error) {
    console.error('Error fetching lobby stats:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thống kê lobby',
      error: error.message
    });
  }
});

// Search tables by name or creator
router.get('/search', async (req, res) => {
  try {
    const { query, page = 1, limit = 10 } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập từ khóa tìm kiếm'
      });
    }

    const searchFilter = {
      $or: [
        { tableName: { $regex: query, $options: 'i' } },
        { tableId: { $regex: query, $options: 'i' } }
      ],
      gameState: { $ne: 'finished' }
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const games = await Game.find(searchFilter)
      .populate('createdBy', 'username')
      .populate('currentPlayers.userId', 'username')
      .sort({ lastActivity: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalGames = await Game.countDocuments(searchFilter);

    const searchResults = games.map(game => ({
      tableId: game.tableId,
      tableName: game.tableName,
      gameType: game.gameType,
      gameState: game.gameState,
      currentPlayersCount: game.currentPlayers.length,
      maxPlayers: game.maxPlayers,
      blinds: game.blinds,
      buyIn: game.buyIn,
      isPrivate: game.isPrivate,
      createdBy: game.createdBy.username,
      lastActivity: game.lastActivity
    }));

    res.json({
      success: true,
      data: {
        games: searchResults,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalGames / parseInt(limit)),
          totalGames,
          hasNext: skip + parseInt(limit) < totalGames,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Error searching tables:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tìm kiếm bàn chơi',
      error: error.message
    });
  }
});

// Delete/Close table (only creator or admin)
router.delete('/table/:tableId', authMiddleware, async (req, res) => {
  try {
    const { tableId } = req.params;

    const game = await Game.findOne({ tableId })
      .populate('currentPlayers.userId', 'username');

    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bàn chơi'
      });
    }

    // Check permission (creator or admin)
    if (game.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa bàn chơi này'
      });
    }

    // Return chips to all players
    for (const player of game.currentPlayers) {
      const user = await User.findById(player.userId);
      if (user) {
        user.balance += player.chips;
        await user.save();
      }
    }

    // Delete the game
    await Game.findByIdAndDelete(game._id);

    res.json({
      success: true,
      message: 'Đã đóng bàn chơi và hoàn trả chip cho tất cả người chơi'
    });

  } catch (error) {
    console.error('Error deleting table:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa bàn chơi',
      error: error.message
    });
  }
});

module.exports = router;
