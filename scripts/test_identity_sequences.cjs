/**
 * EASYDESK — SEQUENTIAL IDENTITY & CUSTOMER-ORDER RELATIONSHIP TEST SUITE
 * 
 * Verifies all 25 specific requirements from Section 14:
 * 1. New customer gets sequential Customer ID (CUST-00xxxx).
 * 2. Second new customer gets next sequential ID.
 * 3. New employee gets sequential Employee ID (EMP-00xxxx).
 * 4. Second employee gets next sequential ID.
 * 5. New order gets sequential Order ID (ORD-00xxxx).
 * 6. Second order gets next sequential ID.
 * 7. Deleted customer ID is not reused.
 * 8. Deleted employee ID is not reused.
 * 9. Deleted order ID is not reused.
 * 10. Refresh does not reset counters.
 * 11. Cold start does not reset counters.
 * 12. Apply Online creates customer when applicant is new.
 * 13. Apply Online creates order linked to customer.
 * 14. New Apply Online service by same customer does NOT create another customer.
 * 15. Same customer can have multiple orders.
 * 16. Customer Management shows Apply Online customer.
 * 17. Customer Management shows all linked orders.
 * 18. Admin Orders shows the same order.
 * 19. Track Order continues to find the order.
 * 20. WhatsApp/manual order can reuse existing customer.
 * 21. Duplicate customer creation is prevented server-side.
 * 22. Concurrent/sequential creation does not produce duplicate IDs.
 * 23. Customer/order relationship survives refresh.
 * 24. Customer/order relationship survives logout/login.
 * 25. Customer/order relationship survives browser restart simulation.
 * Plus: SEO isolation verification (customer and order IDs not exposed in sitemap/robots).
 */

process.env.IS_WORKER = 'true';
process.env.NODE_ENV = 'test';

const http = require('http');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { 
  app, 
  getJwtSecret, 
  ensureDatabaseReady, 
  dbState, 
  initEntitySequences,
  getNextSequence,
  extractMaxNumber,
  allocateNextSequenceInD1,
  initEntitySequencesInD1,
  getEntitySequencesFromD1
} = require('../dist/server.cjs');

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
    const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      'x-csrf-token': 'easydesk_secure_csrf_token_2026_val',
      ...headers
    };
    if (postData && !reqHeaders['Content-Type'].includes('multipart/form-data')) {
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

function parseSeqNumber(id) {
  const match = (id || '').match(/(\d+)/g);
  if (!match) return null;
  return parseInt(match[match.length - 1], 10);
}

async function runSuite() {
  console.log('\n============================================================');
  console.log('EASYDESK SEQUENTIAL IDENTITY & RELATIONSHIP TEST SUITE');
  console.log('============================================================\n');

  await ensureDatabaseReady();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`[TEST SERVER] Running on ephemeral port ${port}\n`);

  const authHeaders = { Authorization: `Bearer ${adminToken}` };

  const runId = Math.floor(1000 + Math.random() * 9000).toString();

  let testCust1 = null;
  let testCust2 = null;
  let testEmp1 = null;
  let testEmp2 = null;
  let testOrd1 = null;
  let testOrd2 = null;
  let deletedCustSeq = null;
  let deletedEmpSeq = null;

  try {
    // -------------------------------------------------------------
    // Test 1: New customer gets sequential Customer ID
    // -------------------------------------------------------------
    await it('1. New customer gets sequential Customer ID (CUST-00xxxx)', async () => {
      const res = await makeRequest(port, '/api/admin/customers', 'POST', {
        name: 'Sequential Customer One',
        mobile: `9811${runId}1`,
        email: `seq.cust1.${runId}@example.com`,
        city: 'Indore',
        state: 'Madhya Pradesh',
        pincode: '452010'
      }, authHeaders);

      assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
      assert(res.body.id, 'Customer ID must be present');
      assert(/^CUST-\d{6}$/.test(res.body.id), `Expected CUST-00xxxx, got ${res.body.id}`);
      assert.strictEqual(res.body.code, res.body.id, 'Customer code must equal customer id');
      testCust1 = res.body;
    });

    // -------------------------------------------------------------
    // Test 2: Second new customer gets next sequential ID
    // -------------------------------------------------------------
    await it('2. Second new customer gets next sequential ID', async () => {
      const res = await makeRequest(port, '/api/admin/customers', 'POST', {
        name: 'Sequential Customer Two',
        mobile: `9811${runId}2`,
        email: `seq.cust2.${runId}@example.com`,
        city: 'Bhopal',
        state: 'Madhya Pradesh',
        pincode: '462001'
      }, authHeaders);

      assert.strictEqual(res.status, 201);
      assert(/^CUST-\d{6}$/.test(res.body.id));
      testCust2 = res.body;

      const num1 = parseSeqNumber(testCust1.id);
      const num2 = parseSeqNumber(testCust2.id);
      assert.strictEqual(num2, num1 + 1, `Second customer ID ${testCust2.id} must be exactly +1 from ${testCust1.id}`);
    });

    // -------------------------------------------------------------
    // Test 3: New employee gets sequential Employee ID
    // -------------------------------------------------------------
    await it('3. New employee gets sequential Employee ID (EMP-00xxxx)', async () => {
      const res = await makeRequest(port, '/api/admin/employees', 'POST', {
        fullName: 'Sequential Employee One',
        designation: 'Case Officer',
        department: 'Operations',
        personalMobile: `9822${runId}1`,
        personalEmail: `seq.emp1.${runId}@easydesk.in`,
        city: 'Indore',
        state: 'Madhya Pradesh',
        pinCode: '452010'
      }, authHeaders);

      assert(res.status === 200 || res.status === 201, `Expected 200/201, got ${res.status}`);
      const emp = res.body.employee || res.body;
      assert(emp, 'Employee profile must be returned');
      assert(/^EMP-\d{6}$/.test(emp.id), `Expected EMP-00xxxx, got ${emp.id}`);
      testEmp1 = emp;
    });

    // -------------------------------------------------------------
    // Test 4: Second employee gets next sequential ID
    // -------------------------------------------------------------
    await it('4. Second employee gets next sequential ID', async () => {
      const res = await makeRequest(port, '/api/admin/employees', 'POST', {
        fullName: 'Sequential Employee Two',
        designation: 'Verification Officer',
        department: 'Operations',
        personalMobile: `9822${runId}2`,
        personalEmail: `seq.emp2.${runId}@easydesk.in`,
        city: 'Ujjain',
        state: 'Madhya Pradesh',
        pinCode: '456001'
      }, authHeaders);

      assert(res.status === 200 || res.status === 201, `Expected 200/201, got ${res.status}`);
      const emp = res.body.employee || res.body;
      assert(/^EMP-\d{6}$/.test(emp.id));
      testEmp2 = emp;

      const num1 = parseSeqNumber(testEmp1.id);
      const num2 = parseSeqNumber(testEmp2.id);
      assert.strictEqual(num2, num1 + 1, `Second employee ID ${testEmp2.id} must be exactly +1 from ${testEmp1.id}`);
    });

    // -------------------------------------------------------------
    // Test 5: New order gets sequential Order ID
    // -------------------------------------------------------------
    const sampleService = (dbState.services && dbState.services[0]) ? dbState.services[0] : { id: 'svc-pan-card', title: 'PAN Card Assistance' };

    await it('5. New order gets sequential Order ID (ORD-00xxxx)', async () => {
      const res = await makeRequest(port, '/api/admin/orders', 'POST', {
        customerId: testCust1.id,
        serviceId: sampleService.id,
        orderSource: 'WhatsApp',
        paymentMethod: 'UPI',
        paymentStatus: 'Pending Verification'
      }, authHeaders);

      assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
      const ordId = res.body.id || res.body.orderId || res.body.order?.id;
      assert(ordId, 'Order ID must be returned');
      assert(/^ORD-\d{6}$/.test(ordId), `Expected ORD-00xxxx, got ${ordId}`);
      testOrd1 = res.body.order || res.body;
      testOrd1.id = ordId;
    });

    // -------------------------------------------------------------
    // Test 6: Second order gets next sequential ID
    // -------------------------------------------------------------
    await it('6. Second order gets next sequential ID', async () => {
      const res = await makeRequest(port, '/api/admin/orders', 'POST', {
        customerId: testCust1.id,
        serviceId: sampleService.id,
        orderSource: 'Phone',
        paymentMethod: 'Bank Transfer',
        paymentStatus: 'Pending Verification'
      }, authHeaders);

      assert.strictEqual(res.status, 201);
      const ordId = res.body.id || res.body.orderId || res.body.order?.id;
      assert(/^ORD-\d{6}$/.test(ordId));
      testOrd2 = res.body.order || res.body;
      testOrd2.id = ordId;

      const num1 = parseSeqNumber(testOrd1.id);
      const num2 = parseSeqNumber(testOrd2.id);
      assert.strictEqual(num2, num1 + 1, `Second order ID ${testOrd2.id} must be exactly +1 from ${testOrd1.id}`);
    });

    // -------------------------------------------------------------
    // Test 7: Deleted customer ID is not reused
    // -------------------------------------------------------------
    await it('7. Deleted customer ID is not reused', async () => {
      // Create a customer to delete
      const toDeleteRes = await makeRequest(port, '/api/admin/customers', 'POST', {
        name: 'Temporary Customer To Delete',
        mobile: `9833${runId}1`,
        email: `temp.cust.${runId}@example.com`
      }, authHeaders);
      assert.strictEqual(toDeleteRes.status, 201);
      const toDeleteId = toDeleteRes.body.id;
      deletedCustSeq = parseSeqNumber(toDeleteId);

      // Delete the customer
      const delRes = await makeRequest(port, `/api/admin/customers/${toDeleteId}`, 'DELETE', null, authHeaders);
      assert.strictEqual(delRes.status, 200);

      // Create a subsequent customer - sequence must be > deletedCustSeq
      const nextCustRes = await makeRequest(port, '/api/admin/customers', 'POST', {
        name: 'Post Delete Customer',
        mobile: `9833${runId}2`,
        email: `post.delete.${runId}@example.com`
      }, authHeaders);
      assert.strictEqual(nextCustRes.status, 201);
      const nextCustSeq = parseSeqNumber(nextCustRes.body.id);

      assert(nextCustSeq > deletedCustSeq, `New customer ID sequence (${nextCustSeq}) must exceed deleted sequence (${deletedCustSeq})`);
      assert.notStrictEqual(nextCustRes.body.id, toDeleteId, 'Deleted customer ID must never be reused');
    });

    // -------------------------------------------------------------
    // Test 8: Deleted employee ID is not reused
    // -------------------------------------------------------------
    await it('8. Deleted employee ID is not reused', async () => {
      // Create an employee to delete
      const toDeleteRes = await makeRequest(port, '/api/admin/employees', 'POST', {
        fullName: 'Temporary Employee To Delete',
        designation: 'Intern',
        department: 'General',
        personalMobile: `9844${runId}1`,
        personalEmail: `temp.emp.${runId}@example.com`
      }, authHeaders);
      assert(toDeleteRes.status === 200 || toDeleteRes.status === 201);
      const empToDelete = toDeleteRes.body.employee || toDeleteRes.body;
      const toDeleteId = empToDelete.id;
      deletedEmpSeq = parseSeqNumber(toDeleteId);

      // Hard delete the employee
      const delRes = await makeRequest(port, `/api/admin/employees/${toDeleteId}?hardDelete=true`, 'DELETE', null, authHeaders);
      assert.strictEqual(delRes.status, 200);

      // Create a subsequent employee - sequence must be > deletedEmpSeq
      const nextEmpRes = await makeRequest(port, '/api/admin/employees', 'POST', {
        fullName: 'Post Delete Employee',
        designation: 'Staff',
        department: 'Operations',
        personalMobile: `9844${runId}2`,
        personalEmail: `post.emp.${runId}@example.com`
      }, authHeaders);
      assert(nextEmpRes.status === 200 || nextEmpRes.status === 201);
      const nextEmp = nextEmpRes.body.employee || nextEmpRes.body;
      const nextEmpSeq = parseSeqNumber(nextEmp.id);

      assert(nextEmpSeq > deletedEmpSeq, `New employee ID sequence (${nextEmpSeq}) must exceed deleted sequence (${deletedEmpSeq})`);
      assert.notStrictEqual(nextEmp.id, toDeleteId, 'Deleted employee ID must never be reused');
    });

    // -------------------------------------------------------------
    // Test 9: Deleted order ID is not reused
    // -------------------------------------------------------------
    await it('9. Deleted order ID is not reused', async () => {
      const prevOrdSeq = parseSeqNumber(testOrd2.id);

      // Manually remove testOrd2 from orders array to simulate order deletion
      const idx = (dbState.orders || []).findIndex(o => o.id === testOrd2.id);
      if (idx !== -1) {
        dbState.orders.splice(idx, 1);
      }

      // Generate next order
      const nextOrdRes = await makeRequest(port, '/api/admin/orders', 'POST', {
        customerId: testCust1.id,
        serviceId: sampleService.id,
        orderSource: 'Website'
      }, authHeaders);
      assert.strictEqual(nextOrdRes.status, 201);
      const ordId = nextOrdRes.body.id || nextOrdRes.body.orderId || nextOrdRes.body.order?.id;
      const nextOrdSeq = parseSeqNumber(ordId);

      assert(nextOrdSeq > prevOrdSeq, `New order sequence (${nextOrdSeq}) must exceed removed order sequence (${prevOrdSeq})`);
      assert.notStrictEqual(ordId, testOrd2.id, 'Deleted order ID must not be reused');
    });

    // -------------------------------------------------------------
    // Test 10: Refresh does not reset counters
    // -------------------------------------------------------------
    await it('10. Refresh does not reset counters', async () => {
      const currentCustSeq = dbState.entity_sequences.customer;
      const currentOrdSeq = dbState.entity_sequences.order;

      // Re-trigger database normalization and sequence init
      await ensureDatabaseReady(true);

      assert.strictEqual(dbState.entity_sequences.customer, currentCustSeq, 'Customer sequence must match before and after refresh');
      assert.strictEqual(dbState.entity_sequences.order, currentOrdSeq, 'Order sequence must match before and after refresh');
    });

    // -------------------------------------------------------------
    // Test 11: Cold start does not reset counters
    // -------------------------------------------------------------
    await it('11. Cold start does not reset counters', async () => {
      const previousSeq = { ...dbState.entity_sequences };

      // Simulate isolate cold start by reloading from disk persistence
      const diskPath = path.join(__dirname, '../db_store.json');
      if (fs.existsSync(diskPath)) {
        const diskState = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
        dbState.entity_sequences = diskState.entity_sequences || dbState.entity_sequences;
      }

      const rehydrated = initEntitySequences(dbState);

      assert(rehydrated.customer >= previousSeq.customer, `Customer counter must be >= ${previousSeq.customer}, got ${rehydrated.customer}`);
      assert(rehydrated.order >= previousSeq.order, `Order counter must be >= ${previousSeq.order}, got ${rehydrated.order}`);
      assert(rehydrated.employee >= previousSeq.employee, `Employee counter must be >= ${previousSeq.employee}, got ${rehydrated.employee}`);
    });

    // -------------------------------------------------------------
    // Test 12: Apply Online creates customer when applicant is new
    // -------------------------------------------------------------
    const applicantMobile = `9855${runId}5`;
    const applicantEmail = `citizen.applicant.${runId}@example.com`;
    let applyOnlineOrder1 = null;

    await it('12. Apply Online creates customer when applicant is new', async () => {
      const res = await makeRequest(port, '/api/orders', 'POST', {
        serviceId: sampleService.id,
        name: 'Rajesh Kumar Citizen',
        mobile: applicantMobile,
        email: applicantEmail,
        address: '104, MG Road, Palasia',
        city: 'Indore',
        state: 'Madhya Pradesh',
        pinCode: '452001',
        paymentMethod: 'UPI'
      });

      assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}`);
      applyOnlineOrder1 = res.body;

      assert(applyOnlineOrder1.id, 'Order ID must be present');
      assert(/^ORD-\d{6}$/.test(applyOnlineOrder1.id), `Order ID should be ORD-00xxxx, got ${applyOnlineOrder1.id}`);
      assert(applyOnlineOrder1.customerId, 'Order must have linked customerId');
      assert(/^CUST-\d{6}$/.test(applyOnlineOrder1.customerId), `customerId should be CUST-00xxxx, got ${applyOnlineOrder1.customerId}`);

      // Verify customer exists in database
      const createdCust = (dbState.customers || []).find(c => c.id === applyOnlineOrder1.customerId);
      assert(createdCust, 'Created customer must exist in dbState.customers');
      assert.strictEqual(createdCust.name, 'Rajesh Kumar Citizen');
      assert.strictEqual(createdCust.mobile, applicantMobile);
    });

    // -------------------------------------------------------------
    // Test 13: Apply Online creates order linked to customer
    // -------------------------------------------------------------
    await it('13. Apply Online creates order linked to customer', async () => {
      assert(applyOnlineOrder1.customerId, 'Order customerId must be set');
      assert.strictEqual(applyOnlineOrder1.userId, applyOnlineOrder1.customerId, 'Order userId should match customerId');

      // Verify order is linked in dbState
      const dbOrder = (dbState.orders || []).find(o => o.id === applyOnlineOrder1.id);
      assert(dbOrder, 'Order must exist in dbState.orders');
      assert.strictEqual(dbOrder.customerId, applyOnlineOrder1.customerId);
    });

    // -------------------------------------------------------------
    // Test 14: New Apply Online service by same customer does NOT create another customer
    // -------------------------------------------------------------
    let applyOnlineOrder2 = null;

    await it('14. New Apply Online service by same customer does NOT create another customer', async () => {
      const customersCountBefore = (dbState.customers || []).length;

      // Second service application with identical mobile (+91 formatted) and email
      const secondService = (dbState.services && dbState.services[1]) ? dbState.services[1] : sampleService;
      const res = await makeRequest(port, '/api/orders', 'POST', {
        serviceId: secondService.id,
        name: 'Rajesh Kumar Citizen',
        mobile: `+91 ${applicantMobile}`, // Format variation to test normalization
        email: applicantEmail.toUpperCase(), // Case variation
        address: '104, MG Road, Palasia',
        city: 'Indore',
        state: 'Madhya Pradesh',
        pinCode: '452001',
        paymentMethod: 'QR Code'
      });

      assert.strictEqual(res.status, 201);
      applyOnlineOrder2 = res.body;

      const customersCountAfter = (dbState.customers || []).length;
      assert.strictEqual(customersCountAfter, customersCountBefore, 'Customer count must not increase for existing applicant');
      assert.strictEqual(applyOnlineOrder2.customerId, applyOnlineOrder1.customerId, 'Second order must link to the EXACT same customerId');
    });

    // -------------------------------------------------------------
    // Test 15: Same customer can have multiple orders
    // -------------------------------------------------------------
    await it('15. Same customer can have multiple orders', async () => {
      assert.notStrictEqual(applyOnlineOrder1.id, applyOnlineOrder2.id, 'The two orders must have distinct IDs');
      assert.strictEqual(applyOnlineOrder1.customerId, applyOnlineOrder2.customerId, 'Both orders must share customerId');
    });

    // -------------------------------------------------------------
    // Test 16: Customer Management shows Apply Online customer
    // -------------------------------------------------------------
    await it('16. Customer Management shows Apply Online customer', async () => {
      const res = await makeRequest(port, '/api/admin/customers', 'GET', null, authHeaders);
      assert.strictEqual(res.status, 200);
      assert(Array.isArray(res.body), 'Response should be array of customers');

      const found = res.body.find(c => c.id === applyOnlineOrder1.customerId);
      assert(found, `Customer Management must list customer ${applyOnlineOrder1.customerId}`);
      assert.strictEqual(found.name, 'Rajesh Kumar Citizen');
    });

    // -------------------------------------------------------------
    // Test 17: Customer Management shows all linked orders
    // -------------------------------------------------------------
    await it('17. Customer Management shows all linked orders', async () => {
      const custId = applyOnlineOrder1.customerId;
      const res = await makeRequest(port, `/api/admin/customers/${custId}/orders`, 'GET', null, authHeaders);

      assert.strictEqual(res.status, 200);
      assert(Array.isArray(res.body), 'Response should be array of customer orders');
      assert(res.body.length >= 2, `Customer ${custId} must have at least 2 linked orders, found ${res.body.length}`);

      const orderIds = res.body.map(o => o.id);
      assert(orderIds.includes(applyOnlineOrder1.id), `Customer orders must include ${applyOnlineOrder1.id}`);
      assert(orderIds.includes(applyOnlineOrder2.id), `Customer orders must include ${applyOnlineOrder2.id}`);
    });

    // -------------------------------------------------------------
    // Test 18: Admin Orders shows the same order
    // -------------------------------------------------------------
    await it('18. Admin Orders shows the same order', async () => {
      const res = await makeRequest(port, '/api/admin/orders', 'GET', null, authHeaders);
      assert.strictEqual(res.status, 200);

      const found1 = res.body.find(o => o.id === applyOnlineOrder1.id);
      assert(found1, `Admin Orders must show order ${applyOnlineOrder1.id}`);
      assert.strictEqual(found1.customerId, applyOnlineOrder1.customerId, 'Admin Orders entry must retain customerId');

      const found2 = res.body.find(o => o.id === applyOnlineOrder2.id);
      assert(found2, `Admin Orders must show order ${applyOnlineOrder2.id}`);
      assert.strictEqual(found2.customerId, applyOnlineOrder2.customerId);
    });

    // -------------------------------------------------------------
    // Test 19: Track Order continues to find the order
    // -------------------------------------------------------------
    await it('19. Track Order continues to find the order', async () => {
      // Track by order ID
      const res = await makeRequest(port, `/api/orders/track?orderId=${applyOnlineOrder1.id}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.id, applyOnlineOrder1.id, 'Track order must return the matching order');
      assert.strictEqual(res.body.name, 'Rajesh Kumar Citizen');

      // Track by order ID with leading hash and lowercase
      const resAlt = await makeRequest(port, `/api/orders/track?orderId=%23${applyOnlineOrder1.id.toLowerCase()}`);
      assert.strictEqual(resAlt.status, 200);
      assert.strictEqual(resAlt.body.id, applyOnlineOrder1.id);
    });

    // -------------------------------------------------------------
    // Test 20: WhatsApp/manual order can reuse existing customer
    // -------------------------------------------------------------
    await it('20. WhatsApp/manual order can reuse existing customer', async () => {
      const custCountBefore = (dbState.customers || []).length;

      // Admin manual order specifying applicant's mobile
      const res = await makeRequest(port, '/api/admin/orders', 'POST', {
        newCustomer: {
          name: 'Rajesh Kumar Citizen',
          mobile: applicantMobile,
          email: applicantEmail
        },
        serviceId: sampleService.id,
        orderSource: 'WhatsApp'
      }, authHeaders);

      assert.strictEqual(res.status, 201);
      const custCountAfter = (dbState.customers || []).length;
      assert.strictEqual(custCountAfter, custCountBefore, 'Manual WhatsApp order for existing citizen must not duplicate customer');
      const returnedCustId = res.body.customerId || res.body.order?.customerId || res.body.customer?.id;
      assert.strictEqual(returnedCustId, applyOnlineOrder1.customerId, 'Manual order must link to the existing customer ID');
    });

    // -------------------------------------------------------------
    // Test 21: Duplicate customer creation is prevented server-side
    // -------------------------------------------------------------
    await it('21. Duplicate customer creation is prevented server-side', async () => {
      const custCountBefore = (dbState.customers || []).length;

      // POST to /api/admin/customers with matching mobile
      const res = await makeRequest(port, '/api/admin/customers', 'POST', {
        name: 'Rajesh Kumar Citizen Updated',
        mobile: applicantMobile,
        email: applicantEmail,
        city: 'Indore',
        state: 'Madhya Pradesh',
        pincode: '452001'
      }, authHeaders);

      assert.strictEqual(res.status, 201);
      const custCountAfter = (dbState.customers || []).length;
      assert.strictEqual(custCountAfter, custCountBefore, 'Admin customer creation with existing mobile must not duplicate customer');
      assert.strictEqual(res.body.id, applyOnlineOrder1.customerId, 'Response must return the existing customer ID');
    });

    // -------------------------------------------------------------
    // Test 22: Concurrent/sequential creation does not produce duplicate IDs
    // -------------------------------------------------------------
    await it('22. Concurrent/sequential creation does not produce duplicate IDs', async () => {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(makeRequest(port, '/api/orders', 'POST', {
          serviceId: sampleService.id,
          name: `Concurrent Citizen ${runId} ${i}`,
          mobile: `9866${runId}${i}`,
          email: `concurrent.${runId}.${i}@example.com`,
          address: `Concurrent Address ${i}`,
          city: 'Indore',
          state: 'Madhya Pradesh',
          pinCode: '452010',
          paymentMethod: 'UPI'
        }));
      }

      const results = await Promise.all(promises);
      const orderIds = new Set();
      const customerIds = new Set();

      for (const r of results) {
        assert.strictEqual(r.status, 201);
        assert(!orderIds.has(r.body.id), `Duplicate order ID detected: ${r.body.id}`);
        assert(!customerIds.has(r.body.customerId), `Duplicate customer ID detected: ${r.body.customerId}`);
        orderIds.add(r.body.id);
        customerIds.add(r.body.customerId);
      }

      assert.strictEqual(orderIds.size, 5, 'All 5 concurrent orders must have unique IDs');
      assert.strictEqual(customerIds.size, 5, 'All 5 concurrent customers must have unique IDs');
    });

    // -------------------------------------------------------------
    // Test 23: Customer/order relationship survives refresh
    // -------------------------------------------------------------
    await it('23. Customer/order relationship survives refresh', async () => {
      await ensureDatabaseReady(true);
      const orders = (dbState.orders || []).filter(o => o.customerId === applyOnlineOrder1.customerId);
      assert(orders.length >= 3, `Expected at least 3 orders for ${applyOnlineOrder1.customerId} after refresh, got ${orders.length}`);
    });

    // -------------------------------------------------------------
    // Test 24: Customer/order relationship survives logout/login
    // -------------------------------------------------------------
    await it('24. Customer/order relationship survives logout/login', async () => {
      // Generate a new fresh admin token simulating a new login session
      const freshAdminToken = jwt.sign({
        id: 'super-admin-deepak',
        email: 'tideepak8@gmail.com',
        role: 'SUPER_ADMIN',
        iat: Math.floor(Date.now() / 1000)
      }, getJwtSecret());

      const res = await makeRequest(port, `/api/admin/customers/${applyOnlineOrder1.customerId}/orders`, 'GET', null, {
        Authorization: `Bearer ${freshAdminToken}`
      });

      assert.strictEqual(res.status, 200);
      assert(res.body.length >= 3, 'Fresh session must retrieve all linked orders');
    });

    // -------------------------------------------------------------
    // Test 25: Customer/order relationship survives browser restart simulation
    // -------------------------------------------------------------
    await it('25. Customer/order relationship survives browser restart simulation', async () => {
      // Independent unauthenticated request verifying public tracking still resolves order and customer details
      const trackRes = await makeRequest(port, `/api/orders/track?orderId=${applyOnlineOrder2.id}`);
      assert.strictEqual(trackRes.status, 200);
      assert.strictEqual(trackRes.body.id, applyOnlineOrder2.id);
      assert.strictEqual(trackRes.body.customerId, applyOnlineOrder1.customerId);
    });

    // -------------------------------------------------------------
    // Test 26: SEO Isolation Verification
    // -------------------------------------------------------------
    await it('26. SEO isolation: Customer and Order IDs are NEVER exposed in sitemaps or robots.txt', async () => {
      const sitemapRes = await makeRequest(port, '/sitemap.xml');
      assert.strictEqual(sitemapRes.status, 200);
      const sitemap = sitemapRes.rawBody || JSON.stringify(sitemapRes.body);

      assert(!sitemap.includes(applyOnlineOrder1.id), 'Sitemap must not contain operational order ID');
      assert(!sitemap.includes(applyOnlineOrder1.customerId), 'Sitemap must not contain customer ID');
      assert(!sitemap.includes('CUST-'), 'Sitemap must not expose customer ID pattern');
      assert(!sitemap.includes('/admin'), 'Sitemap must not expose admin routes');

      const robotsRes = await makeRequest(port, '/robots.txt');
      assert.strictEqual(robotsRes.status, 200);
      const robots = robotsRes.rawBody || JSON.stringify(robotsRes.body);
      assert(robots.includes('Disallow: /admin'), 'robots.txt must disallow /admin');
      assert(robots.includes('Disallow: /api/'), 'robots.txt must disallow /api/');
    });

    // -------------------------------------------------------------
    // Test 27: Direct D1 Database-Level Atomic Sequence Allocation
    // -------------------------------------------------------------
    await it('27. Direct D1 database-level atomic sequence allocation via SQLite RETURNING', async () => {
      const { DatabaseSync } = require('node:sqlite');
      const memDb = new DatabaseSync(':memory:');
      memDb.exec(`
        CREATE TABLE IF NOT EXISTS entity_sequences (
          entity_type TEXT PRIMARY KEY,
          next_value INTEGER NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      const d1Mock = {
        prepare(sql) {
          let bound = [];
          return {
            bind(...args) {
              bound = args;
              return this;
            },
            async first() {
              const stmt = memDb.prepare(sql);
              return stmt.get(...bound) || null;
            },
            async all() {
              const stmt = memDb.prepare(sql);
              return { results: stmt.all(...bound) };
            },
            async run() {
              const stmt = memDb.prepare(sql);
              const info = stmt.run(...bound);
              return { success: true, meta: { changes: info.changes } };
            }
          };
        }
      };

      // Seed high-water marks
      await initEntitySequencesInD1({ customer: 5000, employee: 6000, order: 7000 }, d1Mock);

      // Allocate next sequences directly
      const custSeq1 = await allocateNextSequenceInD1('customer', d1Mock);
      const custSeq2 = await allocateNextSequenceInD1('customer', d1Mock);
      const empSeq1 = await allocateNextSequenceInD1('employee', d1Mock);
      const ordSeq1 = await allocateNextSequenceInD1('order', d1Mock);

      assert.strictEqual(custSeq1, 5001, 'Customer sequence must allocate 5001');
      assert.strictEqual(custSeq2, 5002, 'Customer sequence must allocate 5002');
      assert.strictEqual(empSeq1, 6001, 'Employee sequence must allocate 6001');
      assert.strictEqual(ordSeq1, 7001, 'Order sequence must allocate 7001');

      const d1Seqs = await getEntitySequencesFromD1(d1Mock);
      assert(d1Seqs, 'Must retrieve sequences from D1');
      assert.strictEqual(d1Seqs.customer, 5002);
      assert.strictEqual(d1Seqs.employee, 6001);
      assert.strictEqual(d1Seqs.order, 7001);
    });

    // -------------------------------------------------------------
    // Test 28: 20+ Concurrent Customer Allocations
    // -------------------------------------------------------------
    await it('28. 20 concurrent customer creations produce unique, strictly sequential CUST-00xxxx IDs', async () => {
      const CONCURRENCY_COUNT = 20;
      const promises = [];
      const batchRunId = Date.now();

      for (let i = 0; i < CONCURRENCY_COUNT; i++) {
        promises.push(makeRequest(port, '/api/admin/customers', 'POST', {
          name: `Concurrent Cust ${batchRunId} ${i}`,
          mobile: `9111${String(batchRunId).slice(-4)}${String(i).padStart(2, '0')}`,
          email: `concurrent.cust.${batchRunId}.${i}@example.com`,
          city: 'Indore',
          state: 'Madhya Pradesh',
          pincode: '452001'
        }, authHeaders));
      }

      const results = await Promise.all(promises);
      const ids = [];
      for (let i = 0; i < CONCURRENCY_COUNT; i++) {
        assert.strictEqual(results[i].status, 201, `Customer creation ${i} must succeed with 201`);
        const id = results[i].body.id;
        assert(id, `Response ${i} must contain id`);
        assert(/^CUST-\d{6}$/.test(id), `ID ${id} must follow CUST-000000 format`);
        ids.push(id);
      }

      const uniqueIds = new Set(ids);
      assert.strictEqual(uniqueIds.size, CONCURRENCY_COUNT, `All ${CONCURRENCY_COUNT} customer IDs must be unique, found duplicates: ${ids}`);

      const numSeq = ids.map(parseSeqNumber).sort((a, b) => a - b);
      const minNum = numSeq[0];
      const maxNum = numSeq[numSeq.length - 1];
      assert.strictEqual(maxNum - minNum + 1, CONCURRENCY_COUNT, `Allocations must be strictly contiguous without missing numbers within batch: ${numSeq}`);
    });

    // -------------------------------------------------------------
    // Test 29: 20+ Concurrent Employee Allocations
    // -------------------------------------------------------------
    await it('29. 20 concurrent employee creations produce unique, strictly sequential EMP-00xxxx IDs', async () => {
      const CONCURRENCY_COUNT = 20;
      const promises = [];
      const batchRunId = Date.now();

      for (let i = 0; i < CONCURRENCY_COUNT; i++) {
        promises.push(makeRequest(port, '/api/admin/employees', 'POST', {
          fullName: `Concurrent Emp ${batchRunId} ${i}`,
          personalEmail: `conc.emp.${batchRunId}.${i}@easydesk.com`,
          mobile: `9222${String(batchRunId).slice(-4)}${String(i).padStart(2, '0')}`,
          designation: 'Operations Specialist',
          department: 'Customer Service'
        }, authHeaders));
      }

      const results = await Promise.all(promises);
      const ids = [];
      for (let i = 0; i < CONCURRENCY_COUNT; i++) {
        assert.strictEqual(results[i].status, 201, `Employee creation ${i} must succeed with 201`);
        const id = results[i].body.id || results[i].body.employee?.id;
        const code = results[i].body.employeeCode || results[i].body.employee?.employeeCode;
        assert(id, `Response ${i} must contain employee id`);
        assert(/^EMP-\d{6}$/.test(id), `Employee ID ${id} must follow EMP-000000 format`);
        assert.strictEqual(id, code, 'employee.id must match employee.employeeCode');
        ids.push(id);
      }

      const uniqueIds = new Set(ids);
      assert.strictEqual(uniqueIds.size, CONCURRENCY_COUNT, `All ${CONCURRENCY_COUNT} employee IDs must be unique`);

      const numSeq = ids.map(parseSeqNumber).sort((a, b) => a - b);
      const minNum = numSeq[0];
      const maxNum = numSeq[numSeq.length - 1];
      assert.strictEqual(maxNum - minNum + 1, CONCURRENCY_COUNT, `Employee allocations must be strictly contiguous: ${numSeq}`);
    });

    // -------------------------------------------------------------
    // Test 30: 20+ Concurrent Order Allocations
    // -------------------------------------------------------------
    await it('30. 20 concurrent order creations produce unique, strictly sequential ORD-00xxxx IDs', async () => {
      const CONCURRENCY_COUNT = 20;
      const promises = [];
      const batchRunId = Date.now();

      for (let i = 0; i < CONCURRENCY_COUNT; i++) {
        promises.push(makeRequest(port, '/api/orders', 'POST', {
          serviceId: sampleService.id,
          name: `Concurrent Order Citizen ${batchRunId} ${i}`,
          mobile: `9333${String(batchRunId).slice(-4)}${String(i).padStart(2, '0')}`,
          email: `order.conc.${batchRunId}.${i}@example.com`,
          address: `Order Address ${i}`,
          city: 'Indore',
          state: 'Madhya Pradesh',
          pinCode: '452001',
          paymentMethod: 'UPI'
        }));
      }

      const results = await Promise.all(promises);
      const orderIds = [];
      for (let i = 0; i < CONCURRENCY_COUNT; i++) {
        assert.strictEqual(results[i].status, 201, `Order creation ${i} must succeed with 201`);
        const id = results[i].body.id;
        assert(id, `Order response ${i} must contain order id`);
        assert(/^ORD-\d{6}$/.test(id), `Order ID ${id} must follow ORD-000000 format`);
        assert(results[i].body.customerId, 'Order must contain linked customerId');
        assert.strictEqual(results[i].body.customerId, results[i].body.userId, 'Order customerId and userId must match');
        orderIds.push(id);
      }

      const uniqueIds = new Set(orderIds);
      assert.strictEqual(uniqueIds.size, CONCURRENCY_COUNT, `All ${CONCURRENCY_COUNT} order IDs must be unique`);

      const numSeq = orderIds.map(parseSeqNumber).sort((a, b) => a - b);
      const minNum = numSeq[0];
      const maxNum = numSeq[numSeq.length - 1];
      assert.strictEqual(maxNum - minNum + 1, CONCURRENCY_COUNT, `Order allocations must be strictly contiguous: ${numSeq}`);
    });

    // -------------------------------------------------------------
    // Test 31: Mixed Concurrency (Customers + Employees + Orders simultaneously)
    // -------------------------------------------------------------
    await it('31. Mixed concurrency: simultaneous 10 customers + 10 employees + 10 orders', async () => {
      const BATCH_SIZE = 10;
      const batchRunId = Date.now();
      const mixedPromises = [];

      // 10 Customers
      for (let i = 0; i < BATCH_SIZE; i++) {
        mixedPromises.push(makeRequest(port, '/api/admin/customers', 'POST', {
          name: `Mixed Cust ${batchRunId} ${i}`,
          mobile: `9444${String(batchRunId).slice(-4)}${String(i).padStart(2, '0')}`,
          email: `mixed.cust.${batchRunId}.${i}@test.com`,
          city: 'Indore',
          state: 'Madhya Pradesh',
          pincode: '452001'
        }, authHeaders).then(r => ({ type: 'customer', res: r })));
      }

      // 10 Employees
      for (let i = 0; i < BATCH_SIZE; i++) {
        mixedPromises.push(makeRequest(port, '/api/admin/employees', 'POST', {
          fullName: `Mixed Emp ${batchRunId} ${i}`,
          personalEmail: `mixed.emp.${batchRunId}.${i}@test.com`,
          mobile: `9555${String(batchRunId).slice(-4)}${String(i).padStart(2, '0')}`,
          designation: 'Support Executive',
          department: 'Operations'
        }, authHeaders).then(r => ({ type: 'employee', res: r })));
      }

      // 10 Orders
      for (let i = 0; i < BATCH_SIZE; i++) {
        mixedPromises.push(makeRequest(port, '/api/orders', 'POST', {
          serviceId: sampleService.id,
          name: `Mixed Order Applicant ${batchRunId} ${i}`,
          mobile: `9666${String(batchRunId).slice(-4)}${String(i).padStart(2, '0')}`,
          email: `mixed.order.${batchRunId}.${i}@test.com`,
          address: `Mixed Address ${i}`,
          city: 'Indore',
          state: 'Madhya Pradesh',
          pinCode: '452001',
          paymentMethod: 'UPI'
        }).then(r => ({ type: 'order', res: r })));
      }

      const mixedResults = await Promise.all(mixedPromises);
      assert.strictEqual(mixedResults.length, 30, 'All 30 mixed concurrent requests must complete');

      const custIds = mixedResults.filter(r => r.type === 'customer').map(r => r.res.body.id);
      const empIds = mixedResults.filter(r => r.type === 'employee').map(r => r.res.body.id || r.res.body.employee?.id);
      const ordIds = mixedResults.filter(r => r.type === 'order').map(r => r.res.body.id);

      assert.strictEqual(new Set(custIds).size, 10, 'All 10 customers must have unique IDs');
      assert.strictEqual(new Set(empIds).size, 10, 'All 10 employees must have unique IDs');
      assert.strictEqual(new Set(ordIds).size, 10, 'All 10 orders must have unique IDs');

      custIds.forEach(id => assert(/^CUST-\d{6}$/.test(id), `Customer ID ${id} valid`));
      empIds.forEach(id => assert(/^EMP-\d{6}$/.test(id), `Employee ID ${id} valid`));
      ordIds.forEach(id => assert(/^ORD-\d{6}$/.test(id), `Order ID ${id} valid`));
    });

    // -------------------------------------------------------------
    // Test 32: D1 Atomic Monotonic High-Water Mark Invariant
    // -------------------------------------------------------------
    await it('32. D1 atomic monotonic high-water mark invariant (never initializes downward)', async () => {
      const { DatabaseSync } = require('node:sqlite');
      const memDb = new DatabaseSync(':memory:');
      memDb.exec(`
        CREATE TABLE IF NOT EXISTS entity_sequences (
          entity_type TEXT PRIMARY KEY,
          next_value INTEGER NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      const d1Mock = {
        prepare(sql) {
          let bound = [];
          return {
            bind(...args) { bound = args; return this; },
            async first() { return memDb.prepare(sql).get(...bound) || null; },
            async all() { return { results: memDb.prepare(sql).all(...bound) }; },
            async run() {
              const info = memDb.prepare(sql).run(...bound);
              return { success: true, meta: { changes: info.changes } };
            }
          };
        }
      };

      // 1. Initialize with 8000
      await initEntitySequencesInD1({ customer: 8000, employee: 8000, order: 8000 }, d1Mock);
      let cur = await getEntitySequencesFromD1(d1Mock);
      assert.strictEqual(cur.customer, 8000);

      // 2. Attempt lower re-initialization with 100
      await initEntitySequencesInD1({ customer: 100, employee: 100, order: 100 }, d1Mock);
      cur = await getEntitySequencesFromD1(d1Mock);
      assert.strictEqual(cur.customer, 8000, 'Sequence counter must NOT be downgraded by lower init');

      // 3. Increment
      const nextCust = await allocateNextSequenceInD1('customer', d1Mock);
      assert.strictEqual(nextCust, 8001, 'Next allocation must advance from 8000 to 8001');

      // 4. Initialize with higher value (e.g. 90000)
      await initEntitySequencesInD1({ customer: 90000, employee: 90000, order: 90000 }, d1Mock);
      cur = await getEntitySequencesFromD1(d1Mock);
      assert.strictEqual(cur.customer, 90000, 'Sequence counter must advance to higher init value');
    });

    // -------------------------------------------------------------
    // Test 33: Worker restart / cold start simulation
    // -------------------------------------------------------------
    await it('33. Worker restart / cold start simulation preserves high-water mark without reset', async () => {
      const curMaxCust = extractMaxNumber(dbState.customers || [], ['id', 'code']);
      assert(curMaxCust > 0, 'Current max customer sequence must be positive');

      // Simulate a fresh worker isolate with empty in-memory sequence cache
      const freshIsolatedDbState = {
        customers: [...dbState.customers],
        employees: [...dbState.employees],
        orders: [...dbState.orders],
        system_settings: {
          entity_sequences: { customer: curMaxCust }
        }
      };

      const normalized = initEntitySequences(freshIsolatedDbState);
      assert(normalized.customer >= curMaxCust, `Cold start counter ${normalized.customer} must be >= ${curMaxCust}`);

      // Next customer allocation in this simulated isolate
      const { id: nextAllocId, seq: nextAllocSeq } = await getNextSequence('customer', freshIsolatedDbState);
      assert.strictEqual(nextAllocSeq, normalized.customer + 1, 'Allocation after cold start must be strictly incremented');
      assert.strictEqual(nextAllocId, `CUST-${String(normalized.customer + 1).padStart(6, '0')}`);
    });

    // -------------------------------------------------------------
    // Test 34: Protection against client-supplied operational IDs
    // -------------------------------------------------------------
    await it('34. Protection against client-supplied operational IDs (server assigns authoritative ID)', async () => {
      const spoofCustRes = await makeRequest(port, '/api/admin/customers', 'POST', {
        id: 'SPOOFED-CUST-999999',
        code: 'SPOOFED-CODE-999999',
        name: 'Spoof Attempt Citizen',
        mobile: `9777${Date.now().toString().slice(-6)}`,
        email: `spoof.${Date.now()}@example.com`,
        city: 'Indore',
        state: 'Madhya Pradesh',
        pincode: '452001'
      }, authHeaders);

      assert.strictEqual(spoofCustRes.status, 201);
      assert.notStrictEqual(spoofCustRes.body.id, 'SPOOFED-CUST-999999', 'Server must ignore client-supplied customer ID');
      assert.notStrictEqual(spoofCustRes.body.code, 'SPOOFED-CODE-999999', 'Server must ignore client-supplied customer code');
      assert(/^CUST-\d{6}$/.test(spoofCustRes.body.id), 'Server must assign authoritative CUST-00xxxx ID');

      const spoofEmpRes = await makeRequest(port, '/api/admin/employees', 'POST', {
        id: 'SPOOFED-EMP-888888',
        employeeCode: 'SPOOFED-EMP-888888',
        fullName: 'Spoof Attempt Employee',
        personalEmail: `spoof.emp.${Date.now()}@example.com`,
        mobile: `9888${Date.now().toString().slice(-6)}`,
        designation: 'Clerk',
        department: 'General'
      }, authHeaders);

      assert.strictEqual(spoofEmpRes.status, 201);
      const returnedEmpId = spoofEmpRes.body.id || spoofEmpRes.body.employee?.id;
      assert.notStrictEqual(returnedEmpId, 'SPOOFED-EMP-888888', 'Server must ignore client-supplied employee ID');
      assert(/^EMP-\d{6}$/.test(returnedEmpId), 'Server must assign authoritative EMP-00xxxx ID');
    });

    // -------------------------------------------------------------
    // Test 35: Failure & Gap Safety Invariant
    // -------------------------------------------------------------
    await it('35. Failure & gap safety invariant (allocated numbers are never rolled back or reused on failure)', async () => {
      // Allocate an order sequence
      const { id: testAllocId, seq: testAllocSeq } = await getNextSequence('order', dbState);

      // Simulate a failed transaction where the order was never saved to dbState.orders
      assert(!dbState.orders.some(o => o.id === testAllocId), 'Allocated ID does not exist in orders table');

      // Next allocation must NOT reuse testAllocSeq; it must allocate testAllocSeq + 1
      const { id: nextAllocId, seq: nextAllocSeq } = await getNextSequence('order', dbState);
      assert.strictEqual(nextAllocSeq, testAllocSeq + 1, 'Subsequent allocation must monotonically advance without reusing failed sequence');
      assert.notStrictEqual(nextAllocId, testAllocId, 'Failed allocated ID must never be reused');
    });

  } finally {
    server.close();
  }

  console.log('\n------------------------------------------------------------');
  console.log(`TOTAL CHECKS : ${totalTests}`);
  console.log(`PASSED       : ${passedTests}`);
  console.log(`FAILED       : ${totalTests - passedTests}`);
  console.log('------------------------------------------------------------\n');

  if (passedTests === totalTests) {
    console.log(`>>> ALL ${totalTests} IDENTITY, SEQUENCE & RELATIONSHIP VERIFICATIONS PASSED (100%) <<<\n`);
    process.exit(0);
  } else {
    console.error('>>> SOME TESTS FAILED <<<');
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('[FATAL ERROR IN TEST SUITE]:', err);
  process.exit(1);
});
