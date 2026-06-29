const { getUsers } = require('../config/appwrite');
const logger = require('../utils/logger');

async function getUserCredits(userId) {
  const user = await getUsers().get(userId);
  return {
    credits: user.prefs.credits || 0,
    totalCredits: user.prefs.totalCredits || 0,
  };
}

async function setInitialCredits(userId) {
  await getUsers().updatePrefs(userId, { credits: 40, totalCredits: 40 });
  logger.info(`Set initial credits (40) for user ${userId}`);
}

async function deductCredits(userId, amount = 1) {
  const { credits, totalCredits } = await getUserCredits(userId);
  const newCredits = Math.max(0, credits - amount);
  await getUsers().updatePrefs(userId, { credits: newCredits, totalCredits });
  if (newCredits <= 0) {
    logger.warn(`User ${userId} has run out of credits`);
  }
  return { credits: newCredits, totalCredits };
}

module.exports = {
  getUserCredits,
  setInitialCredits,
  deductCredits,
};
