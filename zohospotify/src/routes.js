const express = require("express");
const authController = require("./controllers/authController");
const playbackController = require("./controllers/playbackController");
const currentController = require("./controllers/currentController");
const botAuth = require("./middleware/authMiddleware");

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

router.get("/login", authController.login);
router.get("/callback", authController.callback);
router.get("/users", authController.getUserIds);

router.use("/spotify", botAuth);
router.post("/spotify/connect", authController.connect);
router.post("/spotify/play", playbackController.play);
router.post("/spotify/pause", playbackController.pause);
router.post("/spotify/resume", playbackController.resume);
router.post("/spotify/next", playbackController.next);
router.post("/spotify/previous", playbackController.previous);
router.post("/spotify/volume", playbackController.volume);
router.post("/spotify/seek", playbackController.seek);
router.post("/spotify/queue", playbackController.queue);
router.get("/spotify/current", currentController.getCurrent);
router.get("/spotify/devices", playbackController.getDevices);

module.exports = router;
