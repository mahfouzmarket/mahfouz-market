const admin = require('firebase-admin');

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function parseJson(label, raw) {
  try { return JSON.parse(raw); }
  catch (e) { throw new Error(`JSON parse failed (${label}): ${e?.message || e}`); }
}

async function main() {
  const expectedBrandId = 'mahfouz_market';
  const brandId = (process.env.BRAND_ID || expectedBrandId).trim();
  if (brandId !== expectedBrandId) {
    throw new Error(
      `Refusing cross-brand push ping: expected ${expectedBrandId}, got ${brandId || '<empty>'}`
    );
  }
  const PUSH_APP_TARGET = Object.freeze({
    iosBundleId: 'MAHFOUZ.MARKET.MM-APP',
    androidPackageName: 'com.mahfouzmarket.mahfouz_market',
  });
  const brandAnchorTopic = `broadcast_${expectedBrandId}`;

  const saRaw = mustEnv('FIREBASE_SERVICE_ACCOUNT_JSON');
  const sa = parseJson('FIREBASE_SERVICE_ACCOUNT_JSON', saRaw);

  // ✅ Critical fix: normalize private_key newlines
  if (sa.private_key && typeof sa.private_key === 'string') {
    sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  }

  console.log('🔎 svc.project_id =', sa.project_id);
  console.log('🔎 svc.client_email =', sa.client_email);

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  }

  const token = (process.env.PING_TOKEN || '').trim();
  const topic = (process.env.PING_TOPIC || '').trim();

  const title = (process.env.PING_TITLE || 'PING').trim();
  const body  = (process.env.PING_BODY  || 'Hello').trim();

  const requestedApnsTopic = (process.env.APNS_TOPIC || '').trim();
  if (requestedApnsTopic && requestedApnsTopic !== PUSH_APP_TARGET.iosBundleId) {
    throw new Error(
      `Refusing cross-brand APNs topic: expected ${PUSH_APP_TARGET.iosBundleId}, got ${requestedApnsTopic}`
    );
  }
  const apnsHeaders = {
    'apns-priority': '10',
    'apns-push-type': 'alert',
    'apns-topic': PUSH_APP_TARGET.iosBundleId,
  };

  const msg = {
    notification: { title, body },
    data: { kind: 'push_ping' },
    android: {
      priority: 'high',
      restrictedPackageName: PUSH_APP_TARGET.androidPackageName,
    },
    apns: { headers: apnsHeaders },
  };

  if (token) {
    throw new Error(
      'Direct-token push ping is disabled because token app identity cannot be proven in the shared Firebase project.'
    );
  }
  if (!topic) throw new Error('Provide PING_TOPIC');
  const brandCondition =
    `'${topic}' in topics && '${brandAnchorTopic}' in topics`;
  const id = await admin.messaging().send({ ...msg, condition: brandCondition });
  console.log(
    `✅ sent TOPIC=${topic} anchor=${brandAnchorTopic} msgId=${id}`
  );
}

main().catch((e) => {
  console.error('❌ PUSH PING FAILED:', e?.message || e);
  if (e?.errorInfo) console.error('errorInfo:', e.errorInfo);
  if (e?.code) console.error('code:', e.code);
  process.exit(1);
});
