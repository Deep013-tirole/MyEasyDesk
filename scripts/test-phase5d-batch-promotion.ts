import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {
  initD1Schema,
  saveEntityToD1,
  deleteEntityFromD1,
  getRelationalReadMode,
  setRelationalReadMode,
  getAllRelationalReadModes,
  resetRelationalReadConfig,
  isCircuitBreakerTripped,
  resetCircuitBreaker,
  recordReadDiagnostic,
  normalizeRecordForParity,
  queryEmployeesRelational,
  queryEmployeeDocumentsRelational,
  queryReviewsRelational,
  queryCollectionRelational,
  queryEntityRelational,
  shadowCompareCollection,
  readCollectionWithFallback,
  readEntityWithFallback,
  getRelationalReadStatus
} from '../src/lib/d1Storage';

// Build a mock D1 database adapter on top of Node SQLite
function createMockD1() {
  const sqlite = new DatabaseSync(':memory:');

  const mockDb = {
    raw: sqlite,
    prepare(sql: string) {
      return {
        _sql: sql,
        _params: [] as any[],
        bind(...args: any[]) {
          this._params = args;
          return this;
        },
        async run() {
          try {
            const stmt = sqlite.prepare(this._sql);
            const info = stmt.run(...this._params) as any;
            return { success: true, changes: info?.changes || 1 };
          } catch (err: any) {
            console.error('[SQL Error in run]:', err.message, 'SQL:', this._sql);
            throw err;
          }
        },
        async all() {
          try {
            const stmt = sqlite.prepare(this._sql);
            const results = stmt.all(...this._params);
            return { success: true, results };
          } catch (err: any) {
            console.error('[SQL Error in all]:', err.message, 'SQL:', this._sql);
            throw err;
          }
        }
      };
    },
    async batch(statements: any[]) {
      for (const s of statements) {
        await s.run();
      }
      return { success: true };
    },
    async exec(sql: string) {
      sqlite.exec(sql);
    }
  };

  return mockDb;
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n============================================================');
  console.log('EASYDESK PHASE 5D — BATCH RELATIONAL READ PROMOTION SUITE');
  console.log('Employees + EmployeeDocuments + Reviews');
  console.log('============================================================\n');

  const db = createMockD1();
  await initD1Schema(db);
  resetRelationalReadConfig();

  // --------------------------------------------------------------------------
  // SUITE 1: Promotion Configuration State (Step 10)
  // --------------------------------------------------------------------------
  console.log('--- SUITE 1: Batch Promotion Configuration State ---');

  const modes = getAllRelationalReadModes();
  assert(modes.categories === 'RELATIONAL', 'categories is in RELATIONAL mode');
  assert(modes.services === 'RELATIONAL', 'services is in RELATIONAL mode');
  assert(modes.customers === 'RELATIONAL', 'customers is in RELATIONAL mode');
  assert(modes.employees === 'RELATIONAL', 'employees is promoted to RELATIONAL mode');
  assert(modes.employeeDocuments === 'RELATIONAL', 'employeeDocuments is promoted to RELATIONAL mode');
  assert(modes.reviews === 'RELATIONAL', 'reviews is promoted to RELATIONAL mode');

  const remainingCollections = [
    'employeeKYC', 'employeePayroll', 'employeeAccounts',
    'orders', 'auditLogs'
  ];

  for (const col of remainingCollections) {
    assert(modes[col] === 'SHADOW', `Collection '${col}' remains safely in unpromoted SHADOW mode`);
  }

  // --------------------------------------------------------------------------
  // SUITE 2: Dual-Write Seeding & Data Parity (Steps 2 & 5)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 2: Dual-Write Seeding & Data Parity ---');

  // 1. Seed Employees
  const sampleEmployees = [
    {
      id: 'emp-101',
      code: 'EMP-101',
      name: 'Ramesh Kulkarni',
      department: 'Operations',
      designation: 'Senior Document Officer',
      employmentType: 'Full-Time',
      status: 'Active',
      joiningDate: '2022-03-01',
      phone: '9823011223',
      email: 'ramesh.k@easydesk.local',
      photoUrl: 'https://images.unsplash.com/photo-ramesh.jpg',
      address: 'Deccan Gymkhana',
      city: 'Pune',
      state: 'Maharashtra',
      pinCode: '411004',
      qualification: 'B.Com, GDCA',
      experienceYears: 6,
      emergencyContactName: 'Sunita Kulkarni',
      emergencyContactPhone: '9823099887'
    },
    {
      id: 'emp-102',
      code: 'EMP-102',
      name: 'Priya Deshmukh',
      department: 'Customer Support',
      designation: 'Helpdesk Lead',
      employmentType: 'Full-Time',
      status: 'Active',
      joiningDate: '2023-01-15',
      phone: '9850123456',
      email: 'priya.d@easydesk.local',
      photoUrl: null,
      address: 'Kothrud Depot',
      city: 'Pune',
      state: 'Maharashtra',
      pinCode: '411038',
      qualification: 'BBA, Customer Success Certified',
      experienceYears: 4,
      emergencyContactName: 'Anil Deshmukh',
      emergencyContactPhone: '9850198765'
    }
  ];

  for (const emp of sampleEmployees) {
    const res = await saveEntityToD1('employees', emp.id, emp, db);
    assert(res.success, `Dual-write successfully synced employee: ${emp.id}`);
  }

  // Verify employee parity
  const empRows = await db.prepare('SELECT * FROM employees').all();
  assert(empRows.results.length === sampleEmployees.length, `Employees relational count matches seeded count (${empRows.results.length}/${sampleEmployees.length})`);
  for (const emp of sampleEmployees) {
    const relEmp = empRows.results.find((r: any) => r.id === emp.id);
    assert(relEmp !== undefined, `Employee ${emp.id} exists in relational table`);
    assert(relEmp.code === emp.code, `Field 'code' parity for ${emp.id}`);
    assert(relEmp.name === emp.name, `Field 'name' parity for ${emp.id}`);
    assert(relEmp.department === emp.department, `Field 'department' parity for ${emp.id}`);
    assert(relEmp.designation === emp.designation, `Field 'designation' parity for ${emp.id}`);
    assert(relEmp.status === emp.status, `Field 'status' parity for ${emp.id}`);
  }

  // 2. Seed Employee Documents
  const sampleDocs = [
    {
      id: 'doc-201',
      employeeId: 'emp-101',
      documentType: 'Aadhaar Card',
      documentName: 'Aadhaar Card - Front & Back',
      originalFileName: 'ramesh_aadhaar.pdf',
      storagePath: 'employee_docs/emp-101/aadhaar.pdf',
      downloadUrl: 'https://storage.easydesk.local/docs/emp-101-aadhaar.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1048576,
      verificationStatus: 'Verified',
      uploadedBy: 'HR Admin'
    },
    {
      id: 'doc-202',
      employeeId: 'emp-101',
      documentType: 'PAN Card',
      documentName: 'PAN Card Copy',
      originalFileName: 'ramesh_pan.pdf',
      storagePath: 'employee_docs/emp-101/pan.pdf',
      downloadUrl: 'https://storage.easydesk.local/docs/emp-101-pan.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 524288,
      verificationStatus: 'Verified',
      uploadedBy: 'HR Admin'
    },
    {
      id: 'doc-203',
      employeeId: 'emp-102',
      documentType: 'Degree Certificate',
      documentName: 'BBA Graduation Degree',
      originalFileName: 'priya_degree.pdf',
      storagePath: 'employee_docs/emp-102/degree.pdf',
      downloadUrl: 'https://storage.easydesk.local/docs/emp-102-degree.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2097152,
      verificationStatus: 'Pending',
      uploadedBy: 'Priya Deshmukh'
    }
  ];

  for (const doc of sampleDocs) {
    const res = await saveEntityToD1('employeeDocuments', doc.id, doc, db);
    assert(res.success, `Dual-write successfully synced employee document: ${doc.id}`);
  }

  // Verify employee documents parity
  const docRows = await db.prepare('SELECT * FROM employee_documents').all();
  assert(docRows.results.length === sampleDocs.length, `EmployeeDocuments relational count matches seeded count (${docRows.results.length}/${sampleDocs.length})`);
  for (const doc of sampleDocs) {
    const relDoc = docRows.results.find((r: any) => r.id === doc.id);
    assert(relDoc !== undefined, `Document ${doc.id} exists in relational table`);
    assert(relDoc.employee_id === doc.employeeId, `Field 'employee_id' parity for ${doc.id}`);
    assert(relDoc.document_type === doc.documentType, `Field 'document_type' parity for ${doc.id}`);
    assert(relDoc.verification_status === doc.verificationStatus, `Field 'verification_status' parity for ${doc.id}`);
  }

  // 3. Seed Prerequisite Services & Customers for Review Foreign Keys
  await saveEntityToD1('categories', 'gov', { id: 'gov', name: 'Government Services', slug: 'gov' }, db);
  await saveEntityToD1('services', 'pan', { id: 'pan', categoryId: 'gov', title: 'PAN Card Assistance', slug: 'new-pan-card' }, db);
  await saveEntityToD1('services', 'gst-reg', { id: 'gst-reg', categoryId: 'gov', title: 'GST Registration', slug: 'gst-registration' }, db);
  await saveEntityToD1('services', 'aadhaar-update', { id: 'aadhaar-update', categoryId: 'gov', title: 'Aadhaar Update', slug: 'aadhaar-update' }, db);
  await saveEntityToD1('customers', 'cust-101', { id: 'cust-101', code: 'CUST-1001', name: 'Deepak Sharma', mobile: '9876543210' }, db);
  await saveEntityToD1('customers', 'cust-102', { id: 'cust-102', code: 'CUST-1002', name: 'Nexus Tech Solutions', mobile: '9123456780' }, db);
  await saveEntityToD1('orders', 'ord-1', { id: 'ord-1', customerId: 'cust-101', serviceId: 'pan', name: 'Deepak Sharma', mobile: '9876543210' }, db);
  await saveEntityToD1('orders', 'ord-2', { id: 'ord-2', customerId: 'cust-101', serviceId: 'aadhaar-update', name: 'Deepak Sharma', mobile: '9876543210' }, db);
  await saveEntityToD1('orders', 'ord-3', { id: 'ord-3', customerId: 'cust-102', serviceId: 'gst-reg', name: 'Nexus Tech', mobile: '9123456780' }, db);

  // 4. Seed Reviews
  const sampleReviews = [
    {
      id: 'rev-301',
      serviceId: 'pan',
      customerId: 'cust-101',
      orderId: 'ord-1',
      customerName: 'Deepak Sharma',
      rating: 5,
      comment: 'Excellent service! Received my PAN card update within 3 business days with zero hassle.',
      status: 'Approved',
      isVerifiedOrder: true,
      adminNote: 'Featured customer feedback'
    },
    {
      id: 'rev-302',
      serviceId: 'gst-reg',
      customerId: 'cust-102',
      orderId: 'ord-3',
      customerName: 'Nexus Tech Solutions',
      rating: 5,
      comment: 'Very professional GST registration support. Everything processed seamlessly.',
      status: 'Approved',
      isVerifiedOrder: true,
      adminNote: 'Verified business client'
    },
    {
      id: 'rev-303',
      serviceId: 'aadhaar-update',
      customerId: 'cust-101',
      orderId: 'ord-2',
      customerName: 'Deepak Sharma',
      rating: 4,
      comment: 'Good communication and swift document handling.',
      status: 'Pending',
      isVerifiedOrder: false,
      adminNote: 'Pending moderation'
    }
  ];

  for (const rev of sampleReviews) {
    const res = await saveEntityToD1('reviews', rev.id, rev, db);
    assert(res.success, `Dual-write successfully synced review: ${rev.id}`);
  }

  // Verify reviews parity
  const revRows = await db.prepare('SELECT * FROM reviews').all();
  assert(revRows.results.length === sampleReviews.length, `Reviews relational count matches seeded count (${revRows.results.length}/${sampleReviews.length})`);
  for (const rev of sampleReviews) {
    const relRev = revRows.results.find((r: any) => r.id === rev.id);
    assert(relRev !== undefined, `Review ${rev.id} exists in relational table`);
    assert(relRev.service_id === rev.serviceId, `Field 'service_id' parity for ${rev.id}`);
    assert(relRev.customer_name === rev.customerName, `Field 'customer_name' parity for ${rev.id}`);
    assert(Number(relRev.rating) === rev.rating, `Field 'rating' parity for ${rev.id}`);
    assert(relRev.status === rev.status, `Field 'status' parity for ${rev.id}`);
  }

  // --------------------------------------------------------------------------
  // SUITE 3: Relational Query Implementations (Step 3)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 3: Relational Query Implementations ---');

  // Employees Query Tests
  const allEmployees = await queryEmployeesRelational(undefined, db);
  assert(allEmployees.length === sampleEmployees.length, '1. queryEmployeesRelational returns full list');
  const empById = await queryEmployeesRelational({ id: 'emp-101' }, db);
  assert(empById.length === 1 && empById[0].name === 'Ramesh Kulkarni', '2. queryEmployeesRelational by ID works');
  const empByDept = await queryEmployeesRelational({ department: 'Operations' }, db);
  assert(empByDept.length === 1 && empByDept[0].id === 'emp-101', '3. queryEmployeesRelational by department works');
  const empBySearch = await queryEmployeesRelational({ search: 'Priya' }, db);
  assert(empBySearch.length === 1 && empBySearch[0].id === 'emp-102', '4. queryEmployeesRelational by search works');
  const empSingle = await queryEntityRelational('employees', 'emp-101', db);
  assert(empSingle?.id === 'emp-101', '5. queryEntityRelational for employees works');

  // Employee Documents Query Tests
  const allDocs = await queryEmployeeDocumentsRelational(undefined, db);
  assert(allDocs.length === sampleDocs.length, '6. queryEmployeeDocumentsRelational returns full list');
  const docsByEmp = await queryEmployeeDocumentsRelational('emp-101', db);
  assert(docsByEmp.length === 2, '7. queryEmployeeDocumentsRelational filters by employeeId correctly');
  const docSingle = await queryEntityRelational('employeeDocuments', 'doc-201', db);
  assert(docSingle?.id === 'doc-201', '8. queryEntityRelational for employeeDocuments works');

  // Reviews Query Tests
  const allReviews = await queryReviewsRelational(undefined, db);
  assert(allReviews.length === sampleReviews.length, '9. queryReviewsRelational returns full list');
  const reviewsBySrv = await queryReviewsRelational({ serviceId: 'pan' }, db);
  assert(reviewsBySrv.length === 1 && reviewsBySrv[0].id === 'rev-301', '10. queryReviewsRelational filters by serviceId');
  const reviewsByStatus = await queryReviewsRelational({ status: 'Approved' }, db);
  assert(reviewsByStatus.length === 2, '11. queryReviewsRelational filters by status');
  const reviewsByRating = await queryReviewsRelational({ rating: 5 }, db);
  assert(reviewsByRating.length === 2, '12. queryReviewsRelational filters by rating');
  const revSingle = await queryEntityRelational('reviews', 'rev-301', db);
  assert(revSingle?.id === 'rev-301', '13. queryEntityRelational for reviews works');

  // SQL Injection prevention test
  const injectionRes = await queryEmployeesRelational({ id: "'; DROP TABLE employees; --" }, db);
  assert(Array.isArray(injectionRes) && injectionRes.length === 0, '14. Parameterized query safely prevents SQL injection');

  // --------------------------------------------------------------------------
  // SUITE 4: API Contract Parity (Step 4)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 4: API Contract Parity ---');

  // Employees API Contract
  setRelationalReadMode('employees', 'LEGACY');
  const legacyEmps = await readCollectionWithFallback('employees', () => sampleEmployees, db);
  setRelationalReadMode('employees', 'RELATIONAL');
  const relEmps = await readCollectionWithFallback('employees', () => sampleEmployees, db);
  assert(legacyEmps.length === relEmps.length, 'API Contract: Employees list length identical');
  assert('code' in relEmps[0] && 'department' in relEmps[0] && 'status' in relEmps[0], 'API Contract: Employee keys preserved');

  // Employee Documents API Contract
  setRelationalReadMode('employeeDocuments', 'LEGACY');
  const legacyEmpDocs = await readCollectionWithFallback('employeeDocuments', () => sampleDocs, db);
  setRelationalReadMode('employeeDocuments', 'RELATIONAL');
  const relEmpDocs = await readCollectionWithFallback('employeeDocuments', () => sampleDocs, db);
  assert(legacyEmpDocs.length === relEmpDocs.length, 'API Contract: Employee documents list length identical');
  assert('documentType' in relEmpDocs[0] && 'storagePath' in relEmpDocs[0], 'API Contract: Document keys preserved');

  // Reviews API Contract
  setRelationalReadMode('reviews', 'LEGACY');
  const legacyRevs = await readCollectionWithFallback('reviews', () => sampleReviews, db);
  setRelationalReadMode('reviews', 'RELATIONAL');
  const relRevs = await readCollectionWithFallback('reviews', () => sampleReviews, db);
  assert(legacyRevs.length === relRevs.length, 'API Contract: Reviews list length identical');
  assert('rating' in relRevs[0] && 'comment' in relRevs[0] && 'status' in relRevs[0], 'API Contract: Review keys preserved');

  // --------------------------------------------------------------------------
  // SUITE 5: Relationship Verification (Step 5)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 5: Relationship Verification ---');

  // 1. Employee -> Documents
  const emp1Docs = relEmpDocs.filter((d: any) => d.employeeId === 'emp-101');
  assert(emp1Docs.length === 2, 'Foreign Key: emp-101 resolves 2 documents in relational table');

  // 2. Reviews -> Service / Customer
  const rev1 = relRevs.find((r: any) => r.id === 'rev-301');
  assert(rev1?.serviceId === 'pan' && rev1?.customerId === 'cust-101', 'Foreign Key: rev-301 links to valid service pan and customer cust-101');

  // --------------------------------------------------------------------------
  // SUITE 6: Shadow Parity Check (Step 6)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 6: Shadow Parity Check ---');

  setRelationalReadMode('employees', 'SHADOW');
  const empShadow = await shadowCompareCollection('employees', sampleEmployees, db);
  assert(empShadow.success && empShadow.mismatches === 0, 'Shadow comparison for employees confirms 100% parity');

  setRelationalReadMode('employeeDocuments', 'SHADOW');
  const docShadow = await shadowCompareCollection('employeeDocuments', sampleDocs, db);
  assert(docShadow.success && docShadow.mismatches === 0, 'Shadow comparison for employeeDocuments confirms 100% parity');

  setRelationalReadMode('reviews', 'SHADOW');
  const revShadow = await shadowCompareCollection('reviews', sampleReviews, db);
  assert(revShadow.success && revShadow.mismatches === 0, 'Shadow comparison for reviews confirms 100% parity');

  // Restore to RELATIONAL
  setRelationalReadMode('employees', 'RELATIONAL');
  setRelationalReadMode('employeeDocuments', 'RELATIONAL');
  setRelationalReadMode('reviews', 'RELATIONAL');

  // --------------------------------------------------------------------------
  // SUITE 7: Resilient Fallback Under Failure Conditions (Step 7)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 7: Resilient Fallback Under Failure Conditions ---');

  const brokenDb = {
    ...db,
    prepare(sql: string) {
      if (sql.includes('FROM employees') || sql.includes('FROM employee_documents') || sql.includes('FROM reviews')) {
        throw new Error('Simulated SQLite disk corruption / syntax error');
      }
      return db.prepare(sql);
    }
  };

  // Employees Fallback
  let empFallbackCalled = false;
  const empResult = await readCollectionWithFallback('employees', () => {
    empFallbackCalled = true;
    return sampleEmployees;
  }, brokenDb);
  assert(empFallbackCalled && empResult.length === sampleEmployees.length, 'Fallback: Employees query exception triggers seamless legacy fallback');

  // EmployeeDocuments Fallback
  let docFallbackCalled = false;
  const docResult = await readCollectionWithFallback('employeeDocuments', () => {
    docFallbackCalled = true;
    return sampleDocs;
  }, brokenDb);
  assert(docFallbackCalled && docResult.length === sampleDocs.length, 'Fallback: EmployeeDocuments query exception triggers seamless legacy fallback');

  // Reviews Fallback
  let revFallbackCalled = false;
  const revResult = await readCollectionWithFallback('reviews', () => {
    revFallbackCalled = true;
    return sampleReviews;
  }, brokenDb);
  assert(revFallbackCalled && revResult.length === sampleReviews.length, 'Fallback: Reviews query exception triggers seamless legacy fallback');

  // --------------------------------------------------------------------------
  // SUITE 8: Circuit Breaker Protection (Step 8)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 8: Circuit Breaker Protection ---');

  resetCircuitBreaker('employees');
  resetCircuitBreaker('employeeDocuments');
  resetCircuitBreaker('reviews');

  assert(!isCircuitBreakerTripped('employees'), 'Circuit breaker starts in untripped healthy state');

  // Fail 5 times in a row for employees
  for (let i = 0; i < 5; i++) {
    await readCollectionWithFallback('employees', () => sampleEmployees, brokenDb);
  }

  assert(isCircuitBreakerTripped('employees'), 'Circuit breaker trips after 5 consecutive failures for employees');

  // While tripped, relational queries are bypassed
  let bypassedCalled = false;
  await readCollectionWithFallback('employees', () => {
    bypassedCalled = true;
    return sampleEmployees;
  }, db);
  assert(bypassedCalled, 'While circuit breaker is tripped, reads bypass relational and serve legacy fallback directly');

  // Manual reset
  resetCircuitBreaker('employees');
  assert(!isCircuitBreakerTripped('employees'), 'Circuit breaker successfully resets manually');

  // --------------------------------------------------------------------------
  // SUITE 9: Read-After-Write Consistency (Step 9)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 9: Read-After-Write Consistency ---');

  // 1. Employee Create/Update/Delete
  const testEmp = {
    id: 'emp-temp-999',
    code: 'EMP-999',
    name: 'Temporary Staff',
    department: 'Support',
    designation: 'Associate',
    employmentType: 'Contract',
    status: 'Active',
    joiningDate: '2026-09-01',
    phone: '9999911111',
    email: 'temp@easydesk.local'
  };
  await saveEntityToD1('employees', testEmp.id, testEmp, db);
  const createdEmp = await readEntityWithFallback('employees', testEmp.id, () => testEmp, db);
  assert(createdEmp?.name === 'Temporary Staff', 'Read-After-Write: Created employee read immediately');

  const updatedEmp = { ...testEmp, name: 'Temporary Staff Updated' };
  await saveEntityToD1('employees', updatedEmp.id, updatedEmp, db);
  const fetchedUpdatedEmp = await readEntityWithFallback('employees', testEmp.id, () => updatedEmp, db);
  assert(fetchedUpdatedEmp?.name === 'Temporary Staff Updated', 'Read-After-Write: Updated employee reflected immediately');

  await deleteEntityFromD1('employees', testEmp.id, db);
  const deletedEmp = await queryEmployeesRelational({ id: testEmp.id }, db);
  assert(deletedEmp.length === 0, 'Read-After-Write: Deleted employee absent from relational query');

  // 2. Review Create/Update/Delete
  const testRev = {
    id: 'rev-temp-999',
    serviceId: 'pan',
    customerId: 'cust-101',
    customerName: 'Test Reviewer',
    rating: 5,
    comment: 'Instant feedback test',
    status: 'Approved'
  };
  await saveEntityToD1('reviews', testRev.id, testRev, db);
  const createdRev = await readEntityWithFallback('reviews', testRev.id, () => testRev, db);
  assert(createdRev?.comment === 'Instant feedback test', 'Read-After-Write: Created review read immediately');

  await deleteEntityFromD1('reviews', testRev.id, db);
  const deletedRev = await queryReviewsRelational({ id: testRev.id }, db);
  assert(deletedRev.length === 0, 'Read-After-Write: Deleted review absent from relational query');

  // --------------------------------------------------------------------------
  // SUITE 10: Performance Benchmarking (Step 13)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 10: Performance Benchmarking (100 iterations) ---');

  const legacyTimes: number[] = [];
  const relTimes: number[] = [];
  const shadowTimes: number[] = [];

  for (let i = 0; i < 100; i++) {
    // Legacy
    setRelationalReadMode('employees', 'LEGACY');
    const t0 = performance.now();
    await readCollectionWithFallback('employees', () => sampleEmployees, db);
    legacyTimes.push(performance.now() - t0);

    // Relational
    setRelationalReadMode('employees', 'RELATIONAL');
    const t1 = performance.now();
    await readCollectionWithFallback('employees', () => sampleEmployees, db);
    relTimes.push(performance.now() - t1);

    // Shadow
    setRelationalReadMode('employees', 'SHADOW');
    const t2 = performance.now();
    await readCollectionWithFallback('employees', () => sampleEmployees, db);
    shadowTimes.push(performance.now() - t2);
  }

  setRelationalReadMode('employees', 'RELATIONAL');

  legacyTimes.sort((a, b) => a - b);
  relTimes.sort((a, b) => a - b);
  shadowTimes.sort((a, b) => a - b);

  const p50 = (arr: number[]) => arr[Math.floor(arr.length * 0.5)].toFixed(3);
  const p95 = (arr: number[]) => arr[Math.floor(arr.length * 0.95)].toFixed(3);
  const p99 = (arr: number[]) => arr[Math.floor(arr.length * 0.99)].toFixed(3);

  console.log(`  [LOCAL BENCHMARK - SQLite in-memory]`);
  console.log(`  - Legacy Read:     p50=${p50(legacyTimes)}ms, p95=${p95(legacyTimes)}ms, p99=${p99(legacyTimes)}ms`);
  console.log(`  - Relational Read: p50=${p50(relTimes)}ms, p95=${p95(relTimes)}ms, p99=${p99(relTimes)}ms`);
  console.log(`  - Shadow Read:     p50=${p50(shadowTimes)}ms, p95=${p95(shadowTimes)}ms, p99=${p99(shadowTimes)}ms`);

  assert(parseFloat(p50(relTimes)) < 50, 'Relational read p50 latency is well within production threshold (<50ms)');

  // --------------------------------------------------------------------------
  // SUITE 11: Security & Static Integrity Scan (Step 12)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 11: Security & Static Integrity Scan ---');

  const d1StoragePath = path.resolve(process.cwd(), 'src/lib/d1Storage.ts');
  const d1Content = fs.readFileSync(d1StoragePath, 'utf-8');

  const forbiddenDrop = /DROP\s+TABLE\s+(?!IF\s+EXISTS\s+_test_)\w+/i.test(d1Content);
  const forbiddenTruncate = /TRUNCATE\s+TABLE/i.test(d1Content);
  const forbiddenDropCol = /ALTER\s+TABLE\s+\w+\s+DROP\s+COLUMN/i.test(d1Content);

  assert(!forbiddenDrop, 'Codebase contains ZERO DROP TABLE statements');
  assert(!forbiddenTruncate, 'Codebase contains ZERO TRUNCATE statements');
  assert(!forbiddenDropCol, 'Codebase contains ZERO DROP COLUMN statements');

  // --------------------------------------------------------------------------
  // SUITE 12: Rollback Procedure Verification
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 12: Rollback Procedure Verification ---');

  setRelationalReadMode('employees', 'SHADOW');
  assert(getRelationalReadMode('employees') === 'SHADOW', 'Rollback employees to SHADOW succeeds immediately');

  setRelationalReadMode('employeeDocuments', 'SHADOW');
  assert(getRelationalReadMode('employeeDocuments') === 'SHADOW', 'Rollback employeeDocuments to SHADOW succeeds immediately');

  setRelationalReadMode('reviews', 'SHADOW');
  assert(getRelationalReadMode('reviews') === 'SHADOW', 'Rollback reviews to SHADOW succeeds immediately');

  // Restore promoted state for Phase 5D
  setRelationalReadMode('employees', 'RELATIONAL');
  setRelationalReadMode('employeeDocuments', 'RELATIONAL');
  setRelationalReadMode('reviews', 'RELATIONAL');
  assert(getRelationalReadMode('employees') === 'RELATIONAL', 'Restored employees to RELATIONAL for Phase 5D');
  assert(getRelationalReadMode('employeeDocuments') === 'RELATIONAL', 'Restored employeeDocuments to RELATIONAL for Phase 5D');
  assert(getRelationalReadMode('reviews') === 'RELATIONAL', 'Restored reviews to RELATIONAL for Phase 5D');

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n============================================================');
  console.log(`PHASE 5D TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
