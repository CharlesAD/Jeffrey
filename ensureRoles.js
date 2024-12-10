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
};