const mongoose = require('mongoose');

const userLevelSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 0 },
  },
  { collection: 'user_levels' }
);

// One document per (guild, user) pair
userLevelSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.models.UserLevel || mongoose.model('UserLevel', userLevelSchema);