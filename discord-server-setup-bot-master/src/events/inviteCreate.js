module.exports = {
    name: 'inviteCreate',
    async execute(invite, client) {
        const invitesCmd = client.commands.get('invites');
        if (invitesCmd?.handleInviteCreate) {
            invitesCmd.handleInviteCreate(invite);
        }
    },
};
