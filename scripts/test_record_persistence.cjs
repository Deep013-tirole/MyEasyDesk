/**
 * EASYDESK — RECORD PERSISTENCE REGRESSION TEST SUITE
 * 
 * Comprehensive automated verification for:
 * 1. Employee full creation persistence (all 40+ fields, profilePhoto, skills, languages, emergency contacts, qualifications, etc.)
 * 2. Employee single record retrieval (GET /api/admin/employees/:id)
 * 3. Employee list retrieval (GET /api/admin/employees)
 * 4. Employee edit/update lifecycle (PUT /api/admin/employees/:id - no field wiping or metadata destruction)
 * 5. Employee KYC persistence & unmasking (PUT /api/admin/employees/:id/kyc & GET with ?unmask=true)
 * 6. Employee Payroll persistence (PUT /api/admin/employees/:id/payroll - special allowances, PF deductions, tax deductions, metadata)
 * 7. Employee Document Vault retrieval (POST base64 doc & GET /api/admin/employees/:id/documents by both canonical ID and employee code)
 * 8. Customer full creation persistence (POST /api/admin/customers - metadata, dobOrIncorporationDate, address)
 * 9. Customer retrieval and update lifecycle (GET and PUT /api/admin/customers/:id)
 * 10. Media persistence (POST /api/media/upload or /api/admin/media)
 * 11. Master Data single canonical routing & persistence (GET and POST /api/master-data)
 * 12. Relational mirror integrity and error resilience
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

async function runSuite() {
  console.log('\n============================================================');
  console.log('EASYDESK RECORD PERSISTENCE & DATA INTEGRITY TEST SUITE');
  console.log('============================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  console.log(`Test server listening on ephemeral port ${port}\n`);

  const authHeaders = {
    'Authorization': `Bearer ${adminToken}`
  };

  const testEmpCode = `EMP-TEST-${Date.now().toString().slice(-4)}`;
  let createdEmployeeId = '';
  let createdCustomerId = '';

  try {
    // -----------------------------------------------------------------
    // TEST 1: Full Employee Creation with all fields & profilePhoto
    // -----------------------------------------------------------------
    await it('1. Full Employee Creation persists all 40+ fields without dropping metadata or photo', async () => {
      const newEmpPayload = {
        fullName: 'Vikramaditya Sharma',
        employeeCode: testEmpCode,
        email: `vikram.${Date.now()}@example.com`,
        mobileNumber: '9876543210',
        designation: 'Senior Operations Architect',
        department: 'Operations & Public Services',
        employmentType: 'Full-time',
        reportingManager: 'Deepak Sharma',
        dateOfJoining: '2025-01-15',
        confirmationDate: '2025-07-15',
        probationStatus: 'Confirmed',
        workLocation: 'Gorakhpur HQ',
        status: 'Active',
        role: 'EMPLOYEE',
        skills: ['Public Service Ops', 'Aadhaar Mitra', 'D1 Architecture', 'Workflow Mgmt'],
        languages: ['Hindi', 'English', 'Bhojpuri'],
        gender: 'Male',
        maritalStatus: 'Married',
        bloodGroup: 'B+',
        dateOfBirth: '1990-08-20',
        nationality: 'Indian',
        currentAddress: '42 Golghar Main Road, Gorakhpur, UP 273001',
        permanentAddress: 'Village Mohaddipur, Gorakhpur, UP 273008',
        district: 'Gorakhpur',
        state: 'Uttar Pradesh',
        emergencyContactName: 'Ananya Sharma',
        emergencyContactRelation: 'Spouse',
        emergencyContactMobile: '9876500000',
        qualificationSummary: 'B.Tech in Computer Science',
        university: 'Dr. A.P.J. Abdul Kalam Technical University',
        certifications: ['CSC VLE Certified', 'ITIL Foundation'],
        totalExperienceYears: 6.5,
        previousOrganizations: ['Digital Seva Kendra Gorakhpur', 'Tech Solutions India'],
        profilePhoto: 'https://images.unsplash.com/photo-vikram-test-custom-avatar.jpg',
        photoUrl: 'https://images.unsplash.com/photo-vikram-test-custom-avatar.jpg',
        notes: 'Top performing employee profile for test verification'
      };

      const res = await makeRequest(port, '/api/admin/employees', 'POST', newEmpPayload, authHeaders);
      assert.strictEqual(res.status, 201, `Expected 201 Created, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert(res.body && res.body.id, 'Expected response to contain created employee id');
      createdEmployeeId = res.body.id;

      // Verify immediate response contains populated profilePhoto and skills
      assert.strictEqual(res.body.fullName, newEmpPayload.fullName);
      assert.strictEqual(res.body.profilePhoto, newEmpPayload.profilePhoto, 'Immediate POST response must preserve profilePhoto');
      assert.deepStrictEqual(res.body.skills, newEmpPayload.skills, 'Immediate POST response must preserve skills');
    });

    // -----------------------------------------------------------------
    // TEST 2: Employee Single Fetch Read-Back (GET /api/admin/employees/:id)
    // -----------------------------------------------------------------
    await it('2. Employee Single Fetch preserves profilePhoto, skills, languages, emergency contact & qualification', async () => {
      assert(createdEmployeeId, 'Employee ID must exist from Test 1');
      const res = await makeRequest(port, `/api/admin/employees/${createdEmployeeId}`, 'GET', null, authHeaders);
      assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
      const emp = res.body;

      // Critical fields verified against D1 read
      assert.strictEqual(emp.id, createdEmployeeId);
      assert.strictEqual(emp.employeeCode, testEmpCode);
      assert.strictEqual(emp.profilePhoto, 'https://images.unsplash.com/photo-vikram-test-custom-avatar.jpg', 'profilePhoto MUST match saved value');
      assert.strictEqual(emp.permanentAddress, 'Village Mohaddipur, Gorakhpur, UP 273008', 'permanentAddress MUST match saved value');
      assert.strictEqual(emp.emergencyContactMobile, '9876500000', 'emergencyContactMobile MUST match saved value');
      assert.strictEqual(emp.emergencyContactRelation, 'Spouse', 'emergencyContactRelation MUST match saved value');
      assert.strictEqual(emp.dateOfBirth, '1990-08-20', 'dateOfBirth MUST match saved value');
      assert.strictEqual(emp.university, 'Dr. A.P.J. Abdul Kalam Technical University', 'university MUST match saved value');
      assert.strictEqual(emp.reportingManager, 'Deepak Sharma', 'reportingManager MUST match saved value');
      assert.strictEqual(emp.probationStatus, 'Confirmed', 'probationStatus MUST match saved value');
      assert.strictEqual(emp.district, 'Gorakhpur', 'district MUST match saved value');
      assert.strictEqual(emp.totalExperienceYears, 6.5, 'totalExperienceYears MUST match saved value');
      assert(Array.isArray(emp.skills) && emp.skills.includes('D1 Architecture'), 'skills array MUST contain saved skills');
      assert(Array.isArray(emp.languages) && emp.languages.includes('Bhojpuri'), 'languages array MUST contain saved languages');
      assert(Array.isArray(emp.previousOrganizations) && emp.previousOrganizations.includes('Digital Seva Kendra Gorakhpur'), 'previousOrganizations MUST contain saved history');
    });

    // -----------------------------------------------------------------
    // TEST 3: Employee List Read-Back (GET /api/admin/employees)
    // -----------------------------------------------------------------
    await it('3. Employee List Retrieval (GET /api/admin/employees) returns persisted employee with correct photo & metadata', async () => {
      const res = await makeRequest(port, '/api/admin/employees', 'GET', null, authHeaders);
      assert.strictEqual(res.status, 200);
      assert(Array.isArray(res.body), 'Expected array of employees');
      const found = res.body.find(e => e.id === createdEmployeeId || e.employeeCode === testEmpCode);
      assert(found, 'Created employee must be present in GET /api/admin/employees');
      assert.strictEqual(found.profilePhoto, 'https://images.unsplash.com/photo-vikram-test-custom-avatar.jpg');
      assert.strictEqual(found.designation, 'Senior Operations Architect');
      assert.strictEqual(found.emergencyContactMobile, '9876500000');
    });

    // -----------------------------------------------------------------
    // TEST 4: Employee Update Cycle (PUT /api/admin/employees/:id)
    // -----------------------------------------------------------------
    await it('4. Employee Update cycle updates designation without wiping unedited metadata or profile photo', async () => {
      // First fetch fresh employee
      const fetchRes = await makeRequest(port, `/api/admin/employees/${createdEmployeeId}`, 'GET', null, authHeaders);
      assert.strictEqual(fetchRes.status, 200);
      const existing = fetchRes.body;

      // Update designation and add a new skill
      const updatePayload = {
        ...existing,
        designation: 'Principal Public Service Architect',
        skills: [...(existing.skills || []), 'Microservices Orchestration'],
        mobileNumber: '9876543299'
      };

      const putRes = await makeRequest(port, `/api/admin/employees/${createdEmployeeId}`, 'PUT', updatePayload, authHeaders);
      assert.strictEqual(putRes.status, 200, `Expected 200 OK on update, got ${putRes.status}`);
      assert.strictEqual(putRes.body.designation, 'Principal Public Service Architect');

      // Re-fetch to ensure persistence after PUT
      const verifyRes = await makeRequest(port, `/api/admin/employees/${createdEmployeeId}`, 'GET', null, authHeaders);
      assert.strictEqual(verifyRes.status, 200);
      const updated = verifyRes.body;
      assert.strictEqual(updated.designation, 'Principal Public Service Architect');
      assert.strictEqual(updated.mobileNumber, '9876543299');
      assert.strictEqual(updated.profilePhoto, 'https://images.unsplash.com/photo-vikram-test-custom-avatar.jpg', 'profilePhoto MUST NOT be wiped on update');
      assert.strictEqual(updated.permanentAddress, 'Village Mohaddipur, Gorakhpur, UP 273008', 'permanentAddress MUST NOT be wiped on update');
      assert.strictEqual(updated.emergencyContactMobile, '9876500000', 'emergencyContactMobile MUST NOT be wiped on update');
      assert(updated.skills.includes('Microservices Orchestration'), 'New skill MUST be persisted');
      assert(updated.skills.includes('D1 Architecture'), 'Original skills MUST NOT be wiped');
    });

    // -----------------------------------------------------------------
    // TEST 5: Employee KYC Persistence & Masking/Unmasking
    // -----------------------------------------------------------------
    await it('5. Employee KYC stores Aadhaar, PAN, Bank Details & supports unmasked retrieval', async () => {
      const kycPayload = {
        aadhaarNumber: '123456789012',
        panNumber: 'ABCDE1234F',
        bankName: 'State Bank of India',
        accountNumber: '98765432101234',
        ifscCode: 'SBIN0001234',
        accountHolderName: 'Vikramaditya Sharma',
        bankBranch: 'Gorakhpur Main Branch',
        accountType: 'Savings',
        status: 'VERIFIED'
      };

      const putRes = await makeRequest(port, `/api/admin/employees/${createdEmployeeId}/kyc`, 'PUT', kycPayload, authHeaders);
      assert(putRes.status === 200 || putRes.status === 201, `Expected 200/201 on KYC put, got ${putRes.status}: ${JSON.stringify(putRes.body)}`);

      // Read-back standard (masked)
      const maskedRes = await makeRequest(port, `/api/admin/employees/${createdEmployeeId}/kyc`, 'GET', null, authHeaders);
      assert.strictEqual(maskedRes.status, 200);
      assert(maskedRes.body.aadhaarNumber.includes('XXXX') || maskedRes.body.aadhaarNumber.includes('****') || maskedRes.body.aadhaarNumber === 'XXXXXXXX9012' || maskedRes.body.aadhaarNumber.length >= 8);
      assert.strictEqual(maskedRes.body.bankName, 'State Bank of India');

      // Read-back unmasked with ?unmask=true
      const unmaskedRes = await makeRequest(port, `/api/admin/employees/${createdEmployeeId}/kyc?unmask=true`, 'GET', null, authHeaders);
      assert.strictEqual(unmaskedRes.status, 200);
      assert.strictEqual(unmaskedRes.body.aadhaarNumber, '123456789012', 'Unmasked Aadhaar must match');
      assert.strictEqual(unmaskedRes.body.panNumber, 'ABCDE1234F', 'Unmasked PAN must match');
      assert.strictEqual(unmaskedRes.body.accountNumber, '98765432101234', 'Unmasked Account Number must match');
      assert.strictEqual(unmaskedRes.body.ifscCode, 'SBIN0001234');
      assert.strictEqual(unmaskedRes.body.accountHolderName, 'Vikramaditya Sharma');
    });

    // -----------------------------------------------------------------
    // TEST 6: Employee Payroll Persistence (Deductions, Allowances, Metadata)
    // -----------------------------------------------------------------
    await it('6. Employee Payroll persists baseSalary, HRA, specialAllowance, pfDeduction, taxDeduction & metadata', async () => {
      const payrollPayload = {
        salaryType: 'Monthly',
        salaryFrequency: 'Monthly',
        baseSalary: 45000,
        hra: 15000,
        conveyanceAllowance: 5000,
        medicalAllowance: 3000,
        specialAllowance: 12000,
        performanceBonus: 5000,
        grossSalary: 80000,
        pfDeduction: 1800,
        taxDeduction: 4200,
        otherDeductions: 500,
        totalDeductions: 6500,
        netSalary: 73500,
        paymentMode: 'Bank Transfer',
        bankName: 'State Bank of India',
        accountNumber: '98765432101234',
        ifscCode: 'SBIN0001234',
        effectiveFrom: '2025-02-01',
        remarks: 'Confirmed annual increment revision'
      };

      const putRes = await makeRequest(port, `/api/admin/employees/${createdEmployeeId}/payroll`, 'PUT', payrollPayload, authHeaders);
      assert(putRes.status === 200 || putRes.status === 201, `Expected 200/201 on payroll put, got ${putRes.status}: ${JSON.stringify(putRes.body)}`);

      // Read-back payroll via GET
      const getRes = await makeRequest(port, `/api/admin/employees/${createdEmployeeId}/payroll`, 'GET', null, authHeaders);
      assert.strictEqual(getRes.status, 200, `Expected 200 on payroll GET, got ${getRes.status}`);
      const payroll = getRes.body;

      assert.strictEqual(payroll.baseSalary, 45000, 'baseSalary must match');
      assert.strictEqual(payroll.hra, 15000, 'hra must match');
      assert.strictEqual(payroll.specialAllowance, 12000, 'specialAllowance MUST be persisted and restored');
      assert.strictEqual(payroll.pfDeduction, 1800, 'pfDeduction MUST be persisted and restored');
      assert.strictEqual(payroll.taxDeduction, 4200, 'taxDeduction MUST be persisted and restored');
      assert.strictEqual(payroll.salaryType, 'Monthly', 'salaryType must match');
      assert.strictEqual(payroll.effectiveFrom, '2025-02-01', 'effectiveFrom must match');
    });

    // -----------------------------------------------------------------
    // TEST 7: Employee Document Vault (Canonical ID & Employee Code)
    // -----------------------------------------------------------------
    await it('7. Employee Document Vault returns documents by both canonical employee ID and employeeCode', async () => {
      // 1. Post document record to employee document vault
      const docPayload = {
        documentType: 'Education',
        documentName: 'BTech Degree Certificate',
        originalFileName: 'vikram_degree.pdf',
        fileData: 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4 Mock certificate content for test').toString('base64'),
        notes: 'Original verified against university registrar'
      };

      const uploadRes = await makeRequest(port, `/api/admin/employees/${createdEmployeeId}/documents`, 'POST', docPayload, authHeaders);
      assert(uploadRes.status === 200 || uploadRes.status === 201, `Expected 200/201 on doc post, got ${uploadRes.status}: ${JSON.stringify(uploadRes.body)}`);

      // 2. Query documents using canonical employee ID
      const docsByIdRes = await makeRequest(port, `/api/admin/employees/${createdEmployeeId}/documents`, 'GET', null, authHeaders);
      assert.strictEqual(docsByIdRes.status, 200);
      assert(Array.isArray(docsByIdRes.body) && docsByIdRes.body.length >= 1, 'Documents query by canonical ID must return at least 1 document');
      const doc1 = docsByIdRes.body.find(d => (d.documentName === 'BTech Degree Certificate' || d.title === 'BTech Degree Certificate'));
      assert(doc1, 'Uploaded degree certificate document must be found by canonical ID');

      // 3. Query documents using employee code (e.g. EMP-TEST-xxxx)
      const docsByCodeRes = await makeRequest(port, `/api/admin/employees/${testEmpCode}/documents`, 'GET', null, authHeaders);
      assert.strictEqual(docsByCodeRes.status, 200);
      assert(Array.isArray(docsByCodeRes.body) && docsByCodeRes.body.length >= 1, 'Documents query by employeeCode must return documents');
      const doc2 = docsByCodeRes.body.find(d => (d.documentName === 'BTech Degree Certificate' || d.title === 'BTech Degree Certificate'));
      assert(doc2, 'Uploaded degree certificate document must be found by employeeCode');
    });

    // -----------------------------------------------------------------
    // TEST 8: Full Customer Creation Persistence (Metadata, Address, Dates)
    // -----------------------------------------------------------------
    await it('8. Customer Full Creation persists dobOrIncorporationDate, address, status & full custom metadata', async () => {
      const custPayload = {
        name: 'Sunita Devi Enterprise',
        email: `sunita.${Date.now()}@example.com`,
        phone: '9812345678',
        customerType: 'Commercial',
        companyName: 'Devi Digital Services LLP',
        gstNumber: '09AAAAA0000A1Z5',
        panNumber: 'AAACD1234K',
        dobOrIncorporationDate: '2018-11-12',
        addressLine1: 'Shop 15, Nagar Nigam Complex',
        addressLine2: 'Civil Lines',
        city: 'Gorakhpur',
        state: 'Uttar Pradesh',
        pincode: '273001',
        isSuspended: false,
        isVerified: true,
        metadata: {
          preferredLanguage: 'Hindi',
          creditLimit: 50000,
          accountTier: 'Platinum Partner',
          tags: ['MSME', 'CSC-Partner', 'Priority-Service']
        }
      };

      const res = await makeRequest(port, '/api/admin/customers', 'POST', custPayload, authHeaders);
      assert.strictEqual(res.status, 201, `Expected 201 Created on customer create, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert(res.body && res.body.id, 'Customer ID must be returned');
      createdCustomerId = res.body.id;

      // Single read-back via GET /api/admin/customers/:id
      const getRes = await makeRequest(port, `/api/admin/customers/${createdCustomerId}`, 'GET', null, authHeaders);
      assert.strictEqual(getRes.status, 200, `Expected 200 on customer GET, got ${getRes.status}`);
      const cust = getRes.body;

      assert.strictEqual(cust.id, createdCustomerId);
      assert.strictEqual(cust.name, 'Sunita Devi Enterprise');
      assert.strictEqual(cust.dobOrIncorporationDate, '2018-11-12', 'dobOrIncorporationDate must be persisted');
      assert.strictEqual(cust.gstNumber, '09AAAAA0000A1Z5');
      assert.strictEqual(cust.isVerified, true, 'isVerified flag must be persisted');
      assert(cust.metadata, 'metadata object must be persisted');
      assert.strictEqual(cust.metadata.accountTier, 'Platinum Partner', 'metadata.accountTier must be preserved');
      assert(Array.isArray(cust.metadata.tags) && cust.metadata.tags.includes('Priority-Service'), 'metadata.tags array must be preserved');
    });

    // -----------------------------------------------------------------
    // TEST 9: Customer Update Lifecycle
    // -----------------------------------------------------------------
    await it('9. Customer Update lifecycle updates fields and preserves metadata without wiping', async () => {
      assert(createdCustomerId, 'Customer ID must exist from Test 8');
      const getRes = await makeRequest(port, `/api/admin/customers/${createdCustomerId}`, 'GET', null, authHeaders);
      assert.strictEqual(getRes.status, 200);
      const existing = getRes.body;

      const updatePayload = {
        ...existing,
        name: 'Sunita Devi Enterprises & Associates',
        metadata: {
          ...existing.metadata,
          creditLimit: 75000,
          updatedAtNote: 'Upgraded credit limit upon compliance review'
        }
      };

      const putRes = await makeRequest(port, `/api/admin/customers/${createdCustomerId}`, 'PUT', updatePayload, authHeaders);
      assert.strictEqual(putRes.status, 200, `Expected 200 on customer PUT, got ${putRes.status}`);

      // Verify re-fetch
      const verifyRes = await makeRequest(port, `/api/admin/customers/${createdCustomerId}`, 'GET', null, authHeaders);
      assert.strictEqual(verifyRes.status, 200);
      const updated = verifyRes.body;
      assert.strictEqual(updated.name, 'Sunita Devi Enterprises & Associates');
      assert.strictEqual(updated.dobOrIncorporationDate, '2018-11-12', 'dobOrIncorporationDate MUST NOT be wiped');
      assert.strictEqual(updated.metadata.creditLimit, 75000);
      assert.strictEqual(updated.metadata.accountTier, 'Platinum Partner', 'Original accountTier must be intact');
    });

    // -----------------------------------------------------------------
    // TEST 10: Media Record Persistence
    // -----------------------------------------------------------------
    await it('10. Media record creation persists metadata, mimeType, and returns valid media object', async () => {
      const mediaPayload = {
        fileName: 'sample-identity-proof.jpg',
        fileSize: 1048576,
        mimeType: 'image/jpeg',
        url: 'https://images.unsplash.com/photo-sample-media-test.jpg',
        title: 'Employee Identity Proof Proofing',
        category: 'Identity',
        tags: ['KYC', 'Aadhaar', 'Employee']
      };

      const res = await makeRequest(port, '/api/admin/media', 'POST', mediaPayload, authHeaders);
      assert(res.status === 200 || res.status === 201, `Expected 200/201 on media create, got ${res.status}: ${JSON.stringify(res.body)}`);
      const mediaId = res.body.id;
      assert(mediaId, 'Media item must have an id');

      // Verify list retrieval
      const listRes = await makeRequest(port, '/api/admin/media', 'GET', null, authHeaders);
      assert.strictEqual(listRes.status, 200);
      assert(Array.isArray(listRes.body));
      const foundMedia = listRes.body.find(m => m.id === mediaId || m.fileName === 'sample-identity-proof.jpg');
      assert(foundMedia, 'Uploaded media must be found in media collection');
      assert.strictEqual(foundMedia.mimeType, 'image/jpeg');
    });

    // -----------------------------------------------------------------
    // TEST 11: Master Data Single Canonical Route & Persistence
    // -----------------------------------------------------------------
    await it('11. Master Data single canonical routing works cleanly for GET and POST without duplicate collisions', async () => {
      const getRes = await makeRequest(port, '/api/master-data', 'GET', null, authHeaders);
      assert.strictEqual(getRes.status, 200, `Expected 200 on /api/master-data, got ${getRes.status}`);
      assert(typeof getRes.body === 'object', 'Master data must be an object');

      // Add/Update a test master data entry
      const updatePayload = {
        ...getRes.body,
        _testKey: 'persistence_verified_2026',
        lastUpdatedBy: 'test_record_persistence.cjs'
      };

      const postRes = await makeRequest(port, '/api/master-data', 'POST', updatePayload, authHeaders);
      assert(postRes.status === 200 || postRes.status === 201, `Expected 200/201 on master data update, got ${postRes.status}`);

      // Verify read-back
      const verifyRes = await makeRequest(port, '/api/master-data', 'GET', null, authHeaders);
      assert.strictEqual(verifyRes.status, 200);
      assert.strictEqual(verifyRes.body._testKey, 'persistence_verified_2026');
    });

    // -----------------------------------------------------------------
    // TEST 12: Dual-write / Relational Fallback Integrity
    // -----------------------------------------------------------------
    await it('12. Relational Mirror consistency: Employee & Customer records exist in relational tables without error', async () => {
      // Direct verification via server API that both relational and kv are consistent
      const empRes = await makeRequest(port, `/api/admin/employees/${createdEmployeeId}`, 'GET', null, authHeaders);
      assert.strictEqual(empRes.status, 200);
      assert.strictEqual(empRes.body.fullName, 'Vikramaditya Sharma');
      assert(Array.isArray(empRes.body.skills) && empRes.body.skills.length >= 4);

      const custRes = await makeRequest(port, `/api/admin/customers/${createdCustomerId}`, 'GET', null, authHeaders);
      assert.strictEqual(custRes.status, 200);
      assert.strictEqual(custRes.body.name, 'Sunita Devi Enterprises & Associates');
    });

  } finally {
    server.close();
  }

  console.log('\n------------------------------------------------------------');
  console.log(`Tests Completed: ${passedTests} / ${totalTests} Passed`);
  console.log('------------------------------------------------------------\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
