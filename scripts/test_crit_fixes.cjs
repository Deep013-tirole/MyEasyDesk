/**
 * EASYDESK — VERIFICATION TEST SUITE FOR REMOVAL OF ORPHANED CUSTOMER AUTH
 * AND CRITICAL SECURITY VULNERABILITIES (CRIT-01 THROUGH CRIT-05)
 */

process.env.IS_WORKER = 'true';
process.env.NODE_ENV = 'test';

const http = require('http');
const assert = require('assert');
const jwt = require('jsonwebtoken');

const { app, getJwtSecret, getDbState } = require('../dist/server.cjs');

const CSRF_TOKEN = 'easydesk_secure_csrf_token_2026_val';

const adminToken = jwt.sign({
  id: 'super-admin-deepak',
  email: 'tideepak8@gmail.com',
  name: 'Deepak Administrator',
  role: 'SUPER_ADMIN'
}, getJwtSecret());

const nonAdminToken = jwt.sign({
  id: 'CUST-TEST-1234',
  email: 'test.user@example.com',
  name: 'Test Regular User',
  role: 'USER'
}, getJwtSecret());

let server;
let serverPort = 3199;

function apiRequest(options, body) {
  return new Promise((resolve, reject) => {
    const headers = { ...(options.headers || {}) };
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method)) {
      if (!headers['x-csrf-token']) {
        headers['x-csrf-token'] = CSRF_TOKEN;
      }
    }
    const req = http.request({
      hostname: '127.0.0.1',
      port: serverPort,
      ...options,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({ status: res.statusCode, headers: res.headers, data: json, raw: data });
      });
    });
    req.on('error', reject);
    if (body) {
      const b = typeof body === 'string' ? body : JSON.stringify(body);
      req.write(b);
    }
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('EASYDESK — CRITICAL FIXES & ORPHANED AUTH VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function check(desc, condition) {
    total++;
    if (condition) {
      console.log(`[PASS] ${total}. ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${total}. ${desc}`);
    }
  }

  server = app.listen(serverPort);
  await new Promise(r => setTimeout(r, 600));

  try {
    // ---------------------------------------------------------
    // TEST GROUP 1: Decommissioned Orphaned Customer Auth Routes (CRIT-01)
    // ---------------------------------------------------------
    console.log('--- TEST GROUP 1: Decommissioned Customer Auth & Backdoor (CRIT-01) ---');
    
    // 1. POST /api/auth/login -> 404
    const loginRes = await apiRequest({
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'user@example.com', password: 'password123' });
    check('POST /api/auth/login returns 404 (Route removed)', loginRes.status === 404);

    // 2. POST /api/auth/customer/login -> 404
    const custLoginRes = await apiRequest({
      path: '/api/auth/customer/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'user@example.com', password: 'password123' });
    check('POST /api/auth/customer/login returns 404 (Route removed)', custLoginRes.status === 404);

    // 3. POST /api/auth/register -> 404
    const regRes = await apiRequest({
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'newcust@example.com', password: 'password123' });
    check('POST /api/auth/register returns 404 (Route removed)', regRes.status === 404);

    // 4. POST /api/auth/customer/register -> 404
    const custRegRes = await apiRequest({
      path: '/api/auth/customer/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'newcust@example.com', password: 'password123' });
    check('POST /api/auth/customer/register returns 404 (Route removed)', custRegRes.status === 404);

    // 5. POST /api/auth/firebase-verify with unverified/non-admin token is rejected
    const fbVerifyMissing = await apiRequest({
      path: '/api/auth/firebase-verify',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {});
    const fbVerifyRes = await apiRequest({
      path: '/api/auth/firebase-verify',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { idToken: 'fake_token_for_non_admin', expectedRole: 'USER' });
    check('POST /api/auth/firebase-verify enforces authentication and rejects unauthorized tokens (400/401/403)', fbVerifyMissing.status === 400 && (fbVerifyRes.status === 401 || fbVerifyRes.status === 403));

    // ---------------------------------------------------------
    // TEST GROUP 2: Unauthenticated Order Dump Prevention (CRIT-02)
    // ---------------------------------------------------------
    console.log('\n--- TEST GROUP 2: Order Dump Prevention (CRIT-02) ---');

    // 6. GET /api/orders?role=ADMIN without token -> 401 Unauthorized
    const unauthOrdersRes = await apiRequest({
      path: '/api/orders?role=ADMIN',
      method: 'GET'
    });
    check('Unauthenticated GET /api/orders?role=ADMIN rejected with 401', unauthOrdersRes.status === 401);

    // 7. GET /api/orders with non-admin token -> 403 Forbidden
    const nonAdminOrdersRes = await apiRequest({
      path: '/api/orders?role=ADMIN',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${nonAdminToken}` }
    });
    check('Non-admin token to GET /api/orders rejected with 403', nonAdminOrdersRes.status === 403);

    // 8. GET /api/orders with admin token -> 200 OK
    const adminOrdersRes = await apiRequest({
      path: '/api/orders',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    check('Admin token to GET /api/orders succeeds with 200 OK', adminOrdersRes.status === 200 && Array.isArray(adminOrdersRes.data));

    // ---------------------------------------------------------
    // TEST GROUP 3: Payment Status Mutation Protection (CRIT-03)
    // ---------------------------------------------------------
    console.log('\n--- TEST GROUP 3: Payment Status Mutation Protection (CRIT-03) ---');

    const db = getDbState();
    const testOrder = db.orders && db.orders[0] ? db.orders[0] : { id: 'ORD-TEST-001' };

    // 9. PATCH /api/orders/:id/payment without token -> 401 Unauthorized
    const unauthPaymentRes = await apiRequest({
      path: `/api/orders/${testOrder.id}/payment`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, { paymentStatus: 'Verified' });
    check('Unauthenticated PATCH /api/orders/:id/payment rejected with 401', unauthPaymentRes.status === 401);

    // 10. PATCH /api/orders/:id/payment with non-admin token -> 403 Forbidden
    const nonAdminPaymentRes = await apiRequest({
      path: `/api/orders/${testOrder.id}/payment`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${nonAdminToken}` }
    }, { paymentStatus: 'Verified' });
    check('Non-admin token PATCH /api/orders/:id/payment rejected with 403', nonAdminPaymentRes.status === 403);

    // 11. PATCH /api/orders/:id/payment with admin token -> 200 OK
    const adminPaymentRes = await apiRequest({
      path: `/api/orders/${testOrder.id}/payment`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
    }, { paymentStatus: 'Verified' });
    check('Admin token PATCH /api/orders/:id/payment succeeds with 200', adminPaymentRes.status === 200 && adminPaymentRes.data?.paymentStatus === 'Verified');

    // ---------------------------------------------------------
    // TEST GROUP 4: Admin Settings Protection & Secret Injection Prevention (CRIT-04)
    // ---------------------------------------------------------
    console.log('\n--- TEST GROUP 4: Settings Overwrite & Secret Protection (CRIT-04) ---');

    // 12. GET /api/admin/settings without token -> 401
    const unauthSettingsGet = await apiRequest({
      path: '/api/admin/settings',
      method: 'GET'
    });
    check('Unauthenticated GET /api/admin/settings rejected with 401', unauthSettingsGet.status === 401);

    // 13. GET /api/admin/settings with admin token redacts jwtSecret
    const adminSettingsGet = await apiRequest({
      path: '/api/admin/settings',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    check('GET /api/admin/settings redacts jwtSecret (undefined in payload)', adminSettingsGet.status === 200 && adminSettingsGet.data?.jwtSecret === undefined);

    // 14. POST /api/admin/settings with non-admin token -> 403 Forbidden
    const nonAdminSettingsPost = await apiRequest({
      path: '/api/admin/settings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${nonAdminToken}` }
    }, { settings: { supportPhone: '1234567890' } });
    check('Non-admin POST /api/admin/settings rejected with 403', nonAdminSettingsPost.status === 403);

    // 15. POST /api/admin/settings with admin token strips attempt to inject jwtSecret
    const adminSettingsPost = await apiRequest({
      path: '/api/admin/settings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
    }, { settings: { jwtSecret: 'malicious_injected_secret_key', companyName: 'EasyDesk India' } });
    check('Admin POST /api/admin/settings strips jwtSecret from dbState', adminSettingsPost.status === 200 && db.settings?.jwtSecret !== 'malicious_injected_secret_key');

    // ---------------------------------------------------------
    // TEST GROUP 5: User Management RBAC & Secure Admin Provisioning (CRIT-05)
    // ---------------------------------------------------------
    console.log('\n--- TEST GROUP 5: User Management RBAC & Secure Admin Passwords (CRIT-05) ---');

    // 16. POST /api/admin/users with non-admin token -> 403 Forbidden
    const nonAdminUserCreate = await apiRequest({
      path: '/api/admin/users',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${nonAdminToken}` }
    }, { user: { name: 'Rogue Admin', email: 'rogue@example.com', role: 'ADMIN' } });
    check('Non-admin POST /api/admin/users rejected with 403', nonAdminUserCreate.status === 403);

    // 17. POST /api/admin/users with admin token creates user with unique random password (NOT DEFAULT_PASSWORD_HASH)
    const testAdminEmail = `staff_${Date.now()}@easydesk.com`;
    const adminUserCreate = await apiRequest({
      path: '/api/admin/users',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
    }, { user: { name: 'Operations Staff', email: testAdminEmail, role: 'STAFF' } });
    
    const createdAdminObj = (db.admins || []).find(a => a.email === testAdminEmail);
    const hasDefaultHash = createdAdminObj?.password === '$2b$10$L9f9Lig0UOY6RNrx.TWalukMMWnwiWv.y7e5fYNyyuD14tVG5LraK';
    check('Admin POST /api/admin/users generates unique password hash (NOT DEFAULT_PASSWORD_HASH)', adminUserCreate.status === 201 && createdAdminObj && !hasDefaultHash);

    // 18. DELETE /api/admin/users/:id with non-admin token -> 403 Forbidden
    const nonAdminUserDelete = await apiRequest({
      path: `/api/admin/users/${createdAdminObj?.id || 'fake_id'}`,
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${nonAdminToken}` }
    });
    check('Non-admin DELETE /api/admin/users/:id rejected with 403', nonAdminUserDelete.status === 403);

    // ---------------------------------------------------------
    // TEST GROUP 6: Public Citizen Guest Workflows Remain Unbroken
    // ---------------------------------------------------------
    console.log('\n--- TEST GROUP 6: Public Citizen Guest Flow Integrity ---');

    // 19. GET /api/security/csrf -> 200 OK
    const csrfRes = await apiRequest({
      path: '/api/security/csrf',
      method: 'GET'
    });
    check('GET /api/security/csrf returns valid token', csrfRes.status === 200 && !!csrfRes.data?.csrfToken);

    // 20. GET /api/orders/track remains public and accessible
    const trackRes = await apiRequest({
      path: `/api/orders/track?orderId=${encodeURIComponent(testOrder.id || 'ORD-TEST-001')}`,
      method: 'GET'
    });
    check('Public tracking GET /api/orders/track is accessible (not 401/403)', trackRes.status === 200 || trackRes.status === 404);

    // ---------------------------------------------------------
    // TEST GROUP 7: Remaining Security Fixes (HIGH-01, 03, 04, MED-01)
    // ---------------------------------------------------------
    console.log('\n--- TEST GROUP 7: Remaining Security & Hardening Fixes ---');

    // 21. Unauthenticated PATCH /api/orders/:id/status -> 401 Unauthorized
    const unauthStatusRes = await apiRequest({
      path: `/api/orders/${testOrder.id}/status`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, { status: 'Processing' });
    check('Unauthenticated PATCH /api/orders/:id/status rejected with 401', unauthStatusRes.status === 401);

    // 22. Non-admin PATCH /api/orders/:id/status -> 403 Forbidden
    const nonAdminStatusRes = await apiRequest({
      path: `/api/orders/${testOrder.id}/status`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${nonAdminToken}` }
    }, { status: 'Processing' });
    check('Non-admin PATCH /api/orders/:id/status rejected with 403', nonAdminStatusRes.status === 403);

    // 23. Authorized Admin PATCH /api/orders/:id/status -> 200 OK
    const adminStatusRes = await apiRequest({
      path: `/api/orders/${testOrder.id}/status`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
    }, { status: 'Processing', comment: 'Audit test update' });
    check('Admin PATCH /api/orders/:id/status succeeds with 200', adminStatusRes.status === 200 && adminStatusRes.data?.orderStatus === 'Processing');

    // 24. Unauthenticated PATCH /api/orders/:id/delivery -> 401 Unauthorized
    const unauthDeliveryRes = await apiRequest({
      path: `/api/orders/${testOrder.id}/delivery`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, { finalDocumentUrl: 'https://example.com/test.pdf' });
    check('Unauthenticated PATCH /api/orders/:id/delivery rejected with 401', unauthDeliveryRes.status === 401);

    // 25. Authorized Admin PATCH /api/orders/:id/delivery -> 200 OK
    const adminDeliveryRes = await apiRequest({
      path: `/api/orders/${testOrder.id}/delivery`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
    }, { finalDocumentUrl: 'https://example.com/test.pdf', finalDocumentName: 'TestDoc.pdf' });
    check('Admin PATCH /api/orders/:id/delivery succeeds with 200', adminDeliveryRes.status === 200);

    // 26. Unauthenticated POST /api/orders/:id/upload without mobile -> 403 Forbidden
    const unauthUploadNoMobile = await apiRequest({
      path: `/api/orders/${testOrder.id}/upload`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { docName: 'unauth.pdf', fileData: Buffer.from('test').toString('base64') });
    check('Unauthenticated POST /api/orders/:id/upload without mobile rejected with 403', unauthUploadNoMobile.status === 403);

    // 27. Unauthenticated POST /api/orders/:id/upload with wrong mobile -> 403 Forbidden
    const unauthUploadWrongMobile = await apiRequest({
      path: `/api/orders/${testOrder.id}/upload`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { docName: 'unauth.pdf', mobile: '9999999999', fileData: Buffer.from('test').toString('base64') });
    check('Unauthenticated POST /api/orders/:id/upload with wrong mobile rejected with 403', unauthUploadWrongMobile.status === 403);

    // 28. Citizen POST /api/orders/:id/upload with matching mobile -> 200 OK
    const citizenUploadCorrectMobile = await apiRequest({
      path: `/api/orders/${testOrder.id}/upload`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { docName: 'correction.pdf', mobile: testOrder.mobile, fileData: Buffer.from('test-correction').toString('base64') });
    check('Citizen POST /api/orders/:id/upload with matching mobile succeeds with 200', citizenUploadCorrectMobile.status === 200);

    // 29. Path traversal attempt rejected on /uploads -> 400 Bad Request
    const traversalRes = await apiRequest({
      path: '/uploads/..%2f..%2fpackage.json',
      method: 'GET'
    });
    check('Path traversal on /uploads rejected with 400', traversalRes.status === 400);

    // 30. Private documents require authorization -> 401 Unauthorized
    const privateDocRes = await apiRequest({
      path: '/uploads/documents/private_test.pdf',
      method: 'GET'
    });
    check('Unauthenticated private document access rejected with 401', privateDocRes.status === 401);

    // 31. Security Headers (X-Frame-Options, Referrer-Policy, Permissions-Policy)
    const headersRes = await apiRequest({
      path: '/api/health',
      method: 'GET'
    });
    const xFrame = headersRes.headers['x-frame-options'];
    const refPolicy = headersRes.headers['referrer-policy'];
    const permPolicy = headersRes.headers['permissions-policy'];
    check('Security headers enforced (X-Frame-Options, Referrer-Policy, Permissions-Policy)', 
      xFrame === 'SAMEORIGIN' && 
      refPolicy === 'strict-origin-when-cross-origin' && 
      permPolicy === 'camera=(), microphone=(), geolocation=()'
    );

    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passed} / ${total} CHECKS PASSED`);
    console.log('================================================================');

    if (passed !== total) {
      process.exit(1);
    }
  } finally {
    if (server) server.close();
  }
}

runTests().catch(err => {
  console.error('[FATAL TEST ERROR]', err);
  if (server) server.close();
  process.exit(1);
});
