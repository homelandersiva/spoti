const { spotifyRequest } = require('../spotify');

function requireUserId(userId, res) {
  if (!userId) {
    res.status(400).json({ error: 'userId is required in the request body.' });
    return false;
  }
  return true;
}

function handleSpotifyError(error, res, action) {
  // Check if it's a Premium required error
  if (error.message && error.message.includes('PREMIUM_REQUIRED')) {
    return res.status(403).json({
      error: `Unable to ${action}.`,
      details: error.message,
      solution: 'Spotify Premium subscription is required for playback controls. Please upgrade your Spotify account or use read-only endpoints like /spotify/current.'
    });
  }
  
  // Generic error handling
  res.status(502).json({ 
    error: `Unable to ${action}.`, 
    details: error.message 
  });
}

function successResponse(res, action, extra = {}) {
  return res.json({ status: 'ok', action, ...extra });
}

async function play(req, res) {
  const { userId, trackUri } = req.body;
  if (!requireUserId(userId, res)) return;
  if (!trackUri) {
    return res.status(400).json({ error: 'trackUri is required to start playback.' });
  }
  try {
    await spotifyRequest(userId, 'put', '/me/player/play', { uris: [trackUri] });
    successResponse(res, 'play', { trackUri });
  } catch (error) {
    handleSpotifyError(error, res, 'start playback');
  }
}

async function pause(req, res) {
  const { userId } = req.body;
  if (!requireUserId(userId, res)) return;
  try {
    await spotifyRequest(userId, 'put', '/me/player/pause');
    successResponse(res, 'pause');
  } catch (error) {
    handleSpotifyError(error, res, 'pause playback');
  }
}

async function next(req, res) {
  const { userId } = req.body;
  if (!requireUserId(userId, res)) return;
  try {
    await spotifyRequest(userId, 'post', '/me/player/next');
    successResponse(res, 'next');
  } catch (error) {
    handleSpotifyError(error, res, 'skip to the next track');
  }
}

async function previous(req, res) {
  const { userId } = req.body;
  if (!requireUserId(userId, res)) return;
  try {
    await spotifyRequest(userId, 'post', '/me/player/previous');
    successResponse(res, 'previous');
  } catch (error) {
    handleSpotifyError(error, res, 'go to the previous track');
  }
}

async function volume(req, res) {
  const { userId, volume_percent: volumePercent } = req.body;
  if (!requireUserId(userId, res)) return;
  if (typeof volumePercent !== 'number' || volumePercent < 0 || volumePercent > 100) {
    return res.status(400).json({ error: 'volume_percent must be a number between 0 and 100.' });
  }
  try {
    await spotifyRequest(userId, 'put', `/me/player/volume?volume_percent=${volumePercent}`);
    successResponse(res, 'volume', { volume_percent: volumePercent });
  } catch (error) {
    handleSpotifyError(error, res, 'set volume');
  }
}

async function seek(req, res) {
  const { userId, position_ms: positionMs } = req.body;
  if (!requireUserId(userId, res)) return;
  if (typeof positionMs !== 'number' || positionMs < 0) {
    return res.status(400).json({ error: 'position_ms must be a positive number.' });
  }
  try {
    await spotifyRequest(userId, 'put', `/me/player/seek?position_ms=${positionMs}`);
    successResponse(res, 'seek', { position_ms: positionMs });
  } catch (error) {
    handleSpotifyError(error, res, 'seek in the current track');
  }
}

async function queue(req, res) {
  const { userId, trackUri } = req.body;
  if (!requireUserId(userId, res)) return;
  if (!trackUri) {
    return res.status(400).json({ error: 'trackUri is required to queue a song.' });
  }
  try {
    await spotifyRequest(userId, 'post', `/me/player/queue?uri=${encodeURIComponent(trackUri)}`);
    successResponse(res, 'queue', { trackUri });
  } catch (error) {
    handleSpotifyError(error, res, 'add track to queue');
  }
}

async function resume(req, res) {
  const { userId } = req.body;
  if (!requireUserId(userId, res)) return;
  
  console.log('🔄 RESUME DEBUGGING START');
  console.log('📍 User ID:', userId);
  
  try {
    // Step 1: Get current playback state to find what to resume
    console.log('📡 Step 1: Getting current playback state...');
    let currentPlayback;
    
    try {
      currentPlayback = await spotifyRequest(userId, 'get', '/me/player');
      console.log('✅ Current playback response received');
      console.log('📊 Playback data:', JSON.stringify(currentPlayback, null, 2));
    } catch (playbackError) {
      console.error('❌ Failed to get current playback state');
      console.error('🔍 Playback error details:', playbackError.message);
      return res.status(400).json({
        error: 'Unable to resume playback.',
        details: 'Could not get current playback state: ' + playbackError.message,
        solution: 'Please ensure Spotify is open and playing/paused on a device.'
      });
    }

    // Step 2: Validate playback data
    console.log('📡 Step 2: Validating playback data...');
    
    if (!currentPlayback) {
      console.log('❌ No playback data received');
      return res.status(400).json({
        error: 'Unable to resume playback.',
        details: 'No current playback information available.',
        solution: 'Please start playing a song first, then try to resume.'
      });
    }

    if (!currentPlayback.item) {
      console.log('❌ No track item in playback data');
      console.log('📊 Available playback keys:', Object.keys(currentPlayback));
      return res.status(400).json({
        error: 'Unable to resume playback.',
        details: 'No track information found in current playback.',
        solution: 'Please start playing a song first, then try to resume.'
      });
    }

    // Step 3: Extract track information
    console.log('📡 Step 3: Extracting track information...');
    const currentTrack = currentPlayback.item;
    const progressMs = currentPlayback.progress_ms || 0;
    const isPlaying = currentPlayback.is_playing || false;
    
    console.log('🎵 Track details:');
    console.log('   - Name:', currentTrack.name);
    console.log('   - Artist:', currentTrack.artists[0]?.name);
    console.log('   - URI:', currentTrack.uri);
    console.log('   - Progress:', progressMs, 'ms (', Math.round(progressMs/1000), 's)');
    console.log('   - Is Playing:', isPlaying);
    
    if (isPlaying) {
      console.log('ℹ️  Track is already playing, no need to resume');
      return res.json({
        status: 'ok',
        action: 'resume',
        message: 'Track is already playing',
        track: {
          name: currentTrack.name,
          artist: currentTrack.artists[0]?.name,
          uri: currentTrack.uri,
          position_ms: progressMs,
          is_playing: true
        }
      });
    }

    // Step 4: Prepare resume payload
    console.log('📡 Step 4: Preparing resume payload...');
    const resumePayload = {
      uris: [currentTrack.uri],
      position_ms: progressMs
    };
    
    console.log('📦 Resume payload:', JSON.stringify(resumePayload, null, 2));
    
    // Step 5: Execute resume request
    console.log('📡 Step 5: Executing resume request...');
    try {
      await spotifyRequest(userId, 'put', '/me/player/play', resumePayload);
      console.log('✅ Resume request successful');
    } catch (resumeError) {
      console.error('❌ Resume request failed');
      console.error('🔍 Resume error details:', resumeError.message);
      throw resumeError; // Re-throw to be caught by main catch block
    }
    
    // Step 6: Return success response
    console.log('📡 Step 6: Returning success response...');
    const responseData = {
      status: 'ok',
      action: 'resume',
      track: {
        name: currentTrack.name,
        artist: currentTrack.artists[0]?.name,
        uri: currentTrack.uri,
        position_ms: progressMs,
        resumed_at: new Date().toISOString()
      }
    };
    
    console.log('📊 Final response:', JSON.stringify(responseData, null, 2));
    console.log('🔄 RESUME DEBUGGING END - SUCCESS');
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ RESUME DEBUGGING END - ERROR');
    console.error('🔍 Final error details:', error.message);
    console.error('🔍 Full error:', error);
    
    // Handle specific Spotify errors
    if (error.message && error.message.includes('NO_ACTIVE_DEVICE')) {
      return res.status(404).json({
        error: 'Unable to resume playback.',
        details: 'No active device found.',
        solution: 'Please open Spotify on a device and start playing something first.',
        debug: {
          userId: userId,
          errorType: 'NO_ACTIVE_DEVICE'
        }
      });
    }
    
    if (error.message && error.message.includes('PREMIUM_REQUIRED')) {
      return res.status(403).json({
        error: 'Unable to resume playback.',
        details: 'Spotify Premium subscription is required.',
        solution: 'Please upgrade to Spotify Premium to use playback controls.',
        debug: {
          userId: userId,
          errorType: 'PREMIUM_REQUIRED'
        }
      });
    }
    
    // Generic error response with debug info
    res.status(500).json({
      error: 'Unable to resume playback.',
      details: error.message,
      debug: {
        userId: userId,
        errorType: 'UNKNOWN',
        timestamp: new Date().toISOString()
      }
    });
  }
}

async function getDevices(req, res) {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required as a query parameter.' });
  }
  try {
    const response = await spotifyRequest(userId, 'get', '/me/player/devices');
    const devices = response.devices || [];
    res.json({
      devices: devices.map(device => ({
        id: device.id,
        name: device.name,
        type: device.type,
        is_active: device.is_active,
        is_private_session: device.is_private_session,
        is_restricted: device.is_restricted,
        volume_percent: device.volume_percent
      })),
      count: devices.length
    });
  } catch (error) {
    res.status(502).json({ 
      error: 'Unable to get devices.', 
      details: error.message 
    });
  }
}

module.exports = {
  play,
  pause,
  next,
  previous,
  volume,
  seek,
  queue,
  resume,
  getDevices
};
