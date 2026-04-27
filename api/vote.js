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
  res.setHeader("Access-Control-Allow-Origin", "https://2026ttmfshort.weebly.com");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const cookies = cookie.parse(req.headers.cookie || "");
    const session = cookies.market_vote_session;

    if (!session) {
      return res.status(401).json({ message: "請先登入 LINE" });
    }

    const user = verify(session);

    if (!user) {
      return res.status(401).json({ message: "登入已失效，請重新登入" });
    }

    const { candidateId } = req.body;

    if (!candidateId) {
      return res.status(400).json({ message: "缺少投票作品 ID" });
    }

    const userId = user.lineUserId;
    const today = new Date().toISOString().slice(0, 10);

    const userVoteRef = db.collection("dailyVotes").doc(`${userId}_${today}`);
    const candidateRef = db.collection("candidates").doc(candidateId);

    await db.runTransaction(async (transaction) => {
      const userVoteDoc = await transaction.get(userVoteRef);
      const currentCount = userVoteDoc.exists ? userVoteDoc.data().count || 0 : 0;

      if (currentCount >= 3) {
        throw new Error("LIMIT_REACHED");
      }

      transaction.set(
        userVoteRef,
        {
          userId,
          date: today,
          count: currentCount + 1,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );

      const candidateDoc = await transaction.get(candidateRef);
      const currentVotes = candidateDoc.exists ? candidateDoc.data().votes || 0 : 0;

      transaction.set(
        candidateRef,
        {
          candidateId,
          votes: currentVotes + 1,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
    });

    const afterDoc = await userVoteRef.get();
    const used = afterDoc.data().count || 0;

    return res.json({
      message: "投票成功",
      remaining: 3 - used
    });

  } catch (err) {
    if (err.message === "LIMIT_REACHED") {
      return res.status(429).json({
        message: "今日投票已達上限",
        remaining: 0
      });
    }

    console.error(err);
    return res.status(500).json({ message: "伺服器錯誤，請稍後再試" });
  }
}
