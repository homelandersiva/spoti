# Spotify Playback Controller Backend

Production-ready Node.js + Express backend that lets a Zoho Cliq bot control a user's Spotify playback via the Spotify Web API. Handles the full Authorization Code flow with refresh tokens, stores tokens securely, and exposes playback control endpoints that Zoho cards/buttons can call.

## ⚠️ **Important: Spotify Premium Required**

**Spotify Premium subscription is required** for playback control functionality (play, pause, next, previous, volume, seek, queue). This is a Spotify API limitation, not a limitation of this application.

### What Works Without Premium:

- ✅ User authentication and authorization
- ✅ Reading current playback state (`/spotify/current`)
- ✅ Accessing user's playlists and library
- ✅ Reading recently played tracks

### What Requires Premium:

- ❌ Play/pause controls
- ❌ Skip to next/previous track
- ❌ Volume control
- ❌ Seek within tracks
- ❌ Adding tracks to queue

## Features

- ✅ Spotify Authorization Code flow with refresh token persistence (JSON store)
- ✅ Shared-secret middleware (`x-bot-secret`) to protect bot endpoints
- ✅ Comprehensive playback controls: play, pause, next, previous, volume, seek, queue
- ✅ Current track endpoint with metadata for Zoho cards (title, artist, album art, play state)
- ✅ Axios-based Spotify helper with automatic token refresh and request timeouts
- ✅ CORS-ready for Zoho Cliq, JSON responses everywhere, and descriptive errors

## Tech Stack

- Node.js 18+
- Express 4
- Axios
- dotenv, cookie-parser, cors

## Getting Started

1. **Install dependencies**

   ```powershell
   npm install
   ```

2. **Configure environment** – copy `.env` and fill the blanks:

   ```ini
   SPOTIFY_CLIENT_ID=your-app-client-id
   SPOTIFY_CLIENT_SECRET=your-app-client-secret
   SPOTIFY_REDIRECT_URI=http://localhost:3000/callback
   BASE_URL=http://localhost:3000
   ZOHO_CORS_ORIGIN=https://cliq.zoho.com
   PORT=3000
   BOT_SHARED_SECRET=super-secure-shared-secret
   ```

3. **Run locally**

   ```powershell
   npm run dev
   ```

4. **Authorize Spotify** – open `http://localhost:3000/login`, grant access, and capture the `userId` shown on the success page. Use that `userId` in every Zoho request.

### Spotify Scopes Requested

```
user-read-playback-state
user-modify-playback-state
user-read-currently-playing
playlist-read-private
playlist-read-collaborative
user-read-recently-played
user-read-private
user-read-email
```

## Project Structure

```
/project-root
  ├── data/refreshTokens.json        # simple JSON token store (NEVER commit this file!)
  ├── src
  │   ├── app.js                     # Express bootstrap
  │   ├── routes.js                  # All HTTP routes
  │   ├── spotify.js                 # Spotify helper + token refresh
  │   ├── tokenStore.js              # In-memory/JSON storage helper
  │   ├── middleware/authMiddleware.js
  │   └── controllers
  │        ├── authController.js
  │        ├── playbackController.js
  │        └── currentController.js
  ├── postman_collection.json
  ├── README.md
  └── .env (local only)
```

## API Reference

> ⚠️ **Endpoints marked with 🔒 require Spotify Premium**

| Method | Endpoint                      | Body / Query                 | Description                                                                           |
| ------ | ----------------------------- | ---------------------------- | ------------------------------------------------------------------------------------- |
| GET    | `/health`                     | —                            | Health probe                                                                          |
| GET    | `/login`                      | —                            | Redirect to Spotify authorization screen                                              |
| GET    | `/callback`                   | `code`, `state`              | Spotify redirect handler, stores refresh token, returns HTML success page with userId |
| GET    | `/users`                      | —                            | Returns JSON list of all authorized userIds and last updated timestamps               |
| POST   | `/spotify/logout`             | `{ userId }`                 | Remove user's refresh token and revoke backend access _(Auth required)_               |
| POST   | `/spotify/play` 🔒            | `{ userId, trackUri }`       | Play a specific track URI _(Premium required)_                                        |
| POST   | `/spotify/pause` 🔒           | `{ userId }`                 | Pause playback _(Premium required)_                                                   |
| POST   | `/spotify/resume` 🔒          | `{ userId }`                 | Resume current track from last position _(Premium required)_                          |
| POST   | `/spotify/next` 🔒            | `{ userId }`                 | Next track _(Premium required)_                                                       |
| POST   | `/spotify/previous` 🔒        | `{ userId }`                 | Previous track _(Premium required)_                                                   |
| POST   | `/spotify/volume` 🔒          | `{ userId, volume_percent }` | Set device volume 0-100 _(Premium required)_                                          |
| POST   | `/spotify/seek` 🔒            | `{ userId, position_ms }`    | Seek within the current track _(Premium required)_                                    |
| POST   | `/spotify/queue` 🔒           | `{ userId, trackUri }`       | Add a track to the queue _(Premium required)_                                         |
| GET    | `/spotify/current?userId=XYZ` | `userId` query               | Return current playback metadata _(Works with free accounts)_                         |
| GET    | `/spotify/devices?userId=XYZ` | `userId` query               | Get user's available Spotify devices _(Works with free accounts)_                     |
| GET    | `/spotify/me?userId=XYZ` 🔒   | `userId` query               | Get Spotify user profile (userId, displayName, email, country, product)               |

> ⚠️ Include the `x-bot-secret: <BOT_SHARED_SECRET>` header for every `/spotify/*` route when `BOT_SHARED_SECRET` is configured.

## Sample cURL Requests

Replace `USER_ID`, `TRACK_URI`, `BOT_SECRET`, and base URL as needed.

```bash
# 1. Trigger Spotify login (opens auth page)
curl -L http://localhost:3000/login

# 2. Play a track
curl -X POST http://localhost:3000/spotify/play \
  -H "Content-Type: application/json" \
  -H "x-bot-secret: BOT_SECRET" \
  -d '{"userId":"USER_ID","trackUri":"spotify:track:4cOdK2wGLETKBW3PvgPWqT"}'

# 3. Pause playback
curl -X POST http://localhost:3000/spotify/pause \
  -H "Content-Type: application/json" \
  -H "x-bot-secret: BOT_SECRET" \
  -d '{"userId":"USER_ID"}'

# 4. Resume playback
curl -X POST http://localhost:3000/spotify/resume \
  -H "Content-Type: application/json" \
  -H "x-bot-secret: BOT_SECRET" \
  -d '{"userId":"USER_ID"}'

# 5. Next track
curl -X POST http://localhost:3000/spotify/next \
  -H "Content-Type: application/json" \
  -H "x-bot-secret: BOT_SECRET" \
  -d '{"userId":"USER_ID"}'

# 6. Previous track
curl -X POST http://localhost:3000/spotify/previous \
  -H "Content-Type: application/json" \
  -H "x-bot-secret: BOT_SECRET" \
  -d '{"userId":"USER_ID"}'

# 7. Volume control
curl -X POST http://localhost:3000/spotify/volume \
  -H "Content-Type: application/json" \
  -H "x-bot-secret: BOT_SECRET" \
  -d '{"userId":"USER_ID","volume_percent":65}'

# 8. Seek position
curl -X POST http://localhost:3000/spotify/seek \
  -H "Content-Type: application/json" \
  -H "x-bot-secret: BOT_SECRET" \
  -d '{"userId":"USER_ID","position_ms":90000}'

# 9. Queue track
curl -X POST http://localhost:3000/spotify/queue \
  -H "Content-Type: application/json" \
  -H "x-bot-secret: BOT_SECRET" \
  -d '{"userId":"USER_ID","trackUri":"spotify:track:3n3Ppam7vgaVa1iaRUc9Lp"}'

# 10. Current track summary
curl "http://localhost:3000/spotify/current?userId=USER_ID" \
  -H "x-bot-secret: BOT_SECRET"

# 11. Get available devices
curl "http://localhost:3000/spotify/devices?userId=USER_ID" \
  -H "x-bot-secret: BOT_SECRET"

# 12. Get all authorized users (no auth required)
curl http://localhost:3000/users

# 13. Logout user (remove refresh token)
curl -X POST http://localhost:3000/spotify/logout \
  -H "Content-Type: application/json" \
  -H "x-bot-secret: BOT_SECRET" \
  -d '{"userId":"USER_ID"}'
```

## Postman Collection

Import `postman_collection.json` into Postman. It already defines:

- Base URL variable (`{{baseUrl}}`)
- Authorization (shared-secret header)
- Requests for every route with example payloads

## Zoho Cliq Button Examples

Use Zoho Cliq message cards to trigger the backend. Example “Next Track” button:

```json
{
  "label": "Skip",
  "type": "open.url",
  "data": {
    "web": "https://yourserver.com/spotify/next?userId=123"
  }
}
```

Minimal version requested:

```json
{
  "type": "open.url",
  "data": { "web": "https://yourserver.com/spotify/next?userId=123" }
}
```

A richer example with POST actions via CLIQ bot:

```json
{
  "type": "invoke.function",
  "name": "Play Track",
  "value": {
    "url": "https://yourserver.com/spotify/play",
    "method": "POST",
    "headers": {
      "x-bot-secret": "${BOT_SHARED_SECRET}",
      "Content-Type": "application/json"
    },
    "body": {
      "userId": "123",
      "trackUri": "spotify:track:4uLU6hMCjMI75M1A2tKUQC"
    }
  }
}
```

## Troubleshooting

### "Premium required" Error (403)

**Error message:** `Player command failed: Premium required`

**Solution:** This is expected behavior for Spotify Free accounts. Playback control endpoints require a Spotify Premium subscription. You have two options:

1. **Upgrade to Spotify Premium** to use full playback controls
2. **Use read-only features** available to free accounts:
   - Current track information (`/spotify/current`)
   - User playlists and library data
   - Recently played tracks

### "No active device found" Error

**Error message:** `No active device found` or `No active devices found`

**Solution:**

- Open Spotify on your phone, computer, or other device
- Start playing any song to activate the device
- The resume endpoint will now automatically detect and use available devices
- Use the `/spotify/devices` endpoint to check which devices are available

### "No previous playback context" Error

**Error message:** `No previous playback context found`

**Solution:**

- This happens when there's nothing to resume (no previous playback)
- Start playing a song first using the `/spotify/play` endpoint
- Then you can pause and resume it
- The resume function needs something to resume from

### How Resume Works

The enhanced resume endpoint:

1. **Gets current playback state** to identify the track that was playing
2. **Resumes the specific track** with the exact position where it was paused
3. **Handles device transfer** if no device is currently active
4. **Returns track information** including name, artist, and resume position

**Example resume response:**

```json
{
  "status": "ok",
  "action": "resume",
  "track": {
    "name": "Song Title",
    "artist": "Artist Name",
    "uri": "spotify:track:1234567890",
    "position_ms": 45000
  }
}
```

### State Mismatch Error

**Error message:** `State mismatch. Please restart the login process.`

**Common causes:**

- Cookies are blocked or expired
- Browser security settings preventing cookie storage
- HTTP vs HTTPS configuration mismatch

**Solution:**

- Clear browser cookies for localhost
- Ensure consistent HTTP/HTTPS usage
- Check browser console for cookie-related errors

### "Illegal redirect_uri" Error

**Error message:** `Illegal redirect_uri`

**Solution:**

- Ensure `SPOTIFY_REDIRECT_URI` in `.env` matches exactly what's configured in your Spotify app settings
- Include the full URL including protocol (`http://` or `https://`)
- Verify no trailing slashes or extra characters

## Post-Deployment Checklist

- ✅ Update `.env` with production Spotify credentials
- ✅ Use HTTPS everywhere (required by Spotify)
- ✅ Set `BOT_SHARED_SECRET` for Zoho -> backend authentication
- ✅ Configure your public `BASE_URL` as the Spotify app redirect URI
- ✅ Persist `data/refreshTokens.json` (or plug in Redis/DB) in production
