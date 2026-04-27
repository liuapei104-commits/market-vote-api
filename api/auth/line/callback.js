import crypto from "crypto";

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload) {
  const secret = process.env.SESSION_SECRET;
  const data = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export default async function handler(req, res) {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send("沒有收到 LINE code");
  }

  const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.LINE_REDIRECT_URI,
      client_id: process.env.LINE_CLIENT_ID,
      client_secret: process.env.LINE_CLIENT_SECRET
    })
  });

  const data = await tokenRes.json();

  if (!data.id_token) {
    return res.status(400).json({
      message: "LINE 登入失敗",
      data
    });
  }

  const payload = JSON.parse(
    Buffer.from(data.id_token.split(".")[1], "base64").toString()
  );

  const session = sign({
    lineUserId: payload.sub,
    name: payload.name || "",
    picture: payload.picture || "",
    loginAt: Date.now()
  });

  res.setHeader(
    "Set-Cookie",
    `market_vote_session=${session}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=604800`
  );

  res.redirect(process.env.FRONTEND_URL || "https://market-vote-api.vercel.app");
}
