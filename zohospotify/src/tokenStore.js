const fs = require('fs/promises');
const path = require('path');

const STORE_PATH = path.join(__dirname, '..', 'data', 'refreshTokens.json');

async function ensureStoreFile() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch (error) {
    await fs.writeFile(STORE_PATH, '{}', 'utf-8');
  }
}

async function readStore() {
  await ensureStoreFile();
  const fileContents = await fs.readFile(STORE_PATH, 'utf-8');
  if (!fileContents.trim()) {
    return {};
  }
  try {
    return JSON.parse(fileContents);
  } catch (error) {
    console.error('Failed to parse token store JSON. Re-initializing file.');
    await fs.writeFile(STORE_PATH, '{}', 'utf-8');
    return {};
  }
}

async function writeStore(store) {
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

async function saveRefreshToken(userId, refreshToken) {
  if (!userId || !refreshToken) {
    throw new Error('userId and refreshToken are required to save tokens.');
  }
  const tokenStore = await readStore();
  tokenStore[userId] = {
    refreshToken,
    updatedAt: new Date().toISOString()
  };
  await writeStore(tokenStore);
}

async function getRefreshToken(userId) {
  if (!userId) {
    throw new Error('userId is required to fetch a refresh token.');
  }
  const tokenStore = await readStore();
  return tokenStore[userId]?.refreshToken || null;
}

async function removeRefreshToken(userId) {
  const tokenStore = await readStore();
  if (tokenStore[userId]) {
    delete tokenStore[userId];
    await writeStore(tokenStore);
  }
}

module.exports = {
  saveRefreshToken,
  getRefreshToken,
  removeRefreshToken
};
