import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import cookie from "cookie";

let db;

function initFirebase() {
  if (!db) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

    const app = initializeApp({
      credential: cert(serviceAccount),
    });

    db = getFirestore(app);
  }
}

export default async function handler(req, res) {
  initFirebase();

  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const cookies = cookie.parse(req.headers.cookie || "");
  const session = cookies.market_vote_session;

  if (!session) {
    return res.status(401).json({ message: "未登入" });
  }

  const [data] = session.split(".");
  const user = JSON.parse(Buffer.from(data, "base64").toString());

  const { candidateId } = req.body;

  if (!candidateId) {
    return res.status(400).json({ message: "缺少 candidateId" });
  }

  const today = new Date().toISOString().slice(0, 10);
  const userVoteRef = db.collection("votes").doc(`${user.lineUserId}_${today}`);

  const doc = await userVoteRef.get();

  let count = 0;

  if (doc.exists) {
    count = doc.data().count || 0;
  }

  if (count >= 3) {
    return res.status(400).json({ message: "今日已達投票上限（3票）" });
  }

  // 更新投票次數
  await userVoteRef.set(
    {
      userId: user.lineUserId,
      date: today,
      count: count + 1,
    },
    { merge: true }
  );

  // 更新候選人票數
  const candidateRef = db.collection("candidates").doc(candidateId);

  await candidateRef.set(
    {
      votes: (doc.data()?.votes || 0) + 1,
    },
    { merge: true }
  );

  return res.json({
    message: "投票成功",
    remaining: 2 - count,
  });
}
