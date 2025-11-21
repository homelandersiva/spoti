const { spotifyRequest } = require('../spotify');

async function getCurrent(req, res) {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: 'userId query parameter is required.' });
  }

  try {
    const playerState = await spotifyRequest(userId, 'get', '/me/player');

    if (!playerState) {
      return res.json({
        is_playing: false,
        message: 'No active playback on this account.'
      });
    }

    const [queueResult, previousResult] = await Promise.allSettled([
      spotifyRequest(userId, 'get', '/me/player/queue'),
      spotifyRequest(userId, 'get', '/me/player/recently-played?limit=1')
    ]);

    const queueData = queueResult.status === 'fulfilled' ? queueResult.value : null;
    const previousData = previousResult.status === 'fulfilled' ? previousResult.value : null;

    const currentTrack = playerState.item;
    const nextTrackUri = queueData?.queue?.[0]?.uri || null;
    const previousTrackUri = previousData?.items?.[0]?.track?.uri || null;

    return res.json({
      track_name: currentTrack?.name || null,
      artist: currentTrack?.artists?.map((artist) => artist.name).join(', ') || null,
      album_image: currentTrack?.album?.images?.[0]?.url || null,
      progress_ms: playerState?.progress_ms ?? 0,
      duration_ms: currentTrack?.duration_ms ?? 0,
      is_playing: playerState?.is_playing ?? false,
      next_track_uri: nextTrackUri,
      previous_track_uri: previousTrackUri
    });
  } catch (error) {
    res.status(502).json({ error: 'Unable to fetch current playback.', details: error.message });
  }
}

module.exports = {
  getCurrent
};
