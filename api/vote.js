import admin from "firebase-admin";
import cookie from "cookie";
import crypto from "crypto";

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

function verify(session) {
  const [data, sig] = session.split(".");
  const check = crypto
    .createHmac("sha256", process.env.SESSION_SECRET)
    .update(data)
    .digest("base64url");

  if (check !== sig) return null;

  return JSON.parse(Buffer.from(data, "base64url").toString());
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_URL);
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const cookies = cookie.parse(req.headers.cookie || "");
    const session = cookies.market_vote_session;

    if (!session) {
      return res.status(401).json({ message: "未登入" });
    }

    const user = verify(session);

    if (!user) {
      return res.status(401).json({ message: "登入失效" });
    }

    const userId = user.lineUserId;
    const today = new Date().toISOString().slice(0, 10);

    const ref = db.collection("votes").doc(userId);
    const doc = await ref.get();

    let data = doc.exists ? doc.data() : {};

    if (!data[today]) {
      data[today] = 0;
    }

    if (data[today] >= 3) {
      return res.status(429).json({
        message: "今日已達上限",
        remaining: 0
      });
    }

    data[today] += 1;

    await ref.set(data);

    return res.json({
      message: "投票成功",
      remaining: 3 - data[today]
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "伺服器錯誤" });
  }
}
