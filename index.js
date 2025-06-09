const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const dotenv = require('dotenv');
const open = require('open');
const { URLSearchParams } = require('url');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

// const storage = multer.diskStorage({
//   destination: 'uploads/',
//   filename: (req, file, cb) => {
//     const filename = `video-${Date.now()}.mp4`;
//     console.log('Saving file as:', filename);
//     cb(null, filename);
//   }
// });
const upload = multer({ destination: 'uploads/' });

dotenv.config();
const app = express();
const PORT = 3000;







// OAuth2 setup
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// Scopes for YouTube upload
const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];

let oauthTokens = null;

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/Index.html');
});

// Step 1: Get Google OAuth link
app.get('/auth', (req, res) => {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: SCOPES,
      });
  res.redirect(authUrl);
});

app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  console.log('OAuth Code:', code);

  try {
    // Manually exchange code for tokens
    const params = new URLSearchParams({
      code,
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      redirect_uri: process.env.REDIRECT_URI,
      grant_type: 'authorization_code'
    });

    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: params
    });
    const tokens = await r.json();

    if (tokens.error) throw tokens;

    console.log('Tokens:', tokens);
    oauthTokens = tokens;
    oauth2Client.setCredentials(tokens);
    res.send('YouTube authentication successful! You can now POST to /upload');
  } catch (err) {
    console.error('OAuth Error:', err);
    res.status(500).send('OAuth failed');
  }
});

// Step 3: Upload endpoint
app.post('/upload', upload.single('video'), async (req, res) => {
  if (!oauthTokens) {
    return res.status(401).send('Please authenticate first at /auth');
  }

  oauth2Client.setCredentials(oauthTokens);
  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

  const { title, description } = req.body;

  try {
    const response = await youtube.videos.insert({
      part: 'snippet,status',
      requestBody: {
        snippet: {
          title: title,
          description: description,
        },
        status: {
          privacyStatus: 'private',
        },
      },
      media: {
        body: fs.createReadStream(req.file.path),
      },
    });

    res.send(`Uploaded! Video ID: ${response.data.id}`);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).send('Upload failed');
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Go to http://localhost:${PORT}/auth to authenticate`);
});


// FACEBOOK ENDPOINT
app.post('/upload-facebook', upload.single('video'), async (req, res) => {

  const pageId = process.env.FB_PAGE_ID;
  const pageAccessToken = process.env.FB_PAGE_ACCESS_TOKEN;
  const { title, description } = req.body;
  const videoPath = req.file.path;
  console.log(pageAccessToken);

  try {

     

    
    const form = new FormData();
    form.set('title', title);
    form.set('description', description);
    form.set('source', fs.createReadStream(videoPath));
    form.set('published', 'true');
    form.set('access_token', pageAccessToken);
    form.submit('https://graph-video.facebook.com/v23.0/589279137611733/videos', (err, res) => {
      if (err) return console.error(err);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => console.log('Response:', data));
    });

    const data = await response.json();

    if (data.id) {
      res.send(`Facebook upload queued! Video ID: ${data.id}`);
    } else {
      console.error('Facebook Upload Error:', data);
      res.status(500).send(`Facebook upload failed: ${JSON.stringify(data)}`);
    }
  } catch (error) {
    console.error('Facebook Upload Error:', error.response?.data || error.message);
    res.status(500).send('Facebook upload failed');
  }
});
