const express = require("express");
const { exec } = require("child_process");
const uuid = require("uuid");
const fs = require("fs");
const path = require("path");
const app = express();
const port = 3000;

// Configuration
const config = {
  hlsPath: "/var/www/hls",
  rtmpServer: "rtmp://your-vps-ip/live",
  baseUrl: "http://your-vps-ip/hls",
};

// Track active streams
const activeStreams = new Map();

// FFmpeg Presets
const ffmpegPresets = {
  "low-cpu": (source, streamKey) =>
    `ffmpeg -re -i "${source}" \
    -filter_complex \
    "[v:0]split=3[in1][in2][in3]; \
    [in1]scale=1920:1080[1080p]; \
    [in2]scale=1280:720[720p]; \
    [in3]scale=854:480[480p]" \
    -map "[1080p]" -c:v:0 libx264 -preset veryfast -b:v:0 4000k -maxrate 4000k -bufsize 8000k \
    -map "[720p]" -c:v:1 libx264 -preset veryfast -b:v:1 2500k -maxrate 2500k -bufsize 5000k \
    -map "[480p]" -c:v:2 libx264 -preset veryfast -b:v:2 1200k -maxrate 1200k -bufsize 2400k \
    -map 0:a -c:a aac -b:a 128k -ar 44100 \
    -f flv "${config.rtmpServer}/${streamKey}_1080p" \
    -f flv "${config.rtmpServer}/${streamKey}_720p" \
    -f flv "${config.rtmpServer}/${streamKey}_480p"`,

  "mid-cpu": (source, streamKey) =>
    `ffmpeg -re -i "${source}" \
    -filter_complex \
    "[v:0]split=3[in1][in2][in3]; \
    [in1]scale=1920:1080[1080p]; \
    [in2]scale=1280:720[720p]; \
    [in3]scale=854:480[480p]" \
    -map "[1080p]" -c:v:0 libx264 -preset medium -b:v:0 6000k -maxrate 6000k -bufsize 12000k \
    -map "[720p]" -c:v:1 libx264 -preset medium -b:v:1 3500k -maxrate 3500k -bufsize 7000k \
    -map "[480p]" -c:v:2 libx264 -preset medium -b:v:2 1800k -maxrate 1800k -bufsize 3600k \
    -map 0:a -c:a aac -b:a 192k -ar 48000 \
    -f flv "${config.rtmpServer}/${streamKey}_1080p" \
    -f flv "${config.rtmpServer}/${streamKey}_720p" \
    -f flv "${config.rtmpServer}/${streamKey}_480p"`,
};

// Start Stream
app.post("/start", express.json(), (req, res) => {
  try {
    const { sourceUrl, preset = "low-cpu" } = req.body;
    if (!sourceUrl) throw new Error("Missing sourceUrl");

    const streamId = uuid.v4();
    const hlsUrls = {
      "1080p": `${config.baseUrl}/${streamId}_1080p.m3u8`,
      "720p": `${config.baseUrl}/${streamId}_720p.m3u8`,
      "480p": `${config.baseUrl}/${streamId}_480p.m3u8`,
    };

    const ffmpegCmd = ffmpegPresets[preset](sourceUrl, streamId);
    const ffmpegProcess = exec(ffmpegCmd);

    ffmpegProcess.stderr.on("data", (data) => {
      console.error(`[${streamId}] FFmpeg Error: ${data}`);
    });

    ffmpegProcess.on("exit", (code) => {
      console.log(`[${streamId}] Exited with code ${code}`);
      activeStreams.delete(streamId);
      cleanupHlsFiles(streamId);
    });

    activeStreams.set(streamId, ffmpegProcess);

    res.json({
      stream_id: streamId,
      hls_urls: hlsUrls,
      preset: preset,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Stop Single Stream
app.post("/stop/:streamId", (req, res) => {
  const streamId = req.params.streamId;
  const process = activeStreams.get(streamId);

  if (!process) return res.status(404).json({ error: "Stream not found" });

  process.kill("SIGINT");
  res.json({ message: `Stopped stream ${streamId}` });
});

// Stop All Streams
app.post("/stop-all", (req, res) => {
  if (activeStreams.size === 0) {
    return res.json({ message: "No active streams" });
  }

  // Create array copy to safely iterate
  const streams = Array.from(activeStreams.entries());

  streams.forEach(([streamId, process]) => {
    process.kill("SIGINT");
    activeStreams.delete(streamId);
    cleanupHlsFiles(streamId);
  });

  res.json({
    message: `Stopped ${streams.length} streams`,
    stopped_streams: streams.map(([id]) => id),
  });
});

// Cleanup HLS Files
function cleanupHlsFiles(streamId) {
  try {
    const hlsDir = config.hlsPath;
    const files = fs.readdirSync(hlsDir);

    files.forEach((file) => {
      if (file.startsWith(streamId)) {
        fs.unlinkSync(path.join(hlsDir, file));
        console.log(`Deleted ${file}`);
      }
    });
  } catch (error) {
    console.error("Cleanup error:", error);
  }
}

app.listen(port, () => {
  console.log(`Streaming server running on port ${port}`);
});
