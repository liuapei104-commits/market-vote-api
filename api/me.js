import cookie from "cookie";
import crypto from "crypto";

function verify(session) {
  const [data, sig] = session.split(".");
  const check = crypto
    .createHmac("sha256", process.env.SESSION_SECRET)
    .update(data)
    .digest("base64url");

  if (check !== sig) return null;

  return JSON.parse(Buffer.from(data, "base64url").toString());
}

export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://2026ttmfshort.weebly.com");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  const cookies = cookie.parse(req.headers.cookie || "");
  const session = cookies.market_vote_session;

  if (!session) {
    return res.status(401).json({ loggedIn: false });
  }

  const user = verify(session);

  if (!user) {
    return res.status(401).json({ loggedIn: false });
  }

  return res.json({
    loggedIn: true,
    name: user.name || "",
    picture: user.picture || ""
  });
}
