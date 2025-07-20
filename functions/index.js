const functions = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');

admin.initializeApp();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const PIN = process.env.PIN || '1234';

function checkPin(req, res, next) {
  const pin = req.headers['x-pin'] || req.query.pin || (req.body && req.body.pin);
  if (pin === PIN) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}

app.post('/login', (req, res) => {
  const { pin } = req.body || {};
  if (pin === PIN) {
    return res.json({ token: 'ok' });
  }
  res.status(401).json({ error: 'Invalid PIN' });
});

app.get('/users/:id/points', checkPin, async (req, res) => {
  try {
    const doc = await admin.firestore().collection('users').doc(req.params.id).get();
    const points = doc.exists && doc.data().points ? doc.data().points : 0;
    res.json({ points });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/users/:id/history', checkPin, async (req, res) => {
  try {
    const snap = await admin
      .firestore()
      .collection('users')
      .doc(req.params.id)
      .collection('history')
      .get();
    const history = snap.docs.map((d) => d.data());
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/payments', checkPin, async (req, res) => {
  try {
    const { userId, amount } = req.body;
    await admin.firestore().collection('payments').add({
      userId,
      amount,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/admin/points', checkPin, async (req, res) => {
  try {
    const { userId, points } = req.body;
    await admin
      .firestore()
      .collection('users')
      .doc(userId)
      .set({ points: admin.firestore.FieldValue.increment(points) }, { merge: true });
    res.json({ status: 'points_added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

exports.api = functions.onRequest(app);
