const { Events } = require('discord.js');
// Reuse the exact same models + helpers declared inside the command file so we
// never register a duplicate Mongoose model.
const selfvoice = require('../commands/selfvoice');
const { SelfVoiceActive, buildPanelMessage } = selfvoice;

module.exports = {
  name: Events.VoiceStateUpdate,
  once: false,

  async execute(oldState, newState, client) {
    try {
      // Lazily start the janitor once we have a live client reference.
      if (typeof selfvoice.startJanitor === 'function') selfvoice.startJanitor(client);

      const oldId = oldState.channelId;
      const newId = newState.channelId;
      if (oldId === newId) return; // mute/deafen/etc — irrelevant here

      // ============================================================
      // JOIN / MOVE-IN  — did someone enter a managed temp channel?
      // ============================================================
      if (newId) {
        const rec = await SelfVoiceActive.findOne({ channelId: newId }).catch(() => null);
        if (rec && newState.id === rec.ownerId && !rec.joined) {
          // The OWNER joined -> cancel the grace deletion + drop the control panel.
          rec.joined = true;
          await rec.save().catch(() => null);

          const channel = newState.channel;
          if (channel) {
            await channel
              .send(buildPanelMessage(rec, channel))
              .catch(() => null);
          }
        }
      }

      // ============================================================
      // LEAVE / MOVE-OUT — did someone leave a managed temp channel?
      // ============================================================
      if (oldId) {
        const rec = await SelfVoiceActive.findOne({ channelId: oldId }).catch(() => null);
        if (rec) {
          const channel =
            oldState.channel ||
            client.channels.cache.get(oldId) ||
            (await client.channels.fetch(oldId).catch(() => null));

          const remaining = channel && channel.members ? channel.members.size : 0;
          const ownerLeft = oldState.id === rec.ownerId;

          // Owner left OR the room is now empty -> tear it down.
          if (ownerLeft || remaining === 0) {
            if (channel) {
              await channel
                .delete(ownerLeft ? 'SelfVoice: owner left the room' : 'SelfVoice: room is empty')
                .catch(() => null);
            }
            await SelfVoiceActive.deleteOne({ channelId: oldId }).catch(() => null);
          }
        }
      }
    } catch (err) {
      console.error('[SelfVoice voiceStateUpdate error]:', err.message);
    }
  },
};
