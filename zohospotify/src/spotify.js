const axios = require('axios');

const { getRefreshToken } = require('./tokenStore');

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const DEFAULT_TIMEOUT = 10000;

function buildAuthorizationHeader(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };
}

async function getAccessToken(userId) {
  const refreshToken = await getRefreshToken(userId);
  if (!refreshToken) {
    throw new Error('No refresh token stored for this user. Ask them to authenticate via /login.');
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });

  const basicAuth = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');

  try {
    const response = await axios.post(SPOTIFY_TOKEN_URL, params.toString(), {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: DEFAULT_TIMEOUT
    });

    if (!response.data?.access_token) {
      throw new Error('Spotify did not return an access token.');
    }

    return response.data.access_token;
  } catch (error) {
    const message = error.response?.data || error.message;
    throw new Error(`Failed to refresh Spotify access token: ${JSON.stringify(message)}`);
  }
}

async function spotifyRequest(userId, method, endpoint, body = null, extraHeaders = {}) {
  const accessToken = await getAccessToken(userId);
  const url = `${SPOTIFY_API_BASE}${endpoint}`;

  try {
    const response = await axios({
      method,
      url,
      data: body,
      headers: {
        ...buildAuthorizationHeader(accessToken),
        ...extraHeaders
      },
      timeout: DEFAULT_TIMEOUT,
      validateStatus: (status) => status >= 200 && status < 300
    });

    return response.data ?? {};
  } catch (error) {
    const status = error.response?.status;
    const responseBody = error.response?.data;
    const payload = {
      status,
      endpoint,
      message: responseBody || error.message
    };
    throw new Error(`Spotify API request failed: ${JSON.stringify(payload)}`);
  }
}

module.exports = {
  getAccessToken,
  spotifyRequest,
  buildAuthorizationHeader
};
