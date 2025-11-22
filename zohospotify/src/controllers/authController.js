const axios = require('axios');
const crypto = require('crypto');
const { saveRefreshToken, getRefreshToken } = require('../tokenStore');

const AUTH_STATE_COOKIE = 'spotify_auth_state';
const AUTH_SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-read-recently-played',
  'user-read-private',
  'user-read-email'
];

function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 20 * 60 * 1000,
    path: '/'
  };
}

function buildAuthorizeUrl(state) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SPOTIFY_CLIENT_ID,
    scope: AUTH_SCOPES.join(' '),
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    state
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function login(req, res) {
  const state = crypto.randomUUID();
  res.cookie(AUTH_STATE_COOKIE, state, getCookieOptions());
  res.redirect(buildAuthorizeUrl(state));
}

async function callback(req, res) {
  const { code, state } = req.query;
  const storedState = req.cookies[AUTH_STATE_COOKIE];

  if (!code || !state || state !== storedState) {
    return res.status(400).json({ error: "Invalid login session" });
  }

  res.clearCookie(AUTH_STATE_COOKIE, { path: "/" });

  try {
    const tokenResponse = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI
      }).toString(),
      {
        headers: {
          Authorization:
            'Basic ' + Buffer.from(
              `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
            ).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const { access_token: accessToken, refresh_token: refreshToken } = tokenResponse.data;

    const profile = await axios.get("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const userId = profile.data.id;

    // store refresh token in DB
    if (refreshToken) {
      await saveRefreshToken(userId, refreshToken);
    }

    const baseUrl = process.env.BASE_URL || "http://localhost:3000";

    return res.status(200).send(`
      <h2>Spotify Connected 🎧</h2>
      <p>You may now close this tab.</p>
      <p>User ID stored: <strong>${userId}</strong></p>
      <p>Bot ready to control your Spotify.</p>
      <p>Zoho will use: <code>${baseUrl}/spotify/play</code></p>
    `);

  } catch (err) {
    console.error("Spotify callback error:", err.response?.data || err);
    return res.status(500).json({ error: "OAuth failed", details: err.message });
  }
}

module.exports = { login, callback };
