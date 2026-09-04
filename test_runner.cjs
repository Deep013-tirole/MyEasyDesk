const http = require('http');
const fs = require('fs');

const CSRF_TOKEN = 'easydesk_secure_csrf_token_2026_val';

function log(msg) {
  process.stdout.write(msg + '\n');
  fs.appendFileSync('/app/applet/test_run.log', msg + '\n');
}

function req(options, body) {
  return new Promise((resolve, reject) => {
    const headers = { ...(options.headers || {}) };
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method)) {
      headers['x-csrf-token'] = CSRF_TOKEN;
    }
    const request = http.request({ ...options, headers }, res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, headers: res.headers, raw: d }); }
      });
    });
    request.on('error', reject);
    if (body) {
      const b = typeof body === 'string' ? body : JSON.stringify(body);
      request.write(b);
    }
    request.end();
  });
}

async function run() {
  fs.writeFileSync('/app/applet/test_run.log', '');
  log('================================================================');
  log('EASYDESK — FINAL PRODUCTION DATA INTEGRITY TEST SUITE');
  log('================================================================');

  // Discover current active password
  const candidatePasswords = ['password123', 'VerifiedPass2026#X', 'NewSecretPassword2026!'];
  let currentPassword = null;
  let token = null;

  for (const pw of candidatePasswords) {
    const res = await req({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/admin/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'tideepak8@gmail.com', password: pw });
    if (res.status === 200 && res.data?.accessToken) {
      currentPassword = pw;
      token = res.data.accessToken;
      break;
    }
  }

  if (!token) {
    log('Failed to login with any candidate password. Aborting.');
    return;
  }
  log(`[AUTH] Admin Logged in successfully. Current Password: "${currentPassword}"`);

  // ==========================================
  // MODULE 1: ADMIN PASSWORD CHANGE & AUTH
  // ==========================================
  log('\n--- MODULE 1: Admin Password Change & Authentication Integrity ---');
  const tempPassword = currentPassword === 'password123' ? 'VerifiedPass2026#X' : 'password123';
  
  // 1a. Update password via API
  const pwChangeRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/profile',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    name: 'Deepak',
    email: 'tideepak8@gmail.com',
    currentPassword: currentPassword,
    newPassword: tempPassword,
    confirmPassword: tempPassword
  });
  log(`1a. Change password API status: ${pwChangeRes.status} (Expected 200)`);

  // 1b. Try login with OLD password (Must return 401)
  const oldLoginRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/admin/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'tideepak8@gmail.com', password: currentPassword });
  log(`1b. Old password login attempt status: ${oldLoginRes.status} (Expected 401: Invalid Login ID or password)`);

  // 1c. Login with NEW password (Must return 200)
  const newLoginRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/admin/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'tideepak8@gmail.com', password: tempPassword });
  log(`1c. New password login attempt status: ${newLoginRes.status} (Expected 200)`);
  token = newLoginRes.data?.accessToken || token;

  // Restore standard password123 if needed
  if (tempPassword !== 'password123') {
    await req({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/profile',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
    }, {
      name: 'Deepak',
      email: 'tideepak8@gmail.com',
      currentPassword: tempPassword,
      newPassword: 'password123',
      confirmPassword: 'password123'
    });
    const relogin = await req({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/admin/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'tideepak8@gmail.com', password: 'password123' });
    token = relogin.data.accessToken;
    log('1d. Restored baseline password "password123". Fresh session token obtained.');
  }

  const mod1Pass = pwChangeRes.status === 200 && oldLoginRes.status === 401 && newLoginRes.status === 200;
  log(`>>> MODULE 1 VERDICT: ${mod1Pass ? 'PASS' : 'FAIL'}`);

  // ==========================================
  // MODULE 2: SERVICE CRUD PERSISTENCE
  // ==========================================
  log('\n--- MODULE 2: Service CRUD Persistence ---');
  const testServiceId = 'service-prod-' + Date.now();
  const testServiceName = 'GST Filing Premium ' + Date.now();
  
  const createServiceRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/services',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    service: {
      id: testServiceId,
      title: testServiceName,
      name: testServiceName,
      categoryId: 'cat-gst',
      price: 1499,
      serviceCharge: 1499,
      govFees: 0,
      description: 'End-to-end GST verification test service.',
      highlights: ['24/7 Filing Help', 'Dedicated CA'],
      requiredDocuments: ['Aadhaar Card', 'PAN Card'],
      processingTime: '2-4 Days',
      status: 'active'
    }
  });
  log(`2a. Create service status: ${createServiceRes.status}`);

  const updateServiceName = testServiceName + ' (Updated)';
  const updateServiceRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/services/' + testServiceId,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    service: {
      title: updateServiceName,
      name: updateServiceName,
      serviceCharge: 1899,
      price: 1899
    }
  });
  log(`2b. Update service status: ${updateServiceRes.status}`);

  const readServicesRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/services',
    method: 'GET'
  });
  const foundService = (readServicesRes.data || []).find(s => s.id === testServiceId);
  const mod2Pass = (createServiceRes.status === 200 || createServiceRes.status === 201) && 
                   updateServiceRes.status === 200 && 
                   !!foundService && 
                   (foundService.title === updateServiceName || foundService.name === updateServiceName);
  log(`2c. Fresh read service persisted: ${!!foundService} (Title: "${foundService?.title || foundService?.name}", Charge: ₹${foundService?.serviceCharge || foundService?.price})`);
  log(`>>> MODULE 2 VERDICT: ${mod2Pass ? 'PASS' : 'FAIL'}`);

  // ==========================================
  // MODULE 3: BLOG CRUD PERSISTENCE
  // ==========================================
  log('\n--- MODULE 3: Blog CRUD Persistence ---');
  const testBlogTitle = 'Essential Compliance Rules 2026 #' + Date.now();
  
  const createBlogRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/blogs',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    blog: {
      title: testBlogTitle,
      slug: 'compliance-rules-' + Date.now(),
      category: 'Legal & Compliance',
      content: 'Complete legal checklist for Indian startups and sole proprietorships.',
      summary: 'Verified production article.',
      author: 'Deepak',
      published: true,
      tags: ['Compliance', 'Production']
    }
  });
  const createdBlogId = createBlogRes.data?.id;
  log(`3a. Create blog status: ${createBlogRes.status}, Blog ID: ${createdBlogId}`);

  const updatedBlogTitle = testBlogTitle + ' [Verified]';
  const updateBlogRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/blogs/' + createdBlogId,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    blog: {
      title: updatedBlogTitle
    }
  });
  log(`3b. Update blog status: ${updateBlogRes.status}`);

  const readBlogsRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/blogs',
    method: 'GET'
  });
  const foundBlog = (readBlogsRes.data || []).find(b => b.id === createdBlogId);
  const mod3Pass = (createBlogRes.status === 200 || createBlogRes.status === 201) && 
                   updateBlogRes.status === 200 && 
                   !!foundBlog && 
                   foundBlog.title === updatedBlogTitle;
  log(`3c. Fresh read blog persisted: ${!!foundBlog} (Title: "${foundBlog?.title}")`);
  log(`>>> MODULE 3 VERDICT: ${mod3Pass ? 'PASS' : 'FAIL'}`);

  // ==========================================
  // MODULE 4: CMS & SETTINGS PERSISTENCE
  // ==========================================
  log('\n--- MODULE 4: CMS & Settings Persistence ---');
  const updateAboutRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/about',
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    aboutUs: {
      heroHeading: 'India Digital Compliance Desk ' + Date.now(),
      heroSubtitle: 'Direct government registrations without physical paperwork',
      missionText: 'Empowering 100,000+ businesses with swift approvals.'
    }
  });
  log(`4a. Update About CMS status: ${updateAboutRes.status}`);

  const readAboutRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/about',
    method: 'GET'
  });
  const aboutPersisted = readAboutRes.data?.aboutUs?.heroHeading?.includes('India Digital Compliance Desk') || 
                         readAboutRes.data?.heroHeading?.includes('India Digital Compliance Desk');
  log(`4b. Fresh read about persisted: ${aboutPersisted}`);

  const updateContactRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/contact-settings',
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    contactSettings: {
      email: 'verified.support@easydesk.in',
      phone: '+91 98765 43210',
      address: 'EasyDesk Corporate Tower, Connaught Place, New Delhi',
      whatsapp: '919876543210'
    }
  });
  log(`4c. Update Contact Settings status: ${updateContactRes.status}`);

  const readContactRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/contact-settings',
    method: 'GET'
  });
  const contactPersisted = readContactRes.data?.email === 'verified.support@easydesk.in';
  log(`4d. Fresh read contact persisted: ${contactPersisted}`);

  const updatePaymentSettingsRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/payment-settings',
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    paymentSettings: {
      upiId: 'easydesk.official@upi',
      accountNumber: '50200012345678',
      ifscCode: 'HDFC0000001',
      accountHolderName: 'EasyDesk India Private Limited',
      bankName: 'HDFC Bank Ltd'
    }
  });
  log(`4e. Update Payment Settings status: ${updatePaymentSettingsRes.status}`);

  const readPaymentSettingsRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/payment-settings',
    method: 'GET'
  });
  const paymentPersisted = readPaymentSettingsRes.data?.upiId === 'easydesk.official@upi';
  log(`4f. Fresh read payment settings persisted: ${paymentPersisted}`);

  const mod4Pass = updateAboutRes.status === 200 && 
                   updateContactRes.status === 200 && 
                   updatePaymentSettingsRes.status === 200 && 
                   aboutPersisted && 
                   contactPersisted && 
                   paymentPersisted;
  log(`>>> MODULE 4 VERDICT: ${mod4Pass ? 'PASS' : 'FAIL'}`);

  // ==========================================
  // MODULE 5: MEDIA FILE STORAGE & RETRIEVAL
  // ==========================================
  log('\n--- MODULE 5: Media File Storage & Retrieval ---');
  const testFileName = 'compliance_doc_' + Date.now() + '.txt';
  const testPayloadContent = 'Production Certificate Payload: verified-integrity-' + Date.now();
  const testBase64 = 'data:text/plain;base64,' + Buffer.from(testPayloadContent).toString('base64');
  
  const uploadRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/media/upload',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    fileName: testFileName,
    fileData: testBase64,
    mimeType: 'text/plain'
  });
  log(`5a. Media upload status: ${uploadRes.status} (Stored URL: ${uploadRes.data?.url})`);

  let mediaRetrieved = false;
  if (uploadRes.data?.url) {
    const fileFetchRes = await req({
      hostname: 'localhost',
      port: 3000,
      path: uploadRes.data.url,
      method: 'GET'
    });
    log(`5b. Media download status: ${fileFetchRes.status}, Received bytes: ${fileFetchRes.raw?.length || 0}`);
    mediaRetrieved = fileFetchRes.status === 200 && fileFetchRes.raw.includes('Production Certificate Payload: verified-integrity-');
  }
  const mod5Pass = (uploadRes.status === 200 || uploadRes.status === 201) && mediaRetrieved;
  log(`5c. File data payload integrity verified: ${mediaRetrieved}`);
  log(`>>> MODULE 5 VERDICT: ${mod5Pass ? 'PASS' : 'FAIL'}`);

  // ==========================================
  // MODULE 6: EMPLOYEE & STAFF CRUD PERSISTENCE
  // ==========================================
  log('\n--- MODULE 6: Employee & Staff CRUD Persistence ---');
  const testEmpCode = 'EMP-' + Math.floor(1000 + Math.random() * 9000);
  const testEmpEmail = 'staff.' + Date.now() + '@easydesk.in';
  
  const createEmpRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/employees',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    fullName: 'Pooja Kashyap ' + testEmpCode,
    name: 'Pooja Kashyap ' + testEmpCode,
    employeeCode: testEmpCode,
    personalEmail: testEmpEmail,
    email: testEmpEmail,
    personalMobile: '9811223344',
    mobile: '9811223344',
    designation: 'Operations Officer',
    department: 'Operations',
    employmentStatus: 'Active',
    status: 'Active',
    joiningDate: new Date().toISOString().split('T')[0]
  });
  log(`6a. Create employee status: ${createEmpRes.status}`);

  const createdEmpId = createEmpRes.data?.id;
  const updateEmpRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/employees/' + createdEmpId,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    designation: 'Senior Lead Operations Officer'
  });
  log(`6b. Update employee status: ${updateEmpRes.status}`);

  const readEmpRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/employees',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const foundEmp = (readEmpRes.data || []).find(e => e.id === createdEmpId || e.personalEmail === testEmpEmail || e.email === testEmpEmail);
  const mod6Pass = (createEmpRes.status === 200 || createEmpRes.status === 201) && 
                   updateEmpRes.status === 200 && 
                   !!foundEmp && 
                   foundEmp.designation === 'Senior Lead Operations Officer';
  log(`6c. Fresh read employee persisted: ${!!foundEmp} (Code: ${foundEmp?.employeeCode}, Role: ${foundEmp?.designation})`);
  log(`>>> MODULE 6 VERDICT: ${mod6Pass ? 'PASS' : 'FAIL'}`);

  // ==========================================
  // MODULE 7: CUSTOMER CRUD PERSISTENCE
  // ==========================================
  log('\n--- MODULE 7: Customer CRUD Persistence ---');
  const testCustEmail = 'customer.' + Date.now() + '@verifieduser.com';
  const createCustRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/customers',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    name: 'Kunal Singhania',
    email: testCustEmail,
    mobile: '9899001122',
    city: 'Bengaluru',
    state: 'Karnataka'
  });
  log(`7a. Create customer status: ${createCustRes.status}`);

  const createdCustId = createCustRes.data?.id;
  const updateCustRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/customers/' + createdCustId,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    name: 'Kunal Singhania (Verified VIP)'
  });
  log(`7b. Update customer status: ${updateCustRes.status}`);

  const readCustRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/customers',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const foundCust = (readCustRes.data || []).find(c => c.id === createdCustId || c.email === testCustEmail);
  const mod7Pass = (createCustRes.status === 200 || createCustRes.status === 201) && 
                   updateCustRes.status === 200 && 
                   !!foundCust && 
                   foundCust.name === 'Kunal Singhania (Verified VIP)';
  log(`7c. Fresh read customer persisted: ${!!foundCust} (Name: ${foundCust?.name}, Email: ${foundCust?.email})`);
  log(`>>> MODULE 7 VERDICT: ${mod7Pass ? 'PASS' : 'FAIL'}`);

  // ==========================================
  // MODULE 8: ORDER LIFECYCLE PERSISTENCE
  // ==========================================
  log('\n--- MODULE 8: Order Lifecycle Persistence ---');
  const orderRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/orders',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    userId: foundCust?.id || 'cust-1',
    customerId: foundCust?.id || 'cust-1',
    serviceId: testServiceId,
    name: 'Kunal Singhania',
    email: testCustEmail,
    mobile: '9899001122',
    address: '45 MG Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    pinCode: '560001',
    paymentMethod: 'UPI',
    utr: 'UTR' + Date.now()
  });
  log(`8a. Create order status: ${orderRes.status} (Order ID: ${orderRes.data?.id})`);

  const createdOrderId = orderRes.data?.id;

  let statusUpdateRes = null;
  if (createdOrderId) {
    statusUpdateRes = await req({
      hostname: 'localhost',
      port: 3000,
      path: '/api/orders/' + createdOrderId + '/status',
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
    }, {
      status: 'In Progress',
      comment: 'Government portal registration in progress.'
    });
    log(`8b. Update order status response: ${statusUpdateRes?.status}`);
  }

  const readOrdersRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/orders',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const foundOrder = (readOrdersRes.data || []).find(o => o.id === createdOrderId);
  const isStatusUpdated = foundOrder && (foundOrder.orderStatus === 'In Progress' || foundOrder.status === 'In Progress');
  const mod8Pass = (orderRes.status === 200 || orderRes.status === 201) && 
                   statusUpdateRes?.status === 200 && 
                   !!foundOrder && 
                   isStatusUpdated;
  log(`8c. Fresh read order persisted: ${!!foundOrder} (Order ID: ${foundOrder?.id}, Status: ${foundOrder?.orderStatus || foundOrder?.status})`);
  log(`>>> MODULE 8 VERDICT: ${mod8Pass ? 'PASS' : 'FAIL'}`);

  // Summary
  log('\n================================================================');
  log('FINAL INTEGRITY VERIFICATION SUMMARY:');
  log(`1. Admin Password & Re-Auth Integrity: ${mod1Pass ? 'PASS' : 'FAIL'}`);
  log(`2. Service CRUD Persistence:           ${mod2Pass ? 'PASS' : 'FAIL'}`);
  log(`3. Blog CRUD Persistence:              ${mod3Pass ? 'PASS' : 'FAIL'}`);
  log(`4. CMS & Settings Persistence:         ${mod4Pass ? 'PASS' : 'FAIL'}`);
  log(`5. Media File Storage & Retrieval:     ${mod5Pass ? 'PASS' : 'FAIL'}`);
  log(`6. Employee & Staff Persistence:       ${mod6Pass ? 'PASS' : 'FAIL'}`);
  log(`7. Customer CRUD Persistence:          ${mod7Pass ? 'PASS' : 'FAIL'}`);
  log(`8. Order Lifecycle Persistence:        ${mod8Pass ? 'PASS' : 'FAIL'}`);
  log('================================================================');

  if (mod1Pass && mod2Pass && mod3Pass && mod4Pass && mod5Pass && mod6Pass && mod7Pass && mod8Pass) {
    log('PRODUCTION PERSISTENCE VERIFIED');
  } else {
    log('PERSISTENCE VERIFICATION FAILED');
  }
}

run().catch(err => {
  log('Error in test runner: ' + (err.stack || err.message));
});
