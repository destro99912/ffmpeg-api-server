// index.js (fixed version)

const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.post('/merge', async (req, res) => {
  try {
    const inputVideos = req.body.input_videos;

    if (!inputVideos || !Array.isArray(inputVideos) || inputVideos.length === 0) {
      return res.status(400).json({ error: 'No input videos provided.' });
    }

    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    const downloadedFiles = [];

    for (const videoUrl of inputVideos) {
      const filename = `${uuidv4()}.mp4`;
      const filepath = path.join(tempDir, filename);
      const writer = fs.createWriteStream(filepath);

      const response = await axios({
        method: 'GET',
        url: videoUrl,
        responseType: 'stream'
      });

      await new Promise((resolve, reject) => {
        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      downloadedFiles.push(filepath);
    }

    const outputFilename = `merged_${Date.now()}.mp4`;
    const outputPath = path.join(tempDir, outputFilename);

    const ffmpegCommand = ffmpeg();
    downloadedFiles.forEach(file => ffmpegCommand.input(file));

    ffmpegCommand
      .on('error', (err) => {
        console.error('Error merging videos:', err);
        res.status(500).json({ error: 'Merging failed.' });
      })
      .on('end', () => {
        res.download(outputPath, () => {
          // Cleanup temp files
          downloadedFiles.forEach(file => fs.unlinkSync(file));
          fs.unlinkSync(outputPath);
        });
      })
      .mergeToFile(outputPath);

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/', (req, res) => {
  res.send('FFmpeg merge server is running!');
});

app.listen(port, () => {
  console.log(`FFmpeg API server listening on port ${port}`);
});