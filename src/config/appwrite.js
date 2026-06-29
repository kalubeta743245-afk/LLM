/**
 * Appwrite server-side SDK configuration.
 *
 * Uses the node-appwrite package to manage databases, users, and API keys
 * from the backend. All credentials come from environment variables.
 */
const { Client, Databases, Users, ID, Query, Permission, Role } = require('node-appwrite');

const optional = (name, fallback = '') => {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
};

const APPWRITE_ENDPOINT = optional('APPWRITE_ENDPOINT');
const APPWRITE_PROJECT_ID = optional('APPWRITE_PROJECT_ID');
const APPWRITE_API_KEY = optional('APPWRITE_API_KEY');

// Database & collection IDs (stable, deterministic)
const DATABASE_ID = optional('APPWRITE_DATABASE_ID', 'optimized-llm');
const API_KEYS_COLLECTION_ID = optional('APPWRITE_API_KEYS_COLLECTION', 'api_keys');
const INITIAL_CREDITS = Number(optional('INITIAL_CREDITS', '40'));

function isConfigured() {
  return !!(APPWRITE_ENDPOINT && APPWRITE_PROJECT_ID && APPWRITE_API_KEY);
}

function requireConfigured() {
  if (!isConfigured()) {
    throw new Error(
      'Appwrite is not configured. Set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, and APPWRITE_API_KEY.'
    );
  }
}

// Lazily create the client — only when first accessed
let _client = null;
let _databases = null;
let _users = null;

function ensureClient() {
  if (!_client) {
    requireConfigured();
    _client = new Client()
      .setEndpoint(APPWRITE_ENDPOINT)
      .setProject(APPWRITE_PROJECT_ID)
      .setKey(APPWRITE_API_KEY);
  }
  return _client;
}

function getDatabases() {
  if (!_databases) {
    _databases = new Databases(ensureClient());
  }
  return _databases;
}

function getUsers() {
  if (!_users) {
    _users = new Users(ensureClient());
  }
  return _users;
}

module.exports = {
  client: ensureClient,
  getDatabases,
  getUsers,
  isConfigured,
  requireConfigured,
  ID,
  Query,
  Permission,
  Role,
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
  APPWRITE_API_KEY,
  DATABASE_ID,
  API_KEYS_COLLECTION_ID,
  INITIAL_CREDITS,
};
