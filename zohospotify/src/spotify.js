const axios = require('axios');

const { getRefreshToken } = require('./tokenStore');

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const DEFAULT_TIMEOUT = 10000;

function buildAuthorizationHeader(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };
}

async function getAccessToken(userId) {
  console.log('🔐 TOKEN REFRESH DEBUGGING START');
  console.log('📍 User ID for token refresh:', userId);
  
  const refreshToken = await getRefreshToken(userId);
  if (!refreshToken) {
    console.error('❌ No refresh token found for user:', userId);
    throw new Error('No refresh token stored for this user. Ask them to authenticate via /login.');
  }
  
  console.log('✅ Refresh token found:', refreshToken.substring(0, 20) + '...');
  console.log('🔧 CLIENT_ID:', process.env.SPOTIFY_CLIENT_ID ? 'Set' : 'MISSING');
  console.log('🔧 CLIENT_SECRET:', process.env.SPOTIFY_CLIENT_SECRET ? 'Set' : 'MISSING');

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });

  const basicAuth = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');
  
  console.log('📡 Making token refresh request to Spotify...');

  try {
    const response = await axios.post(SPOTIFY_TOKEN_URL, params.toString(), {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: DEFAULT_TIMEOUT
    });
    
    console.log('✅ Token refresh response received');
    console.log('📊 Response status:', response.status);
    console.log('📊 Response data keys:', Object.keys(response.data || {}));

    if (!response.data?.access_token) {
      console.error('❌ No access token in response');
      throw new Error('Spotify did not return an access token.');
    }
    
    const accessToken = response.data.access_token;
    console.log('✅ Access token obtained:', accessToken.substring(0, 20) + '...');
    console.log('🔐 TOKEN REFRESH DEBUGGING END - SUCCESS');

    return accessToken;
  } catch (error) {
    console.error('❌ TOKEN REFRESH DEBUGGING END - ERROR');
    console.error('🔍 Token refresh error:', error.message);
    if (error.response) {
      console.error('🔍 Response status:', error.response.status);
      console.error('🔍 Response data:', error.response.data);
    }
    
    const message = error.response?.data || error.message;
    throw new Error(`Failed to refresh Spotify access token: ${JSON.stringify(message)}`);
  }
}

async function spotifyRequest(userId, method, endpoint, body = null, extraHeaders = {}) {
  console.log('📡 SPOTIFY API REQUEST DEBUGGING START');
  console.log('📍 User ID:', userId);
  console.log('📍 Method:', method.toUpperCase());
  console.log('📍 Endpoint:', endpoint);
  console.log('📍 Has body:', !!body);
  
  console.log('🔐 Getting access token...');
  const accessToken = await getAccessToken(userId);
  const url = `${SPOTIFY_API_BASE}${endpoint}`;
  
  console.log('📍 Full URL:', url);
  console.log('📍 Access token (first 20 chars):', accessToken.substring(0, 20) + '...');

  try {
    console.log('📡 Making Spotify API request...');
      const requestConfig = {
        method,
        url,
        headers: {
          ...buildAuthorizationHeader(accessToken),
          ...extraHeaders
        },
        timeout: DEFAULT_TIMEOUT,
        validateStatus: (status) => status >= 200 && status < 300
      };

      const hasBody = body !== null && body !== undefined;
      if (hasBody) {
        requestConfig.data = body;
      }

      const response = await axios(requestConfig);
    
    console.log('✅ Spotify API response received');
    console.log('📊 Response status:', response.status);
    console.log('📊 Response data type:', typeof response.data);
    console.log('📊 Response data keys:', Object.keys(response.data || {}));
    console.log('📡 SPOTIFY API REQUEST DEBUGGING END - SUCCESS');

    return response.data ?? {};
  } catch (error) {
    console.error('❌ SPOTIFY API REQUEST DEBUGGING END - ERROR');
    console.error('🔍 Request error:', error.message);
    
    if (error.response) {
      console.error('📊 Error response status:', error.response.status);
      console.error('📊 Error response headers:', error.response.headers);
      console.error('📊 Error response data type:', typeof error.response.data);
      console.error('📊 Error response data:', error.response.data);
    } else {
      console.error('🔍 No response object in error');
    }

    if (error.config) {
      const sanitizedHeaders = { ...(error.config.headers || {}) };
      if (sanitizedHeaders.Authorization) {
        sanitizedHeaders.Authorization = 'Bearer [REDACTED]';
      }
      console.error('🧪 Request config URL:', error.config.url);
      console.error('🧪 Request method:', error.config.method);
      console.error('🧪 Request headers (sanitized):', sanitizedHeaders);
      console.error('🧪 Request has body:', !!error.config.data);

      const rawHeader = error.response?.request?._header;
      if (rawHeader) {
        console.error(
          '🧪 Raw HTTP header (sanitized):',
          rawHeader.replace(/Authorization: Bearer .*/i, 'Authorization: Bearer [REDACTED]')
        );
      }
    }
    
    const status = error.response?.status;
    let responseBody = error.response?.data;
    if (typeof responseBody === 'string' && responseBody.includes('<html')) {
      responseBody = 'HTML error page received. Spotify likely rejected the request before JSON serialization (check tunnel/headers).';
    }
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
