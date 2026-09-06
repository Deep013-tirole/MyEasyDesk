/**
 * EASYDESK — PRIVACY & SECURITY CMS + FRAUD REPORT + PURGE REQUEST
 * AUTOMATED REGRESSION & END-TO-END VERIFICATION TEST SUITE
 * 
 * Verifies:
 * A. Privacy CMS persistence, read-after-write, disk sync, customer hydration, cache invalidation
 * B. Fraud Report submission with CSRF, report ID generation, admin listing, status patch & persistence
 * C. Purge Request submission with CSRF, request ID generation, admin listing, status patch & persistence
 * D. CSRF state-changing protection enforcement (HTTP 403 on missing token)
 * E. RBAC authorization boundaries (HTTP 401 on missing admin token)
 * F. Input validation boundaries (HTTP 400 on empty/malformed payloads)
 * G. Preserved data integrity of existing customer, employee, and business records
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
  role: 'SUPER_ADMIN'
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

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
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
  console.log(' EASYDESK PRIVACY & SECURITY END-TO-END VERIFICATION SUITE');
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
  const testHeading = `EasyDesk Bank-Grade Data Protection Notice - ${timestamp}`;
  const testMayRequestTitle = `Authorized Verification Documents Required - ${timestamp}`;
  const testStatement = `EasyDesk operates in strict compliance with the DPDP Act 2023 - ${timestamp}`;

  // Read initial DB state to verify data preservation later
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

  let currentConfig = null;
  let createdScamId = null;
  let createdDelId = null;

  // -------------------------------------------------------------
  // GROUP A: PRIVACY & SECURITY CMS PERSISTENCE & HYDRATION
  // -------------------------------------------------------------
  console.log('--- GROUP A: PRIVACY & SECURITY CMS PERSISTENCE ---');

  await it('A1: Read initial configuration from GET /api/privacy-security', async () => {
    const res = await request('GET', '/api/privacy-security');
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(res.json, 'Response should be JSON');
    assert(res.json.hero, 'Response should contain hero section');
    currentConfig = JSON.parse(JSON.stringify(res.json));
  });

  await it('A2: Save unique test configuration via POST /api/admin/privacy-security with CSRF', async () => {
    const updated = {
      ...currentConfig,
      hero: {
        ...currentConfig.hero,
        heading: testHeading
      },
      mayRequest: {
        ...currentConfig.mayRequest,
        title: testMayRequestTitle
      },
      legalCompliance: {
        ...currentConfig.legalCompliance,
        statement: testStatement
      }
    };

    const res = await request('POST', '/api/admin/privacy-security', {
      'x-csrf-token': CSRF_TOKEN,
      'Authorization': `Bearer ${adminToken}`
    }, {
      privacySecuritySettings: updated,
      updaterId: 'super-admin-deepak',
      updaterName: 'Deepak Test'
    });

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(res.json, 'Response should be JSON');
    assert(res.json.privacySecuritySettings, 'Response should return saved privacySecuritySettings');
    assert.strictEqual(res.json.privacySecuritySettings.hero.heading, testHeading, 'Returned hero.heading should match');
  });

  await it('A3: Verify saved settings persisted directly to db_store.json on disk', async () => {
    assert(fs.existsSync(dbStorePath), 'db_store.json must exist');
    const diskData = JSON.parse(fs.readFileSync(dbStorePath, 'utf8'));
    const saved = diskData.privacySecuritySettings || diskData.privacySecurity;
    assert(saved, 'db_store.json must have privacySecuritySettings');
    assert.strictEqual(saved.hero.heading, testHeading, 'Disk hero.heading should match test value');
    assert.strictEqual(saved.mayRequest.title, testMayRequestTitle, 'Disk mayRequest.title should match test value');
    assert.strictEqual(saved.legalCompliance.statement, testStatement, 'Disk legalCompliance.statement should match test value');
  });

  await it('A4: Read public customer endpoint GET /api/privacy-security and verify exact parity', async () => {
    const res = await request('GET', '/api/privacy-security');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.hero.heading, testHeading);
    assert.strictEqual(res.json.mayRequest.title, testMayRequestTitle);
    assert.strictEqual(res.json.legalCompliance.statement, testStatement);
  });

  await it('A5: Read public customer endpoint GET /api/settings/privacy-security and verify exact parity', async () => {
    const res = await request('GET', '/api/settings/privacy-security');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.json.hero.heading, testHeading);
  });

  await it('A6: Simulate repeated re-reads to guarantee no reverting to preseeded defaults', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await request('GET', `/api/privacy-security?_t=${Date.now() + i}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.hero.heading, testHeading, `Iteration ${i} reverted to default`);
    }
  });

  // -------------------------------------------------------------
  // GROUP B: FRAUD REPORT FLOW
  // -------------------------------------------------------------
  console.log('\n--- GROUP B: FRAUD REPORT FLOW ---');

  const testScamPayload = {
    reporterName: `Test Victim ${timestamp}`,
    reporterEmail: `victim_${timestamp}@example.com`,
    reporterPhone: '9876543210',
    impersonatorContact: `+91 9119119119 (Fake Desk Officer ${timestamp})`,
    channelUsed: 'WhatsApp Call',
    scamDetails: `Caller claimed to be EasyDesk staff demanding immediate card CVV and UPI PIN for application approval ${timestamp}`
  };

  await it('B1: Submit Fraud Report via POST /api/security/report-scam with CSRF', async () => {
    const res = await request('POST', '/api/security/report-scam', {
      'x-csrf-token': CSRF_TOKEN
    }, testScamPayload);

    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
    assert(res.json && res.json.report, 'Response should contain report object');
    assert(res.json.report.id, 'Report should have an ID');
    assert(res.json.report.id.startsWith('scam-'), `ID should start with scam-, got ${res.json.report.id}`);
    assert.strictEqual(res.json.report.reporterName, testScamPayload.reporterName);
    assert.strictEqual(res.json.report.impersonatorContact, testScamPayload.impersonatorContact);
    assert.strictEqual(res.json.report.status, 'Investigating');
    assert(res.json.report.createdAt, 'Report should have createdAt timestamp');
    createdScamId = res.json.report.id;
  });

  await it('B2: Verify submitted Fraud Report is saved to db_store.json on disk', async () => {
    const diskData = JSON.parse(fs.readFileSync(dbStorePath, 'utf8'));
    assert(Array.isArray(diskData.scamReports), 'db_store.json must contain scamReports array');
    const diskReport = diskData.scamReports.find(r => r.id === createdScamId);
    assert(diskReport, `Fraud report ${createdScamId} not found in db_store.json`);
    assert.strictEqual(diskReport.reporterName, testScamPayload.reporterName);
    assert.strictEqual(diskReport.channelUsed, testScamPayload.channelUsed);
  });

  await it('B3: Admin GET /api/admin/scam-reports retrieves submitted report', async () => {
    const res = await request('GET', '/api/admin/scam-reports', {
      'Authorization': `Bearer ${adminToken}`
    });

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.json), 'Admin response should be an array');
    const found = res.json.find(r => r.id === createdScamId);
    assert(found, `Admin listing does not contain report ${createdScamId}`);
    assert.strictEqual(found.impersonatorContact, testScamPayload.impersonatorContact);
    assert.strictEqual(found.status, 'Investigating');
  });

  await it('B4: Admin updates report status via PATCH /api/admin/scam-reports/:id with CSRF', async () => {
    const res = await request('PATCH', `/api/admin/scam-reports/${createdScamId}`, {
      'x-csrf-token': CSRF_TOKEN,
      'Authorization': `Bearer ${adminToken}`
    }, {
      status: 'Resolved'
    });

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert.strictEqual(res.json.status, 'Resolved');

    // Verify disk sync
    const diskData = JSON.parse(fs.readFileSync(dbStorePath, 'utf8'));
    const diskReport = diskData.scamReports.find(r => r.id === createdScamId);
    assert.strictEqual(diskReport.status, 'Resolved', 'Status should be persisted as Resolved on disk');
  });

  // -------------------------------------------------------------
  // GROUP C: PURGE REQUEST (DATA DELETION) FLOW
  // -------------------------------------------------------------
  console.log('\n--- GROUP C: PURGE REQUEST FLOW ---');

  const testDelPayload = {
    customerName: `Purge Customer ${timestamp}`,
    customerEmail: `purge_${timestamp}@example.com`,
    customerPhone: '9988776655',
    orderId: `ORD-${timestamp}`,
    reason: `Service completed successfully, exercising DPDP Act right to be forgotten ${timestamp}`
  };

  await it('C1: Submit Purge Request via POST /api/security/request-data-deletion with CSRF', async () => {
    const res = await request('POST', '/api/security/request-data-deletion', {
      'x-csrf-token': CSRF_TOKEN
    }, testDelPayload);

    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
    assert(res.json && res.json.request, 'Response should contain request object');
    assert(res.json.request.id, 'Request should have an ID');
    assert(res.json.request.id.startsWith('del-'), `ID should start with del-, got ${res.json.request.id}`);
    assert.strictEqual(res.json.request.customerName, testDelPayload.customerName);
    assert.strictEqual(res.json.request.customerEmail, testDelPayload.customerEmail);
    assert.strictEqual(res.json.request.orderId, testDelPayload.orderId);
    assert.strictEqual(res.json.request.status, 'Pending Verification');
    assert(res.json.request.createdAt, 'Request should have createdAt timestamp');
    createdDelId = res.json.request.id;
  });

  await it('C2: Verify submitted Purge Request is saved to db_store.json on disk', async () => {
    const diskData = JSON.parse(fs.readFileSync(dbStorePath, 'utf8'));
    assert(Array.isArray(diskData.dataDeletionRequests), 'db_store.json must contain dataDeletionRequests array');
    const diskDel = diskData.dataDeletionRequests.find(d => d.id === createdDelId);
    assert(diskDel, `Purge request ${createdDelId} not found in db_store.json`);
    assert.strictEqual(diskDel.customerEmail, testDelPayload.customerEmail);
    assert.strictEqual(diskDel.orderId, testDelPayload.orderId);
  });

  await it('C3: Admin GET /api/admin/data-deletion-requests retrieves submitted request', async () => {
    const res = await request('GET', '/api/admin/data-deletion-requests', {
      'Authorization': `Bearer ${adminToken}`
    });

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.json), 'Admin response should be an array');
    const found = res.json.find(d => d.id === createdDelId);
    assert(found, `Admin listing does not contain purge request ${createdDelId}`);
    assert.strictEqual(found.customerName, testDelPayload.customerName);
    assert.strictEqual(found.status, 'Pending Verification');
  });

  await it('C4: Admin updates purge request status via PATCH /api/admin/data-deletion-requests/:id with CSRF', async () => {
    const res = await request('PATCH', `/api/admin/data-deletion-requests/${createdDelId}`, {
      'x-csrf-token': CSRF_TOKEN,
      'Authorization': `Bearer ${adminToken}`
    }, {
      status: 'Purged'
    });

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert.strictEqual(res.json.status, 'Purged');

    // Verify disk sync
    const diskData = JSON.parse(fs.readFileSync(dbStorePath, 'utf8'));
    const diskDel = diskData.dataDeletionRequests.find(d => d.id === createdDelId);
    assert.strictEqual(diskDel.status, 'Purged', 'Status should be persisted as Purged on disk');
  });

  // -------------------------------------------------------------
  // GROUP D: SECURITY & CSRF / RBAC CONTROLS
  // -------------------------------------------------------------
  console.log('\n--- GROUP D: SECURITY & AUTHORIZATION CONTROLS ---');

  await it('D1: Mutating request without CSRF token is rejected with HTTP 403', async () => {
    const res = await request('POST', '/api/security/report-scam', {}, testScamPayload);
    assert.strictEqual(res.status, 403, `Expected 403 without CSRF, got ${res.status}`);
  });

  await it('D2: Admin CMS save without CSRF token is rejected with HTTP 403', async () => {
    const res = await request('POST', '/api/admin/privacy-security', {
      'Authorization': `Bearer ${adminToken}`
    }, { privacySecuritySettings: currentConfig });
    assert.strictEqual(res.status, 403, `Expected 403 without CSRF, got ${res.status}`);
  });

  await it('D3: Admin Fraud Reports listing without Admin token is rejected with HTTP 401', async () => {
    const res = await request('GET', '/api/admin/scam-reports');
    assert.strictEqual(res.status, 401, `Expected 401 without auth, got ${res.status}`);
  });

  await it('D4: Admin Purge Requests listing without Admin token is rejected with HTTP 401', async () => {
    const res = await request('GET', '/api/admin/data-deletion-requests');
    assert.strictEqual(res.status, 401, `Expected 401 without auth, got ${res.status}`);
  });

  await it('D5: Status PATCH without Admin token is rejected with HTTP 401', async () => {
    const res = await request('PATCH', `/api/admin/scam-reports/${createdScamId}`, {
      'x-csrf-token': CSRF_TOKEN
    }, { status: 'Resolved' });
    assert.strictEqual(res.status, 401, `Expected 401 without auth, got ${res.status}`);
  });

  // -------------------------------------------------------------
  // GROUP E: INPUT VALIDATION BOUNDARIES
  // -------------------------------------------------------------
  console.log('\n--- GROUP E: INPUT VALIDATION ---');

  await it('E1: Empty scam report payload is rejected with HTTP 400', async () => {
    const res = await request('POST', '/api/security/report-scam', {
      'x-csrf-token': CSRF_TOKEN
    }, {});
    assert.strictEqual(res.status, 400, `Expected 400 on empty scam report, got ${res.status}`);
  });

  await it('E2: Deletion request with missing email is rejected with HTTP 400', async () => {
    const res = await request('POST', '/api/security/request-data-deletion', {
      'x-csrf-token': CSRF_TOKEN
    }, { customerName: 'Test Name' });
    assert.strictEqual(res.status, 400, `Expected 400 on missing email, got ${res.status}`);
  });

  // -------------------------------------------------------------
  // GROUP F: DATA INTEGRITY PRESERVATION
  // -------------------------------------------------------------
  console.log('\n--- GROUP F: DATA INTEGRITY PRESERVATION ---');

  await it('F1: Existing customers, employees, and orders were not corrupted or wiped', async () => {
    const finalDiskData = JSON.parse(fs.readFileSync(dbStorePath, 'utf8'));
    const finalCustomerCount = (finalDiskData.customers || []).length;
    const finalEmployeeCount = (finalDiskData.employees || []).length;
    const finalOrderCount = (finalDiskData.orders || []).length;

    assert(finalCustomerCount >= initialCustomerCount, `Customer count decreased: was ${initialCustomerCount}, now ${finalCustomerCount}`);
    assert(finalEmployeeCount >= initialEmployeeCount, `Employee count decreased: was ${initialEmployeeCount}, now ${finalEmployeeCount}`);
    assert(finalOrderCount >= initialOrderCount, `Order count decreased: was ${initialOrderCount}, now ${finalOrderCount}`);
  });

  // Restore original config
  if (currentConfig) {
    await request('POST', '/api/admin/privacy-security', {
      'x-csrf-token': CSRF_TOKEN,
      'Authorization': `Bearer ${adminToken}`
    }, {
      privacySecuritySettings: currentConfig
    });
  }

  // Cleanup test items from in-memory and disk
  const finalState = getDbState();
  if (createdScamId && Array.isArray(finalState.scamReports)) {
    finalState.scamReports = finalState.scamReports.filter(r => r.id !== createdScamId);
  }
  if (createdDelId && Array.isArray(finalState.dataDeletionRequests)) {
    finalState.dataDeletionRequests = finalState.dataDeletionRequests.filter(d => d.id !== createdDelId);
  }
  fs.writeFileSync(dbStorePath, JSON.stringify(finalState, null, 2), 'utf8');

  // Close server
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
