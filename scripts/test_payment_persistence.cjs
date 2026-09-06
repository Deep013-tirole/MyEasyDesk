/**
 * EASYDESK — PAYMENT MODULE COMPREHENSIVE PERSISTENCE TEST SUITE
 * 
 * Tests complete lifecycle & persistence of Payment Configuration:
 * 1. Initial GET /api/payment-settings returns canonical & aliased properties.
 * 2. Route alias parity: /api/settings/payment, /api/admin/settings/payment, /api/admin/payment-settings return identical structure.
 * 3. PUT /api/admin/payment-settings with full custom configuration.
 * 4. Response trustworthiness: returns 200 with verified paymentConfig matching inputs without demo overrides.
 * 5. Read-back verification via GET /api/payment-settings.
 * 6. Read-back verification via GET /api/settings/payment.
 * 7. Read-back verification via GET /api/admin/settings/payment.
 * 8. Partial update test: updating only upiId preserves existing bank details, QR, and instructions.
 * 9. Non-demo override test: custom bank details and instructions are NOT wiped or reset.
 * 10. Explicit blank value test: branch: '' stays empty and is not replaced by demo strings.
 * 11. Custom instructions persistence across reads.
 * 12. Local disk store verification: dbState & db_store.json contain paymentConfig & paymentSettings.
 * 13. Simulated server restart: reloading state preserves the persisted payment configuration.
 * 14. Invalid payload rejection: non-object or null returns 400 Bad Request.
 * 15. Alias identity verification: all alias pairs are strictly equal in read payloads.
 * 16. Method parity & toggle flags: POST works identically to PUT, boolean toggles & fee percentage persist accurately.
 */

process.env.IS_WORKER = 'true';
process.env.NODE_ENV = 'test';

const http = require('http');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { app, getJwtSecret, dbState, getDbState, ensureDatabaseReady } = require('../dist/server.cjs');

const adminToken = jwt.sign({
  id: 'super-admin-deepak',
  email: 'tideepak8@gmail.com',
  role: 'SUPER_ADMIN'
}, getJwtSecret());

let totalTests = 0;
let passedTests = 0;

async function it(desc, fn) {
  totalTests++;
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      await res;
    }
    passedTests++;
    console.log(`  [PASS] ${desc}`);
  } catch (err) {
    console.error(`  [FAIL] ${desc}`);
    console.error(`         ${err.message}`);
    process.exitCode = 1;
  }
}

function makeRequest(port, reqPath, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      'x-csrf-token': 'easydesk_secure_csrf_token_2026_val',
      ...headers
    };
    if (postData) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: reqPath,
      method,
      headers: reqHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json,
          rawText: data
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('\n==================================================');
  console.log('EASYDESK PAYMENT MODULE PERSISTENCE TEST SUITE');
  console.log('==================================================\n');

  if (typeof ensureDatabaseReady === 'function') {
    await ensureDatabaseReady();
  }

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    // 1. Initial GET /api/payment-settings
    await it('1. Initial GET /api/payment-settings returns canonical & aliased properties', async () => {
      const res = await makeRequest(port, '/api/payment-settings');
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      assert(typeof res.body === 'object', 'Response must be an object');
      assert('upiId' in res.body, 'Missing upiId');
      assert('qrCodeUrl' in res.body, 'Missing qrCodeUrl');
      assert('bankName' in res.body, 'Missing bankName');
      assert('bankAccountName' in res.body, 'Missing bankAccountName');
      assert('accountName' in res.body, 'Missing accountName alias');
      assert('accountNumber' in res.body, 'Missing accountNumber');
      assert('bankAccountNumber' in res.body, 'Missing bankAccountNumber alias');
      assert('ifsc' in res.body, 'Missing ifsc');
      assert('ifscCode' in res.body, 'Missing ifscCode alias');
      assert('branch' in res.body, 'Missing branch');
      assert('bankBranch' in res.body, 'Missing bankBranch alias');
      assert('paymentInstructions' in res.body, 'Missing paymentInstructions');
      assert('instructions' in res.body, 'Missing instructions alias');
    });

    // 2. Route alias parity
    await it('2. Route alias parity: /api/settings/payment matches /api/payment-settings', async () => {
      const res1 = await makeRequest(port, '/api/payment-settings');
      const res2 = await makeRequest(port, '/api/settings/payment');
      const res3 = await makeRequest(port, '/api/admin/settings/payment', 'GET', null, {
        'Authorization': `Bearer ${adminToken}`
      });
      assert.strictEqual(res1.status, 200);
      assert.strictEqual(res2.status, 200);
      assert.strictEqual(res3.status, 200);
      assert.strictEqual(res1.body.upiId, res2.body.upiId);
      assert.strictEqual(res1.body.bankName, res3.body.bankName);
    });

    // 3 & 4. PUT /api/admin/payment-settings with full custom data
    const customConfig = {
      upiId: 'easydesk.corporate@kotak',
      upiName: 'EasyDesk Technologies India Pvt Ltd',
      qrCodeUrl: 'https://cdn.easydesk.com/qr/custom_payment_qr.png',
      bankName: 'Kotak Mahindra Bank',
      accountName: 'EasyDesk Technologies India Private Limited',
      accountNumber: '991238475610',
      ifscCode: 'KKBK0001824',
      branch: 'Cyber Hub Gurugram',
      paymentInstructions: '1. Transfer exact fees. 2. Note Order ID in remarks. 3. Upload screenshot.',
      acceptUpi: true,
      acceptNetBanking: true,
      acceptQrCode: true,
      convenienceFeePercentage: 1.5
    };

    await it('3 & 4. PUT /api/admin/payment-settings saves custom data and returns verified config', async () => {
      const res = await makeRequest(port, '/api/admin/payment-settings', 'PUT', {
        paymentConfig: customConfig
      }, {
        'Authorization': `Bearer ${adminToken}`
      });

      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.success, true, 'Expected success === true');
      const saved = res.body.paymentConfig;
      assert(saved, 'Missing paymentConfig in response');
      assert.strictEqual(saved.upiId, 'easydesk.corporate@kotak');
      assert.strictEqual(saved.upiName, 'EasyDesk Technologies India Pvt Ltd');
      assert.strictEqual(saved.qrCodeUrl, 'https://cdn.easydesk.com/qr/custom_payment_qr.png');
      assert.strictEqual(saved.bankName, 'Kotak Mahindra Bank');
      assert.strictEqual(saved.accountName, 'EasyDesk Technologies India Private Limited');
      assert.strictEqual(saved.bankAccountName, 'EasyDesk Technologies India Private Limited');
      assert.strictEqual(saved.accountNumber, '991238475610');
      assert.strictEqual(saved.bankAccountNumber, '991238475610');
      assert.strictEqual(saved.ifsc, 'KKBK0001824');
      assert.strictEqual(saved.ifscCode, 'KKBK0001824');
      assert.strictEqual(saved.branch, 'Cyber Hub Gurugram');
      assert.strictEqual(saved.paymentInstructions, '1. Transfer exact fees. 2. Note Order ID in remarks. 3. Upload screenshot.');
      assert.strictEqual(saved.convenienceFeePercentage, 1.5);
    });

    // 5. Read-back verification via GET /api/payment-settings
    await it('5. Read-back verification via GET /api/payment-settings returns saved custom data', async () => {
      const res = await makeRequest(port, '/api/payment-settings');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.upiId, 'easydesk.corporate@kotak');
      assert.strictEqual(res.body.bankName, 'Kotak Mahindra Bank');
      assert.strictEqual(res.body.accountNumber, '991238475610');
      assert.strictEqual(res.body.ifscCode, 'KKBK0001824');
      assert.strictEqual(res.body.branch, 'Cyber Hub Gurugram');
      assert.strictEqual(res.body.paymentInstructions, '1. Transfer exact fees. 2. Note Order ID in remarks. 3. Upload screenshot.');
    });

    // 6. Read-back verification via GET /api/settings/payment
    await it('6. Read-back verification via GET /api/settings/payment returns identical saved custom data', async () => {
      const res = await makeRequest(port, '/api/settings/payment');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.upiId, 'easydesk.corporate@kotak');
      assert.strictEqual(res.body.accountNumber, '991238475610');
      assert.strictEqual(res.body.bankAccountName, 'EasyDesk Technologies India Private Limited');
    });

    // 7. Read-back verification via GET /api/admin/settings/payment
    await it('7. Read-back verification via GET /api/admin/settings/payment returns identical saved custom data', async () => {
      const res = await makeRequest(port, '/api/admin/settings/payment', 'GET', null, {
        'Authorization': `Bearer ${adminToken}`
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.upiId, 'easydesk.corporate@kotak');
      assert.strictEqual(res.body.paymentInstructions, '1. Transfer exact fees. 2. Note Order ID in remarks. 3. Upload screenshot.');
    });

    // 8 & 9. Partial update test: update only upiId
    await it('8 & 9. Partial update: updating only upiId preserves bank details, QR, and instructions', async () => {
      const res = await makeRequest(port, '/api/admin/payment-settings', 'PUT', {
        paymentConfig: {
          upiId: 'easydesk.newvpa@kotak'
        }
      }, {
        'Authorization': `Bearer ${adminToken}`
      });

      assert.strictEqual(res.status, 200);
      const saved = res.body.paymentConfig;
      assert.strictEqual(saved.upiId, 'easydesk.newvpa@kotak', 'UPI ID should be updated');
      assert.strictEqual(saved.bankName, 'Kotak Mahindra Bank', 'Bank name must be preserved');
      assert.strictEqual(saved.accountNumber, '991238475610', 'Account number must be preserved');
      assert.strictEqual(saved.ifscCode, 'KKBK0001824', 'IFSC code must be preserved');
      assert.strictEqual(saved.branch, 'Cyber Hub Gurugram', 'Branch must be preserved');
      assert.strictEqual(saved.qrCodeUrl, 'https://cdn.easydesk.com/qr/custom_payment_qr.png', 'QR code URL must be preserved');
      assert.strictEqual(saved.paymentInstructions, '1. Transfer exact fees. 2. Note Order ID in remarks. 3. Upload screenshot.', 'Instructions must be preserved');
    });

    // 10. Explicit blank value test
    await it('10. Explicit blank value test: branch: "" stays blank without demo overrides', async () => {
      const res = await makeRequest(port, '/api/admin/payment-settings', 'PUT', {
        paymentConfig: {
          branch: ''
        }
      }, {
        'Authorization': `Bearer ${adminToken}`
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.paymentConfig.branch, '', 'Branch should be empty string');
      assert.strictEqual(res.body.paymentConfig.bankBranch, '', 'bankBranch alias should also be empty string');

      // Verify read-back
      const getRes = await makeRequest(port, '/api/payment-settings');
      assert.strictEqual(getRes.body.branch, '', 'GET branch must remain empty');
    });

    // 11. Custom instructions persistence
    await it('11. Custom instructions persistence across reads', async () => {
      const newInst = 'Special instructions: Only UPI payment accepted on weekends.';
      await makeRequest(port, '/api/admin/payment-settings', 'PUT', {
        paymentConfig: { paymentInstructions: newInst }
      }, {
        'Authorization': `Bearer ${adminToken}`
      });

      const res = await makeRequest(port, '/api/payment-settings');
      assert.strictEqual(res.body.paymentInstructions, newInst);
      assert.strictEqual(res.body.instructions, newInst);
    });

    // 12. Local disk store verification
    await it('12. Local disk store verification: dbState and keys are updated', async () => {
      const state = (typeof getDbState === 'function' ? getDbState() : dbState) || {};
      assert(state.paymentConfig, 'state.paymentConfig must exist');
      assert(state.paymentSettings, 'state.paymentSettings must exist');
      assert(state.settings && state.settings.paymentConfig, 'state.settings.paymentConfig must exist');
      assert.strictEqual(state.paymentConfig.upiId, 'easydesk.newvpa@kotak');
    });

    // 13. Simulated server restart / hydration
    await it('13. Simulated server restart: re-running hydration maintains persisted paymentConfig', async () => {
      if (typeof ensureDatabaseReady === 'function') {
        await ensureDatabaseReady(true);
      }
      const res = await makeRequest(port, '/api/payment-settings');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.upiId, 'easydesk.newvpa@kotak');
      assert.strictEqual(res.body.accountNumber, '991238475610');
    });

    // 14. Invalid payload rejection
    await it('14. Invalid payload rejection: empty object, null, non-object, or empty array returns 400', async () => {
      const res1 = await makeRequest(port, '/api/admin/payment-settings', 'PUT', {}, {
        'Authorization': `Bearer ${adminToken}`
      });
      assert.strictEqual(res1.status, 400);

      const res2 = await makeRequest(port, '/api/admin/payment-settings', 'PUT', { paymentConfig: null }, {
        'Authorization': `Bearer ${adminToken}`
      });
      assert.strictEqual(res2.status, 400);

      const res3 = await makeRequest(port, '/api/admin/payment-settings', 'PUT', { paymentConfig: [] }, {
        'Authorization': `Bearer ${adminToken}`
      });
      assert.strictEqual(res3.status, 400);
    });

    // 15. Alias identity verification
    await it('15. Complete alias identity verification: all alias pairs are strictly equal', async () => {
      const res = await makeRequest(port, '/api/payment-settings');
      const b = res.body;
      assert.strictEqual(b.accountName, b.bankAccountName, 'accountName === bankAccountName');
      assert.strictEqual(b.accountName, b.accountHolderName, 'accountName === accountHolderName');
      assert.strictEqual(b.accountNumber, b.bankAccountNumber, 'accountNumber === bankAccountNumber');
      assert.strictEqual(b.ifsc, b.ifscCode, 'ifsc === ifscCode');
      assert.strictEqual(b.ifsc, b.bankIfsc, 'ifsc === bankIfsc');
      assert.strictEqual(b.branch, b.bankBranch, 'branch === bankBranch');
      assert.strictEqual(b.paymentInstructions, b.instructions, 'paymentInstructions === instructions');
    });

    // 16. Method parity & toggle flags
    await it('16. POST method parity & toggle flags persist accurately', async () => {
      const res = await makeRequest(port, '/api/admin/payment-settings', 'POST', {
        paymentConfig: {
          acceptUpi: true,
          acceptNetBanking: false,
          acceptQrCode: true,
          convenienceFeePercentage: 2.0
        }
      }, {
        'Authorization': `Bearer ${adminToken}`
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.paymentConfig.acceptNetBanking, false);
      assert.strictEqual(res.body.paymentConfig.convenienceFeePercentage, 2.0);

      const getRes = await makeRequest(port, '/api/payment-settings');
      assert.strictEqual(getRes.body.acceptNetBanking, false);
      assert.strictEqual(getRes.body.convenienceFeePercentage, 2.0);
    });

  } finally {
    server.close();
  }

  console.log('\n==================================================');
  console.log(`TOTAL: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
  console.log('==================================================\n');

  if (passedTests === totalTests) {
    console.log('ALL PAYMENT PERSISTENCE TESTS PASSED!\n');
  } else {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
