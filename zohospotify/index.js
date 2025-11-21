require('dotenv').config({ quiet: true });

console.log('🔧 Dotenv loaded. CLIENT_ID:', process.env.SPOTIFY_CLIENT_ID ? '✓ Set' : '✗ UNDEFINED');
console.log('🔧 Redirect URI:', process.env.SPOTIFY_REDIRECT_URI ? '✓ Set' : '✗ UNDEFINED');

// Validate required environment variables before starting app
if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET || !process.env.SPOTIFY_REDIRECT_URI) {
    console.error('❌ Missing required Spotify environment variables. Please check your .env file.');
    console.error('Required variables: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI');
    process.exit(1);
}

const app = require('./src/app');

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Spotify playback controller listening on port ${port}`);
});
