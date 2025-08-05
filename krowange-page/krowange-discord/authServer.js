const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;

require('dotenv').config();

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

app.get('/auth/discord/meta', (req, res) => {
  res.json({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI
  });
});

app.get('/auth/discord/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send('No code provided');

  try {
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      scope: 'identify guilds'
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const accessToken = tokenResponse.data.access_token;

    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const user = userResponse.data;
    res.send(`Logged in as ${user.username}#${user.discriminator}`);
  } catch (err) {
    console.error(err);
    res.send('Error during Discord OAuth');
  }
});

app.listen(port, () => {
  console.log(`Auth server running on http://localhost:${port}`);
});
