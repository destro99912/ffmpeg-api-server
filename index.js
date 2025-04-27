// Required modules
const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Initialize app
const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(express.json());

// Merge videos endpoint
app.post('/merge', async (req, res) => {
  const { input_videos } = req.body;

  if (!input_videos || !Array.isArray(input_videos) || input_videos.length === 0) {
    return res.status(400).json({ error: 'input_videos must be a non-empty array' });
  }

  const tempDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  try {
    // Step 1: Download all videos locally
    const downloadedFiles = [];
    for (const url of input_videos) {
      const response = await axios({
        method: 'GET',
        url,
        responseType: 'stream'
      });
      const tempFileName = path.join(tempDir, uuidv4() + '.mp4');
      const writer = fs.createWriteStream(tempFileName);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      downloadedFiles.push(tempFileName);
    }

    // Step 2: Create file list for ffmpeg concat
    const fileListPath = path.join(tempDir, 'filelist.txt');
    fs.writeFileSync(fileListPath, downloadedFiles.map(file => `file '${file}'`).join('\n'));

    // Step 3: Merge videos
    const outputFile = path.join(tempDir, `merged_${Date.now()}.mp4`);
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(fileListPath)
        .inputOptions('-f concat', '-safe 0')
        .outputOptions('-c copy')
        .output(outputFile)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // Step 4: Send merged file
    res.download(outputFile, async () => {
      // Cleanup temp files after sending
      [...downloadedFiles, fileListPath, outputFile].forEach(file => {
        fs.unlink(file, (err) => {
          if (err) console.error('Failed to delete', file);
        });
      });
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to merge videos', details: error.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`FFmpeg API server listening on port ${port}`);
});
