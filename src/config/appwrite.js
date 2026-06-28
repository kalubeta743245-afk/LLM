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

const required = (name) => {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`[appwrite] Missing required environment variable: ${name}`);
  }
  return value.trim();
};

const APPWRITE_ENDPOINT = required('APPWRITE_ENDPOINT');
const APPWRITE_PROJECT_ID = required('APPWRITE_PROJECT_ID');
const APPWRITE_API_KEY = required('APPWRITE_API_KEY');

// Database & collection IDs (stable, deterministic)
const DATABASE_ID = optional('APPWRITE_DATABASE_ID', 'galaxy-llm');
const API_KEYS_COLLECTION_ID = optional('APPWRITE_API_KEYS_COLLECTION', 'api_keys');
const INITIAL_CREDITS = Number(optional('INITIAL_CREDITS', '40'));

// Create the Appwrite client
const client = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);
const users = new Users(client);

module.exports = {
  client,
  databases,
  users,
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
