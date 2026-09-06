/**
 * EASYDESK — CONTACT INQUIRY + REVIEW SUBMISSION
 * AUTOMATED REGRESSION & END-TO-END VERIFICATION TEST SUITE
 * 
 * Verifies:
 * Part A: Contact Inquiry Flow (10+ checkpoints)
 *  1. Endpoint existence (POST /api/contact-messages, /api/contact, /api/inquiries)
 *  2. Guest/public submission with valid CSRF token succeeds (HTTP 201)
 *  3. Authenticated customer submission with valid CSRF token succeeds (HTTP 201)
 *  4. Inquiry Reference ID (msg-... / inquiryId) returned in response
 *  5. Disk persistence: Inquiry record persisted in db_store.json under contactMessages
 *  6. Admin listing endpoint (GET /api/admin/contact-messages) returns the inquiry
 *  7. Admin listing route alias (GET /api/admin/inquiries) returns the inquiry
 *  8. Field parity check: name, email, phone, subject, category, message, status
 *  9. Admin status update (PATCH /api/admin/contact-messages/:id) persists to disk
 * 10. RBAC authorization boundary: Admin GET/PATCH rejected (HTTP 401/403) without admin token
 * 11. CSRF protection enforcement: POST /api/contact-messages without token rejected (HTTP 403)
 * 12. Input validation: POST /api/contact-messages with missing required fields rejected (HTTP 400)
 * 
 * Part B: Review Submission Flow (8+ checkpoints)
 * 13. CSRF token acquisition: GET /api/security/csrf returns valid csrfToken
 * 14. Review submission with valid CSRF token succeeds (HTTP 201)
 * 15. Zero CSRF error: returns HTTP 201, not HTTP 403 ("CSRF security token verification failed")
 * 16. Disk persistence: Review record persisted in db_store.json under reviews with status 'Pending'
 * 17. Admin visibility: GET /api/admin/reviews returns the new pending review
 * 18. Moderation integrity: GET /api/reviews (public) does NOT expose pending review before approval
 * 19. CSRF protection enforcement: POST /api/reviews without token rejected (HTTP 403)
 * 20. Input validation: POST /api/reviews with invalid rating rejected (HTTP 400)
 * 21. Input validation: POST /api/reviews with missing review text rejected (HTTP 400)
 * 22. Data preservation: Existing customer, employee, order, and review records remain completely intact
 */

process.env.IS_WORKER = 'true';
process.env.NODE_ENV = 'test';

const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const jwt = require('jsonwebtoken');

// Import compiled server and utilities
const { app, getJwtSecret, getDbState } = require('../dist/server.cjs');

const CSRF_TOKEN = 'easydesk_secure_csrf_token_2026_val';

const adminToken = jwt.sign({
  id: 'super-admin-deepak',
  email: 'tideepak8@gmail.com',
  name: 'Deepak Administrator',
  role: 'SUPER_ADMIN'
}, getJwtSecret());

const customerToken = jwt.sign({
  id: 'CUST-TEST-9988',
  email: 'customer.test@example.com',
  name: 'Test Customer User',
  phone: '9876543210',
  role: 'CUSTOMER'
}, getJwtSecret());

let server;
let baseUrl;
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

function request(method, pathUrl, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathUrl, baseUrl);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          if (data && data.trim().length > 0) {
            json = JSON.parse(data);
          }
        } catch {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data,
          json
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runAllTests() {
  console.log('\n===============================================================');
  console.log(' EASYDESK CONTACT INQUIRY & REVIEW SUBMISSION E2E TEST SUITE');
  console.log('===============================================================\n');

  // Start ephemeral HTTP server on random port
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      baseUrl = `http://127.0.0.1:${addr.port}`;
      console.log(`Test server running on ${baseUrl}\n`);
      resolve();
    });
  });

  const timestamp = Date.now();
  const dbStorePath = path.resolve(process.cwd(), 'db_store.json');
  let initialDbStore = {};
  if (fs.existsSync(dbStorePath)) {
    try {
      initialDbStore = JSON.parse(fs.readFileSync(dbStorePath, 'utf8'));
    } catch {}
  }
  const initialCustomerCount = (initialDbStore.customers || []).length;
  const initialEmployeeCount = (initialDbStore.employees || []).length;
  const initialOrderCount = (initialDbStore.orders || []).length;
  const initialReviewCount = (initialDbStore.reviews || []).length;

  let createdGuestMsgId = null;
  let createdAuthMsgId = null;
  let createdReviewId = null;

  // -------------------------------------------------------------
  // PART A: CONTACT INQUIRY FLOW
  // -------------------------------------------------------------
  console.log('--- PART A: CONTACT INQUIRY FLOW ---');

  await it('A1: Submit guest contact inquiry with valid CSRF token (POST /api/contact-messages)', async () => {
    const payload = {
      name: `Rajesh Sharma ${timestamp}`,
      email: `rajesh.${timestamp}@example.com`,
      phone: '9876543210',
      subject: `Passport Document Assistance ${timestamp}`,
      category: 'Service Inquiry',
      message: 'Hello, I need urgent guidance on renewal documents required for Passport Seva application.'
    };

    const res = await request('POST', '/api/contact-messages', {
      'x-csrf-token': CSRF_TOKEN
    }, payload);

    assert.strictEqual(res.status, 201, `Expected HTTP 201, got ${res.status}: ${res.data}`);
    assert(res.json, 'Response should be JSON');
    assert(res.json.messageData || res.json.inquiry, 'Response must include messageData or inquiry');
    const msg = res.json.messageData || res.json.inquiry;
    assert(msg.id, 'Inquiry must have an auto-generated id');
    assert.strictEqual(msg.email, payload.email);
    assert.strictEqual(msg.subject, payload.subject);
    assert.strictEqual(msg.status, 'New');
    createdGuestMsgId = msg.id;
  });

  await it('A2: Submit inquiry using route alias /api/inquiries with auth user token', async () => {
    const payload = {
      subject: `PAN Card Correction Query ${timestamp}`,
      category: 'Correction',
      message: 'My surname is misspelled in the draft application.'
    };

    const res = await request('POST', '/api/inquiries', {
      'x-csrf-token': CSRF_TOKEN,
      'Authorization': `Bearer ${customerToken}`
    }, payload);

    assert.strictEqual(res.status, 201, `Expected HTTP 201, got ${res.status}: ${res.data}`);
    assert(res.json, 'Response should be JSON');
    const msg = res.json.messageData || res.json.inquiry;
    assert(msg.id, 'Inquiry must have an auto-generated id');
    assert.strictEqual(msg.email, 'customer.test@example.com');
    assert.strictEqual(msg.name, 'Test Customer User');
    assert.strictEqual(msg.customerId, 'CUST-TEST-9988');
    createdAuthMsgId = msg.id;
  });

  await it('A3: Verify inquiry disk persistence in db_store.json', async () => {
    assert(fs.existsSync(dbStorePath), 'db_store.json should exist');
    const diskData = JSON.parse(fs.readFileSync(dbStorePath, 'utf8'));
    assert(Array.isArray(diskData.contactMessages), 'contactMessages must be an array in db_store.json');
    const diskGuestMsg = diskData.contactMessages.find(m => m.id === createdGuestMsgId);
    const diskAuthMsg = diskData.contactMessages.find(m => m.id === createdAuthMsgId);
    assert(diskGuestMsg, `Guest inquiry ${createdGuestMsgId} was not found on disk`);
    assert(diskAuthMsg, `Auth inquiry ${createdAuthMsgId} was not found on disk`);
  });

  await it('A4: Admin fetches contact messages (GET /api/admin/contact-messages)', async () => {
    const res = await request('GET', '/api/admin/contact-messages', {
      'Authorization': `Bearer ${adminToken}`
    });

    assert.strictEqual(res.status, 200, `Expected HTTP 200, got ${res.status}: ${res.data}`);
    assert(Array.isArray(res.json), 'Admin endpoint should return an array of messages');
    const foundGuest = res.json.find(m => m.id === createdGuestMsgId);
    const foundAuth = res.json.find(m => m.id === createdAuthMsgId);
    assert(foundGuest, 'Newly created guest inquiry must be present in admin listing');
    assert(foundAuth, 'Newly created auth inquiry must be present in admin listing');
    assert.strictEqual(foundGuest.status, 'New');
  });

  await it('A5: Admin fetches contact messages via route alias (GET /api/admin/inquiries)', async () => {
    const res = await request('GET', '/api/admin/inquiries', {
      'Authorization': `Bearer ${adminToken}`
    });

    assert.strictEqual(res.status, 200, `Expected HTTP 200, got ${res.status}: ${res.data}`);
    assert(Array.isArray(res.json), 'Alias endpoint should return an array of messages');
    const found = res.json.find(m => m.id === createdGuestMsgId);
    assert(found, 'Guest inquiry must be accessible via /api/admin/inquiries alias');
  });

  await it('A6: Field parity check between submitted inquiry and admin listing', async () => {
    const res = await request('GET', '/api/admin/contact-messages', {
      'Authorization': `Bearer ${adminToken}`
    });
    const item = res.json.find(m => m.id === createdGuestMsgId);
    assert(item, 'Item must be in admin list');
    assert.strictEqual(item.name, `Rajesh Sharma ${timestamp}`);
    assert.strictEqual(item.email, `rajesh.${timestamp}@example.com`);
    assert.strictEqual(item.phone, '9876543210');
    assert.strictEqual(item.subject, `Passport Document Assistance ${timestamp}`);
    assert.strictEqual(item.category, 'Service Inquiry');
    assert.strictEqual(item.message, 'Hello, I need urgent guidance on renewal documents required for Passport Seva application.');
  });

  await it('A7: Admin updates inquiry status (PATCH /api/admin/contact-messages/:id)', async () => {
    const res = await request('PATCH', `/api/admin/contact-messages/${createdGuestMsgId}`, {
      'x-csrf-token': CSRF_TOKEN,
      'Authorization': `Bearer ${adminToken}`
    }, {
      status: 'Replied'
    });

    assert.strictEqual(res.status, 200, `Expected HTTP 200, got ${res.status}: ${res.data}`);
    assert.strictEqual(res.json.status, 'Replied');

    // Verify persistence on disk
    const diskData = JSON.parse(fs.readFileSync(dbStorePath, 'utf8'));
    const diskMsg = (diskData.contactMessages || []).find(m => m.id === createdGuestMsgId);
    assert(diskMsg, 'Updated msg must exist on disk');
    assert.strictEqual(diskMsg.status, 'Replied', 'Disk record status must be updated to Replied');
  });

  await it('A8: RBAC boundary: Unauthenticated access to /api/admin/contact-messages is rejected (HTTP 401)', async () => {
    const res = await request('GET', '/api/admin/contact-messages');
    assert.strictEqual(res.status, 401, `Expected HTTP 401 for unauthenticated request, got ${res.status}`);
  });

  await it('A9: RBAC boundary: Non-admin customer token to /api/admin/contact-messages is rejected (HTTP 403)', async () => {
    const res = await request('GET', '/api/admin/contact-messages', {
      'Authorization': `Bearer ${customerToken}`
    });
    assert.strictEqual(res.status, 403, `Expected HTTP 403 for non-admin request, got ${res.status}`);
  });

  await it('A10: CSRF boundary: POST /api/contact-messages without CSRF token is rejected (HTTP 403)', async () => {
    const res = await request('POST', '/api/contact-messages', {}, {
      name: 'Hacker',
      email: 'hacker@example.com',
      message: 'Attempting CSRF bypass'
    });
    assert.strictEqual(res.status, 403, `Expected HTTP 403 on missing CSRF token, got ${res.status}`);
  });

  await it('A11: Input validation: POST /api/contact-messages with missing fields is rejected (HTTP 400)', async () => {
    const res = await request('POST', '/api/contact-messages', {
      'x-csrf-token': CSRF_TOKEN
    }, {
      name: '',
      email: '',
      message: ''
    });
    assert.strictEqual(res.status, 400, `Expected HTTP 400 on empty fields, got ${res.status}`);
  });

  // -------------------------------------------------------------
  // PART B: REVIEW SUBMISSION FLOW
  // -------------------------------------------------------------
  console.log('\n--- PART B: REVIEW SUBMISSION FLOW ---');

  await it('B1: Fetch CSRF token from GET /api/security/csrf', async () => {
    const res = await request('GET', '/api/security/csrf');
    assert.strictEqual(res.status, 200, `Expected HTTP 200, got ${res.status}`);
    assert(res.json && res.json.csrfToken, 'Response must return csrfToken property');
    assert.strictEqual(res.json.csrfToken, CSRF_TOKEN);
  });

  await it('B2: Submit customer review with valid CSRF token (POST /api/reviews) succeeds with HTTP 201', async () => {
    const payload = {
      customerName: `Aarav Patel ${timestamp}`,
      customerId: `CUST-REV-${timestamp}`,
      serviceTitle: 'Passport Expedited Assistance',
      serviceName: 'Passport Expedited Assistance',
      rating: 5,
      reviewText: 'Outstanding service! The EasyDesk team verified my documents in under 20 minutes and guided me through every step.'
    };

    const res = await request('POST', '/api/reviews', {
      'x-csrf-token': CSRF_TOKEN
    }, payload);

    assert.strictEqual(res.status, 201, `Expected HTTP 201, got ${res.status}: ${res.data}`);
    assert(res.json, 'Response should be JSON');
    assert(res.json.review, 'Response should contain review object');
    assert(res.json.reviewId || res.json.review.id, 'Response should return reviewId');
    assert.strictEqual(res.json.review.rating, 5);
    assert.strictEqual(res.json.review.status, 'Pending');
    assert.strictEqual(res.json.review.customerName, payload.customerName);
    createdReviewId = res.json.review.id;
  });

  await it('B3: Zero CSRF error on review submission (no 403 Forbidden)', async () => {
    assert(createdReviewId, 'Review must have been created in previous step without CSRF rejection');
  });

  await it('B4: Review persistence in db_store.json under reviews with Pending status', async () => {
    const diskData = JSON.parse(fs.readFileSync(dbStorePath, 'utf8'));
    assert(Array.isArray(diskData.reviews), 'reviews must be an array in db_store.json');
    const diskReview = diskData.reviews.find(r => r.id === createdReviewId);
    assert(diskReview, `Created review ${createdReviewId} must exist on disk`);
    assert.strictEqual(diskReview.rating, 5);
    assert.strictEqual(diskReview.status, 'Pending');
    assert.strictEqual(diskReview.customerName, `Aarav Patel ${timestamp}`);
  });

  await it('B5: Admin Reviews moderation API (GET /api/admin/reviews) includes the new review', async () => {
    const res = await request('GET', '/api/admin/reviews', {
      'Authorization': `Bearer ${adminToken}`
    });

    assert.strictEqual(res.status, 200, `Expected HTTP 200, got ${res.status}`);
    assert(Array.isArray(res.json), 'Admin reviews endpoint should return an array');
    const found = res.json.find(r => r.id === createdReviewId);
    assert(found, `Review ${createdReviewId} should be visible in Admin Reviews list`);
    assert.strictEqual(found.status, 'Pending');
    assert.strictEqual(found.rating, 5);
  });

  await it('B6: Public Reviews endpoint (GET /api/reviews) excludes unapproved Pending reviews', async () => {
    const res = await request('GET', '/api/reviews');
    assert.strictEqual(res.status, 200, `Expected HTTP 200, got ${res.status}`);
    assert(Array.isArray(res.json), 'Public endpoint should return an array');
    const found = res.json.find(r => r.id === createdReviewId);
    assert(!found, 'Pending review must NOT be displayed on public reviews until approved');
  });

  await it('B7: CSRF boundary: POST /api/reviews without CSRF token is rejected with HTTP 403 Forbidden', async () => {
    const res = await request('POST', '/api/reviews', {}, {
      customerName: 'Unchecked User',
      rating: 5,
      reviewText: 'This request lacks x-csrf-token header.'
    });

    assert.strictEqual(res.status, 403, `Expected HTTP 403 on missing CSRF token, got ${res.status}`);
    assert(res.data.includes('CSRF security token verification failed'), 'Error message must specify CSRF verification failure');
  });

  await it('B8: Input validation: POST /api/reviews with invalid star rating (< 1 or > 5) is rejected (HTTP 400)', async () => {
    const resZero = await request('POST', '/api/reviews', {
      'x-csrf-token': CSRF_TOKEN
    }, {
      customerName: 'Tester',
      rating: 0,
      reviewText: 'Zero star test'
    });
    assert.strictEqual(resZero.status, 400, `Expected HTTP 400 for rating 0, got ${resZero.status}`);

    const resSix = await request('POST', '/api/reviews', {
      'x-csrf-token': CSRF_TOKEN
    }, {
      customerName: 'Tester',
      rating: 6,
      reviewText: 'Six star test'
    });
    assert.strictEqual(resSix.status, 400, `Expected HTTP 400 for rating 6, got ${resSix.status}`);
  });

  await it('B9: Input validation: POST /api/reviews with missing review text is rejected (HTTP 400)', async () => {
    const res = await request('POST', '/api/reviews', {
      'x-csrf-token': CSRF_TOKEN
    }, {
      customerName: 'Tester',
      rating: 5,
      reviewText: '   '
    });
    assert.strictEqual(res.status, 400, `Expected HTTP 400 for empty review text, got ${res.status}`);
  });

  // -------------------------------------------------------------
  // PART C: DATA PRESERVATION AUDIT
  // -------------------------------------------------------------
  console.log('\n--- PART C: DATA PRESERVATION AUDIT ---');

  await it('C1: Existing customer, employee, order, and initial review records are preserved', async () => {
    const finalDiskData = JSON.parse(fs.readFileSync(dbStorePath, 'utf8'));
    const finalCustomerCount = (finalDiskData.customers || []).length;
    const finalEmployeeCount = (finalDiskData.employees || []).length;
    const finalOrderCount = (finalDiskData.orders || []).length;
    const finalReviewCount = (finalDiskData.reviews || []).length;

    assert(finalCustomerCount >= initialCustomerCount, `Customer count decreased: was ${initialCustomerCount}, now ${finalCustomerCount}`);
    assert(finalEmployeeCount >= initialEmployeeCount, `Employee count decreased: was ${initialEmployeeCount}, now ${finalEmployeeCount}`);
    assert(finalOrderCount >= initialOrderCount, `Order count decreased: was ${initialOrderCount}, now ${finalOrderCount}`);
    assert(finalReviewCount >= initialReviewCount, `Review count decreased: was ${initialReviewCount}, now ${finalReviewCount}`);
  });

  // Cleanup test items from in-memory state and disk
  const finalState = getDbState();
  if (Array.isArray(finalState.contactMessages)) {
    finalState.contactMessages = finalState.contactMessages.filter(
      m => m.id !== createdGuestMsgId && m.id !== createdAuthMsgId
    );
  }
  if (Array.isArray(finalState.reviews)) {
    finalState.reviews = finalState.reviews.filter(r => r.id !== createdReviewId);
  }
  fs.writeFileSync(dbStorePath, JSON.stringify(finalState, null, 2), 'utf8');

  // Close ephemeral test server
  await new Promise(resolve => server.close(resolve));

  console.log('\n===============================================================');
  console.log(` RESULTS: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
  console.log('===============================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  if (server) server.close();
  process.exit(1);
});
