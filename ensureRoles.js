const { PermissionsBitField, Colors } = require("discord.js");

module.exports = async function ensureRolesForGuild(guild) {
  console.log(`Ensuring roles for guild: ${guild.name}`);

  // Check Staff role
  let staffRole = guild.roles.cache.find(role => role.name === "Staff");
  if (!staffRole) {
    try {
      staffRole = await guild.roles.create({
        name: "Staff",
        color: Colors.Red,
        permissions: [PermissionsBitField.Flags.Administrator],
        reason: "Creating Staff role with admin permissions.",
      });
      console.log("Staff role created successfully.");
    } catch (error) {
      console.error("Failed to create Staff role:", error);
    }
  } else {
    console.log("Staff role already exists.");
  }

  // Check Student role
  let studentRole = guild.roles.cache.find(role => role.name === "Student");
  if (!studentRole) {
    try {
      studentRole = await guild.roles.create({
        name: "Student",
        color: Colors.Blue,
        reason: "Creating Student role.",
      });
      console.log("Student role created successfully.");
    } catch (error) {
      console.error("Failed to create Student role:", error);
    }
  } else {
    console.log("Student role already exists.");
  }

  // Assign Student role to any unassigned users (excluding bots)
  try {
    // Fetch all members of the guild
    const members = await guild.members.fetch();
    members.forEach(async member => {
      // Skip bots
      if (member.user.bot) return;

      // If the member doesn't have either the Student or Staff role, assign Student
      if (!member.roles.cache.has(studentRole.id) && !member.roles.cache.has(staffRole.id)) {
        try {
          await member.roles.add(studentRole);
          console.log(`Assigned Student role to ${member.user.tag}`);
        } catch (error) {
          console.error(`Failed to assign Student role to ${member.user.tag}:`, error);
        }
      }
    });
  } catch (error) {
    console.error("Error fetching guild members:", error);
  }
};