/**
 * API Key service
 *
 * Manages API keys stored in Appwrite database. Each key tracks credits
 * and usage. New users get INITIAL_CREDITS on registration.
 */
const crypto = require('crypto');
const {
  databases,
  ID,
  Query,
  Permission,
  Role,
  DATABASE_ID,
  API_KEYS_COLLECTION_ID,
} = require('../config/appwrite');
const { setInitialCredits } = require('./credits');
const logger = require('../utils/logger');

/**
 * Generate a prefixed API key: gllm_<48-hex-chars>
 */
function generateApiKey() {
  const random = crypto.randomBytes(24).toString('hex');
  return `gllm_${random}`;
}

/**
 * Create the initial API key for a newly registered user.
 * Called after Appwrite account creation.
 */
async function createInitialApiKey(userId) {
  const key = generateApiKey();
  await setInitialCredits(userId);
  const doc = await databases.createDocument(
    DATABASE_ID,
    API_KEYS_COLLECTION_ID,
    ID.unique(),
    {
      userId,
      key,
      name: 'Default Key',
      credits: 0,
      totalCredits: 0,
      lastUsedAt: null,
      createdAt: new Date().toISOString(),
    },
    [
      Permission.read(Role.user(userId)),
      Permission.update(Role.user(userId)),
      Permission.delete(Role.user(userId)),
    ]
  );
  logger.info(`Created initial API key for user ${userId}`);
  return doc;
}

/**
 * List all API keys for a user.
 */
async function listApiKeys(userId) {
  const result = await databases.listDocuments(
    DATABASE_ID,
    API_KEYS_COLLECTION_ID,
    [Query.equal('userId', userId), Query.orderDesc('$createdAt')]
  );
  return result.documents;
}

/**
 * Create a new API key for an existing user.
 */
async function createApiKey(userId, name = 'New Key') {
  const key = generateApiKey();
  const doc = await databases.createDocument(
    DATABASE_ID,
    API_KEYS_COLLECTION_ID,
    ID.unique(),
    {
      userId,
      key,
      name,
      credits: 0,
      totalCredits: 0,
      lastUsedAt: null,
      createdAt: new Date().toISOString(),
    },
    [
      Permission.read(Role.user(userId)),
      Permission.update(Role.user(userId)),
      Permission.delete(Role.user(userId)),
    ]
  );
  logger.info(`Created new API key "${name}" for user ${userId}`);
  return doc;
}

/**
 * Delete an API key by document ID. Only if it belongs to the user.
 */
async function deleteApiKey(documentId, userId) {
  await databases.deleteDocument(DATABASE_ID, API_KEYS_COLLECTION_ID, documentId);
  logger.info(`Deleted API key ${documentId} for user ${userId}`);
}

/**
 * Validate an API key and return the document if valid.
 * Returns null if not found or expired (credits <= 0).
 */
async function validateApiKey(key) {
  const result = await databases.listDocuments(
    DATABASE_ID,
    API_KEYS_COLLECTION_ID,
    [Query.equal('key', key), Query.limit(1)]
  );
  if (result.documents.length === 0) return null;
  return result.documents[0];
}

/**
 * Decrement credits for an API key after a successful request.
 */
async function decrementCredits(documentId, amount = 1) {
  const doc = await databases.getDocument(
    DATABASE_ID,
    API_KEYS_COLLECTION_ID,
    documentId
  );
  const newCredits = Math.max(0, doc.credits - amount);
  const updated = await databases.updateDocument(
    DATABASE_ID,
    API_KEYS_COLLECTION_ID,
    documentId,
    {
      credits: newCredits,
      lastUsedAt: new Date().toISOString(),
    }
  );
  if (newCredits <= 0) {
    logger.warn(`API key ${documentId} has run out of credits`);
  }
  return updated;
}

/**
 * Add credits to an API key.
 */
async function addCredits(documentId, amount) {
  const doc = await databases.getDocument(
    DATABASE_ID,
    API_KEYS_COLLECTION_ID,
    documentId
  );
  const newCredits = doc.credits + amount;
  const newTotal = (doc.totalCredits || 0) + amount;
  return databases.updateDocument(
    DATABASE_ID,
    API_KEYS_COLLECTION_ID,
    documentId,
    { credits: newCredits, totalCredits: newTotal }
  );
}

module.exports = {
  generateApiKey,
  createInitialApiKey,
  listApiKeys,
  createApiKey,
  deleteApiKey,
  validateApiKey,
  decrementCredits,
  addCredits,
};
