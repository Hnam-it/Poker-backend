const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: String,
  dob: Date,
  username: { type: String, required: true, unique: true, index: true },
  password: String,
  role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
  balance: { type: Number, default: 0 }
}, {
  timestamps: true // Thêm createdAt và updatedAt
});

module.exports = mongoose.model('User', userSchema);
