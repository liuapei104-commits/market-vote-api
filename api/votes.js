import admin from "firebase-admin";

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://2026ttmfshort.weebly.com");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const snapshot = await db.collection("candidates").get();

    const votes = snapshot.docs.map(doc => ({
      videoId: doc.id,
      count: doc.data().votes || 0
    }));

    return res.status(200).json(votes);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "讀取票數失敗" });
  }
}
