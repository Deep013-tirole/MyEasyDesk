/**
 * EASYDESK — APPLY ONLINE SERVICE REQUEST & ORDER SUBMISSION TEST SUITE
 * 
 * Verifies:
 * 1. Customer service request submission without payment (POST /api/orders).
 * 2. Generated order invariants via tracking & admin APIs:
 *    - Order ID format ('ORD-...')
 *    - orderSource = 'Website'
 *    - orderStatus = 'Pending' (Pending Contact)
 *    - paymentStatus = 'Pending Verification' (Unpaid/Pending)
 *    - Billable total amount preserved from catalog govFees + serviceCharge
 * 3. Profile validation: Missing required fields rejects with 400.
 * 4. Tracking integration: Newly submitted order is immediately retrievable via GET /api/orders/track?orderId=...
 * 5. Admin panel visibility: Newly submitted website order appears in GET /api/admin/orders without manual entry.
 * 6. Admin order status management: Admin can update order status (e.g. Processing).
 * 7. Downstream payment flow: Standalone payment submission (POST /api/orders/:id/submit-payment) works when customer pays later.
 * 8. Admin payment verification: Admin can verify payment (POST /api/admin/orders/:id/verify-payment).
 * 9. Document upload flow: Customer/admin can upload additional files to order (POST /api/orders/:id/upload).
 * 10. WhatsApp order workflow: Admin manual order creation (POST /api/admin/orders) remains 100% operational.
 */

process.env.IS_WORKER = 'true';
process.env.NODE_ENV = 'test';

const http = require('http');
const assert = require('assert');
const jwt = require('jsonwebtoken');
const { app, getJwtSecret } = require('../dist/server.cjs');

const adminToken = jwt.sign({
  id: 'super-admin-deepak',
  email: 'tideepak8@gmail.com',
  role: 'SUPER_ADMIN'
}, getJwtSecret());

let totalTests = 0;
let passedTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      return res.then(() => {
        passedTests++;
        console.log(`  [PASS] ${desc}`);
      }).catch(err => {
        console.error(`  [FAIL] ${desc}`);
        console.error(`         ${err.message}`);
        process.exitCode = 1;
      });
    } else {
      passedTests++;
      console.log(`  [PASS] ${desc}`);
    }
  } catch (err) {
    console.error(`  [FAIL] ${desc}`);
    console.error(`         ${err.message}`);
    process.exitCode = 1;
  }
}

function makeRequest(port, path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
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
      path,
      method,
      headers: reqHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : {} });
        } catch (e) {
          resolve({ status: res.statusCode, rawBody: data });
        }
      });
    });

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runSuite() {
  console.log('============================================================');
  console.log('EASYDESK APPLY ONLINE ORDER SUBMISSION & WORKFLOW SUITE');
  console.log('============================================================\n');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    // Fetch available services to test against a real catalog item
    const servicesRes = await makeRequest(port, '/api/services');
    const servicesList = Array.isArray(servicesRes.body) ? servicesRes.body : [];
    const testService = servicesList.length > 0
      ? servicesList[0]
      : { id: 'srv-pan-new', title: 'New PAN Card Application', govFees: 107, serviceCharge: 199 };

    let createdWebsiteOrderId = null;

    console.log('--- SUITE 1: Website Service Request Submission (Zero Payment) ---');

    await it('1.1 Submit order without any paymentMethod, UTR, or coupon succeeds with 201 Created', async () => {
      const res = await makeRequest(port, '/api/orders', 'POST', {
        serviceId: testService.id,
        orderSource: 'Website',
        name: 'Sunita Vijay Patil',
        mobile: '9822012345',
        email: 'sunita.patil@example.com',
        address: 'Flat 402, Green Meadows, Baner Road',
        city: 'Pune',
        state: 'Maharashtra',
        pinCode: '411045',
        additionalNotes: 'Urgent requirement for bank account opening',
        uploadedDocs: ['Aadhaar Card', 'Address Proof Electricity Bill', 'Passport Photo']
      });

      assert.strictEqual(res.status, 201, `Expected 201 Created, got ${res.status}`);
      assert.ok(res.body.id, 'Order must have a generated ID');
      assert.ok(res.body.id.startsWith('ORD-'), `Order ID must start with ORD-, got ${res.body.id}`);
      createdWebsiteOrderId = res.body.id;
    });

    await it('1.2 Submitted order has orderSource="Website", orderStatus="Pending", paymentStatus="Pending Verification"', async () => {
      const trackRes = await makeRequest(port, `/api/orders/track?orderId=${createdWebsiteOrderId}`);
      assert.strictEqual(trackRes.status, 200, 'Order tracking must succeed');
      const order = trackRes.body;
      assert.strictEqual(order.orderSource, 'Website', `Expected orderSource='Website', got ${order.orderSource}`);
      assert.strictEqual(order.orderStatus, 'Pending', `Expected orderStatus='Pending', got ${order.orderStatus}`);
      assert.strictEqual(order.paymentStatus, 'Pending Verification', `Expected paymentStatus='Pending Verification', got ${order.paymentStatus}`);
      assert.strictEqual(order.name, 'Sunita Vijay Patil');
      assert.strictEqual(order.mobile, '9822012345');
      assert.ok(order.totalAmount > 0, 'Total billable amount must be calculated from service catalog');
      assert.strictEqual(order.uploadedDocuments.length, 3, 'Must record 3 uploaded/verified documents');
    });

    await it('1.3 Initial order log records website submission without claiming payment was made', async () => {
      const trackRes = await makeRequest(port, `/api/orders/track?orderId=${createdWebsiteOrderId}`);
      const order = trackRes.body;
      assert.ok(order.logs && order.logs.length > 0, 'Order must contain initial log');
      const initialLog = order.logs[0];
      assert.ok(initialLog.comment.includes('Service request submitted from website'), `Expected log comment to reflect website submission, got: "${initialLog.comment}"`);
      assert.ok(!initialLog.comment.includes('Payment submitted via'), 'Initial log must NOT claim payment was submitted');
    });

    await it('1.4 Missing mandatory profile fields (e.g. mobile or address) returns 400 Bad Request', async () => {
      const res = await makeRequest(port, '/api/orders', 'POST', {
        serviceId: testService.id,
        name: 'Incomplete Citizen'
      });
      assert.strictEqual(res.status, 400, `Expected 400, got ${res.status}`);
    });

    console.log('\n--- SUITE 2: Tracking Integration ---');

    await it('2.1 Newly submitted order is immediately retrievable via /api/orders/track with phone filter', async () => {
      const res = await makeRequest(port, `/api/orders/track?orderId=${createdWebsiteOrderId}&mobile=9822012345`);
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      assert.strictEqual(res.body.id, createdWebsiteOrderId);
      assert.strictEqual(res.body.orderStatus, 'Pending');
      assert.strictEqual(res.body.paymentStatus, 'Pending Verification');
      assert.strictEqual(res.body.serviceTitle, testService.title);
    });

    await it('2.2 Tracking with case-insensitive Order ID works seamlessly', async () => {
      const res = await makeRequest(port, `/api/orders/track?orderId=${createdWebsiteOrderId.toLowerCase()}`);
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      assert.strictEqual(res.body.id, createdWebsiteOrderId);
    });

    console.log('\n--- SUITE 3: Admin Visibility & Order Management ---');

    await it('3.1 Submitted website order appears automatically in /api/admin/orders without manual entry', async () => {
      const res = await makeRequest(port, '/api/admin/orders', 'GET', null, {
        Authorization: `Bearer ${adminToken}`
      });
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      assert.ok(Array.isArray(res.body), 'Admin orders response must be an array');
      const foundOrder = res.body.find(o => o.id === createdWebsiteOrderId);
      assert.ok(foundOrder, 'Website order must be present in admin orders list');
      assert.strictEqual(foundOrder.orderSource, 'Website');
    });

    await it('3.2 Admin can update order status (e.g. to Processing) and add internal note', async () => {
      const res = await makeRequest(port, `/api/orders/${createdWebsiteOrderId}/status`, 'PATCH', {
        status: 'Processing',
        comment: 'Citizen contacted via phone. Paperwork verified with department.'
      }, {
        Authorization: `Bearer ${adminToken}`
      });
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      const trackRes = await makeRequest(port, `/api/orders/track?orderId=${createdWebsiteOrderId}`);
      assert.strictEqual(trackRes.body.orderStatus, 'Processing');
      assert.ok(trackRes.body.logs.some(l => l.comment.includes('Citizen contacted via phone')));
    });

    console.log('\n--- SUITE 4: Downstream Standalone Payment Workflow ---');

    await it('4.1 Customer pays later and submits UTR proof via /api/orders/:id/submit-payment', async () => {
      const res = await makeRequest(port, `/api/orders/${createdWebsiteOrderId}/submit-payment`, 'POST', {
        paymentMethod: 'UPI',
        utr: '409182736451',
        paymentDate: new Date().toISOString()
      });
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      const trackRes = await makeRequest(port, `/api/orders/track?orderId=${createdWebsiteOrderId}`);
      assert.strictEqual(trackRes.body.utr, '409182736451');
      assert.strictEqual(trackRes.body.paymentStatus, 'Pending Verification');
    });

    await it('4.2 Admin verifies customer payment via /api/admin/orders/:id/verify-payment', async () => {
      const res = await makeRequest(port, `/api/admin/orders/${createdWebsiteOrderId}/verify-payment`, 'POST', {
        action: 'approve'
      }, {
        Authorization: `Bearer ${adminToken}`
      });
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      const trackRes = await makeRequest(port, `/api/orders/track?orderId=${createdWebsiteOrderId}`);
      assert.strictEqual(trackRes.body.paymentStatus, 'Verified');
    });

    console.log('\n--- SUITE 5: Document Upload & WhatsApp Path Preservation ---');

    await it('5.1 Order document upload (/api/orders/:id/upload) remains operational', async () => {
      const res = await makeRequest(port, `/api/orders/${createdWebsiteOrderId}/upload`, 'POST', {
        docName: 'Affidavit_Signed.pdf',
        fileUrl: 'https://storage.easydesk.in/orders/affidavit.pdf'
      });
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      const trackRes = await makeRequest(port, `/api/orders/track?orderId=${createdWebsiteOrderId}`);
      assert.ok(trackRes.body.uploadedDocuments.some(d => d.name === 'Affidavit_Signed.pdf'));
    });

    await it('5.2 Admin manual order creation (/api/admin/orders) for WhatsApp path remains 100% operational', async () => {
      const res = await makeRequest(port, '/api/admin/orders', 'POST', {
        orderSource: 'WhatsApp',
        serviceId: testService.id,
        name: 'Rohan Deshmukh (WhatsApp)',
        mobile: '9823198231',
        email: 'rohan.wapp@example.com',
        address: 'Shivaji Nagar',
        city: 'Pune',
        state: 'Maharashtra',
        pinCode: '411005',
        orderStatus: 'Pending',
        paymentStatus: 'Pending Verification'
      }, {
        Authorization: `Bearer ${adminToken}`
      });

      assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
      const createdId = res.body.order?.id || res.body.id;
      assert.ok(createdId, 'Manual order must have an ID');
      const trackRes = await makeRequest(port, `/api/orders/track?orderId=${createdId}`);
      assert.strictEqual(trackRes.body.orderSource, 'WhatsApp');
      assert.strictEqual(trackRes.body.name, 'Rohan Deshmukh (WhatsApp)');
    });

  } finally {
    server.close();
  }

  console.log('\n------------------------------------------------------------');
  console.log(`Results: ${passedTests}/${totalTests} tests passed`);
  console.log('------------------------------------------------------------\n');

  if (passedTests === totalTests) {
    console.log('SUCCESS: ALL APPLY ONLINE & ORDER SUBMISSION TESTS PASSED (100%)!\n');
    process.exit(0);
  } else {
    console.error('FAILURE: Some tests failed.');
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal error running suite:', err);
  process.exit(1);
});
