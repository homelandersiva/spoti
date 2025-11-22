const axios = require("axios");
const crypto = require("crypto");

const { saveRefreshToken, getRefreshToken } = require("../tokenStore");

const AUTH_STATE_COOKIE = "spotify_auth_state";
const AUTH_SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-read-recently-played",
  "user-read-private",
  "user-read-email",
];

// Helper function for consistent cookie options
function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction, // Only use secure cookies in production (HTTPS)
    maxAge: 20 * 60 * 1000, // Increased to 20 minutes
    path: "/", // Explicit path
  };
}

function buildAuthorizeUrl(state) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SPOTIFY_CLIENT_ID,
    scope: AUTH_SCOPES.join(" "),
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    state,
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function login(req, res) {
  try {
    // Validate environment variables are loaded
    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_REDIRECT_URI) {
      console.error(
        "❌ Missing Spotify environment variables in auth controller"
      );
      return res.status(500).json({
        error: "Server configuration error: Missing Spotify credentials",
        debug: {
          clientId: process.env.SPOTIFY_CLIENT_ID ? "Set" : "UNDEFINED",
          redirectUri: process.env.SPOTIFY_REDIRECT_URI ? "Set" : "UNDEFINED",
        },
      });
    }

    console.log(
      "📍 Login called. CLIENT_ID:",
      process.env.SPOTIFY_CLIENT_ID ? "✓ Set" : "✗ UNDEFINED"
    );
    console.log(
      "📍 Login called. REDIRECT_URI:",
      process.env.SPOTIFY_REDIRECT_URI ? "✓ Set" : "✗ UNDEFINED"
    );

    const state = crypto.randomUUID();
    const cookieOptions = getCookieOptions();

    // Enhanced debug logging
    console.log("🍪 Setting auth state cookie:", {
      state: state.substring(0, 8) + "...", // Only log partial state for security
      options: cookieOptions,
      userAgent: req.get("User-Agent"),
    });

    res.cookie(AUTH_STATE_COOKIE, state, cookieOptions);

    const authUrl = buildAuthorizeUrl(state);
    console.log("🔗 Redirecting to Spotify OAuth...");

    res.redirect(authUrl);
  } catch (error) {
    console.error("❌ Login error:", error);
    res
      .status(500)
      .json({
        error: "Failed to create Spotify auth redirect.",
        details: error.message,
      });
  }
}

async function callback(req, res) {
  const { code, state } = req.query;
  const storedState = req.cookies[AUTH_STATE_COOKIE];

  // Enhanced debug logging
  console.log("🔄 OAuth callback received:", {
    hasCode: !!code,
    receivedState: state ? state.substring(0, 8) + "..." : "MISSING",
    storedState: storedState ? storedState.substring(0, 8) + "..." : "MISSING",
    cookieCount: Object.keys(req.cookies).length,
    allCookieNames: Object.keys(req.cookies),
    userAgent: req.get("User-Agent"),
    referer: req.get("Referer"),
  });

  if (!code) {
    console.log("❌ No authorization code received");
    return res.status(400).json({ error: "Missing authorization code." });
  }

  if (!state) {
    console.log("❌ No state parameter received from Spotify");
    return res.status(400).json({ error: "Missing state parameter." });
  }

  if (!storedState) {
    console.log("❌ No stored state found in cookies");
    return res.status(400).json({
      error: "No stored state found. Cookies may be blocked or expired.",
      debug: {
        cookiesReceived: Object.keys(req.cookies),
        expectedCookie: AUTH_STATE_COOKIE,
      },
    });
  }

  if (state !== storedState) {
    console.log("❌ State mismatch:", {
      received: state.substring(0, 8) + "...",
      stored: storedState.substring(0, 8) + "...",
      exactMatch: state === storedState,
    });
    return res
      .status(400)
      .json({ error: "State mismatch. Please restart the login process." });
  }

  console.log("✅ State validation passed");

  // Clear the cookie with same options used to set it
  res.clearCookie(AUTH_STATE_COOKIE, { path: "/" });

  try {
    console.log("🔄 Exchanging authorization code for tokens...");
    const tokenResponse = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
      }).toString(),
      {
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(
              `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
            ).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 10000,
      }
    );

    const { access_token: accessToken, refresh_token: refreshToken } =
      tokenResponse.data;

    const profileResponse = await axios.get("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10000,
    });

    const userId = profileResponse.data.id;

    if (refreshToken) {
      await saveRefreshToken(userId, refreshToken);
    } else {
      // fallback if Spotify omits refresh token (happens after first consent)
      const existingToken = await getRefreshToken(userId);
      if (!existingToken) {
        throw new Error(
          "Spotify did not return a refresh token. Ask the user to re-consent."
        );
      }
    }

    const baseUrl = process.env.BASE_URL || "http://localhost:3000";
    const successHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Spotify Auth Success</title>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 3rem auto; max-width: 640px; line-height: 1.6; color: #0f172a; }
      code { background: #f1f5f9; padding: 0.2rem 0.35rem; border-radius: 4px; }
      pre { background: #0f172a; color: #f8fafc; padding: 1rem; border-radius: 8px; overflow-x: auto; }
      .card { border: 1px solid #cbd5f5; padding: 2rem; border-radius: 12px; box-shadow: 0 20px 35px -25px rgba(15, 23, 42, 0.4); }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>You're all set ✅</h1>
      <p>Spotify has authorized this Zoho Cliq controller. You can close this window.</p>
      <p><strong>User ID:</strong> ${userId}</p>
      <pre>{\n  "accessToken": "${accessToken}",\n  "refreshToken": "${
      refreshToken || "stored previously"
    }"\n}</pre>
      <p>Next step: configure your Zoho Cliq bot to call <code>${baseUrl}/spotify/*</code> endpoints with <code>userId=${userId}</code>.</p>
    </div>
  </body>
</html>`;

    res.status(200).send(successHtml);
  } catch (error) {
    const status = error.response?.status || 500;
    const details = error.response?.data || error.message;
    res.status(status).json({ error: "Spotify callback failed.", details });
  }
}

async function getUserIds(req, res) {
  try {
    const fs = require("fs").promises;
    const path = require("path");
    const tokensPath = path.join(__dirname, "../../data/refreshTokens.json");

    const data = await fs.readFile(tokensPath, "utf-8");
    const tokens = JSON.parse(data);

    const users = Object.keys(tokens).map((userId) => ({
      userId,
      lastUpdated: tokens[userId].updatedAt,
    }));

    res.json({
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Error reading user IDs:", error.message);
    res
      .status(500)
      .json({ error: "Failed to retrieve user IDs.", details: error.message });
  }
}

module.exports = {
  login,
  callback,
  getUserIds,
};
