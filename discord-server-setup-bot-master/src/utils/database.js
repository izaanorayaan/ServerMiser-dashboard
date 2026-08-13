const mongoose = require('mongoose');

// Generic schema matching your collection framework
const genericSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, 
    value: { type: mongoose.Schema.Types.Mixed, required: true }, 
  },
  { collection: undefined, strict: false } 
);

// Cache models per collection name
const modelCache = {};

function getModel(fileName) {
  const collectionName = fileName.replace(/\.json$/i, '');
  if (!modelCache[collectionName]) {
    modelCache[collectionName] = mongoose.model(
      collectionName,
      genericSchema,
      collectionName 
    );
  }
  return modelCache[collectionName];
}

async function readData(fileName) {
  try {
    const Model = getModel(fileName);
    const docs = await Model.find().lean();
    const result = {};
    for (const doc of docs) {
      result[doc._id] = doc.value;
    }
    return result;
  } catch (error) {
    console.error(`Error reading ${fileName} from MongoDB:`, error.message);
    return {};
  }
}

async function writeData(fileName, data) {
  try {
    const Model = getModel(fileName);
    const keys = Object.keys(data);

    const bulkOps = keys.map((key) => ({
      updateOne: {
        filter: { _id: key },
        update: { $set: { value: data[key] } },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await Model.bulkWrite(bulkOps);
    }
    await Model.deleteMany({ _id: { $nin: keys } });
  } catch (error) {
    console.error(`Error writing to ${fileName} in MongoDB:`, error.message);
  }
}

// ============================================================
// UNIFIED PER-GUILD CONFIG STORE
// ============================================================
// All guild-level settings (tickets, welcome messages, cute style,
// leveling config, mod-log settings, setup records, reaction role
// panels, etc.) live together in ONE document per guild, in the
// 'guild_config' collection. This matches how every command already
// calls findOne({ guildId }) / findOneAndUpdate({ guildId }, ...) —
// they're really all reading/writing fields on the same guild record.
const GUILD_CONFIG_COLLECTION = 'guild_config';

function getDotValue(obj, dotPath) {
  return dotPath.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function setDotValue(obj, dotPath, value) {
  const keys = dotPath.split('.');
  let cursor = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (cursor[key] == null || typeof cursor[key] !== 'object') cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]] = value;
}

function unsetDotValue(obj, dotPath) {
  const keys = dotPath.split('.');
  let cursor = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (cursor[key] == null || typeof cursor[key] !== 'object') return;
    cursor = cursor[key];
  }
  delete cursor[keys[keys.length - 1]];
}

/**
 * Reads a single guild's unified config document. Supports the calling
 * convention used throughout the codebase: findOne({ guildId }) or
 * findOne({ userId }) (legacy leveling lookups fall back to the levels
 * collection, since those are keyed by user, not guild).
 */
async function findOne(query = {}) {
  try {
    if (query.guildId) {
      const Model = getModel(GUILD_CONFIG_COLLECTION);
      const doc = await Model.findOne({ _id: String(query.guildId) }).lean();
      return doc ? { guildId: query.guildId, ...doc.value } : null;
    }

    // Legacy per-user lookups (e.g. leveling ranks) still use their own collection.
    const targetCollection = query.collectionName || 'levels';
    const targetId = query.userId || query._id || Object.values(query)[0];
    if (!targetId) return null;

    const Model = getModel(targetCollection);
    const doc = await Model.findOne({ _id: String(targetId) }).lean();
    return doc ? { ...doc, ...doc.value } : null;
  } catch (error) {
    console.error('[database] Error in findOne:', error.message);
    return null;
  }
}

/**
 * Real findOneAndUpdate implementation for per-guild config documents.
 * Supports the Mongo-style update operators actually used across the
 * codebase: $set (including dot-notation paths), $unset (dot-notation),
 * $push (append to array field), and $pull (remove matching items from
 * an array field). Options: { upsert, new } — both are effectively
 * always-on here since every call site expects upsert behavior.
 *
 * Returns the updated document's value object (flattened, matching what
 * findOne() returns), so callers like `updatedConfig.levelConfig?.channelId`
 * continue to work unchanged.
 */
async function findOneAndUpdate(query = {}, update = {}, options = {}) {
  try {
    if (!query.guildId) {
      console.error('[database] findOneAndUpdate currently only supports guildId-keyed documents.');
      return null;
    }

    const Model = getModel(GUILD_CONFIG_COLLECTION);
    const guildId = String(query.guildId);
    const existingDoc = await Model.findOne({ _id: guildId }).lean();
    const current = existingDoc ? { ...existingDoc.value } : {};

    if (update.$set) {
      for (const [path, value] of Object.entries(update.$set)) {
        setDotValue(current, path, value);
      }
    }

    if (update.$unset) {
      for (const path of Object.keys(update.$unset)) {
        unsetDotValue(current, path);
      }
    }

    if (update.$push) {
      for (const [path, value] of Object.entries(update.$push)) {
        const arr = getDotValue(current, path);
        const nextArr = Array.isArray(arr) ? [...arr, value] : [value];
        setDotValue(current, path, nextArr);
      }
    }

    if (update.$pull) {
      for (const [path, matcher] of Object.entries(update.$pull)) {
        const arr = getDotValue(current, path);
        if (Array.isArray(arr)) {
          const filtered = arr.filter(item => {
            if (matcher && typeof matcher === 'object') {
              return !Object.entries(matcher).every(([mk, mv]) => item?.[mk] === mv);
            }
            return item !== matcher;
          });
          setDotValue(current, path, filtered);
        }
      }
    }

    await Model.updateOne(
      { _id: guildId },
      { $set: { value: current } },
      { upsert: true }
    );

    return { guildId, ...current };
  } catch (error) {
    console.error('[database] Error in findOneAndUpdate:', error.message);
    return null;
  }
}

// Export the new global fallback along with your existing schema methods
module.exports = { readData, writeData, getModel, findOne, findOneAndUpdate };

// ============================================================
// ANALYTICS HELPERS (added for the ServerMiser dashboard)
// ============================================================

/**
 * Sums XP across every guild and user in the levels collection.
 * Returns 0 safely if the collection is empty or unreadable.
 */
async function getTotalXp() {
  try {
    const levelsData = (await readData('levels.json')) || {};
    let total = 0;
    for (const guildId of Object.keys(levelsData)) {
      const guildUsers = levelsData[guildId] || {};
      for (const userId of Object.keys(guildUsers)) {
        total += Number(guildUsers[userId]?.xp || 0);
      }
    }
    return total;
  } catch (error) {
    console.error('[database] Error computing total XP:', error.message);
    return 0;
  }
}

/**
 * Increments a lifetime counter stored in the botStats collection.
 * Used for total tickets created and total setups run — figures that
 * need to persist even after the underlying record (e.g. an active
 * ticket) is closed/deleted.
 */
async function incrementCounter(counterName, amount = 1) {
  try {
    const stats = (await readData('bot_stats_counters.json')) || {};
    stats[counterName] = Number(stats[counterName] || 0) + amount;
    await writeData('bot_stats_counters.json', stats);
    return stats[counterName];
  } catch (error) {
    console.error(`[database] Error incrementing counter "${counterName}":`, error.message);
    return null;
  }
}

/**
 * Reads all lifetime counters (total tickets, total setups, setup
 * successes/failures, etc.) in one call.
 */
async function getCounters() {
  try {
    return (await readData('bot_stats_counters.json')) || {};
  } catch (error) {
    console.error('[database] Error reading counters:', error.message);
    return {};
  }
}

module.exports.getTotalXp = getTotalXp;
module.exports.incrementCounter = incrementCounter;
module.exports.getCounters = getCounters;

/**
 * Aggregates every guild's chosen /setup template into category counts
 * for the dashboard's donut chart. This is real data — each guild's
 * template is the one they actually picked when running /setup — not a
 * fabricated split. Guilds that haven't run /setup yet aren't counted.
 */
const TEMPLATE_LABELS = {
  gaming: { name: 'Gaming Clan Networks', color: '#ff3b5c', desc: 'Esports servers, stream hubs, and localized clans running the Gaming setup template.' },
  community: { name: 'Public Community Guilds', color: '#e2f9b8', desc: 'General chat guilds, interest groups, and hobby portals running the Community setup template.' },
  study: { name: 'Academic Study Hubs', color: '#38bdf8', desc: 'Study groups and classrooms running the Academic setup template.' },
  business: { name: 'Corporate & Business', color: '#fca5a5', desc: 'Business and corporate operations running the Business setup template.' },
  creative: { name: 'Creative Art Studios', color: '#a78bfa', desc: 'Art, music, and creator communities running the Creative setup template.' },
  development: { name: 'Dev Forge Engineering', color: '#2e7b8f', desc: 'Software and engineering communities running the Development setup template.' }
};

async function getGuildCategories() {
  try {
    const Model = getModel('guild_config');
    const docs = await Model.find().lean();
    const counts = {};

    for (const doc of docs) {
      const template = doc.value?.template;
      if (template && TEMPLATE_LABELS[template]) {
        counts[template] = (counts[template] || 0) + 1;
      }
    }

    return Object.entries(counts).map(([template, count]) => ({
      name: TEMPLATE_LABELS[template].name,
      count,
      color: TEMPLATE_LABELS[template].color,
      desc: TEMPLATE_LABELS[template].desc
    }));
  } catch (error) {
    console.error('[database] Error computing guild categories:', error.message);
    return [];
  }
}

module.exports.getGuildCategories = getGuildCategories;