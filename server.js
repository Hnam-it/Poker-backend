require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');
const gameRoutes = require('./routes/game');

const { authMiddleware } = require('./middleware/authMiddleware');
const tableCleanupService = require('./services/tableCleanupService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5000', 'http://192.168.20.8:3000'],
    credentials: true,
  }
});

const PORT = process.env.PORT || 5000;

connectDB();

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5000', 'http://192.168.20.8:3000'],
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/game', gameRoutes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  // Join a specific table room
  socket.on('join-table', (tableId, userId) => {
    socket.join(`table-${tableId}`);
    socket.tableId = tableId;
    socket.userId = userId;
    console.log(`👤 User ${userId} joined table ${tableId}`);
    
    // Notify other players in the room
    socket.to(`table-${tableId}`).emit('player-joined', {
      userId,
      message: `Player ${userId} joined the table`
    });
  });

  // Leave table room
  socket.on('leave-table', (tableId, userId) => {
    socket.leave(`table-${tableId}`);
    console.log(`👤 User ${userId} left table ${tableId}`);
    
    // Notify other players
    socket.to(`table-${tableId}`).emit('player-left', {
      userId,
      message: `Player ${userId} left the table`
    });
  });

  // Handle player actions (bet, fold, call, etc.)
  socket.on('player-action', (data) => {
    const { tableId, action, amount } = data;
    console.log(`🎯 Player action in table ${tableId}:`, action, amount);
    
    // Broadcast action to all players in the table
    io.to(`table-${tableId}`).emit('action-update', {
      playerId: socket.userId,
      action,
      amount,
      timestamp: new Date()
    });
  });

  // Handle chat messages
  socket.on('table-chat', (data) => {
    const { tableId, message } = data;
    io.to(`table-${tableId}`).emit('chat-message', {
      playerId: socket.userId,
      message,
      timestamp: new Date()
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
    if (socket.tableId) {
      socket.to(`table-${socket.tableId}`).emit('player-left', {
        userId: socket.userId,
        message: `Player ${socket.userId} disconnected`
      });
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT} and accessible from all interfaces`);
  console.log(`🔌 Socket.IO enabled for real-time communication`);
  
  // Khởi động table cleanup service
  tableCleanupService.start();
});
