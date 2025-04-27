const express = require('express');
const multer  = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const upload = multer({ dest: 'uploads/' });

app.use(express.json());

// Existing /convert endpoint
app.post('/convert', upload.fields([{ name: 'audio' }, { name: 'image' }]), (req, res) => {
  const audioPath = req.files['audio'][0].path;
  const imagePath = req.files['image'][0].path;
  const outputPath = `output_${Date.now()}.mp4`;

  ffmpeg()
    .input(imagePath)
    .loop(5)
    .input(audioPath)
    .outputOptions('-c:v libx264', '-c:a aac', '-shortest')
    .save(outputPath)
    .on('end', () => {
      res.download(outputPath, () => {
        fs.unlinkSync(audioPath);
        fs.unlinkSync(imagePath);
        fs.unlinkSync(outputPath);
      });
    })
    .on('error', err => {
      res.status(500).send('Conversion failed: ' + err.message);
    });
});

// New /merge endpoint
app.post('/merge', upload.array('videos', 10), (req, res) => {
  const videoPaths = req.files.map(file => file.path);
  const outputPath = `merged_${Date.now()}.mp4`;

  const fileListPath = `filelist_${Date.now()}.txt`;
  const fileListContent = videoPaths.map(path => `file '${path}'`).join('\n');
  fs.writeFileSync(fileListPath, fileListContent);

  ffmpeg()
    .input(fileListPath)
    .inputOptions('-f concat', '-safe 0')
    .outputOptions('-c copy')
    .save(outputPath)
    .on('end', () => {
      res.download(outputPath, () => {
        videoPaths.forEach(path => fs.unlinkSync(path));
        fs.unlinkSync(fileListPath);
        fs.unlinkSync(outputPath);
      });
    })
    .on('error', (err) => {
      res.status(500).send('Merging failed: ' + err.message);
    });
});

app.listen(port, () => {
  console.log(`FFmpeg API server listening on port ${port}`);
});