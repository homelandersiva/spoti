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
  try {
    // First check if user has any available devices
    const devicesResponse = await spotifyRequest(userId, 'get', '/me/player/devices');
    const devices = devicesResponse.devices || [];
    
    if (devices.length === 0) {
      return res.status(400).json({
        error: 'Unable to resume playback.',
        details: 'No active devices found. Please open Spotify on a device first.',
        solution: 'Open Spotify on your phone, computer, or other device, then try again.'
      });
    }

    // Get current playback state to find what to resume
    let currentPlayback;
    try {
      currentPlayback = await spotifyRequest(userId, 'get', '/me/player');
    } catch (playbackError) {
      // If we can't get current playback, try simple resume
      console.log('⚠️ Could not get current playback state, trying simple resume');
    }

    // Check if there's an active device
    const activeDevice = devices.find(device => device.is_active);
    let targetDeviceId = activeDevice ? activeDevice.id : devices[0].id;
    
    // Prepare resume payload based on current playback state
    let resumePayload = {};
    
    if (currentPlayback && currentPlayback.item) {
      const currentTrack = currentPlayback.item;
      const progressMs = currentPlayback.progress_ms || 0;
      
      console.log(`🔄 Resuming track: ${currentTrack.name} by ${currentTrack.artists[0].name} at ${Math.round(progressMs/1000)}s`);
      
      // Resume with specific track and position
      resumePayload = {
        uris: [currentTrack.uri],
        position_ms: progressMs
      };
      
      if (!activeDevice) {
        // If no active device, specify device and start playback
        resumePayload.device_id = targetDeviceId;
      }
    } else {
      console.log('🔄 No current track found, attempting simple resume');
      // Fallback to simple resume without specific track
      if (!activeDevice) {
        // Transfer playback to first available device
        await spotifyRequest(userId, 'put', '/me/player', {
          device_ids: [targetDeviceId],
          play: true
        });
        return successResponse(res, 'resume', { 
          message: `Transferred playback to ${devices[0].name} and resumed`,
          device: devices[0].name 
        });
      }
    }

    // Execute the resume request
    if (!activeDevice && resumePayload.uris) {
      // Transfer and play specific track
      await spotifyRequest(userId, 'put', '/me/player', {
        device_ids: [targetDeviceId]
      });
      // Small delay to ensure device transfer completes
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    await spotifyRequest(userId, 'put', '/me/player/play', resumePayload);
    
    const responseData = { 
      action: 'resume',
      status: 'ok'
    };
    
    if (currentPlayback && currentPlayback.item) {
      responseData.track = {
        name: currentPlayback.item.name,
        artist: currentPlayback.item.artists[0].name,
        uri: currentPlayback.item.uri,
        position_ms: currentPlayback.progress_ms
      };
    }
    
    if (!activeDevice) {
      responseData.message = `Transferred playback to ${devices[0].name} and resumed`;
      responseData.device = devices[0].name;
    }
    
    res.json(responseData);
    
  } catch (error) {
    // Handle specific Spotify errors
    if (error.message && error.message.includes('NO_ACTIVE_DEVICE')) {
      return res.status(404).json({
        error: 'Unable to resume playback.',
        details: 'No active device found.',
        solution: 'Please open Spotify on a device and start playing something first.'
      });
    }
    
    if (error.message && error.message.includes('UNKNOWN')) {
      return res.status(400).json({
        error: 'Unable to resume playback.',
        details: 'No previous playback context found.',
        solution: 'Please start playing a song first, then you can pause and resume it.'
      });
    }
    
    handleSpotifyError(error, res, 'resume playback');
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
