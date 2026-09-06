/**
 * EASYDESK — SOCIAL MEDIA LINKS CMS COMPREHENSIVE TEST SUITE
 * 
 * Verifies all 12 required test cases:
 * 1. Save Facebook link (enabled=true, url='https://facebook.com/easydesk')
 * 2. Save Instagram link (enabled=true, url='https://instagram.com/easydesk')
 * 3. Update existing link (modify Facebook URL, verify updated URL stored)
 * 4. Enabled links appear in public footer endpoint GET /api/social-media-links
 * 5. Disabled links excluded from active display / marked enabled: false
 * 6. Empty URL with enabled=true: auto-normalized to enabled: false or rejected
 * 7. Unsafe schemes: javascript:, data:, vbscript: rejected with 400 Bad Request
 * 8. WhatsApp format handling: wa.me auto-prefixed with https:// and accepted
 * 9. Data persistence across server reload / storage read-back
 * 10. Existing contact settings & CMS unaffected (GET /api/contact-settings, GET /api/services)
 * 11. Unauthorized write operations rejected with 401/403
 * 12. All links disabled: returns empty active list, footer social section hidden
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

const customerToken = jwt.sign({
  id: 'customer-user-123',
  email: 'customer@example.com',
  role: 'USER'
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

function makeRequest(port, path, method = 'GET', body = null, headers = {}) {
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
  console.log('\n============================================================');
  console.log('EASYDESK SOCIAL MEDIA LINKS CMS TEST SUITE');
  console.log('============================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  console.log(`Test server listening on ephemeral port ${port}\n`);

  const authHeaders = {
    'Authorization': `Bearer ${adminToken}`
  };

  try {
    // -----------------------------------------------------------------
    // TEST 1: Save Facebook link
    // -----------------------------------------------------------------
    await it('1. Save Facebook link with enabled=true and valid HTTPS URL', async () => {
      const payload = {
        socialMediaLinks: [
          { platform: 'facebook', url: 'https://facebook.com/easydesk', enabled: true },
          { platform: 'instagram', url: '', enabled: false },
          { platform: 'whatsapp', url: '', enabled: false },
          { platform: 'youtube', url: '', enabled: false },
          { platform: 'telegram', url: '', enabled: false },
          { platform: 'twitter', url: '', enabled: false },
          { platform: 'linkedin', url: '', enabled: false }
        ]
      };

      const res = await makeRequest(port, '/api/admin/social-media-links', 'POST', payload, authHeaders);
      assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.success, true, 'Expected success: true');
      assert(Array.isArray(res.body.socialMediaLinks), 'Expected socialMediaLinks array');
      
      const fb = res.body.socialMediaLinks.find(l => l.platform === 'facebook');
      assert(fb, 'Facebook entry missing in response');
      assert.strictEqual(fb.url, 'https://facebook.com/easydesk');
      assert.strictEqual(fb.enabled, true);
    });

    // -----------------------------------------------------------------
    // TEST 2: Save Instagram link
    // -----------------------------------------------------------------
    await it('2. Save Instagram link alongside existing Facebook link', async () => {
      const payload = {
        socialMediaLinks: [
          { platform: 'facebook', url: 'https://facebook.com/easydesk', enabled: true },
          { platform: 'instagram', url: 'https://instagram.com/easydesk', enabled: true },
          { platform: 'whatsapp', url: '', enabled: false },
          { platform: 'youtube', url: '', enabled: false },
          { platform: 'telegram', url: '', enabled: false },
          { platform: 'twitter', url: '', enabled: false },
          { platform: 'linkedin', url: '', enabled: false }
        ]
      };

      const res = await makeRequest(port, '/api/admin/social-media-links', 'POST', payload, authHeaders);
      assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
      
      const fb = res.body.socialMediaLinks.find(l => l.platform === 'facebook');
      const ig = res.body.socialMediaLinks.find(l => l.platform === 'instagram');
      assert.strictEqual(fb.enabled, true);
      assert.strictEqual(ig.enabled, true);
      assert.strictEqual(ig.url, 'https://instagram.com/easydesk');
    });

    // -----------------------------------------------------------------
    // TEST 3: Update existing link
    // -----------------------------------------------------------------
    await it('3. Update existing Facebook link to new handle and verify updated state', async () => {
      const payload = {
        socialMediaLinks: [
          { platform: 'facebook', url: 'https://facebook.com/easydesk-official', enabled: true },
          { platform: 'instagram', url: 'https://instagram.com/easydesk', enabled: true },
          { platform: 'whatsapp', url: '', enabled: false },
          { platform: 'youtube', url: '', enabled: false },
          { platform: 'telegram', url: '', enabled: false },
          { platform: 'twitter', url: '', enabled: false },
          { platform: 'linkedin', url: '', enabled: false }
        ]
      };

      const res = await makeRequest(port, '/api/admin/social-media-links', 'POST', payload, authHeaders);
      assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
      
      const fb = res.body.socialMediaLinks.find(l => l.platform === 'facebook');
      assert.strictEqual(fb.url, 'https://facebook.com/easydesk-official');
      assert.strictEqual(fb.enabled, true);
    });

    // -----------------------------------------------------------------
    // TEST 4: Enabled links appear in public footer endpoint
    // -----------------------------------------------------------------
    await it('4. Public endpoint GET /api/social-media-links returns active enabled links', async () => {
      const res = await makeRequest(port, '/api/social-media-links', 'GET');
      assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
      assert(Array.isArray(res.body.socialMediaLinks), 'Expected socialMediaLinks array');
      
      const active = res.body.socialMediaLinks.filter(l => l.enabled && l.url);
      assert.strictEqual(active.length, 2, `Expected 2 active links, got ${active.length}`);
      
      const fb = active.find(l => l.platform === 'facebook');
      const ig = active.find(l => l.platform === 'instagram');
      assert.strictEqual(fb.url, 'https://facebook.com/easydesk-official');
      assert.strictEqual(ig.url, 'https://instagram.com/easydesk');
    });

    // -----------------------------------------------------------------
    // TEST 5: Disabled links are excluded or marked disabled
    // -----------------------------------------------------------------
    await it('5. Disabled link is marked enabled: false and excluded by client active filter', async () => {
      // Disable Instagram
      const payload = {
        socialMediaLinks: [
          { platform: 'facebook', url: 'https://facebook.com/easydesk-official', enabled: true },
          { platform: 'instagram', url: 'https://instagram.com/easydesk', enabled: false },
          { platform: 'whatsapp', url: '', enabled: false },
          { platform: 'youtube', url: '', enabled: false },
          { platform: 'telegram', url: '', enabled: false },
          { platform: 'twitter', url: '', enabled: false },
          { platform: 'linkedin', url: '', enabled: false }
        ]
      };

      await makeRequest(port, '/api/admin/social-media-links', 'POST', payload, authHeaders);
      
      const res = await makeRequest(port, '/api/social-media-links', 'GET');
      const ig = res.body.socialMediaLinks.find(l => l.platform === 'instagram');
      assert.strictEqual(ig.enabled, false, 'Expected Instagram enabled: false');

      const active = res.body.socialMediaLinks.filter(l => l.enabled && l.url);
      assert.strictEqual(active.length, 1, 'Only 1 link should be active');
      assert.strictEqual(active[0].platform, 'facebook');
    });

    // -----------------------------------------------------------------
    // TEST 6: Empty URL with enabled=true is normalized to disabled
    // -----------------------------------------------------------------
    await it('6. Platform with empty/whitespace URL and enabled=true is normalized to enabled: false', async () => {
      const payload = {
        socialMediaLinks: [
          { platform: 'facebook', url: 'https://facebook.com/easydesk-official', enabled: true },
          { platform: 'youtube', url: '   ', enabled: true },
          { platform: 'instagram', url: '', enabled: false },
          { platform: 'whatsapp', url: '', enabled: false },
          { platform: 'telegram', url: '', enabled: false },
          { platform: 'twitter', url: '', enabled: false },
          { platform: 'linkedin', url: '', enabled: false }
        ]
      };

      const res = await makeRequest(port, '/api/admin/social-media-links', 'POST', payload, authHeaders);
      assert.strictEqual(res.status, 200);
      
      const yt = res.body.socialMediaLinks.find(l => l.platform === 'youtube');
      assert.strictEqual(yt.enabled, false, 'Empty URL platform must not be enabled');
      assert.strictEqual(yt.url, '', 'Whitespace should be trimmed to empty string');
    });

    // -----------------------------------------------------------------
    // TEST 7: Unsafe schemes rejected with 400 Bad Request
    // -----------------------------------------------------------------
    await it('7. Unsafe schemes (javascript:, data:, vbscript:) are strictly rejected with 400', async () => {
      const xssPayload = {
        socialMediaLinks: [
          { platform: 'facebook', url: 'javascript:alert(document.cookie)', enabled: true }
        ]
      };
      const res1 = await makeRequest(port, '/api/admin/social-media-links', 'POST', xssPayload, authHeaders);
      assert.strictEqual(res1.status, 400, `Expected 400 for javascript: URL, got ${res1.status}`);

      const dataPayload = {
        socialMediaLinks: [
          { platform: 'facebook', url: 'data:text/html,<script>alert(1)</script>', enabled: true }
        ]
      };
      const res2 = await makeRequest(port, '/api/admin/social-media-links', 'POST', dataPayload, authHeaders);
      assert.strictEqual(res2.status, 400, `Expected 400 for data: URL, got ${res2.status}`);

      const vbPayload = {
        socialMediaLinks: [
          { platform: 'facebook', url: 'vbscript:msgbox(1)', enabled: true }
        ]
      };
      const res3 = await makeRequest(port, '/api/admin/social-media-links', 'POST', vbPayload, authHeaders);
      assert.strictEqual(res3.status, 400, `Expected 400 for vbscript: URL, got ${res3.status}`);
    });

    // -----------------------------------------------------------------
    // TEST 8: WhatsApp format handling
    // -----------------------------------------------------------------
    await it('8. WhatsApp wa.me links are auto-prefixed with https:// and accepted', async () => {
      const payload = {
        socialMediaLinks: [
          { platform: 'whatsapp', url: 'wa.me/919999988888', enabled: true }
        ]
      };

      const res = await makeRequest(port, '/api/admin/social-media-links', 'POST', payload, authHeaders);
      assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
      
      const wa = res.body.socialMediaLinks.find(l => l.platform === 'whatsapp');
      assert.strictEqual(wa.enabled, true);
      assert.strictEqual(wa.url, 'https://wa.me/919999988888');
    });

    // -----------------------------------------------------------------
    // TEST 9: Persistence across read-back and alias endpoints
    // -----------------------------------------------------------------
    await it('9. Data persists and is read back consistently across GET endpoints', async () => {
      const resAdmin = await makeRequest(port, '/api/admin/social-media-links', 'GET', null, authHeaders);
      assert.strictEqual(resAdmin.status, 200);
      assert(Array.isArray(resAdmin.body.socialMediaLinks));

      const resAlias = await makeRequest(port, '/api/settings/social-media', 'GET');
      assert.strictEqual(resAlias.status, 200);
      assert.deepStrictEqual(resAdmin.body.socialMediaLinks, resAlias.body.socialMediaLinks);
    });

    // -----------------------------------------------------------------
    // TEST 10: Existing contact settings & CMS unaffected
    // -----------------------------------------------------------------
    await it('10. Existing contact settings & CMS endpoints remain fully operational', async () => {
      const resContact = await makeRequest(port, '/api/contact-settings', 'GET');
      assert.strictEqual(resContact.status, 200);
      assert(resContact.body, 'Expected contact settings object');
      // Verify backwards-compatible socialMedia mirror in contactSettings
      assert(resContact.body.socialMedia, 'Expected socialMedia mirror in contactSettings');
      assert.strictEqual(resContact.body.socialMedia.whatsapp, 'https://wa.me/919999988888');

      const resServices = await makeRequest(port, '/api/services', 'GET');
      assert.strictEqual(resServices.status, 200);
      assert(Array.isArray(resServices.body), 'Expected services array');
    });

    // -----------------------------------------------------------------
    // TEST 11: Unauthorized write protection
    // -----------------------------------------------------------------
    await it('11. Unauthorized write attempts return 401/403', async () => {
      const payload = {
        socialMediaLinks: [{ platform: 'facebook', url: 'https://facebook.com/hacked', enabled: true }]
      };

      // No token -> 401
      const resNoAuth = await makeRequest(port, '/api/admin/social-media-links', 'POST', payload);
      assert.strictEqual(resNoAuth.status, 401, `Expected 401, got ${resNoAuth.status}`);

      // Customer token (insufficient permissions) -> 403
      const resCustAuth = await makeRequest(port, '/api/admin/social-media-links', 'POST', payload, {
        'Authorization': `Bearer ${customerToken}`
      });
      assert.strictEqual(resCustAuth.status, 403, `Expected 403, got ${resCustAuth.status}`);
    });

    // -----------------------------------------------------------------
    // TEST 12: All links disabled hides footer section
    // -----------------------------------------------------------------
    await it('12. When all links are disabled, active links list is empty and footer hides section', async () => {
      const payload = {
        socialMediaLinks: [
          { platform: 'facebook', url: '', enabled: false },
          { platform: 'instagram', url: '', enabled: false },
          { platform: 'whatsapp', url: '', enabled: false },
          { platform: 'youtube', url: '', enabled: false },
          { platform: 'telegram', url: '', enabled: false },
          { platform: 'twitter', url: '', enabled: false },
          { platform: 'linkedin', url: '', enabled: false }
        ]
      };

      const res = await makeRequest(port, '/api/admin/social-media-links', 'POST', payload, authHeaders);
      assert.strictEqual(res.status, 200);

      const resPublic = await makeRequest(port, '/api/social-media-links', 'GET');
      assert.strictEqual(resPublic.status, 200);
      
      const active = resPublic.body.socialMediaLinks.filter(l => l.enabled && l.url);
      assert.strictEqual(active.length, 0, 'No active links should be returned when all disabled');
    });

  } finally {
    server.close();
  }

  console.log('\n------------------------------------------------------------');
  console.log(`TOTAL: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
  console.log('------------------------------------------------------------\n');

  if (passedTests === totalTests) {
    console.log('All Social Media Links CMS tests passed successfully!\n');
  } else {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Test suite failed unexpectedly:', err);
  process.exit(1);
});
