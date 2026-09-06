/**
 * EASYDESK — SERVICE CATEGORY PERSISTENCE & RELATIONAL PARITY TEST SUITE
 * 
 * Comprehensive automated verification for:
 * 1. Baseline state verification (all 8 original service categories intact)
 * 2. Category creation lifecycle (POST /api/admin/categories)
 * 3. Immediate visibility on both public and admin endpoints
 * 4. Zero data loss: All previously existing categories remain visible
 * 5. Duplicate category prevention (POST with existing ID returns 400)
 * 6. Repeated read stability (10x consecutive GET requests with zero flapping)
 * 7. Status toggle lifecycle (PUT /api/admin/categories/:id/status)
 * 8. Status filtering (public active-only vs ?all=true / admin)
 * 9. Category update lifecycle (PUT /api/admin/categories/:id)
 * 10. Category deletion lifecycle (DELETE /api/admin/categories/:id)
 * 11. Post-deletion integrity (all 8 baseline categories preserved)
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
    const reqHeaders = {
      'Content-Type': 'application/json',
      'x-csrf-token': 'easydesk_secure_csrf_token_2026_val',
      ...headers
    };
    let postData = null;

    if (body) {
      postData = JSON.stringify(body);
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
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

const BASELINE_CATEGORY_IDS = ['gov', 'biz', 'edu', 'doc', 'it', 'pers', 'util', 'legal'];
const TEST_CAT_ID = 'test-auto-cat-alpha';

async function runCategorySuite() {
  console.log('\n============================================================');
  console.log('EASYDESK — SERVICE CATEGORY PERSISTENCE & PARITY TEST SUITE');
  console.log('============================================================\n');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  console.log(`[TEST SERVER] Running on port ${port}`);

  try {
    // 0. Health check
    await it('0. Server is healthy and responsive', async () => {
      const res = await makeRequest(port, '/api/health');
      assert.strictEqual(res.status, 200, 'Health check must return 200');
    });

    // 1. Baseline check: Public endpoint
    await it('1. Public GET /api/categories returns all 8 baseline categories', async () => {
      const res = await makeRequest(port, '/api/categories');
      assert.strictEqual(res.status, 200);
      assert(Array.isArray(res.body), 'Response must be an array');
      assert(res.body.length >= 8, `Expected at least 8 categories, got ${res.body.length}`);
      for (const id of BASELINE_CATEGORY_IDS) {
        const found = res.body.some(c => c.id === id);
        assert(found, `Baseline category '${id}' must be present in public listing`);
      }
    });

    // 2. Baseline check: Admin endpoint
    await it('2. Admin GET /api/admin/categories returns all 8 baseline categories', async () => {
      const res = await makeRequest(port, '/api/admin/categories', 'GET', null, {
        'Authorization': `Bearer ${adminToken}`
      });
      assert.strictEqual(res.status, 200);
      assert(Array.isArray(res.body), 'Admin response must be an array');
      assert(res.body.length >= 8, `Expected at least 8 categories, got ${res.body.length}`);
      for (const id of BASELINE_CATEGORY_IDS) {
        const found = res.body.some(c => c.id === id);
        assert(found, `Baseline category '${id}' must be present in admin listing`);
      }
    });

    // 3. Create a new category
    await it('3. POST /api/admin/categories creates a new service category', async () => {
      const payload = {
        category: {
          id: TEST_CAT_ID,
          name: 'Automated Testing Services',
          slug: 'automated-testing-services',
          icon: 'Briefcase',
          color: 'purple',
          description: 'Category created to test persistence and parity',
          status: 'Active',
          sortOrder: 99
        }
      };
      const res = await makeRequest(port, '/api/admin/categories', 'POST', payload, {
        'Authorization': `Bearer ${adminToken}`
      });
      assert.strictEqual(res.status, 201, `Expected 201 Created, got ${res.status}`);
      assert.strictEqual(res.body.id, TEST_CAT_ID, 'Returned category id must match created ID');
      assert.strictEqual(res.body.name, 'Automated Testing Services');
    });

    // 4. Immediate visibility check on Admin endpoint (ZERO DATA LOSS CHECK)
    await it('4. Admin GET /api/admin/categories returns all 8 baseline categories PLUS the new category (9 total)', async () => {
      const res = await makeRequest(port, '/api/admin/categories', 'GET', null, {
        'Authorization': `Bearer ${adminToken}`
      });
      assert.strictEqual(res.status, 200);
      assert(Array.isArray(res.body), 'Response must be an array');
      assert.strictEqual(res.body.length, 9, `Expected exactly 9 categories (8 original + 1 new), got ${res.body.length}`);
      
      // Verify all 8 original categories still exist!
      for (const id of BASELINE_CATEGORY_IDS) {
        const found = res.body.some(c => c.id === id);
        assert(found, `Baseline category '${id}' MUST NOT DISAPPEAR after creating a new category`);
      }
      
      // Verify new category exists
      const newCat = res.body.find(c => c.id === TEST_CAT_ID);
      assert(newCat, `New category '${TEST_CAT_ID}' must be present in admin listing`);
      assert.strictEqual(newCat.status, 'Active');
    });

    // 5. Immediate visibility check on Public endpoint
    await it('5. Public GET /api/categories returns all 8 baseline categories PLUS the new category (9 total)', async () => {
      const res = await makeRequest(port, '/api/categories');
      assert.strictEqual(res.status, 200);
      assert(Array.isArray(res.body), 'Response must be an array');
      assert.strictEqual(res.body.length, 9, `Expected exactly 9 categories on public endpoint, got ${res.body.length}`);
      
      for (const id of BASELINE_CATEGORY_IDS) {
        const found = res.body.some(c => c.id === id);
        assert(found, `Baseline category '${id}' must remain visible on public site`);
      }
      const newCat = res.body.find(c => c.id === TEST_CAT_ID);
      assert(newCat, `New category '${TEST_CAT_ID}' must be present on public site`);
    });

    // 6. Duplicate category prevention
    await it('6. POST /api/admin/categories rejects duplicate category ID with 400 Bad Request', async () => {
      const payload = {
        category: {
          id: 'gov',
          name: 'Government Services Duplicate',
          slug: 'gov'
        }
      };
      const res = await makeRequest(port, '/api/admin/categories', 'POST', payload, {
        'Authorization': `Bearer ${adminToken}`
      });
      assert.strictEqual(res.status, 400, `Expected 400 Bad Request, got ${res.status}`);
      assert(res.body && res.body.message && res.body.message.includes('already exists'), 'Error message must specify category already exists');
    });

    // 7. Repeated read stability (10x consecutive calls to ensure zero flapping)
    await it('7. Repeated read stability: 10 consecutive GET requests consistently return all 9 categories', async () => {
      for (let i = 1; i <= 10; i++) {
        const adminRes = await makeRequest(port, '/api/admin/categories', 'GET', null, {
          'Authorization': `Bearer ${adminToken}`
        });
        assert.strictEqual(adminRes.status, 200);
        assert.strictEqual(adminRes.body.length, 9, `Iteration ${i}: Admin GET must return 9 categories, got ${adminRes.body.length}`);

        const publicRes = await makeRequest(port, '/api/categories');
        assert.strictEqual(publicRes.status, 200);
        assert.strictEqual(publicRes.body.length, 9, `Iteration ${i}: Public GET must return 9 categories, got ${publicRes.body.length}`);
      }
    });

    // 8. Status toggle (deactivate new category)
    await it('8. PUT /api/admin/categories/:id/status deactivates the test category', async () => {
      const res = await makeRequest(port, `/api/admin/categories/${TEST_CAT_ID}/status`, 'PUT', {
        status: 'Inactive'
      }, {
        'Authorization': `Bearer ${adminToken}`
      });
      assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.category.status, 'Inactive');
    });

    // 9. Active filtering verification
    await it('9. Filtered listing: public GET returns 8 active categories, ?all=true and admin return 9', async () => {
      // Public active-only (default)
      const publicRes = await makeRequest(port, '/api/categories');
      assert.strictEqual(publicRes.status, 200);
      assert.strictEqual(publicRes.body.length, 8, `Public active-only should return 8, got ${publicRes.body.length}`);
      assert(!publicRes.body.some(c => c.id === TEST_CAT_ID), 'Inactive category should be filtered from public active-only');

      // Public all=true
      const allRes = await makeRequest(port, '/api/categories?all=true');
      assert.strictEqual(allRes.status, 200);
      assert.strictEqual(allRes.body.length, 9, `Public all=true should return 9, got ${allRes.body.length}`);
      assert(allRes.body.some(c => c.id === TEST_CAT_ID), 'Inactive category should be included in ?all=true');

      // Admin endpoint
      const adminRes = await makeRequest(port, '/api/admin/categories', 'GET', null, {
        'Authorization': `Bearer ${adminToken}`
      });
      assert.strictEqual(adminRes.status, 200);
      assert.strictEqual(adminRes.body.length, 9, `Admin should return 9, got ${adminRes.body.length}`);
      const testItem = adminRes.body.find(c => c.id === TEST_CAT_ID);
      assert(testItem && testItem.status === 'Inactive', 'Test category should show Inactive in admin');
    });

    // 10. Update category details
    await it('10. PUT /api/admin/categories/:id updates category details and persists', async () => {
      const updatePayload = {
        category: {
          name: 'Automated Testing Services (Updated)',
          color: 'emerald',
          description: 'Updated description for testing',
          status: 'Active'
        }
      };
      const res = await makeRequest(port, `/api/admin/categories/${TEST_CAT_ID}`, 'PUT', updatePayload, {
        'Authorization': `Bearer ${adminToken}`
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.name, 'Automated Testing Services (Updated)');
      assert.strictEqual(res.body.status, 'Active');

      // Verify persistence via GET
      const verifyRes = await makeRequest(port, '/api/admin/categories', 'GET', null, {
        'Authorization': `Bearer ${adminToken}`
      });
      const updatedItem = verifyRes.body.find(c => c.id === TEST_CAT_ID);
      assert(updatedItem, 'Updated category must be present');
      assert.strictEqual(updatedItem.name, 'Automated Testing Services (Updated)');
      assert.strictEqual(updatedItem.color, 'emerald');
    });

    // 11. Delete category
    await it('11. DELETE /api/admin/categories/:id removes test category successfully', async () => {
      const res = await makeRequest(port, `/api/admin/categories/${TEST_CAT_ID}`, 'DELETE', {
        fallbackCategoryId: 'gov'
      }, {
        'Authorization': `Bearer ${adminToken}`
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
    });

    // 12. Post-deletion integrity check: All 8 baseline categories remain intact
    await it('12. Post-deletion: All 8 baseline categories remain completely intact', async () => {
      const res = await makeRequest(port, '/api/admin/categories', 'GET', null, {
        'Authorization': `Bearer ${adminToken}`
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.length, 8, `Expected exactly 8 categories remaining, got ${res.body.length}`);
      for (const id of BASELINE_CATEGORY_IDS) {
        const found = res.body.some(c => c.id === id);
        assert(found, `Baseline category '${id}' must be preserved intact`);
      }
      assert(!res.body.some(c => c.id === TEST_CAT_ID), 'Deleted category must no longer be present');
    });

  } finally {
    server.close();
  }

  console.log('\n------------------------------------------------------------');
  console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
  console.log('------------------------------------------------------------\n');

  if (totalTests !== passedTests) {
    process.exit(1);
  }
}

runCategorySuite().catch(err => {
  console.error('[FATAL ERROR IN SUITE]:', err);
  process.exit(1);
});
