const http = require('http');

const CSRF_TOKEN = 'easydesk_secure_csrf_token_2026_val';

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

async function runAllTests() {
  console.log('================================================================');
  console.log('EASYDESK — FINAL PRODUCTION DATA INTEGRITY TEST SUITE');
  console.log('================================================================\n');

  // Verify CSRF Endpoint
  const csrfRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/security/csrf',
    method: 'GET'
  });
  console.log('[CSRF] Token Endpoint Status:', csrfRes.status, 'Token:', csrfRes.data?.csrfToken);

  // Attempt login with password123 or NewSecretPassword2026!
  let currentActivePassword = 'password123';
  let loginRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/admin/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'tideepak8@gmail.com', password: currentActivePassword });

  if (loginRes.status !== 200) {
    currentActivePassword = 'NewSecretPassword2026!';
    loginRes = await req({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/admin/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'tideepak8@gmail.com', password: currentActivePassword });
  }

  if (loginRes.status !== 200 || !loginRes.data?.accessToken) {
    console.error('Initial Admin Login Failed:', loginRes.status, loginRes.data);
    return;
  }
  let token = loginRes.data.accessToken;
  console.log('[AUTH] Admin Initial Login OK:', loginRes.data.user.name, '(' + loginRes.data.user.email + ') with active password:', currentActivePassword);

  // TEST 1: Change Admin Password -> Logout -> Login with NEW password -> Confirm OLD fails
  console.log('\n--- MODULE 1: Admin Password Change & Authentication Integrity ---');
  const targetNewPassword = currentActivePassword === 'password123' ? 'VerifiedPass2026#X' : 'password123';
  const pwChangeRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/profile',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    name: 'Deepak',
    email: 'tideepak8@gmail.com',
    currentPassword: currentActivePassword,
    newPassword: targetNewPassword,
    confirmPassword: targetNewPassword
  });
  console.log('1a. Admin password change HTTP status:', pwChangeRes.status);

  // Logout
  await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/admin/logout',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, { refreshToken: loginRes.data.refreshToken });

  // Try login with OLD password (Must FAIL with 401)
  const oldLoginRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/admin/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'tideepak8@gmail.com', password: currentActivePassword });
  console.log('1b. Old password login attempt HTTP status (Expected 401):', oldLoginRes.status);

  // Login with NEW password (Must PASS with 200)
  const newLoginRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/admin/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'tideepak8@gmail.com', password: targetNewPassword });
  console.log('1c. New password login attempt HTTP status (Expected 200):', newLoginRes.status);

  if (newLoginRes.status === 200) {
    token = newLoginRes.data.accessToken;
    // Restore back to standard 'password123' if not already
    if (targetNewPassword !== 'password123') {
      await req({
        hostname: 'localhost',
        port: 3000,
        path: '/api/admin/profile',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
      }, {
        name: 'Deepak',
        email: 'tideepak8@gmail.com',
        currentPassword: targetNewPassword,
        newPassword: 'password123',
        confirmPassword: 'password123'
      });
      // Re-login with password123 to get fresh token
      const reloginRes = await req({
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/admin/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { email: 'tideepak8@gmail.com', password: 'password123' });
      token = reloginRes.data.accessToken;
      console.log('1d. Standard password password123 restored.');
    }
  }

  const mod1Pass = pwChangeRes.status === 200 && oldLoginRes.status === 401 && newLoginRes.status === 200;
  console.log('>>> MODULE 1 VERDICT:', mod1Pass ? 'PASS' : 'FAIL');

  // TEST 2: Create/Update Service -> Fresh Read -> Confirm Persisted
  console.log('\n--- MODULE 2: Service CRUD Persistence ---');
  const testServiceId = 'service-test-' + Date.now();
  const testServiceName = 'Test Verified Service ' + Date.now();
  const createServiceRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/services',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    service: {
      id: testServiceId,
      name: testServiceName,
      title: testServiceName,
      category: 'GST Services',
      price: 1499,
      originalPrice: 2999,
      governmentFee: 0,
      description: 'Comprehensive test service for persistence verification.',
      features: ['Feature A', 'Feature B'],
      requiredDocuments: ['Aadhaar Card', 'PAN Card'],
      processingDays: '3-5 Days',
      status: 'Active'
    }
  });
  console.log('2a. Create service HTTP status:', createServiceRes.status);

  // Update Service
  const updateServiceName = testServiceName + ' - Updated';
  const updateServiceRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/services/' + testServiceId,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    service: {
      name: updateServiceName,
      price: 1999
    }
  });
  console.log('2b. Update service HTTP status:', updateServiceRes.status);

  // Fresh Read
  const readServicesRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/services',
    method: 'GET'
  });
  const foundService = (readServicesRes.data || []).find(s => s.id === testServiceId);
  const mod2Pass = createServiceRes.status === 201 && updateServiceRes.status === 200 && !!foundService && foundService.name === updateServiceName && foundService.price === 1999;
  console.log('2c. Fresh read verified:', !!foundService, 'Name:', foundService?.name, 'Price:', foundService?.price);
  console.log('>>> MODULE 2 VERDICT:', mod2Pass ? 'PASS' : 'FAIL');

  // TEST 3: Create/Update Blog -> Fresh Read -> Confirm Persisted
  console.log('\n--- MODULE 3: Blog CRUD Persistence ---');
  const testBlogId = 'blog-test-' + Date.now();
  const testBlogTitle = 'Test Blog Integrity ' + Date.now();
  const createBlogRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/blogs',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    blog: {
      id: testBlogId,
      title: testBlogTitle,
      slug: 'test-blog-' + Date.now(),
      category: 'Tax Planning',
      content: 'This is a verified production blog post content.',
      summary: 'Verified blog test.',
      author: 'Deepak',
      published: true,
      tags: ['Test', 'Production']
    }
  });
  console.log('3a. Create blog HTTP status:', createBlogRes.status);

  // Update Blog
  const updatedBlogTitle = testBlogTitle + ' (Updated)';
  const updateBlogRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/blogs/' + testBlogId,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    blog: {
      title: updatedBlogTitle
    }
  });
  console.log('3b. Update blog HTTP status:', updateBlogRes.status);

  // Fresh Read
  const readBlogsRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/blogs',
    method: 'GET'
  });
  const foundBlog = (readBlogsRes.data || []).find(b => b.id === testBlogId);
  const mod3Pass = createBlogRes.status === 201 && updateBlogRes.status === 200 && !!foundBlog && foundBlog.title === updatedBlogTitle;
  console.log('3c. Fresh read verified:', !!foundBlog, 'Title:', foundBlog?.title);
  console.log('>>> MODULE 3 VERDICT:', mod3Pass ? 'PASS' : 'FAIL');

  // TEST 4: Update CMS (About, Contact, Privacy, Payment) -> Fresh Read
  console.log('\n--- MODULE 4: CMS & Settings Persistence ---');
  const updateAboutRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/about',
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    about: {
      heroHeading: 'EasyDesk Production Verified ' + Date.now(),
      heroSubtitle: 'Professional Business Compliance Desk',
      missionText: 'Reliable government business registrations across India.'
    }
  });
  console.log('4a. Update About HTTP status:', updateAboutRes.status);

  const readAboutRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/about',
    method: 'GET'
  });
  const aboutPersisted = readAboutRes.data?.heroHeading?.includes('EasyDesk Production Verified');
  console.log('4b. Fresh read about persisted:', aboutPersisted);

  const updateContactRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/contact-settings',
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    contactSettings: {
      email: 'support@easydesk.in',
      phone: '+91 99999 88888',
      address: 'Suite 404, Business Plaza, New Delhi',
      whatsapp: '919999988888'
    }
  });
  console.log('4c. Update Contact HTTP status:', updateContactRes.status);

  const readContactRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/contact-settings',
    method: 'GET'
  });
  const contactPersisted = readContactRes.data?.email === 'support@easydesk.in';
  console.log('4d. Fresh read contact persisted:', contactPersisted);

  const updatePaymentSettingsRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/payment-settings',
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    paymentSettings: {
      upiId: 'easydesk@upi',
      accountNumber: '998877665544',
      ifscCode: 'HDFC0001234',
      accountHolderName: 'EasyDesk Services Private Limited',
      bankName: 'HDFC Bank'
    }
  });
  console.log('4e. Update Payment Settings HTTP status:', updatePaymentSettingsRes.status);

  const readPaymentSettingsRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/payment-settings',
    method: 'GET'
  });
  const paymentPersisted = readPaymentSettingsRes.data?.upiId === 'easydesk@upi';
  console.log('4f. Fresh read payment settings persisted:', paymentPersisted);

  const mod4Pass = updateAboutRes.status === 200 && updateContactRes.status === 200 && updatePaymentSettingsRes.status === 200 && aboutPersisted && contactPersisted && paymentPersisted;
  console.log('>>> MODULE 4 VERDICT:', mod4Pass ? 'PASS' : 'FAIL');

  // TEST 5: Media Upload -> Refresh / Re-request File
  console.log('\n--- MODULE 5: Media File Upload & Retrieval ---');
  const testFileName = 'test-upload-' + Date.now() + '.txt';
  const testFileContent = 'EasyDesk Verified File Storage Content: ' + Date.now();
  const testBase64 = 'data:text/plain;base64,' + Buffer.from(testFileContent).toString('base64');
  
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
  console.log('5a. Media upload HTTP status:', uploadRes.status, 'Uploaded URL:', uploadRes.data?.url);

  // Fresh GET request for the media URL
  let mediaRetrieved = false;
  if (uploadRes.data?.url) {
    const fileFetchRes = await req({
      hostname: 'localhost',
      port: 3000,
      path: uploadRes.data.url,
      method: 'GET'
    });
    console.log('5b. Media file fetch HTTP status:', fileFetchRes.status, 'Content length:', fileFetchRes.raw?.length);
    mediaRetrieved = fileFetchRes.status === 200 && fileFetchRes.raw.includes('EasyDesk Verified File Storage Content');
  }
  const mod5Pass = uploadRes.status === 200 && mediaRetrieved;
  console.log('5c. Fresh media payload valid:', mediaRetrieved);
  console.log('>>> MODULE 5 VERDICT:', mod5Pass ? 'PASS' : 'FAIL');

  // TEST 6: Create/Update Employee -> Fresh Read
  console.log('\n--- MODULE 6: Employee & Staff CRUD Persistence ---');
  const testEmpCode = 'EMP-' + Math.floor(1000 + Math.random() * 9000);
  const testEmpEmail = 'staff.' + Date.now() + '@easydesk.in';
  const createEmpRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/employees',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    employee: {
      employeeCode: testEmpCode,
      name: 'Rohan Verma ' + testEmpCode,
      email: testEmpEmail,
      mobile: '9876543210',
      designation: 'Operations Executive',
      department: 'Operations',
      status: 'Active',
      joiningDate: new Date().toISOString()
    }
  });
  console.log('6a. Create employee HTTP status:', createEmpRes.status);

  // Update employee
  const createdEmpId = createEmpRes.data?.id;
  const updateEmpRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/employees/' + createdEmpId,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
  }, {
    employee: {
      designation: 'Senior Operations Executive'
    }
  });
  console.log('6b. Update employee HTTP status:', updateEmpRes.status);

  const readEmpRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/employees',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const foundEmp = (readEmpRes.data || []).find(e => e.id === createdEmpId || e.email === testEmpEmail);
  const mod6Pass = createEmpRes.status === 201 && updateEmpRes.status === 200 && !!foundEmp && foundEmp.designation === 'Senior Operations Executive';
  console.log('6c. Fresh read found employee:', !!foundEmp, 'Designation:', foundEmp?.designation);
  console.log('>>> MODULE 6 VERDICT:', mod6Pass ? 'PASS' : 'FAIL');

  // TEST 7: Create/Update Customer -> Fresh Read
  console.log('\n--- MODULE 7: Customer CRUD Persistence ---');
  const testCustEmail = 'customer.' + Date.now() + '@example.com';
  const createCustRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    name: 'Anjali Sharma',
    email: testCustEmail,
    mobile: '9123456780',
    password: 'CustomerPass123!'
  });
  console.log('7a. Register customer HTTP status:', createCustRes.status);

  const readCustRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/customers',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const foundCust = (readCustRes.data || []).find(c => c.email === testCustEmail);
  const mod7Pass = (createCustRes.status === 200 || createCustRes.status === 201) && !!foundCust;
  console.log('7b. Fresh read found customer:', !!foundCust, 'ID:', foundCust?.id);
  console.log('>>> MODULE 7 VERDICT:', mod7Pass ? 'PASS' : 'FAIL');

  // TEST 8: Create/Update Order -> Fresh Read
  console.log('\n--- MODULE 8: Order Lifecycle Persistence ---');
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
    name: 'Anjali Sharma',
    email: testCustEmail,
    mobile: '9123456780',
    address: '123 Market Street',
    city: 'Mumbai',
    state: 'Maharashtra',
    pinCode: '400001',
    paymentMethod: 'UPI',
    utr: 'UTR' + Date.now()
  });
  console.log('8a. Create order HTTP status:', orderRes.status, 'Order ID:', orderRes.data?.id);

  const createdOrderId = orderRes.data?.id;

  // Update order status to In Progress
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
      comment: 'Documents under review.'
    });
    console.log('8b. Order status update HTTP status:', statusUpdateRes?.status);
  }

  // Fresh read all orders
  const readOrdersRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/orders',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const foundOrder = (readOrdersRes.data || []).find(o => o.id === createdOrderId);
  const mod8Pass = orderRes.status === 201 && statusUpdateRes?.status === 200 && !!foundOrder && foundOrder.status === 'In Progress';
  console.log('8c. Fresh read found order:', !!foundOrder, 'Status:', foundOrder?.status);
  console.log('>>> MODULE 8 VERDICT:', mod8Pass ? 'PASS' : 'FAIL');

  console.log('\n================================================================');
  console.log('FINAL RESULTS:');
  console.log('Module 1 (Admin Password & Auth):', mod1Pass ? 'PASS' : 'FAIL');
  console.log('Module 2 (Service CRUD):', mod2Pass ? 'PASS' : 'FAIL');
  console.log('Module 3 (Blog CRUD):', mod3Pass ? 'PASS' : 'FAIL');
  console.log('Module 4 (CMS & Settings):', mod4Pass ? 'PASS' : 'FAIL');
  console.log('Module 5 (Media File Storage):', mod5Pass ? 'PASS' : 'FAIL');
  console.log('Module 6 (Employee & Staff):', mod6Pass ? 'PASS' : 'FAIL');
  console.log('Module 7 (Customer CRUD):', mod7Pass ? 'PASS' : 'FAIL');
  console.log('Module 8 (Order Lifecycle):', mod8Pass ? 'PASS' : 'FAIL');
  console.log('================================================================\n');

  if (mod1Pass && mod2Pass && mod3Pass && mod4Pass && mod5Pass && mod6Pass && mod7Pass && mod8Pass) {
    console.log('PRODUCTION PERSISTENCE VERIFIED');
  } else {
    console.log('PERSISTENCE VERIFICATION FAILED');
  }
}

runAllTests().catch(console.error);
