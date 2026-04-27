export default function handler(req, res) {
  const clientId = process.env.LINE_CLIENT_ID;
  const redirectUri = process.env.LINE_REDIRECT_URI;

  const url = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=12345&scope=profile%20openid`;

  res.redirect(url);
}
