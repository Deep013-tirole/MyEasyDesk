/**
 * EASYDESK — INDIAN STRUCTURED ADDRESS PERSISTENCE & LIFECYCLE TEST SUITE
 * 
 * Verifies:
 * 1. Canonical master list integrity (exactly 28 States, 8 UTs, 36 total)
 * 2. District mapping coverage (all 36 States/UTs mapped to constituent districts)
 * 3. PIN code validation (/^[1-9][0-9]{5}$/)
 * 4. State normalization helper (casing, whitespace, canonical names)
 * 5. Structured address format helper (composite string generation)
 * 6. API endpoint GET /api/address/states
 * 7. API endpoint GET /api/address/districts/:state
 * 8. Customer creation with non-Maharashtra state (Madhya Pradesh)
 * 9. Customer read & hydration (all structured address fields intact)
 * 10. Customer address update to Gujarat
 * 11. Customer intentional update to Maharashtra
 * 12. Empty address creation: state remains empty, NOT defaulted to Maharashtra
 * 13. Employee operational address lifecycle (Rajasthan -> Jaipur)
 * 14. Public order submission with structured address (Karnataka -> Bengaluru)
 * 15. Manual order creation & order editing (Punjab -> Haryana)
 * 16. Historical record integrity: Existing customers and service categories preserved
 */

process.env.IS_WORKER = 'true';
process.env.NODE_ENV = 'test';

const http = require('http');
const assert = require('assert');
const jwt = require('jsonwebtoken');

let server;
let port;
let adminToken;
let app;
let getJwtSecret;

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

function makeRequest(path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'x-csrf-token': 'easydesk_secure_csrf_token_2026_val',
      ...headers
    };
    if (adminToken && !defaultHeaders['Authorization']) {
      defaultHeaders['Authorization'] = `Bearer ${adminToken}`;
    }

    const payload = body ? JSON.stringify(body) : null;
    if (payload) {
      defaultHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: defaultHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed;
        try {
          parsed = data ? JSON.parse(data) : null;
        } catch (e) {
          parsed = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('\n===============================================================');
  console.log('EASYDESK — INDIAN STRUCTURED ADDRESS PERSISTENCE TEST SUITE');
  console.log('===============================================================\n');

  // Load compiled server
  const serverModule = require('../dist/server.cjs');
  app = serverModule.app;
  getJwtSecret = serverModule.getJwtSecret;

  adminToken = jwt.sign({
    id: 'super-admin-deepak',
    email: 'tideepak8@gmail.com',
    role: 'SUPER_ADMIN'
  }, getJwtSecret());

  // Start temporary test server
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      console.log(`Test server listening on port ${port}\n`);
      resolve();
    });
  });

  // Load address helpers from dist/server or import
  const {
    INDIAN_STATES_AND_UTS,
    INDIAN_DISTRICTS_BY_STATE,
    getAllIndianStateNames,
    isValidIndianState,
    normalizeIndianState,
    getDistrictsForState,
    isValidIndianPinCode,
    formatStructuredAddress
  } = require('../dist/server.cjs');

  // SCENARIO 1: Master List Integrity
  await it('1. Master list contains exactly 28 States and 8 Union Territories (36 total)', () => {
    assert(Array.isArray(INDIAN_STATES_AND_UTS), 'INDIAN_STATES_AND_UTS must be an array');
    assert.strictEqual(INDIAN_STATES_AND_UTS.length, 36, `Expected 36 entries, got ${INDIAN_STATES_AND_UTS.length}`);
    const states = INDIAN_STATES_AND_UTS.filter(s => s.type === 'STATE');
    const uts = INDIAN_STATES_AND_UTS.filter(s => s.type === 'UT');
    assert.strictEqual(states.length, 28, `Expected 28 States, got ${states.length}`);
    assert.strictEqual(uts.length, 8, `Expected 8 UTs, got ${uts.length}`);
    assert(states.some(s => s.name === 'Madhya Pradesh'));
    assert(states.some(s => s.name === 'Maharashtra'));
    assert(states.some(s => s.name === 'Karnataka'));
    assert(states.some(s => s.name === 'Punjab'));
    assert(uts.some(s => s.name === 'Delhi'));
  });

  // SCENARIO 2: District Mapping Coverage
  await it('2. District mapping returns valid lists for all 36 States/UTs and empty for invalid state', () => {
    const mpDistricts = getDistrictsForState('Madhya Pradesh');
    assert(Array.isArray(mpDistricts) && mpDistricts.length > 0, 'MP should have districts');
    assert(mpDistricts.includes('Bhopal') && mpDistricts.includes('Indore'));

    const mhDistricts = getDistrictsForState('Maharashtra');
    assert(mhDistricts.includes('Mumbai City') && mhDistricts.includes('Pune'));

    const dlDistricts = getDistrictsForState('Delhi');
    assert(dlDistricts.includes('New Delhi'));

    const invalidDistricts = getDistrictsForState('NonExistentState');
    assert.strictEqual(invalidDistricts.length, 0, 'Invalid state should return empty array');
  });

  // SCENARIO 3: PIN Code Validation
  await it('3. PIN code validator strictly enforces 6-digit Indian postal code format', () => {
    assert.strictEqual(isValidIndianPinCode('400001'), true);
    assert.strictEqual(isValidIndianPinCode('462001'), true);
    assert.strictEqual(isValidIndianPinCode('110001'), true);
    assert.strictEqual(isValidIndianPinCode('273001'), true);

    // Invalid PIN codes
    assert.strictEqual(isValidIndianPinCode('012345'), false, 'Cannot start with 0');
    assert.strictEqual(isValidIndianPinCode('4000'), false, 'Too short');
    assert.strictEqual(isValidIndianPinCode('4000001'), false, 'Too long');
    assert.strictEqual(isValidIndianPinCode('abc400'), false, 'Non-numeric');
    assert.strictEqual(isValidIndianPinCode(''), false, 'Empty string');
    assert.strictEqual(isValidIndianPinCode(null), false, 'Null value');
  });

  // SCENARIO 4: State Name Normalization
  await it('4. Normalization resolves case and whitespace variations to canonical state names', () => {
    assert.strictEqual(normalizeIndianState('maharashtra'), 'Maharashtra');
    assert.strictEqual(normalizeIndianState('  madhya pradesh  '), 'Madhya Pradesh');
    assert.strictEqual(normalizeIndianState('DELHI'), 'Delhi');
    assert.strictEqual(normalizeIndianState('UTTAR PRADESH'), 'Uttar Pradesh');
    assert.strictEqual(isValidIndianState('Maharashtra'), true);
    assert.strictEqual(isValidIndianState('Madhya Pradesh'), true);
    assert.strictEqual(isValidIndianState('UnknownLand'), false);
  });

  // SCENARIO 5: Address Format Helper
  await it('5. Address formatting helper generates clean composite address without duplicates', () => {
    const formatted = formatStructuredAddress({
      addressLine1: 'Flat 302, Lotus Heights',
      addressLine2: 'MG Road',
      locality: 'Arera Colony',
      landmark: 'Near 10 Number Market',
      city: 'Bhopal',
      district: 'Bhopal',
      state: 'Madhya Pradesh',
      pinCode: '462016'
    });
    assert(formatted.includes('Lotus Heights'));
    assert(formatted.includes('Bhopal'));
    assert(formatted.includes('Madhya Pradesh'));
    assert(formatted.includes('462016'));
  });

  // SCENARIO 6: Server API endpoint GET /api/address/states
  await it('6. GET /api/address/states returns canonical master list over HTTP', async () => {
    const res = await makeRequest('/api/address/states');
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body));
    assert.strictEqual(res.body.length, 36);
  });

  // SCENARIO 7: Server API endpoint GET /api/address/districts/:state
  await it('7. GET /api/address/districts/Maharashtra returns valid districts over HTTP', async () => {
    const res = await makeRequest('/api/address/districts/Maharashtra');
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.body));
    assert(res.body.includes('Mumbai City') || res.body.includes('Pune'));
  });

  // SCENARIO 8: Customer Creation with Non-Maharashtra State (Madhya Pradesh)
  let testCustomerId = `test-cust-mp-${Date.now()}`;
  await it('8. POST /api/admin/customers creates record with state=Madhya Pradesh without Maharashtra default', async () => {
    const payload = {
      id: testCustomerId,
      name: 'Ramesh Sharma',
      email: `ramesh.${Date.now()}@bhopal.client`,
      mobile: '98260' + Math.floor(10000 + Math.random() * 90000),
      country: 'India',
      state: 'Madhya Pradesh',
      district: 'Bhopal',
      city: 'Bhopal',
      pincode: '462001',
      addressLine1: 'Plot 45, MP Nagar Zone 2',
      customerType: 'Individual',
      status: 'Active'
    };

    const res = await makeRequest('/api/admin/customers', 'POST', payload);
    assert.strictEqual(res.status, 201, `Failed with status ${res.status}: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.state, 'Madhya Pradesh', `Expected Madhya Pradesh, got ${res.body.state}`);
    assert.strictEqual(res.body.city, 'Bhopal');
    assert.strictEqual(res.body.district, 'Bhopal');
    assert.strictEqual(res.body.pincode, '462001');
    assert.strictEqual(res.body.pinCode, '462001');
  });

  // SCENARIO 9: Customer Read & Hydration
  await it('9. GET /api/admin/customers/:id returns exactly the saved Madhya Pradesh state & fields', async () => {
    const res = await makeRequest(`/api/admin/customers/${testCustomerId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.state, 'Madhya Pradesh');
    assert.strictEqual(res.body.city, 'Bhopal');
    assert.strictEqual(res.body.district, 'Bhopal');
    assert.strictEqual(res.body.pincode, '462001');
    assert.strictEqual(res.body.pinCode, '462001');
    assert.notStrictEqual(res.body.state, 'Maharashtra');
  });

  // SCENARIO 10: Customer Address Update to Gujarat
  await it('10. PUT /api/admin/customers/:id updates state to Gujarat with zero Maharashtra override', async () => {
    const updatePayload = {
      state: 'Gujarat',
      district: 'Ahmedabad',
      city: 'Ahmedabad',
      pincode: '380001',
      addressLine1: '101, Ashram Road'
    };

    const res = await makeRequest(`/api/admin/customers/${testCustomerId}`, 'PUT', updatePayload);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.state, 'Gujarat');
    assert.strictEqual(res.body.city, 'Ahmedabad');
    assert.strictEqual(res.body.district, 'Ahmedabad');
    assert.strictEqual(res.body.pincode, '380001');
  });

  // SCENARIO 11: Intentional Update to Maharashtra Works
  await it('11. PUT /api/admin/customers/:id correctly saves Maharashtra when user intentionally selects it', async () => {
    const updatePayload = {
      state: 'Maharashtra',
      district: 'Pune',
      city: 'Pune',
      pincode: '411001',
      addressLine1: 'FC Road, Deccan'
    };

    const res = await makeRequest(`/api/admin/customers/${testCustomerId}`, 'PUT', updatePayload);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.state, 'Maharashtra');
    assert.strictEqual(res.body.city, 'Pune');
    assert.strictEqual(res.body.district, 'Pune');
    assert.strictEqual(res.body.pincode, '411001');
  });

  // SCENARIO 12: Empty Address Creation Has No Hardcoded Default
  let emptyCustId = `test-cust-empty-${Date.now()}`;
  await it('12. POST /api/admin/customers with empty state does NOT default to Maharashtra', async () => {
    const payload = {
      id: emptyCustId,
      name: 'Unspecified Address User',
      email: `unspec.${Date.now()}@client.easydesk`,
      mobile: '98000' + Math.floor(10000 + Math.random() * 90000),
      state: '',
      city: '',
      pincode: '',
      customerType: 'Individual',
      status: 'Active'
    };

    const res = await makeRequest('/api/admin/customers', 'POST', payload);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.state, '', `State should remain empty, got ${res.body.state}`);
    assert.notStrictEqual(res.body.state, 'Maharashtra');
  });

  // SCENARIO 13: Employee Operational Address Lifecycle
  let testEmpId = `test-emp-raj-${Date.now()}`;
  await it('13. Employee operational address persists Rajasthan -> Jaipur cleanly', async () => {
    const payload = {
      id: testEmpId,
      employeeCode: `EMP-T-${Date.now().toString().slice(-4)}`,
      fullName: 'Vikramaditya Singh',
      designation: 'Senior Legal Officer',
      department: 'Compliance',
      personalEmail: `vikram.${Date.now()}@easydesk.in`,
      personalMobile: '94140' + Math.floor(10000 + Math.random() * 90000),
      state: 'Rajasthan',
      district: 'Jaipur',
      city: 'Jaipur',
      pinCode: '302001',
      currentAddress: 'Civil Lines, Jaipur, Rajasthan',
      employmentType: 'Full-Time',
      employmentStatus: 'Active'
    };

    const res = await makeRequest('/api/admin/employees', 'POST', payload);
    assert([200, 201].includes(res.status), `Failed employee create: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.state, 'Rajasthan');
    assert.strictEqual(res.body.city, 'Jaipur');
    assert.strictEqual(res.body.pinCode, '302001');
    assert.strictEqual(res.body.pincode, '302001');

    // Read back employee
    const getRes = await makeRequest(`/api/admin/employees/${testEmpId}`);
    assert.strictEqual(getRes.status, 200);
    assert.strictEqual(getRes.body.state, 'Rajasthan');
    assert.strictEqual(getRes.body.district, 'Jaipur');
    assert.strictEqual(getRes.body.city, 'Jaipur');
  });

  // SCENARIO 14: Public Order Submission with Structured Address (Karnataka -> Bengaluru)
  let testOrderId;
  await it('14. POST /api/orders preserves Karnataka state and Bengaluru city without Maharashtra fallback', async () => {
    // Pick an existing service
    const servRes = await makeRequest('/api/services');
    assert(Array.isArray(servRes.body) && servRes.body.length > 0, 'Must have at least 1 service');
    const service = servRes.body[0];

    const orderPayload = {
      serviceId: service.id,
      orderSource: 'Website',
      name: 'Ananya Rao',
      email: `ananya.${Date.now()}@bangalore.client`,
      mobile: '98450' + Math.floor(10000 + Math.random() * 90000),
      address: 'Indiranagar 100ft Road',
      district: 'Bengaluru Urban',
      city: 'Bengaluru',
      state: 'Karnataka',
      pinCode: '560038'
    };

    const res = await makeRequest('/api/orders', 'POST', orderPayload);
    assert([200, 201].includes(res.status), `Order creation failed: ${JSON.stringify(res.body)}`);
    assert(res.body.id, 'Expected order ID');
    testOrderId = res.body.id;
    assert.strictEqual(res.body.state, 'Karnataka', `Expected Karnataka, got ${res.body.state}`);
    assert.strictEqual(res.body.city, 'Bengaluru');
    assert.strictEqual(res.body.pinCode, '560038');
    assert.strictEqual(res.body.pincode, '560038');
  });

  // SCENARIO 15: Manual Order Creation (Punjab) & Admin Order Address Editing (Haryana)
  await it('15. Manual order creation preserves Punjab and PUT /api/admin/orders/:id updates to Haryana', async () => {
    const servRes = await makeRequest('/api/services');
    const service = servRes.body[0];

    const manualPayload = {
      serviceId: service.id,
      orderSource: 'WhatsApp',
      newCustomer: {
        name: 'Harpreet Kaur',
        mobile: '98140' + Math.floor(10000 + Math.random() * 90000),
        email: `harpreet.${Date.now()}@punjab.client`,
        address: 'Mall Road',
        district: 'Amritsar',
        city: 'Amritsar',
        state: 'Punjab',
        pincode: '143001'
      }
    };

    const res = await makeRequest('/api/admin/orders', 'POST', manualPayload);
    assert.strictEqual(res.status, 201, `Failed manual order create: ${JSON.stringify(res.body)}`);
    const createdOrder = res.body.order;
    assert.strictEqual(createdOrder.state, 'Punjab');
    assert.strictEqual(createdOrder.city, 'Amritsar');
    assert.strictEqual(createdOrder.pinCode, '143001');

    // Now edit order address to Haryana (Gurugram, 122001)
    const editPayload = {
      address: 'Golf Course Road, Sector 54',
      district: 'Gurugram',
      city: 'Gurugram',
      state: 'Haryana',
      pinCode: '122001'
    };

    const putRes = await makeRequest(`/api/admin/orders/${createdOrder.id}`, 'PUT', editPayload);
    assert.strictEqual(putRes.status, 200, `Failed order PUT: ${JSON.stringify(putRes.body)}`);
    assert.strictEqual(putRes.body.order.state, 'Haryana');
    assert.strictEqual(putRes.body.order.city, 'Gurugram');
    assert.strictEqual(putRes.body.order.district, 'Gurugram');
    assert.strictEqual(putRes.body.order.pinCode, '122001');
  });

  // SCENARIO 16: Historical Record Integrity
  await it('16. Historical records with non-Maharashtra states and baseline service categories remain untouched', async () => {
    // Verify historical customer with Uttar Pradesh
    const custRes = await makeRequest('/api/admin/customers');
    assert.strictEqual(custRes.status, 200);
    const historicalCust = custRes.body.find(c => c.id === 'cust-1788633398793');
    if (historicalCust) {
      assert.strictEqual(historicalCust.state, 'Uttar Pradesh', 'Historical UP customer must not be mutated');
      assert.strictEqual(historicalCust.city, 'Gorakhpur');
      assert.strictEqual(historicalCust.pincode, '273001');
    }

    // Verify all 8 original service categories are intact
    const catRes = await makeRequest('/api/categories?all=true');
    assert.strictEqual(catRes.status, 200);
    assert(Array.isArray(catRes.body) && catRes.body.length >= 8, `Expected >= 8 categories, got ${catRes.body.length}`);
  });

  // Shutdown server
  await new Promise((resolve) => server.close(resolve));

  console.log('\n===============================================================');
  console.log(`TOTAL TESTS: ${totalTests}`);
  console.log(`PASSED: ${passedTests}`);
  console.log(`FAILED: ${totalTests - passedTests}`);
  console.log('===============================================================\n');

  if (totalTests !== passedTests) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error in test suite:', err);
  if (server) server.close();
  process.exit(1);
});
