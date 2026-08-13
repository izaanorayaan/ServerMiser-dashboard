module.exports = {
    name: 'inviteDelete',
    async execute(invite, client) {
        const invitesCmd = client.commands.get('invites');
        if (invitesCmd?.handleInviteDelete) {
            invitesCmd.handleInviteDelete(invite);
        }
    },
};
