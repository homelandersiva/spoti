const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const routes = require('./routes');

const app = express();
const allowList = process.env.ZOHO_CORS_ORIGIN
  ? process.env.ZOHO_CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : [];

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowList.length === 0 || allowList.includes('*') || allowList.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/', routes);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const port = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Spotify playback controller listening on port ${port}`);
  });
}

module.exports = app;
