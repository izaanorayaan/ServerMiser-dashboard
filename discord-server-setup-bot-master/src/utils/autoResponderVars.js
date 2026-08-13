// ============================================================================
// AUTO RESPONDER VARIABLE PARSER
// Shared by the /autoresponder command (previews/tests) and the
// messageCreateAutoResponder.js event (live responses).
//
// Supports a large, documented set of placeholders so server owners can craft
// highly dynamic responses. All parsing is defensive: a missing value resolves
// to an empty string (or a sensible fallback) instead of throwing.
// ============================================================================

/**
 * Pick a random element from an array.
 */
function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  
  /**
   * Ordinal suffix helper (1st, 2nd, 3rd...).
   */
  function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  
  /**
   * Build the full replacement map for a given message context.
   * `ctx` is a plain object so the command can build previews without a real
   * Message object.
   */
  function buildContext(message, extra = {}) {
    const guild = message.guild;
    const author = message.author;
    const member = message.member;
    const channel = message.channel;
    const now = new Date();
  
    const memberCount = guild?.memberCount ?? 0;
  
    return {
      // ---- USER ----
      'user': author ? `<@${author.id}>` : '',
      'user.mention': author ? `<@${author.id}>` : '',
      'user.name': author?.username ?? '',
      'user.tag': author?.tag ?? author?.username ?? '',
      'user.id': author?.id ?? '',
      'user.displayname': member?.displayName ?? author?.username ?? '',
      'user.nickname': member?.nickname ?? author?.username ?? '',
      'user.avatar': author?.displayAvatarURL?.({ dynamic: true, size: 256 }) ?? '',
      'user.createdat': author ? `<t:${Math.floor(author.createdTimestamp / 1000)}:D>` : '',
      'user.joinedat': member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : '',
      'user.roles': member ? member.roles.cache.filter(r => r.id !== guild.id).map(r => r.name).join(', ') : '',
      'user.toprole': member?.roles?.highest?.name ?? '',
  
      // ---- SERVER ----
      'server': guild?.name ?? '',
      'server.name': guild?.name ?? '',
      'server.id': guild?.id ?? '',
      'server.membercount': String(memberCount),
      'server.members': String(memberCount),
      'server.membercount.ordinal': ordinal(memberCount),
      'server.owner': guild?.ownerId ? `<@${guild.ownerId}>` : '',
      'server.boosts': String(guild?.premiumSubscriptionCount ?? 0),
      'server.boostlevel': String(guild?.premiumTier ?? 0),
      'server.icon': guild?.iconURL?.({ dynamic: true, size: 256 }) ?? '',
      'server.createdat': guild?.createdTimestamp ? `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>` : '',
  
      // ---- CHANNEL ----
      'channel': channel ? `<#${channel.id}>` : '',
      'channel.mention': channel ? `<#${channel.id}>` : '',
      'channel.name': channel?.name ?? '',
      'channel.id': channel?.id ?? '',
  
      // ---- MESSAGE ----
      'message': message?.content ?? '',
      'message.content': message?.content ?? '',
      'message.id': message?.id ?? '',
      'message.link': (guild && channel && message?.id) ? `https://discord.com/channels/${guild.id}/${channel.id}/${message.id}` : '',
  
      // ---- TIME ----
      'date': now.toLocaleDateString('en-US'),
      'time': now.toLocaleTimeString('en-US'),
      'timestamp': `<t:${Math.floor(now.getTime() / 1000)}:F>`,
      'timestamp.relative': `<t:${Math.floor(now.getTime() / 1000)}:R>`,
      'year': String(now.getFullYear()),
  
      // ---- MISC / injected ----
      'trigger': extra.trigger ?? '',
      'args': extra.args ?? '',
      'arg1': (extra.argsArray && extra.argsArray[0]) || '',
      'arg2': (extra.argsArray && extra.argsArray[1]) || '',
      'arg3': (extra.argsArray && extra.argsArray[2]) || '',
      'count': extra.count != null ? String(extra.count) : '',
      'bot': message?.client?.user ? `<@${message.client.user.id}>` : '',
      'bot.name': message?.client?.user?.username ?? '',
    };
  }
  
  /**
   * Parse a response template against a message.
   * Handles {variables}, {random:a|b|c}, {choose:a|b} and {#member.mention}
   * style targeted mentions.
   */
  function parseVariables(template, message, extra = {}) {
    if (!template || typeof template !== 'string') return '';
  
    const map = buildContext(message, extra);
  
    let out = template;
  
    // 1. {random:a|b|c} or {choose:a|b|c} -> random option
    out = out.replace(/\{(?:random|choose):([^}]*)\}/gi, (_, opts) => {
      const parts = String(opts).split('|').map(s => s.trim()).filter(Boolean);
      return parts.length ? pick(parts) : '';
    });
  
    // 2. {mention:123456789} -> raw mention of an id
    out = out.replace(/\{mention:(\d{5,25})\}/gi, (_, id) => `<@${id}>`);
  
    // 3. Standard {key} placeholders (case-insensitive)
    out = out.replace(/\{([a-z0-9_.]+)\}/gi, (full, key) => {
      const val = map[String(key).toLowerCase()];
      return val != null ? val : full; // leave unknown tokens untouched
    });
  
    // 4. Escaped newlines for single-line inputs from modals
    out = out.replace(/\\n/g, '\n');
  
    return out;
  }
  
  /**
   * The catalog of variables, grouped, for the help/variables UI.
   */
  const VARIABLE_CATALOG = {
    User: [
      ['{user}', 'Mentions the user (@name)'],
      ['{user.name}', 'Username without mention'],
      ['{user.tag}', 'Full username#0000 tag'],
      ['{user.id}', 'The user\'s numeric ID'],
      ['{user.displayname}', 'Server display name'],
      ['{user.avatar}', 'URL of the user\'s avatar'],
      ['{user.joinedat}', 'When they joined (date)'],
      ['{user.toprole}', 'Their highest role name'],
    ],
    Server: [
      ['{server}', 'Server name'],
      ['{server.membercount}', 'Total member count'],
      ['{server.membercount.ordinal}', 'e.g. 1,234th member'],
      ['{server.owner}', 'Mentions the server owner'],
      ['{server.boosts}', 'Number of boosts'],
      ['{server.boostlevel}', 'Boost tier (0-3)'],
      ['{server.icon}', 'Server icon URL'],
    ],
    Channel: [
      ['{channel}', 'Mentions the current channel'],
      ['{channel.name}', 'Channel name'],
      ['{channel.id}', 'Channel ID'],
    ],
    Message: [
      ['{message}', 'The full message content'],
      ['{message.link}', 'A jump link to the message'],
      ['{trigger}', 'The phrase that triggered this'],
      ['{args}', 'Everything after the trigger word'],
      ['{arg1} {arg2} {arg3}', 'Individual words after the trigger'],
    ],
    Time: [
      ['{date}', 'Current date'],
      ['{time}', 'Current time'],
      ['{timestamp}', 'Discord live timestamp'],
      ['{timestamp.relative}', 'Relative time (e.g. 2m ago)'],
    ],
    Dynamic: [
      ['{random:a|b|c}', 'Picks one option at random'],
      ['{choose:x|y}', 'Alias of random'],
      ['{mention:ID}', 'Mentions a specific user ID'],
      ['{count}', 'Times this responder has fired'],
      ['{bot}', 'Mentions the bot'],
    ],
  };
  
  module.exports = { parseVariables, buildContext, VARIABLE_CATALOG, ordinal };
  