import admin from "firebase-admin";

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const { itemId } = req.body;

    if (!itemId) {
      return res.status(400).json({ message: "缺少 itemId" });
    }

    const docRef = db.collection("votes").doc(itemId);

    await db.runTransaction(async (transaction) => {
      // ✅ 先讀
      const doc = await transaction.get(docRef);

      let newCount = 1;

      if (doc.exists) {
        newCount = (doc.data().count || 0) + 1;
      }

      // ✅ 再寫（不能中間再讀）
      transaction.set(docRef, { count: newCount });
    });

    res.status(200).json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "投票失敗" });
  }
}
