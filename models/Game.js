const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  tableId: {
    type: String,
    required: true,
    unique: true
  },
  tableName: {
    type: String,
    required: true
  },
  gameType: {
    type: String,
    enum: ['texas-holdem', 'omaha', 'seven-card-stud'],
    default: 'texas-holdem'
  },
  maxPlayers: {
    type: Number,
    required: true,
    min: 2,
    max: 10,
    default: 6
  },
  currentPlayers: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    username: String,
    chips: Number,
    position: Number,
    isActive: {
      type: Boolean,
      default: true
    },
    lastAction: {
      type: String,
      enum: ['fold', 'call', 'raise', 'check', 'all-in'],
      default: null
    }
  }],
  blinds: {
    smallBlind: {
      type: Number,
      required: true
    },
    bigBlind: {
      type: Number,
      required: true
    }
  },
  buyIn: {
    min: {
      type: Number,
      required: true
    },
    max: {
      type: Number,
      required: true
    }
  },
  pot: {
    type: Number,
    default: 0
  },
  gameState: {
    type: String,
    enum: ['waiting', 'pre-flop', 'flop', 'turn', 'river', 'showdown', 'finished'],
    default: 'waiting'
  },
  communityCards: [{
    suit: String,
    rank: String
  }],
  currentTurn: {
    type: Number,
    default: 0
  },
  dealerPosition: {
    type: Number,
    default: 0
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  password: {
    type: String,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
gameSchema.index({ gameState: 1, isPrivate: 1 });
gameSchema.index({ lastActivity: 1 });

module.exports = mongoose.model('Game', gameSchema);
