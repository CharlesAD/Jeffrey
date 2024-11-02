// dmManager.js
const fs = require('fs');
const path = require('path');

const dataFilePath = path.join(__dirname, 'dmData.json');

// Load the DM data from the JSON file
let dmData = {};
if (fs.existsSync(dataFilePath)) {
  dmData = JSON.parse(fs.readFileSync(dataFilePath));
}

// Function to save dmData to file
function saveDMData() {
  fs.writeFileSync(dataFilePath, JSON.stringify(dmData));
}

// Function to update last activity time for a DM channel
function updateLastActivity(channelId) {
  if (!dmData[channelId]) {
    dmData[channelId] = {
      lastActivity: Date.now(),
      userMessageIds: [],  // To track user messages
      botMessageIds: [],   // To track bot messages
    };
  } else {
    dmData[channelId].lastActivity = Date.now();
  }
  saveDMData();
}

// Function to add a bot message ID to a DM channel
function addBotMessage(channelId, messageId) {
  if (!dmData[channelId]) {
    dmData[channelId] = {
      lastActivity: Date.now(),
      userMessageIds: [],  // To track user messages
      botMessageIds: [messageId],
       };   // To track bot messages    };
  } else {
    dmData[channelId].botMessageIds.push(messageId);
  }
  saveDMData();
}

// Function to add a user message ID to a DM channel
function addUserMessage(channelId, messageId) {
  if (!dmData[channelId]) {
    dmData[channelId] = {
      lastActivity: Date.now(),
      userMessageIds: [messageId],  // Initialize user message tracking
      botMessageIds: [],
    };
  } else {
    dmData[channelId].userMessageIds.push(messageId);  // Add the user message ID
  }
  saveDMData();
}

// Function to get DM channels
function getDMChannels() {
  return Object.keys(dmData);
}

// Function to get DM data for a channel
function getDMData(channelId) {
  return dmData[channelId];
}

// Function to delete DM data for a channel
function deleteDMData(channelId) {
  delete dmData[channelId];
  saveDMData();
  console.log(`Data for channel ${channelId} deleted`);
}

module.exports = {
  updateLastActivity,
  addBotMessage,
  getDMChannels,
  getDMData,
  deleteDMData,
};