module.exports = {
    name: 'messageReactionRemove',
    async execute(reaction, user) {
        try {
            // Handle partial states safely
            if (reaction.partial) await reaction.fetch().catch(() => null);
            if (reaction.message.partial) await reaction.message.fetch().catch(() => null);
        } catch { return; }

        // Securely reference the client instance directly from the event payload
        const botClient = reaction.client;

        // Add a safety check to ensure commands collection exists before reading it
        if (!botClient.commands) {
            console.warn('[Warning] client.commands collection is not initialized during reaction remove.');
            return;
        }

        const starboardCmd = botClient.commands.get('starboard');
        if (starboardCmd && typeof starboardCmd.handleReaction === 'function') {
            // Notice we pass false here since it's a reaction removal event
            await starboardCmd.handleReaction(reaction, user, false, botClient).catch(() => null);
        }
    },
};
