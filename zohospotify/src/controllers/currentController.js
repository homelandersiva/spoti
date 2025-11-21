const { spotifyRequest } = require('../spotify');

async function getCurrent(req, res) {
  const { userId } = req.query;
  
  console.log('🔄 CURRENT PLAYBACK DEBUGGING START');
  console.log('📍 User ID:', userId);
  console.log('📍 Full query params:', req.query);
  
  if (!userId) {
    console.log('❌ No userId provided');
    return res.status(400).json({ error: 'userId query parameter is required.' });
  }

  try {
    console.log('📡 Step 1: Making request to /me/player...');
    const playerState = await spotifyRequest(userId, 'get', '/me/player');
    console.log('✅ Player state response received');
    console.log('📊 Player state keys:', Object.keys(playerState || {}));
    
    if (playerState) {
      console.log('📊 Player state summary:', {
        is_playing: playerState.is_playing,
        has_item: !!playerState.item,
        device: playerState.device?.name,
        progress_ms: playerState.progress_ms
      });
    }

    if (!playerState) {
      console.log('ℹ️  No player state - returning no active playback message');
      return res.json({
        is_playing: false,
        message: 'No active playback on this account.'
      });
    }

    console.log('📡 Step 2: Making parallel requests for queue and recently played...');
    const [queueResult, previousResult] = await Promise.allSettled([
      spotifyRequest(userId, 'get', '/me/player/queue'),
      spotifyRequest(userId, 'get', '/me/player/recently-played?limit=1')
    ]);
    
    console.log('📊 Queue request result:', queueResult.status);
    console.log('📊 Previous tracks request result:', previousResult.status);

    const queueData = queueResult.status === 'fulfilled' ? queueResult.value : null;
    const previousData = previousResult.status === 'fulfilled' ? previousResult.value : null;
    
    if (queueResult.status === 'rejected') {
      console.log('⚠️  Queue request failed:', queueResult.reason?.message);
    }
    if (previousResult.status === 'rejected') {
      console.log('⚠️  Previous tracks request failed:', previousResult.reason?.message);
    }

    console.log('📡 Step 3: Extracting track information...');
    const currentTrack = playerState.item;
    const nextTrackUri = queueData?.queue?.[0]?.uri || null;
    const previousTrackUri = previousData?.items?.[0]?.track?.uri || null;
    
    if (currentTrack) {
      console.log('🎵 Current track info:', {
        name: currentTrack.name,
        artist: currentTrack.artists?.[0]?.name,
        uri: currentTrack.uri,
        duration_ms: currentTrack.duration_ms
      });
    }
    
    console.log('📡 Step 4: Building response...');
    const responseData = {
      track_name: currentTrack?.name || null,
      artist: currentTrack?.artists?.map((artist) => artist.name).join(', ') || null,
      album_image: currentTrack?.album?.images?.[0]?.url || null,
      progress_ms: playerState?.progress_ms ?? 0,
      duration_ms: currentTrack?.duration_ms ?? 0,
      is_playing: playerState?.is_playing ?? false,
      next_track_uri: nextTrackUri,
      previous_track_uri: previousTrackUri
    };
    
    console.log('📊 Final response data:', responseData);
    console.log('🔄 CURRENT PLAYBACK DEBUGGING END - SUCCESS');

    return res.json(responseData);
  } catch (error) {
    console.error('❌ CURRENT PLAYBACK DEBUGGING END - ERROR');
    console.error('🔍 Error message:', error.message);
    console.error('🔍 Full error object:', error);
    
    res.status(502).json({ 
      error: 'Unable to fetch current playback.', 
      details: error.message,
      debug: {
        userId: userId,
        timestamp: new Date().toISOString(),
        endpoint: '/me/player'
      }
    });
  }
}

module.exports = {
  getCurrent
};
