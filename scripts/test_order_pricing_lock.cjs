/**
 * EASYDESK — ORDER PRICING LOCK & HISTORICAL CHARGES REGRESSION TEST SUITE
 * 
 * Verifies:
 * 1. Create order at old price.
 * 2. Change Service Master price.
 * 3. Verify old order still shows old price (immutable historical lock).
 * 4. Create new order for the same customer and verify it gets the new price.
 * 5. Verify Track Order and print breakdown reflect exact historical charges with mathematical match:
 *    - Government/Portal Fee
 *    - EasyDesk Service Charge
 *    - Processing/Other Fee (if applicable)
 *    - Discount (if applicable)
 *    - Total Amount
 *    - Amount Paid
 *    - Amount Due
 *    - Payment Status
 *    govFees + serviceCharge + processingFee - discount == totalAmount
 *    amountPaid + amountDue == totalAmount
 */

process.env.IS_WORKER = 'true';
process.env.NODE_ENV = 'test';

const http = require('http');
const assert = require('assert');
const jwt = require('jsonwebtoken');

let serverApp;
let jwtSecret;

try {
  const srv = require('../dist/server.cjs');
  serverApp = srv.app;
  jwtSecret = srv.getJwtSecret();
} catch (e) {
  console.error('Failed to load dist/server.cjs. Please ensure npm run build or build:server has run.');
  throw e;
}

const adminToken = jwt.sign({
  id: 'super-admin-deepak',
  email: 'tideepak8@gmail.com',
  role: 'SUPER_ADMIN'
}, jwtSecret);

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
  console.log('EASYDESK ORDER PRICING LOCK & HISTORICAL CHARGES TEST SUITE');
  console.log('============================================================\n');

  const server = http.createServer(serverApp);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    // 1. Fetch available services or seed a dedicated test service
    const servicesRes = await makeRequest(port, '/api/services');
    let serviceList = Array.isArray(servicesRes.body) ? servicesRes.body : [];
    assert.ok(serviceList.length > 0, 'Catalog should contain at least one service');

    // Pick first service and set known baseline prices: Gov: 107, Service: 199
    const targetService = serviceList[0];
    const initialGovFees = 107;
    const initialServiceCharge = 199;
    const initialTotal = initialGovFees + initialServiceCharge; // 306

    // Configure service master to baseline price
    const updateServiceRes = await makeRequest(port, `/api/admin/services/${targetService.id}`, 'PUT', {
      ...targetService,
      govFees: initialGovFees,
      serviceCharge: initialServiceCharge,
      price: initialTotal
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(updateServiceRes.status, 200, 'Service master update should succeed');

    const customerMobile = '9876543210';
    const customerName = 'Aarav Historical Pricing Test';
    const customerEmail = 'aarav.pricing@example.com';

    let order1Id = null;

    console.log('--- Step 1: Create Order 1 at Old / Initial Price ---');
    await it('1.1 Create Order 1 with baseline catalog prices (Gov: 107, Service: 199)', async () => {
      const res = await makeRequest(port, '/api/orders', 'POST', {
        serviceId: targetService.id,
        orderSource: 'Website',
        name: customerName,
        mobile: customerMobile,
        email: customerEmail,
        address: '123 Test Colony',
        city: 'Indore',
        state: 'Madhya Pradesh',
        pinCode: '452001'
      });

      assert.strictEqual(res.status, 201, `Order creation should return 201, got ${res.status}`);
      assert.ok(res.body.id, 'Order must return id');
      order1Id = res.body.id;

      assert.strictEqual(res.body.govFees, initialGovFees, `govFees should be locked to ${initialGovFees}`);
      assert.strictEqual(res.body.serviceCharge, initialServiceCharge, `serviceCharge should be locked to ${initialServiceCharge}`);
      assert.strictEqual(res.body.totalAmount, initialTotal, `totalAmount should equal ${initialTotal}`);
      assert.strictEqual(res.body.amountPaid, 0, 'Initial amountPaid should be 0');
      assert.strictEqual(res.body.amountDue, initialTotal, `Initial amountDue should equal ${initialTotal}`);
    });

    console.log('\n--- Step 2: Mutate Service Master Price ---');
    const newGovFees = 250;
    const newServiceCharge = 450;
    const newTotal = newGovFees + newServiceCharge; // 700

    await it('2.1 Update Service Master price to higher rate (Gov: 250, Service: 450)', async () => {
      const res = await makeRequest(port, `/api/admin/services/${targetService.id}`, 'PUT', {
        ...targetService,
        govFees: newGovFees,
        serviceCharge: newServiceCharge,
        price: newTotal
      }, {
        'Authorization': `Bearer ${adminToken}`
      });

      assert.strictEqual(res.status, 200, `Admin service update should return 200, got ${res.status}`);

      // Verify catalog reflects new price
      const catalogRes = await makeRequest(port, '/api/services');
      const catalogService = catalogRes.body.find(s => s.id === targetService.id);
      assert.ok(catalogService, 'Service should exist in catalog');
      assert.strictEqual(catalogService.govFees, newGovFees, 'Catalog service govFees should reflect new price');
      assert.strictEqual(catalogService.serviceCharge, newServiceCharge, 'Catalog service serviceCharge should reflect new price');
    });

    console.log('\n--- Step 3: Verify Old Order 1 Preserves Old Price ---');
    await it('3.1 Track Order for Order 1 still shows locked old price (Gov: 107, Service: 199, Total: 306)', async () => {
      const res = await makeRequest(port, `/api/orders/track?orderId=${order1Id}&mobile=${customerMobile}`);
      assert.strictEqual(res.status, 200, `Tracking Order 1 should return 200, got ${res.status}`);
      
      const order = res.body;
      assert.strictEqual(order.id, order1Id);
      assert.strictEqual(order.govFees, initialGovFees, `Order 1 govFees must remain ${initialGovFees}, got ${order.govFees}`);
      assert.strictEqual(order.serviceCharge, initialServiceCharge, `Order 1 serviceCharge must remain ${initialServiceCharge}, got ${order.serviceCharge}`);
      assert.strictEqual(order.totalAmount, initialTotal, `Order 1 totalAmount must remain ${initialTotal}, got ${order.totalAmount}`);
      assert.strictEqual(order.amountDue, initialTotal, `Order 1 amountDue must remain ${initialTotal}, got ${order.amountDue}`);
      assert.strictEqual(order.amountPaid, 0, 'Order 1 amountPaid must remain 0');

      // Check mathematical consistency
      const calcTotal = (order.govFees || 0) + (order.serviceCharge || 0) + (order.processingFee || 0) - (order.discount || 0);
      assert.strictEqual(calcTotal, order.totalAmount, 'Mathematical breakdown must match totalAmount');
      assert.strictEqual((order.amountPaid || 0) + (order.amountDue || 0), order.totalAmount, 'amountPaid + amountDue must match totalAmount');
    });

    await it('3.2 Admin Order API also returns locked old price for Order 1', async () => {
      const res = await makeRequest(port, '/api/admin/orders', 'GET', null, {
        'Authorization': `Bearer ${adminToken}`
      });
      assert.strictEqual(res.status, 200);
      const orders = Array.isArray(res.body) ? res.body : [];
      const order1Admin = orders.find(o => o.id === order1Id);
      assert.ok(order1Admin, 'Order 1 should exist in admin order list');
      assert.strictEqual(order1Admin.govFees, initialGovFees);
      assert.strictEqual(order1Admin.serviceCharge, initialServiceCharge);
      assert.strictEqual(order1Admin.totalAmount, initialTotal);
    });

    console.log('\n--- Step 4: Create New Order 2 for Same Customer & Verify New Price ---');
    let order2Id = null;

    await it('4.1 Create Order 2 for same customer under new Service Master price', async () => {
      const res = await makeRequest(port, '/api/orders', 'POST', {
        serviceId: targetService.id,
        orderSource: 'Website',
        name: customerName,
        mobile: customerMobile,
        email: customerEmail,
        address: '123 Test Colony',
        city: 'Indore',
        state: 'Madhya Pradesh',
        pinCode: '452001'
      });

      assert.strictEqual(res.status, 201, `Order 2 creation should return 201, got ${res.status}`);
      order2Id = res.body.id;
      assert.notStrictEqual(order2Id, order1Id, 'Order 2 must have distinct ID');

      assert.strictEqual(res.body.govFees, newGovFees, `Order 2 govFees should lock new price ${newGovFees}`);
      assert.strictEqual(res.body.serviceCharge, newServiceCharge, `Order 2 serviceCharge should lock new price ${newServiceCharge}`);
      assert.strictEqual(res.body.totalAmount, newTotal, `Order 2 totalAmount should lock new price ${newTotal}`);
      assert.strictEqual(res.body.amountPaid, 0);
      assert.strictEqual(res.body.amountDue, newTotal);
    });

    await it('4.2 Verify same customer holds both orders simultaneously with independent historical charges', async () => {
      const track1 = await makeRequest(port, `/api/orders/track?orderId=${order1Id}&mobile=${customerMobile}`);
      const track2 = await makeRequest(port, `/api/orders/track?orderId=${order2Id}&mobile=${customerMobile}`);

      assert.strictEqual(track1.body.govFees, initialGovFees, 'Order 1 govFees remained at old price');
      assert.strictEqual(track1.body.serviceCharge, initialServiceCharge, 'Order 1 serviceCharge remained at old price');
      assert.strictEqual(track1.body.totalAmount, initialTotal, 'Order 1 total remained at old price');

      assert.strictEqual(track2.body.govFees, newGovFees, 'Order 2 govFees used new price');
      assert.strictEqual(track2.body.serviceCharge, newServiceCharge, 'Order 2 serviceCharge used new price');
      assert.strictEqual(track2.body.totalAmount, newTotal, 'Order 2 total used new price');
    });

    console.log('\n--- Step 5: Verify Track Order, Payment Verification & Receipt Breakdown ---');
    await it('5.1 Verify payment on Order 1 updates amountPaid and amountDue while keeping charges locked', async () => {
      const payRes = await makeRequest(port, `/api/admin/orders/${order1Id}/verify-payment`, 'POST', {
        decision: 'Approved',
        adminRemarks: 'Payment confirmed via UPI'
      }, {
        'Authorization': `Bearer ${adminToken}`
      });
      assert.strictEqual(payRes.status, 200, `Payment verification should return 200, got ${payRes.status}`);

      const trackRes = await makeRequest(port, `/api/orders/track?orderId=${order1Id}&mobile=${customerMobile}`);
      assert.strictEqual(trackRes.status, 200);
      const paidOrder = trackRes.body;

      assert.strictEqual(paidOrder.paymentStatus, 'Verified', 'Payment status should be Verified');
      assert.strictEqual(paidOrder.amountPaid, initialTotal, 'amountPaid should equal totalAmount on verification');
      assert.strictEqual(paidOrder.amountDue, 0, 'amountDue should be 0 on full verification');
      assert.strictEqual(paidOrder.govFees, initialGovFees, 'govFees must remain locked');
      assert.strictEqual(paidOrder.serviceCharge, initialServiceCharge, 'serviceCharge must remain locked');

      // Check mathematical balance
      assert.strictEqual(paidOrder.amountPaid + paidOrder.amountDue, paidOrder.totalAmount, 'Paid + Due == Total');
      assert.strictEqual((paidOrder.govFees || 0) + (paidOrder.serviceCharge || 0), paidOrder.totalAmount, 'Gov + Service == Total');
    });

    await it('5.2 Create Order with processing fee and discount, verify exact mathematical breakdown', async () => {
      // Create via admin order to test custom processingFee and discount
      const customRes = await makeRequest(port, '/api/admin/orders', 'POST', {
        serviceId: targetService.id,
        serviceTitle: targetService.title,
        customerName: 'Discounted Order Test',
        customerMobile: '9876543219',
        customerEmail: 'discount@example.com',
        customerAddress: '456 MG Road',
        customerCity: 'Indore',
        customerState: 'Madhya Pradesh',
        customerPincode: '452001',
        govFees: 200,
        serviceCharge: 300,
        processingFee: 50,
        discount: 100,
        couponCode: 'FESTIVE100',
        paymentMethod: 'UPI',
        paymentStatus: 'Pending Verification'
      }, {
        'Authorization': `Bearer ${adminToken}`
      });

      assert.strictEqual(customRes.status, 201);
      const customOrder = customRes.body;
      const expectedTotal = 200 + 300 + 50 - 100; // 450
      assert.strictEqual(customOrder.totalAmount, expectedTotal, `Total should be 450, got ${customOrder.totalAmount}`);
      assert.strictEqual(customOrder.govFees, 200);
      assert.strictEqual(customOrder.serviceCharge, 300);
      assert.strictEqual(customOrder.processingFee, 50);
      assert.strictEqual(customOrder.discount, 100);
      assert.strictEqual(customOrder.couponCode, 'FESTIVE100');

      // Verify track order output contains all 8 items
      const trackCustom = await makeRequest(port, `/api/orders/track?orderId=${customOrder.id}&mobile=9876543219`);
      assert.strictEqual(trackCustom.status, 200);
      const o = trackCustom.body;

      // 1. Government/Portal Fee
      assert.strictEqual(typeof o.govFees, 'number', 'Government/Portal fee present');
      // 2. EasyDesk Service Charge
      assert.strictEqual(typeof o.serviceCharge, 'number', 'EasyDesk Service Charge present');
      // 3. Processing/Other Fee
      assert.strictEqual(o.processingFee, 50, 'Processing/Other fee present');
      // 4. Discount
      assert.strictEqual(o.discount, 100, 'Discount present');
      // 5. Total Amount
      assert.strictEqual(o.totalAmount, expectedTotal, 'Total amount matches');
      // 6. Amount Paid
      assert.strictEqual(typeof o.amountPaid, 'number', 'Amount paid present');
      // 7. Amount Due
      assert.strictEqual(typeof o.amountDue, 'number', 'Amount due present');
      // 8. Payment Status
      assert.ok(o.paymentStatus, 'Payment status present');

      // Verify mathematical balance:
      const mathTotal = o.govFees + o.serviceCharge + o.processingFee - o.discount;
      assert.strictEqual(mathTotal, o.totalAmount, 'govFees + serviceCharge + processingFee - discount === totalAmount');
      assert.strictEqual(o.amountPaid + o.amountDue, o.totalAmount, 'amountPaid + amountDue === totalAmount');
    });

  } finally {
    server.close();
  }

  console.log('\n============================================================');
  console.log(`TEST RESULTS: ${passedTests} passed of ${totalTests} total`);
  console.log('============================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
