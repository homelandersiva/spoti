function authMiddleware(req, res, next) {
  const sharedSecret = process.env.BOT_SHARED_SECRET;
  if (!sharedSecret) {
    return next();
  }

  const providedSecret = req.headers['x-bot-secret'] || req.query.secret;
  if (providedSecret !== sharedSecret) {
    return res.status(401).json({ error: 'Unauthorized request. Provide a valid x-bot-secret header.' });
  }

  return next();
}

module.exports = authMiddleware;
