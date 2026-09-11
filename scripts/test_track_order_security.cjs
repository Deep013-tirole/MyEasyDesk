/**
 * EASYDESK — TRACK ORDER SECURITY VERIFICATION TEST SUITE
 *
 * Verifies strict Track Order security requirements:
 * 1. Order ID and Mobile Number BOTH are mandatory.
 * 2. Order ID alone NEVER returns any order details (400 Bad Request).
 * 3. Mobile number alone NEVER returns any order details (400 Bad Request).
 * 4. Both empty returns 400 Bad Request.
 * 5. Whitespace only returns 400 Bad Request.
 * 6. Correct Order ID + correct mobile -> 200 SUCCESS.
 * 7. Correct Order ID + wrong mobile -> 404 generic "Order details not found".
 * 8. Wrong Order ID + correct mobile -> 404 generic "Order details not found".
 * 9. Different customer's mobile + valid Order ID -> 404 generic message.
 * 10. Zero oracle leakage: Identical 404 status & body regardless of whether Order ID exists.
 * 11. Safe normalization (+91, spaces, hyphens, leading 0, Devanagari, Gujarati).
 * 12. Legacy/pre-seeded sequential Order IDs work only with matching mobile.
 * 13. Mobile number validation (<10 digits rejected with 400).
 * 14. Frontend code enforcement (TrackingView requires both before calling API).
 * 15. SEO / robots.txt isolation.
 */

process.env.IS_WORKER = 'true';
process.env.NODE_ENV = 'test';

const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert');
const { app } = require('../dist/server.cjs');

let totalTests = 0;
let passedTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${desc}`);
    console.error(`         ${err.message}`);
    process.exitCode = 1;
  }
}

async function itAsync(desc, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${desc}`);
    console.error(`         ${err.message}`);
    process.exitCode = 1;
  }
}

function makeRequest(port, reqPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: reqPath,
      method: 'GET'
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runSuite() {
  console.log('====================================================================');
  console.log(' EASYDESK — TRACK ORDER SECURITY VERIFICATION SUITE');
  console.log('====================================================================\n');

  // ------------------------------------------------------------------------
  // PART 1: STATIC CODE & CONFIGURATION AUDITS
  // ------------------------------------------------------------------------
  console.log('--- PART 1: Static Code & Configuration Audits ---');

  const trackingViewPath = path.resolve(__dirname, '../src/components/TrackingView.tsx');
  const trackingViewCode = fs.readFileSync(trackingViewPath, 'utf8');

  const serverPath = path.resolve(__dirname, '../server.ts');
  const serverCode = fs.readFileSync(serverPath, 'utf8');

  const robotsPath = path.resolve(__dirname, '../public/robots.txt');
  const robotsContent = fs.readFileSync(robotsPath, 'utf8');

  it('1.1 TrackingView requires both Order ID and Mobile before invoking API', () => {
    assert(trackingViewCode.includes('if (!cleanTargetId || !cleanTargetMobile)'), 'Must check both cleanTargetId and cleanTargetMobile');
    assert(trackingViewCode.includes('Both Order ID and registered mobile number are required'), 'Must show clear validation error');
  });

  it('1.2 TrackingView form input has Registered Mobile Number * label and is required', () => {
    assert(trackingViewCode.includes('Registered Mobile Number *'), 'Must label mobile as Registered Mobile Number *');
    assert(/<input[^>]*name="mobile"[^>]*required/.test(trackingViewCode), 'Mobile input must have HTML required attribute');
  });

  it('1.3 TrackingView initial load does NOT auto-call API if mobile is absent', () => {
    assert(trackingViewCode.includes('if (savedOrderId && savedMobile)'), 'Mount effect must only executeTrack if BOTH savedOrderId and savedMobile exist');
  });

  it('1.4 robots.txt disallows tracking query parameters to prevent SEO exposure', () => {
    assert(robotsContent.includes('Disallow: /*?*orderId='), 'robots.txt must disallow orderId query parameters');
    assert(robotsContent.includes('Disallow: /*?*mobile='), 'robots.txt must disallow mobile query parameters');
  });

  // ------------------------------------------------------------------------
  // PART 2: LIVE BACKEND API VERIFICATIONS
  // ------------------------------------------------------------------------
  console.log('\n--- PART 2: Live Backend Security API Verifications ---');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const testPort = server.address().port;

  try {
    const dbStore = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../db_store.json'), 'utf8'));
    const sampleOrder = (dbStore.orders || []).find(o => o && o.id && o.mobile && o.mobile.length >= 10);
    assert(sampleOrder, 'Must have at least one valid order in db_store.json');
    const validOrderId = sampleOrder.id;
    const validMobile = sampleOrder.mobile;

    // Find another order with a different mobile for cross-customer test
    const sampleOrder2 = (dbStore.orders || []).find(o => o && o.id && o.mobile && o.mobile.slice(-10) !== validMobile.slice(-10) && o.mobile.length >= 10);
    const otherCustomerMobile = sampleOrder2 ? sampleOrder2.mobile : '9811223344';

    const wrongMobile = '9999988888';
    const wrongOrderId = 'ORD-999999';

    // 2.1 Missing parameter tests (400 Bad Request)
    await itAsync('2.1 Order ID only -> DENIED (400 Bad Request: both required)', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?orderId=${validOrderId}`);
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.message, 'Both Order ID and registered mobile number are required to track an order.');
    });

    await itAsync('2.2 Mobile only -> DENIED (400 Bad Request: both required)', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?mobile=${validMobile}`);
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.message, 'Both Order ID and registered mobile number are required to track an order.');
    });

    await itAsync('2.3 Both empty -> DENIED (400 Bad Request: both required)', async () => {
      const res = await makeRequest(testPort, '/api/orders/track?orderId=&mobile=');
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.message, 'Both Order ID and registered mobile number are required to track an order.');
    });

    await itAsync('2.4 No query parameters at all -> DENIED (400 Bad Request: both required)', async () => {
      const res = await makeRequest(testPort, '/api/orders/track');
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.message, 'Both Order ID and registered mobile number are required to track an order.');
    });

    await itAsync('2.5 Whitespace-only parameters -> DENIED (400 Bad Request)', async () => {
      const res = await makeRequest(testPort, '/api/orders/track?orderId=%20%20&mobile=%20%20');
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.message, 'Both Order ID and registered mobile number are required to track an order.');
    });

    await itAsync('2.6 Mobile number with < 10 digits -> DENIED (400 Bad Request)', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?orderId=${validOrderId}&mobile=12345`);
      assert.strictEqual(res.status, 400);
      assert(res.body.message.includes('valid 10-digit'));
    });

    // 2.2 Matching & Non-matching tests
    await itAsync('2.7 Correct Order ID + correct mobile -> SUCCESS (200 OK with order details)', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?orderId=${validOrderId}&mobile=${validMobile}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, validOrderId);
      assert.strictEqual(res.body.serviceTitle, sampleOrder.serviceTitle);
    });

    await itAsync('2.8 Correct Order ID + wrong mobile -> DENIED (404 generic "Order details not found")', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?orderId=${validOrderId}&mobile=${wrongMobile}`);
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.message, 'Order details not found. Please verify your Order ID and registered mobile number.');
      assert.strictEqual(res.body.id, undefined, 'No order details must be returned');
      assert.strictEqual(res.body.name, undefined, 'No customer details must be returned');
    });

    await itAsync('2.9 Wrong Order ID + correct mobile -> DENIED (404 generic "Order details not found")', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?orderId=${wrongOrderId}&mobile=${validMobile}`);
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.message, 'Order details not found. Please verify your Order ID and registered mobile number.');
      assert.strictEqual(res.body.id, undefined);
    });

    await itAsync('2.10 Zero oracle leakage: Wrong ID and Wrong Mobile return identical generic 404 response', async () => {
      const res1 = await makeRequest(testPort, `/api/orders/track?orderId=${validOrderId}&mobile=${wrongMobile}`);
      const res2 = await makeRequest(testPort, `/api/orders/track?orderId=${wrongOrderId}&mobile=${validMobile}`);
      const res3 = await makeRequest(testPort, `/api/orders/track?orderId=${wrongOrderId}&mobile=${wrongMobile}`);
      
      assert.strictEqual(res1.status, 404);
      assert.strictEqual(res2.status, 404);
      assert.strictEqual(res3.status, 404);
      assert.strictEqual(res1.body.message, res2.body.message);
      assert.strictEqual(res2.body.message, res3.body.message);
    });

    // 2.3 Cross-customer authorization test
    await itAsync('2.11 Different customer\'s mobile + valid Order ID -> DENIED (404 generic message)', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?orderId=${validOrderId}&mobile=${otherCustomerMobile}`);
      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.message, 'Order details not found. Please verify your Order ID and registered mobile number.');
    });

    // 2.4 Mobile normalization variations
    const cleanValid10 = validMobile.replace(/\D/g, '').slice(-10);

    await itAsync('2.12 Mobile normalization: +91 with spaces succeeds', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?orderId=${validOrderId}&mobile=${encodeURIComponent('+91 ' + cleanValid10.slice(0, 5) + ' ' + cleanValid10.slice(5))}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, validOrderId);
    });

    await itAsync('2.13 Mobile normalization: Leading 0 (09876543210) succeeds', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?orderId=${validOrderId}&mobile=${encodeURIComponent('0' + cleanValid10)}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, validOrderId);
    });

    await itAsync('2.14 Mobile normalization: Hyphenated (98765-43210) succeeds', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?orderId=${validOrderId}&mobile=${encodeURIComponent(cleanValid10.slice(0, 5) + '-' + cleanValid10.slice(5))}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, validOrderId);
    });

    await itAsync('2.15 Mobile normalization: +91-98765-43210 succeeds', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?orderId=${validOrderId}&mobile=${encodeURIComponent('+91-' + cleanValid10.slice(0, 5) + '-' + cleanValid10.slice(5))}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, validOrderId);
    });

    await itAsync('2.16 Mobile normalization: Devanagari numerals (Hindi/Marathi) succeeds', async () => {
      const devanagariPhone = cleanValid10.replace(/\d/g, d => String.fromCharCode(d.charCodeAt(0) - 48 + 0x0966));
      const res = await makeRequest(testPort, `/api/orders/track?orderId=${validOrderId}&mobile=${encodeURIComponent(devanagariPhone)}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, validOrderId);
    });

    await itAsync('2.17 Mobile normalization: Gujarati numerals succeeds', async () => {
      const gujaratiPhone = cleanValid10.replace(/\d/g, d => String.fromCharCode(d.charCodeAt(0) - 48 + 0x0AE6));
      const res = await makeRequest(testPort, `/api/orders/track?orderId=${validOrderId}&mobile=${encodeURIComponent(gujaratiPhone)}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, validOrderId);
    });

    // 2.5 Multi-order test
    if (sampleOrder2) {
      await itAsync(`2.18 Order ${sampleOrder2.id} works with matching mobile`, async () => {
        const res = await makeRequest(testPort, `/api/orders/track?orderId=${sampleOrder2.id}&mobile=${sampleOrder2.mobile}`);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.id, sampleOrder2.id);
      });

      await itAsync(`2.19 Order ${sampleOrder2.id} fails with wrong mobile`, async () => {
        const res = await makeRequest(testPort, `/api/orders/track?orderId=${sampleOrder2.id}&mobile=${wrongMobile}`);
        assert.strictEqual(res.status, 404);
        assert.strictEqual(res.body.message, 'Order details not found. Please verify your Order ID and registered mobile number.');
      });
    }

    // 2.6 Order ID aliases work ONLY when matching mobile is supplied
    await itAsync('2.20 Parameter alias trackingId works with matching mobile', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?trackingId=${validOrderId}&mobile=${validMobile}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, validOrderId);
    });

    await itAsync('2.21 Parameter alias query works with matching mobile', async () => {
      const res = await makeRequest(testPort, `/api/orders/track?query=${validOrderId}&mobile=${validMobile}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, validOrderId);
    });

    await itAsync(`2.22 Leading hash #${validOrderId} works with matching mobile`, async () => {
      const res = await makeRequest(testPort, `/api/orders/track?orderId=%23${validOrderId}&mobile=${validMobile}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, validOrderId);
    });

    await itAsync(`2.23 Case-insensitive ${validOrderId.toLowerCase()} works with matching mobile`, async () => {
      const res = await makeRequest(testPort, `/api/orders/track?orderId=${validOrderId.toLowerCase()}&mobile=${validMobile}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, validOrderId);
    });

  } finally {
    server.close();
  }

  console.log('\n====================================================================');
  console.log(` SUMMARY: ${passedTests}/${totalTests} tests passed`);
  console.log('====================================================================');

  if (passedTests === totalTests) {
    console.log('ALL TRACK ORDER SECURITY TESTS PASSED SUCCESSFULLY!\n');
  } else {
    console.error(`SOME TESTS FAILED (${totalTests - passedTests} failures)!\n`);
    process.exitCode = 1;
  }
}

runSuite().catch(err => {
  console.error('Fatal error running suite:', err);
  process.exitCode = 1;
});
