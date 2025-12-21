// .github/scripts/push_ping.js
// Sends a test push to either a token or a topic.
// Env:
// - FIREBASE_SERVICE_ACCOUNT_JSON (required)
// - PING_TOKEN (optional) -> if set, send to token
// - PING_TOPIC (optional) -> send to topic if token empty
// - PING_TITLE, PING_BODY (optional)
// - APNS_TOPIC (optional) -> sets apns-topic header (bundle id)

const admin = require('firebase-admin');

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function safeStr(v) {
  return v == null ? '' : String(v);
}

function parseJsonOrThrow(label, text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`JSON parse failed (${label}): ${e?.message || e}`);
  }
}

async function main() {
  const saRaw = mustEnv('FIREBASE_SERVICE_ACCOUNT_JSON');
  const sa = parseJsonOrThrow('FIREBASE_SERVICE_ACCOUNT_JSON', saRaw);

  if (!sa.project_id || !sa.client_email || !sa.private_key) {
    throw new Error('Service account JSON missing required keys: project_id/client_email/private_key');
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }

  const token = (process.env.PING_TOKEN || '').trim();
  const topic = (process.env.PING_TOPIC || '').trim() || 'orders_mahfouz_market_geitawi';

  const title = (process.env.PING_TITLE || 'PING').trim();
  const body = (process.env.PING_BODY || 'Hello from GitHub Actions').trim();

  const apnsHeaders = {
    'apns-priority': '10',
    'apns-push-type': 'alert',
  };

  const apnsTopic = (process.env.APNS_TOPIC || '').trim();
  if (apnsTopic) apnsHeaders['apns-topic'] = apnsTopic;

  const message = {
    notification: { title, body },
    data: {
      kind: 'push_ping',
      title: safeStr(title),
      body: safeStr(body),
    },
    android: {
      priority: 'high',
      notification: { sound: 'default' },
    },
    apns: {
      headers: apnsHeaders,
      payload: {
        aps: {
          alert: { title, body },
          sound: 'default',
          badge: 1,
        },
      },
    },
  };

  let msgId;
  if (token) {
    msgId = await admin.messaging().send({ ...message, token });
    console.log(`✅ Push Ping sent to TOKEN (${token.slice(0, 12)}…) msgId=${msgId}`);
  } else {
    msgId = await admin.messaging().send({ ...message, topic });
    console.log(`✅ Push Ping sent to TOPIC=${topic} msgId=${msgId}`);
  }
}

main().catch((e) => {
  console.error('❌ PUSH PING FAILED:', e?.message || e);
  if (e?.errorInfo) console.error('errorInfo:', e.errorInfo);
  if (e?.code) console.error('code:', e.code);
  process.exit(1);
});
