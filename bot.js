const {
    Client, GatewayIntentBits, Partials, ChannelType, REST, Routes, EmbedBuilder, PermissionsBitField } = require('discord.js');
require('dotenv').config();
// Log – and don't crash – if any promise is rejected without a catch
process.on('unhandledRejection', err => {
  console.error('Unhandled promise rejection:', err);
});
const { handleDmMessage } = require('./features/dmHistory');
const fs = require('fs');
const path = require('path');
const { studentButtons, staffButtons } = require('./features/queueButtons');
const {
  handleJoinQueue,
  handleLeaveQueue,
  handleJoinStaffQueue,
  handleLeaveStaffQueue,
  handleStudentQueueSelect,
  handleStaffQueueSelect,
  handleCreateQueueModal,
  handleEditQueue,
  handleEditQueueModal,
  handleShuffleQueue,
  handleClearQueue,
  handleBlacklistSelect,
  handleBlacklistButton,
  handleDeleteUserButton,
  handleDeleteUserSelect,
  handleCreateQueueButton
} = require('./queueOperations');
  
const { ACCESS_TOKEN_DISCORD, CLIENT_ID } = process.env;

const ensureRolesForGuild = require('./ensureRoles.js');
const assignRolesToMember = require('./assignRoles.js');
const handleCodeReview = require('./features/codeReview');
const handleDMResponse = require('./features/dmResponse');
const handleGeneralQuestion = require('./features/generalQuestion');
const queueManager = require('./queueManager');
const { setupStudentQueueChannel, setupStaffQueueChannel } = queueManager;
const { activeQueue } = queueManager;   // use the shared map from queueManager

const clientDB = require('./database');

/**
 * Backfill all past messages from a text channel into Postgres.
 */
async function backfillChannel(channel) {
  let lastId;
  while (true) {
    const options = { limit: 100, before: lastId };
    let messages;
    try {
      messages = await channel.messages.fetch(options);
    } catch (err) {
      // 50001 = Missing Access → skip this channel and carry on
      if (err.code === 50001) {
        console.warn(`Skipping ${channel.guild?.name ?? 'unknown'}#${channel.name} – missing access`);
        return;
      }
      throw err;                     // bubble up anything unexpected
    }
    if (!messages.size) break;
    for (const msg of messages.values()) {
      if (msg.author.bot) continue;
      await clientDB.query(
        `INSERT INTO public_messages
           (id, guild_id, channel_id, author_id, author_tag, content, ts)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO NOTHING`,
        [
          msg.id,
          msg.guildId,
          msg.channelId,
          msg.author.id,
          msg.author.tag,
          msg.content.trim(),
          msg.createdAt
        ]
      );
    }
    lastId = messages.last().id;
    // Pause briefly to respect rate limits
    await new Promise(res => setTimeout(res, 500));
  }
}

/**
 * Loop through every text channel in the guild and backfill history.
 */
async function backfillGuildHistory(guild) {
  for (const channel of guild.channels.cache.values()) {
    if (channel.type === ChannelType.GuildText) {
      console.log(`Backfilling ${guild.name}#${channel.name}`);
      await backfillChannel(channel);
    }
  }
}

clientDB.query('SELECT NOW()')
    .then(res => console.log(`Database connected. Server time: ${res.rows[0].now}`))
    .catch(err => console.error('Database connection error:', err));

// Documentation channel messages
const STAFF_MESSAGE =
"**Welcome to the Staff Documentation Channel!**\n\n" +
"As a staff member, here’s what you can do with the Jeffrey Bot:\n\n" +
"**1️⃣ /createevent** - Create new events.\n" +
"**2️⃣ /manageusers** - Manage roles and permissions.\n" +
"**3️⃣ /staffstats** - View staff-specific statistics.\n\n" +
"Update this list as needed! If you need assistance, contact the server admin.";

const STUDENT_MESSAGE =
"**Welcome to the Student Documentation Channel!**\n\n" +
"Here’s what you can do with the Jeffrey Bot:\n\n" +
"## Queue actions\n" +
"**1️⃣ /viewevents** – See upcoming events.\n" +
"**2️⃣ /askquestion** – Ask staff or mentors a question.\n" +
"**3️⃣ /resources** – Access helpful resources.\n\n" +
"## Conversation‑history queries _(ask these in a DM to Jeffrey)_\n" +
"## Conversation-history queries _(ask these in a DM to Jeffrey)_\n" +
"• **Who asked about \\\"something\\\" in the chat?**\n" +
"• **When was \\\"something\\\" last mentioned?**\n" +
"• **Who said \\\"something\\\" in the chat?**\n" +
"• **What was the last message in the chat?**\n" +
"• **What was mentioned yesterday?** (or last week / last Friday)\n" +
"• **What did @Alice say on 2025-04-21?**\n" +
"• **What did we talk about in #general last Friday?**\n" +
"• **How many messages has @Bob sent in the last 24 hours?**\n" +
"• **What did we say about arrays between 2025-04-01 and 2025-04-10?**\n" +
"• **What was discussed in #help last week?**\n\n" +
"_Type any of the above (or similar) in a private DM to Jeffrey and you’ll get an instant answer pulled from the server’s chat history._\n\n" +
"Ask if you need help!";

// Initialise the bot client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel],
});

// Map of command objects keyed by their name
client.commands = new Map();

// Load all slash commands
const commands = [];
const commandsPath = path.join(__dirname, 'features');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if (command.data && command.data.name) {
        commands.push(command.data.toJSON());
        client.commands.set(command.data.name, command);
    }
}

async function refreshChannels(guild) {
    console.log(`Refreshing channels for ${guild.name}...`);
    // Re-ensure that the student and staff channels are set up with updated permissions and documentation
    await ensureStudentQueueChannel(guild);
    await ensureStaffQueueChannel(guild);
    await setupDocumentationChannels(guild);
}

/**
 * Sets up the documentation channels (staff-docs and student-docs) under a "Jeffrey Documentation" category.
 */
async function setupDocumentationChannels(guild) {
    try {
        console.log(`Setting up documentation channels for ${guild.name}...`);
        const channels = guild.channels.cache;
        let category = channels.find(ch => ch.type === ChannelType.GuildCategory && ch.name === 'Jeffrey Documentation');

        // Create the category if it doesn’t exist
        if (!category) {
            console.log('Creating "Jeffrey Documentation" category...');
            category = await guild.channels.create({
                name: 'Jeffrey Documentation',
                type: ChannelType.GuildCategory,
            });
        }

        // Create the staff-docs channel if it doesn’t exist
        let staffChannel = channels.find(ch => ch.name === 'staff-docs' && ch.parentId === category.id);
        if (!staffChannel) {
            console.log('Creating staff-docs channel...');
            const staffRole = guild.roles.cache.find(role => role.name === 'Staff');
            staffChannel = await guild.channels.create({
                name: 'staff-docs',
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    { id: guild.id, deny: ['ViewChannel'] },
                    ...(staffRole ? [{ id: staffRole.id, allow: ['ViewChannel', 'SendMessages'] }] : []),
                ],
            });
        }

        // Create the student-docs channel if it doesn’t exist
        let studentChannel = channels.find(ch => ch.name === 'student-docs' && ch.parentId === category.id);
        if (!studentChannel) {
            console.log('Creating student-docs channel...');
            const studentRole = guild.roles.cache.find(role => role.name === 'Students');
            const staffRole = guild.roles.cache.find(role => role.name === 'Staff');
            studentChannel = await guild.channels.create({
                name: 'student-docs',
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    { id: guild.id, deny: ['ViewChannel'] },
                    ...(studentRole ? [{ id: studentRole.id, allow: ['ViewChannel', 'SendMessages'] }] : []),
                    ...(staffRole ? [{ id: staffRole.id, allow: ['ViewChannel'] }] : []),
                ],
            });
        }

        // Post or update documentation messages with pinned behavior
        await updateDocumentationMessage(guild, 'staff-docs', STAFF_MESSAGE);
        await updateDocumentationMessage(guild, 'student-docs', STUDENT_MESSAGE);

        console.log(`Documentation channels setup complete for ${guild.name}.`);
    } catch (error) {
        console.error(`Error setting up documentation channels for ${guild.name}:`, error);
    }
}

/**
 * Clears old messages in a given doc channel and sends updated doc text.
 */
async function updateDocumentationMessage(guild, channelName, content) {
    const channel = guild.channels.cache.find(ch => ch.name === channelName && ch.type === ChannelType.GuildText);
    if (!channel) return;

    try {
        // Fetch pinned messages in the channel
        const pinnedMessages = await channel.messages.fetchPinned();
        const existingMessage = pinnedMessages.find(msg => msg.content === content);

        if (existingMessage) {
            // Update the existing pinned message if content differs
            if (existingMessage.content !== content) {
                await existingMessage.edit(content);
                console.log(`Updated pinned message in ${channelName} for ${guild.name}.`);
            } else {
                console.log(`Pinned message in ${channelName} is already up to date for ${guild.name}.`);
            }
        } else {
            // Send a new message and pin it if no matching message exists
            const message = await channel.send(content);
            await message.pin();
            console.log(`Pinned new documentation message in ${channelName} for ${guild.name}.`);

            // Unpin old messages (if any)
            for (const msg of pinnedMessages.values()) {
                if (msg.id !== message.id) {
                    await msg.unpin();
                    console.log(`Unpinned outdated message in ${channelName} for ${guild.name}.`);
                }
            }
        }
    } catch (err) {
        console.error(`Failed to update messages in ${channelName} for ${guild.name}:`, err);
    }
}

/**
 * When the bot comes online, register slash commands, then ensure
 * roles, documentation channels, and queue channels for every guild.
 */
client.once('ready', async () => {
    console.log(`The AI bot is online as ${client.user.tag}`);

    // Register commands globally
    const rest = new REST({ version: '10' }).setToken(ACCESS_TOKEN_DISCORD);
    try {
        console.log('Registering application (/) commands globally...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('Successfully registered application (/) commands globally.');
        /* ---------- Auto‑generated invite link ---------- */
        // Define the permissions your bot absolutely needs. 
        // Adjust this list if you add/remove features later.
        const requiredPerms = new PermissionsBitField([
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ManageRoles,
          PermissionsBitField.Flags.ManageChannels,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.AddReactions
        ]);

        const inviteUrl =
          `https://discord.com/api/oauth2/authorize` +
          `?client_id=${CLIENT_ID}` +
          `&permissions=${requiredPerms.bitfield}` +
          `&scope=bot%20applications.commands`;

        console.log('\n=== Invite Jeffrey to your server ===');
        console.log(inviteUrl);
        console.log('====================================\n');
    } catch (error) {
        console.error('Error registering commands:', error);
    }

    // For each guild the bot is in, ensure roles and refresh channels
    for (const [_, guild] of client.guilds.cache) {
        await ensureRolesForGuild(guild);
        // Sync roles for all current members so they all get the Students role if applicable
        const allMembers = await guild.members.fetch();
        for (const member of allMembers.values()) {
          await assignRolesToMember(member);
        }
        await refreshChannels(guild);
        // Backfill historical messages for this guild
        console.log(`Starting backfill for ${guild.name}...`);
        await backfillGuildHistory(guild);
        console.log(`Backfill complete for ${guild.name}.`);
    }
});

/**
 * On joining a new guild, automatically set up roles, docs, and queue channel.
 */
client.on('guildCreate', async (guild) => {
    console.log(`Bot added to a new server: ${guild.name}`);
    await ensureRolesForGuild(guild);
    await setupDocumentationChannels(guild);
    await ensureQueueChannel(guild);
});

/**
 * Assigns roles to new members.
 */
client.on('guildMemberAdd', async (member) => {
    console.log(`New member joined: ${member.user.tag}`);
    await assignRolesToMember(member);
    
    // Fetch the Students role from the guild
    const studentRole = member.guild.roles.cache.find(role => role.name === 'Students');
    
    // If the studentRole exists and the member doesn't already have it, assign it
    if (studentRole && !member.roles.cache.has(studentRole.id)) {
        try {
            await member.roles.add(studentRole);
            console.log(`Assigned 'Students' role to ${member.user.tag}`);
        } catch (err) {
            console.error(`Failed to assign 'Students' role to ${member.user.tag}:`, err);
        }
    }
    
    // Now ensure that if the member is a student, the student channels are created/updated
    if (studentRole && member.roles.cache.has(studentRole.id)) {
        await ensureStudentQueueChannel(member.guild);
        await updateDocumentationMessage(member.guild, 'student-docs', STUDENT_MESSAGE);
    }
});

/**
 * Ensures the 'student-queues' channel exists, visible only to Students.
 */
async function ensureStudentQueueChannel(guild) {
    try {
        // Check if the 'student-queues' channel exists
        let studentQueueChannel = guild.channels.cache.find(
            channel => channel.name === 'student-queues' && channel.type === ChannelType.GuildText
        );

        // Find the Students role and ensure it exists
        let studentRole = guild.roles.cache.find(role => role.name.toLowerCase() === 'students');
        if (!studentRole) {
            console.log(`Students role not found in ${guild.name}. Creating it...`);
            studentRole = await guild.roles.create({
                name: 'Students',
                permissions: []
            });
        }

        // If the channel doesn't exist, create it with the appropriate permission overwrites
        if (!studentQueueChannel) {
            console.log(`Creating "student-queues" channel in ${guild.name}...`);
            studentQueueChannel = await guild.channels.create({
                name: 'student-queues',
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: guild.id, // Everyone
                        deny: ['ViewChannel'], // Deny view for all
                    },
                    ...(studentRole
                        ? [
                              {
                                  id: studentRole.id,
                                  allow: ['ViewChannel', 'SendMessages'],
                              },
                          ]
                        : []),
                ],
            });
            console.log(`Created "student-queues" channel in ${guild.name} (${studentQueueChannel.id})`);
        } else {
            // If the channel exists, ensure its permission overwrites include the Students role
            if (studentRole) {
                const hasStudentOverwrite = studentQueueChannel.permissionOverwrites.cache.has(studentRole.id);
                if (!hasStudentOverwrite) {
                    await studentQueueChannel.permissionOverwrites.edit(studentRole, {
                        ViewChannel: true,
                        SendMessages: true,
                    });
                    console.log(`Updated "student-queues" channel permissions to include Students role in ${guild.name}.`);
                }
            }
        }

        // Post or update the channel with the student queue message
        await queueManager.setupStudentQueueChannel(studentQueueChannel);
            return studentQueueChannel;
    } catch (error) {
        console.error(`Failed to ensure "student-queues" channel for ${guild.name}:`, error);
    }
}

/**
 * Ensures the 'staff-queues' channel exists, visible only to Staff.
 */
async function ensureStaffQueueChannel(guild) {
    try {
        // Check if the 'staff-queues' channel exists
        let staffQueueChannel = guild.channels.cache.find(
            channel => channel.name === 'staff-queues' && channel.type === ChannelType.GuildText
        );

        // Find the Staff role
        const staffRole = guild.roles.cache.find(role => role.name === 'Staff');

        // If the channel doesn't exist, create it
        if (!staffQueueChannel) {
            console.log(`Creating "staff-queues" channel in ${guild.name}...`);
            staffQueueChannel = await guild.channels.create({
                name: 'staff-queues',
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        deny: ['ViewChannel'],
                    },
                    ...(staffRole
                        ? [
                              {
                                  id: staffRole.id,
                                  allow: ['ViewChannel', 'SendMessages'],
                              },
                          ]
                        : []),
                ],
            });
            console.log(`Created "staff-queues" channel in ${guild.name} (${staffQueueChannel.id})`);
        }

        // Post or update the channel with the staff queue message
        await queueManager.setupStaffQueueChannel(staffQueueChannel);
            return staffQueueChannel;
    } catch (error) {
        console.error(`Failed to ensure "staff-queues" channel for ${guild.name}:`, error);
    }
}

/**
 * Handle the /history slash-command by turning the sub-command + options
 * into the natural-language question strings already understood by
 * handleDmMessage(), then piping it through that parser.
 */
async function handleHistorySlash(interaction) {
    // Work out which guild’s history we should search.
    // • If the command is invoked inside a server channel we already have
    //   `interaction.guild`.
    // • If it’s invoked from a DM we attempt to find the *first* guild
    //   that both the user and the bot share.
    //   (That’s good enough for single‑server classrooms; for multiple
    //   mutual servers you may want to add a guild selector later.)
    let guild = interaction.guild;
    if (!guild) {
      for (const g of interaction.client.guilds.cache.values()) {
        try {
          await g.members.fetch(interaction.user.id); // throws if user not in guild
          guild = g;
          break;
        } catch (_) {
          /* not a mutual guild – keep looking */
        }
      }
      if (!guild) {
        return interaction.reply({
          content: '⛔ I couldn’t find a server we both belong to. Please invite me to the server and try again.',
          ephemeral: true,
        });
      }
    }
    const guildId = guild.id;
    const sub = interaction.options.getSubcommand();
    let query;
  
    switch (sub) {
      case 'last_mentioned':
        query = `When was ${interaction.options.getString('term')} last mentioned?`;
        break;
      case 'last_message':
        query = 'What was the last message in the chat?';
        break;
      case 'keyword_between': {
        const term      = interaction.options.getString('term');
        const startStr  = interaction.options.getString('start');
        const endStr    = interaction.options.getString('end');

        // Basic YYYY‑MM‑DD check
        const startDate = new Date(startStr);
        const endDate   = new Date(endStr);
        if (isNaN(startDate) || isNaN(endDate)) {
          return interaction.reply({
            content: '⛔ Invalid date format. Please use YYYY‑MM‑DD.',
            ephemeral: true,
          });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
          // Include the whole end day by adding 24h
          const { rows } = await clientDB.query(
            `SELECT author_tag, content, ts
               FROM public_messages
              WHERE guild_id = $1
                AND content ILIKE $2
                AND ts BETWEEN $3 AND $4
              ORDER BY ts`,
            [
              guildId,
              '%' + term + '%',
              startDate,
              new Date(endDate.getTime() + 24 * 60 * 60 * 1000),
            ]
          );

          const count = rows.length;
          let response =
            `${term} was mentioned **${count}** time(s) between ` +
            `${startStr} and ${endStr}.`;

          if (count > 0) {
            // Show up to the first 10 results
            const preview = rows.slice(0, 10).map(r =>
              `• **${r.author_tag}** at <t:${Math.floor(new Date(r.ts).getTime() / 1000)}:f> – ${r.content}`
            ).join('\n');

            // First / last
            const firstTs = rows[0].ts;
            const lastTs  = rows[rows.length - 1].ts;

            response += `\nFirst: <t:${Math.floor(new Date(firstTs).getTime() / 1000)}:f>`;
            response += `\nLast:  <t:${Math.floor(new Date(lastTs ).getTime() / 1000)}:f>`;
            response += `\n\n${preview}`;
            if (count > 10) response += `\n…and **${count - 10}** more.`;
          } else {
            response += `\n\n_No matching messages were found in that period._`;
          }

          await interaction.editReply({ content: response });
        } catch (err) {
          console.error('keyword_between query failed:', err);
          await interaction.editReply({
            content: 'Sorry, something went wrong fetching that history.',
          });
        }
        return; // handled – skip the generic dmHistory fallback
      }
      case 'channel_discussed_period': {
        // ── 1. Resolve which channel to search ──────────────────────────────
        let ch = interaction.options.getChannel('channel');
        if (!ch) {
          ch =
            guild.systemChannel ||
            guild.channels.cache.find(
              c => c.type === ChannelType.GuildText && c.name === 'general'
            ) ||
            guild.channels.cache.find(c => c.type === ChannelType.GuildText);
        }
        if (!ch) {
          return interaction.reply({
            content: '⛔ I couldn’t find a text channel to search in this server.',
            ephemeral: true,
          });
        }

        // ── 2. Work out time‑window based on period selector ────────────────
        // periodChoice: "yesterday", "today", "last week"
        // "last week" means the last 7×24h window, starting 00:00 seven days ago, up to now.
        const periodChoice = (interaction.options.getString('period') || 'last week').toLowerCase();
        const now       = new Date();
        let   startDate = new Date();
        let   endDate   = new Date();           // defaults to “now”

        switch (periodChoice) {
          case 'yesterday': {                   // 00:00 → 23:59 of the previous day
            startDate.setDate(now.getDate() - 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setHours(23, 59, 59, 999);
            break;
          }
          case 'today': {                    // midnight today → now
            startDate = new Date(now);
            startDate.setHours(0, 0, 0, 0);
            // endDate stays as “now”
            break;
          }
          case 'last week': {                   // 7 * 24 hours up to “now”
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
            startDate.setHours(0, 0, 0, 0);     // midnight at start
            // endDate stays as “now”
            break;
          }
          default: {                            // fallback: last 7 days (not normalized to midnight)
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
            break;
          }
        }

        await interaction.deferReply({ ephemeral: true });

        // ── 3. Fetch messages from Postgres ─────────────────────────────────
        try {
          const { rows } = await clientDB.query(
            `SELECT content
               FROM public_messages
              WHERE guild_id   = $1
                AND channel_id = $2
                AND ts BETWEEN $3 AND $4`,
            [guildId, ch.id, startDate, endDate]
          );

          if (!rows.length) {
            return interaction.editReply({
              content: `Nothing was posted in #${ch.name} during that period.`,
            });
          }

          // ── 4. Tiny summary: top 5 keywords (excluding stop‑words) ───────
          const stop = new Set([
            'the','and','a','an','to','of','in','it','is','for','on','that',
            'this','with','i','you','we','they','he','she','at','by','be',
            'was','were','are','from','as','but','or','if','so','not','have',
            'has','had','our','your','my','me'
          ]);
          const counts = {};
          for (const r of rows) {
            for (const word of r.content
              .toLowerCase()
              .replace(/[`*_~>|<@\d:,.\-?!()\[\]{}]/g, ' ')
              .split(/\s+/)
            ) {
              if (word.length < 3 || stop.has(word)) continue;
              counts[word] = (counts[word] || 0) + 1;
            }
          }

          const topics = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([w]) => w);

          // Helper to join words nicely: "a, b and c"
          const humanList = arr => {
            if (arr.length === 0) return '';
            if (arr.length === 1) return arr[0];
            if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
            return `${arr.slice(0, -1).join(', ')}, and ${arr[arr.length - 1]}`;
          };

          const summary =
            topics.length
              ? `During this period the conversation mainly revolved around **${humanList(topics)}**.`
              : 'Messages were too varied for a clear one‑sentence summary.';

          // ── 5. Craft the response ────────────────────────────────────────
          await interaction.editReply({
            content:
              `I found **${rows.length}** messages in <#${ch.id}> ` +
              `between <t:${Math.floor(startDate.getTime() / 1000)}:d> ` +
              `and <t:${Math.floor(endDate.getTime()   / 1000)}:d>.\n` +
              summary
          });
        } catch (err) {
          console.error('channel_discussed_period query failed:', err);
          await interaction.editReply({
            content: 'Sorry, something went wrong fetching that history.',
          });
        }
        return; // handled – skip the dmHistory fallback
      }
      default:
        return interaction.reply({ content: '⛔ Unknown history query.', ephemeral: true });
    }
  
    await interaction.deferReply({ ephemeral: true });
  
    // Lightweight stub satisfying dmHistory expectations
    const fakeMsg = {
      content: query,
      client: interaction.client,
      reply: (content) => interaction.followUp({ content, ephemeral: true })
    };
  
    try {
      await handleDmMessage(fakeMsg);
    } catch (err) {
      console.error('History slash command failed:', err);
      await interaction.followUp({ content: 'Sorry, something went wrong.', ephemeral: true });
    }
  }


/**
 * Handle button interactions in the queue channel.
 */
client.on('interactionCreate', async (interaction) => {

    // ─── Slash commands ────────────────────────────────
    if (interaction.isChatInputCommand()) {
        // /smart_search is implemented as a bespoke handler
        if (interaction.commandName === 'smart_search') {
            await handleHistorySlash(interaction);
            return;
        }

        // All other slash commands loaded from /features
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) {
            await interaction.reply({ content: '⛔ Unknown command.', ephemeral: true });
            return;
        }

        try {
            await command.execute(interaction);
        } catch (err) {
            console.error(`Error running /${interaction.commandName}:`, err);
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp({ content: 'Sorry, something went wrong.', ephemeral: true });
            } else {
                await interaction.reply({ content: 'Sorry, something went wrong.', ephemeral: true });
            }
        }
        return; // done with slash commands
    }

    if (interaction.isModalSubmit() && interaction.customId === 'create-queue-modal') {
        await handleCreateQueueModal(interaction);
        return;
    }
    if (interaction.isModalSubmit() && interaction.customId?.startsWith('edit-queue-modal-')) {
        await handleEditQueueModal(interaction);
        return;
    }
    
    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;

    // Let the generalQuestion collector handle these
    if (interaction.customId === 'yes_private_help' || interaction.customId === 'no_private_help') {
      return;
    }
    // Let the codeReview collector handle these
    if (interaction.customId === 'code_review_yes' || interaction.customId === 'code_review_no') {
      return;
    }

    console.log(`Button clicked: ${interaction.customId}`);

    // Ignore buttons not related to queue
    //if (!interaction.customId.startsWith('queue-')) return;

    const { customId, user, guild } = interaction;

    try {
        // // Defer the reply to avoid timeout errors and allow time to respond later
        // await interaction.deferReply({ ephemeral: true });

        switch (customId) {
            /* ---------- Student selectors & buttons ---------- */
            case 'student-queue-selector':
                await handleStudentQueueSelect(interaction);
                break;
            case 'join-student':
                await handleJoinQueue(interaction, user, guild);
                break;
            case 'leave-student':
                await handleLeaveQueue(interaction, user, guild);
                break;
          
            /* ---------- Staff selectors & buttons ---------- */
            case 'staff-queue-selector':
                await handleStaffQueueSelect(interaction);
                break;
            case 'join-staff':
                await handleJoinStaffQueue(interaction, user, guild);
                break;
            case 'leave-staff':
                await handleLeaveStaffQueue(interaction, user, guild);
                break;
            case 'shuffle-queue':
                await handleShuffleQueue(interaction);
                break;
            case 'clear-queue':
                await handleClearQueue(interaction);
                break;
            case 'blacklist-selector':
                await handleBlacklistSelect(interaction);
                break;
// (Removed whitelist-selector case)
            case 'queue-blacklist':
                await handleBlacklistButton(interaction);
                break;
            case 'edit-queue':
                await handleEditQueue(interaction);
                break;
            case 'delete-user-selector':
                await handleDeleteUserSelect(interaction);
                break;
            case 'queue-delete-user':
                await handleDeleteUserButton(interaction);
                break;
            case 'create-queue':
                await handleCreateQueueButton(interaction);
                break;

          /* ---------- Fallback ---------- */
          default:
              await interaction.reply({ content: '⛔ Unknown interaction.', ephemeral: true });
              break;
          }
    } catch (error) {
        console.error('Error handling interaction:', error);

        // Only follow up if deferReply succeeded
        if (interaction.deferred && !interaction.replied) {
            await interaction.editReply({ content: 'An error occurred while processing your request.' });
        } else if (!interaction.replied) {
            await interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
        } else {
            // If already replied, optionally log or ignore
            console.warn('Could not send error message — interaction already replied.');
        }
    }
});

/**
 * Handle message-based features (code review, DM response, general question).
 */

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // If DM channel, handle via natural‐language history lookup
    if (message.channel.type === ChannelType.DM) {
      await handleDmMessage(message);
      return;
    }

    // Otherwise, existing guild‐message features
    await handleCodeReview(message);
    await handleDMResponse(message);
    await handleGeneralQuestion(message);

    /* ---------- Live message logging ---------- */
    try {
      if (message.guild && !message.author.bot) {
        await clientDB.query(
          `INSERT INTO public_messages
             (id, guild_id, channel_id, author_id, author_tag, content, ts)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (id) DO NOTHING`,
          [
            message.id,
            message.guildId,
            message.channelId,
            message.author.id,
            message.author.tag,
            message.content.trim(),
            message.createdAt
          ]
        );
      }
    } catch (err) {
      console.error('Live‑logging failed:', err);
    }
});

/**
 * Ensure student channels exist whenever a student comes online.
 */
client.on('presenceUpdate', async (oldPresence, newPresence) => {
  try {
    // Only trigger when coming online from offline
    if ((!oldPresence || oldPresence.status === 'offline') && newPresence.status === 'online') {
      const member = newPresence.member;
      // Only for students
      if (member.roles.cache.some(role => role.name.toLowerCase() === 'students')) {
        // Re-create or ensure the student-queues channel and student-docs channel
        await ensureStudentQueueChannel(newPresence.guild);
        await updateDocumentationMessage(newPresence.guild, 'student-docs', STUDENT_MESSAGE);
      }
    }
  } catch (err) {
    console.error('Error in presenceUpdate handler:', err);
  }
});


client.login(ACCESS_TOKEN_DISCORD);
