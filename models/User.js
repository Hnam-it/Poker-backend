const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: String,
  dob: Date,
  username: { type: String, required: true, unique: true },
  password: String,
  role: { type: String, enum: ['user', 'admin'], default: 'user' }, // ✅ THÊM DÒNG NÀY
  balance: { type: Number, default: 0 } // Thêm trường balance
});

module.exports = mongoose.model('User', userSchema);
