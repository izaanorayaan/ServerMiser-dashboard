'use strict';

const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  nextCase: { type: Number, default: 1 },
});

const caseSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  caseNumber: { type: Number, required: true },
  action: { type: String, required: true },
  targetId: { type: String, required: true },
  targetTag: { type: String, default: null },
  moderatorId: { type: String, required: true },
  reason: { type: String, default: 'No reason provided' },
  notes: { type: String, default: null },
  evidence: { type: [String], default: [] },
}, { timestamps: true });

caseSchema.index({ guildId: 1, caseNumber: 1 }, { unique: true });
caseSchema.index({ guildId: 1, targetId: 1, createdAt: -1 });

const CaseCounter = mongoose.models.ModerationCaseCounter || mongoose.model('ModerationCaseCounter', counterSchema);
const ModerationCase = mongoose.models.ModerationCase || mongoose.model('ModerationCase', caseSchema);

async function createCase({ guildId, action, target, moderator, reason, notes, evidence = [] }) {
  const counter = await CaseCounter.findOneAndUpdate(
    { guildId },
    { $inc: { nextCase: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const caseNumber = counter.nextCase - 1;
  return ModerationCase.create({
    guildId,
    caseNumber,
    action,
    targetId: target.id,
    targetTag: target.tag || target.username || null,
    moderatorId: moderator.id,
    reason: reason || 'No reason provided',
    notes: notes || null,
    evidence: Array.isArray(evidence) ? evidence : [],
  });
}

function caseLabel(record) {
  return `Case #${record.caseNumber}`;
}

module.exports = { ModerationCase, createCase, caseLabel };
