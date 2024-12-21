const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Display help documentation for staff or students')
        .addStringOption(option =>
            option
                .setName('type')
                .setDescription('Type of user')
                .setRequired(true)
                .addChoices(
                    { name: 'Staff', value: 'staff' },
                    { name: 'Student', value: 'student' }
                )),
    async execute(interaction) {
        const userType = interaction.options.getString('type');

        if (userType === 'staff') {
            const staffEmbed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle('Jeffrey Bot Help - Staff')
                .setDescription('Here are the commands you can use as a staff member:')
                .addFields(
                    { name: '/createevent', value: 'Create a new event for the server.' },
                    { name: '/manageusers', value: 'Manage user permissions and roles.' },
                    { name: '/staffstats', value: 'View staff-specific statistics.' }
                )
                .setFooter({ text: 'For further assistance, contact the server admin.' });

            return interaction.reply({ embeds: [staffEmbed], ephemeral: true });
        } else if (userType === 'student') {
            const studentEmbed = new EmbedBuilder()
                .setColor(0x00ff99)
                .setTitle('Jeffrey Bot Help - Students')
                .setDescription('Here are the commands you can use as a student:')
                .addFields(
                    { name: '/viewevents', value: 'View upcoming events on the server.' },
                    { name: '/askquestion', value: 'Ask a question to staff or mentors.' },
                    { name: '/resources', value: 'Get helpful resources and links.' }
                )
                .setFooter({ text: 'For further assistance, contact a staff member.' });

            return interaction.reply({ embeds: [studentEmbed], ephemeral: true });
        } else {
            return interaction.reply({
                content: '❌ Invalid user type. Please choose either "staff" or "student".',
                ephemeral: true,
            });
        }
    },
};