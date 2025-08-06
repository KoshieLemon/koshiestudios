import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app    = express();
const port   = process.env.PORT || 3000;
const CLIENT_ID     = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI  = process.env.DISCORD_REDIRECT_URI;

app.use(cors());
app.use(express.json());

app.get('/auth/discord/meta', (req, res) => {
  console.log('[GET] /auth/discord/meta');
  res.json({ client_id: CLIENT_ID, redirect_uri: REDIRECT_URI });
});

app.get('/auth/discord/callback', async (req, res) => {
  console.log('[GET] /auth/discord/callback?code=' + req.query.code);
  const code = req.query.code;
  if (!code) return res.status(400).send('No code provided');

  try {
    const tokenRes = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        scope: 'identify guilds'
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const accessToken = tokenRes.data.access_token;
    console.log('→ got access_token');

    const userRes = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    console.log('→ fetched user:', userRes.data.username);
    res.send(`Logged in as ${userRes.data.username}#${userRes.data.discriminator}`);
  } catch (err) {
    console.error('OAuth error', err);
    res.status(500).send('Error during Discord OAuth');
  }
});

app.listen(port, () => {
  console.log(`Auth server listening on port ${port}`);
});