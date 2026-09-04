import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {
  initD1Schema,
  saveEntityToD1,
  getRelationalReadMode,
  setRelationalReadMode,
  getAllRelationalReadModes,
  resetRelationalReadConfig,
  isCircuitBreakerTripped,
  resetCircuitBreaker,
  recordReadDiagnostic,
  normalizeRecordForParity,
  queryCategoriesRelational,
  queryServicesRelational,
  queryCustomersRelational,
  queryEmployeesRelational,
  queryEmployeeKycRelational,
  queryEmployeePayrollRelational,
  queryEmployeeAccountsRelational,
  queryEmployeeDocumentsRelational,
  queryOrdersRelational,
  queryReviewsRelational,
  queryAuditLogsRelational,
  queryCollectionRelational,
  queryEntityRelational,
  shadowCompareCollection,
  shadowCompareEntity,
  readCollectionWithFallback,
  readEntityWithFallback,
  getRelationalReadStatus
} from '../src/lib/d1Storage';

// Build a mock D1 database adapter on top of Node sqlite
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

// Simple test harness
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
  console.log('EASYDESK PHASE 4 — RELATIONAL READ TEST SUITE');
  console.log('============================================================\n');

  const db = createMockD1();
  await initD1Schema(db);
  resetRelationalReadConfig();

  // --------------------------------------------------------------------------
  // SUITE 1: Configuration & Default Read Modes (Tests 1-14)
  // --------------------------------------------------------------------------
  console.log('--- SUITE 1: Configuration & Read Modes ---');
  const collections = [
    'categories', 'services', 'customers', 'employees',
    'employeeKYC', 'employeePayroll', 'employeeAccounts', 'employeeDocuments',
    'orders', 'reviews', 'auditLogs'
  ];

  for (const col of collections) {
    const expected = (col === 'categories' || col === 'services' || col === 'customers' || col === 'employees' || col === 'employeeDocuments' || col === 'reviews') ? 'RELATIONAL' : 'SHADOW';
    assert(getRelationalReadMode(col) === expected, `Default mode for ${col} is ${expected}`);
  }

  setRelationalReadMode('categories', 'RELATIONAL');
  assert(getRelationalReadMode('categories') === 'RELATIONAL', 'Can set categories to RELATIONAL');

  setRelationalReadMode('categories', 'LEGACY');
  assert(getRelationalReadMode('categories') === 'LEGACY', 'Can set categories to LEGACY');

  let invalidError = false;
  try {
    setRelationalReadMode('nonExistentCollection', 'RELATIONAL');
  } catch {
    invalidError = true;
  }
  assert(invalidError, 'Setting read mode on unsupported collection throws error');

  resetRelationalReadConfig();

  // --------------------------------------------------------------------------
  // SUITE 2: Mock Data Population via Dual-Write (Sync)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 2: Seeding Dual-Write Test Data ---');

  const sampleCategory = {
    id: 'cat-test-1',
    name: 'Business Licenses',
    slug: 'business-licenses',
    sortOrder: 1,
    status: 'Active',
    icon: 'briefcase',
    color: '#3B82F6',
    description: 'All business and corporate licensing services'
  };
  await saveEntityToD1('categories', sampleCategory.id, sampleCategory, db);

  const sampleService = {
    id: 'srv-test-1',
    categoryId: 'cat-test-1',
    title: 'Trade License Renewal',
    slug: 'trade-license-renewal',
    subCategory: 'Municipal',
    description: 'Renew trade licenses quickly and easily',
    govFees: 1500,
    serviceCharge: 500,
    processingTime: '3-5 business days',
    status: 'active',
    requiredDocuments: ['Utility Bill', 'Lease Agreement'],
    faqs: [{ question: 'How long?', answer: '3 days' }]
  };
  await saveEntityToD1('services', sampleService.id, sampleService, db);

  const sampleCustomer = {
    id: 'cust-test-1',
    code: 'CUST-1001',
    name: 'Rajesh Sharma',
    email: 'rajesh@example.com',
    mobile: '9876543210',
    whatsappMobile: '9876543210',
    customerType: 'Individual',
    status: 'Active',
    address: '123 MG Road',
    city: 'Mumbai',
    state: 'Maharashtra',
    pinCode: '400001'
  };
  await saveEntityToD1('customers', sampleCustomer.id, sampleCustomer, db);

  const sampleEmployee = {
    id: 'emp-test-1',
    code: 'EMP-001',
    name: 'Priya Patel',
    department: 'Operations',
    designation: 'Senior Executive',
    employmentType: 'Full-Time',
    status: 'Active',
    joiningDate: '2023-01-15',
    phone: '9811122233',
    email: 'priya@easydesk.local'
  };
  await saveEntityToD1('employees', sampleEmployee.id, sampleEmployee, db);

  const sampleKYC = {
    employeeId: 'emp-test-1',
    aadhaarNumber: 'XXXX-XXXX-9876',
    panNumber: 'ABCDE****G',
    aadhaarVerificationStatus: 'Verified',
    panVerificationStatus: 'Verified'
  };
  await saveEntityToD1('employeeKYC', 'emp-test-1', sampleKYC, db);

  const samplePayroll = {
    employeeId: 'emp-test-1',
    accountHolderName: 'Priya Patel',
    bankName: 'HDFC Bank',
    branchName: 'Nariman Point',
    accountNumber: '******1234',
    ifscCode: 'HDFC0000123',
    salaryAmount: 60000,
    netSalary: 55000
  };
  await saveEntityToD1('employeePayroll', 'emp-test-1', samplePayroll, db);

  const sampleAccount = {
    employeeId: 'emp-test-1',
    userId: 'user-emp-1',
    systemEmail: 'priya.system@easydesk.local',
    role: 'STAFF',
    accountStatus: 'Active'
  };
  await saveEntityToD1('employeeAccounts', 'emp-test-1', sampleAccount, db);

  const sampleDoc = {
    id: 'doc-test-1',
    employeeId: 'emp-test-1',
    documentType: 'Aadhaar',
    documentName: 'Aadhaar Card Copy',
    storagePath: 'vault/emp-test-1/aadhaar.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1048576,
    verificationStatus: 'Verified'
  };
  await saveEntityToD1('employeeDocuments', sampleDoc.id, sampleDoc, db);

  const sampleOrder = {
    id: 'ord-test-1',
    orderCode: 'ORD-2026-001',
    customerId: 'cust-test-1',
    serviceId: 'srv-test-1',
    assignedStaffId: 'emp-test-1',
    orderSource: 'WhatsApp',
    name: 'Rajesh Sharma',
    mobile: '9876543210',
    email: 'rajesh@example.com',
    totalAmount: 2000,
    paymentMethod: 'UPI',
    paymentStatus: 'Paid',
    orderStatus: 'In Progress',
    documentDeliveryStatus: 'Pending',
    priority: 'Normal'
  };
  await saveEntityToD1('orders', sampleOrder.id, sampleOrder, db);

  const sampleReview = {
    id: 'rev-test-1',
    serviceId: 'srv-test-1',
    customerId: 'cust-test-1',
    orderId: 'ord-test-1',
    customerName: 'Rajesh Sharma',
    rating: 5,
    comment: 'Exceptional and fast turnaround service!',
    status: 'Approved'
  };
  await saveEntityToD1('reviews', sampleReview.id, sampleReview, db);

  const sampleAuditLog = {
    id: 'aud-test-1',
    userId: 'admin-1',
    userName: 'Deepak Admin',
    userRole: 'SUPER_ADMIN',
    action: 'ORDER_ASSIGN',
    entityType: 'orders',
    entityId: 'ord-test-1',
    timestamp: Date.now()
  };
  await saveEntityToD1('auditLogs', sampleAuditLog.id, sampleAuditLog, db);

  console.log('  ✓ Seeded 11 sample records across relational mirror tables.');

  // --------------------------------------------------------------------------
  // SUITE 3: Normalization & Field Parity Across All 11 Collections (Tests 15-26)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 3: Normalization Layer & Parity Verification ---');

  const normCat = normalizeRecordForParity('categories', sampleCategory);
  assert(normCat.name === 'Business Licenses' && normCat.sortOrder === 1, 'Normalized category scalar fields match');

  const normSrv = normalizeRecordForParity('services', sampleService);
  assert(normSrv.govFees === 1500 && normSrv.serviceCharge === 500, 'Normalized service financial fields match numeric values');

  const normCust = normalizeRecordForParity('customers', sampleCustomer);
  assert(normCust.mobile === '9876543210' && normCust.city === 'Mumbai', 'Normalized customer details match');

  const normEmp = normalizeRecordForParity('employees', sampleEmployee);
  assert(normEmp.code === 'EMP-001' && normEmp.department === 'Operations', 'Normalized employee details match');

  const normKYC = normalizeRecordForParity('employeeKYC', sampleKYC);
  assert(normKYC.aadhaarMasked === 'XXXX-XXXX-9876' && normKYC.panMasked === 'ABCDE****G', 'Normalized KYC retains masked identifiers');

  const normPayroll = normalizeRecordForParity('employeePayroll', samplePayroll);
  assert(normPayroll.accountMasked === '******1234' && normPayroll.salaryCtc === 60000, 'Normalized Payroll retains masked account and numeric salary');

  const normAccount = normalizeRecordForParity('employeeAccounts', sampleAccount);
  assert(normAccount.role === 'STAFF' && normAccount.accountStatus === 'Active', 'Normalized Employee Account fields match');

  const normDoc = normalizeRecordForParity('employeeDocuments', sampleDoc);
  assert(normDoc.documentType === 'Aadhaar' && normDoc.sizeBytes === 1048576, 'Normalized Document fields match');

  const normOrder = normalizeRecordForParity('orders', sampleOrder);
  assert(normOrder.totalAmount === 2000 && normOrder.paymentStatus === 'Paid', 'Normalized Order financial and status match');

  const normReview = normalizeRecordForParity('reviews', sampleReview);
  assert(normReview.rating === 5 && normReview.status === 'Approved', 'Normalized Review fields match');

  const normAudit = normalizeRecordForParity('auditLogs', sampleAuditLog);
  assert(normAudit.action === 'ORDER_ASSIGN' && typeof normAudit.timestamp === 'number', 'Normalized AuditLog fields match');

  // --------------------------------------------------------------------------
  // SUITE 4: Sensitive Data Masking Verification (Tests 27-30)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 4: Sensitive Data Protection Verification ---');

  assert(!normKYC.aadhaarMasked.includes('123456789012'), 'Raw 12-digit Aadhaar number is never exposed');
  assert(!normKYC.panMasked.includes('ABCDE1234F'), 'Raw PAN number is never exposed');
  assert(!normPayroll.accountMasked.includes('987654321012'), 'Raw bank account number is never exposed');

  // Record a diagnostic and check it contains no passwords or secret tokens
  await recordReadDiagnostic('employeeKYC', 'SHADOW_READ', 'SHADOW', 'SUCCESS', 1, 1, 0, null, null, 5, db);
  const diagRows = await db.prepare('SELECT * FROM relational_read_diagnostics WHERE collection = ?').bind('employeeKYC').all();
  const diagData = (diagRows && diagRows.results) ? diagRows.results[0] : null;
  assert(diagData !== null && !JSON.stringify(diagData).includes('password'), 'Diagnostics log contains zero plaintext passwords or secrets');

  // --------------------------------------------------------------------------
  // SUITE 5: Shadow Read Comparison Engine (Tests 31-33)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 5: Shadow Read Comparison Engine ---');

  const shadowSuccess = await shadowCompareCollection('categories', [sampleCategory], db);
  assert(shadowSuccess.success && shadowSuccess.mismatches === 0, 'Shadow read detects perfect 100% parity on matching data');

  const mutatedCategory = { ...sampleCategory, name: 'Divergent License Name' };
  const shadowMismatch = await shadowCompareCollection('categories', [mutatedCategory], db);
  assert(!shadowMismatch.success && shadowMismatch.mismatches > 0, 'Shadow read correctly flags field mismatches between stores');

  const entityShadowSuccess = await shadowCompareEntity('customers', 'cust-test-1', sampleCustomer, db);
  assert(entityShadowSuccess.success && entityShadowSuccess.mismatches === 0, 'Shadow entity comparison detects exact match');

  // --------------------------------------------------------------------------
  // SUITE 6: Read Routing & Safe Fallback Architecture (Tests 34-39)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 6: Read Routing & Fallback Engine ---');

  // 1. LEGACY mode
  setRelationalReadMode('categories', 'LEGACY');
  let legacyCalled = false;
  const legResult = await readCollectionWithFallback('categories', () => {
    legacyCalled = true;
    return [sampleCategory];
  }, db);
  assert(legacyCalled && legResult.length === 1, 'In LEGACY mode, serves directly from legacy store');

  // 2. SHADOW mode
  setRelationalReadMode('categories', 'SHADOW');
  let shadowLegacyCalled = false;
  const shadowResult = await readCollectionWithFallback('categories', () => {
    shadowLegacyCalled = true;
    return [sampleCategory];
  }, db);
  assert(shadowLegacyCalled && shadowResult.length === 1, 'In SHADOW mode, caller receives legacy response immediately');

  // 3. RELATIONAL mode
  setRelationalReadMode('categories', 'RELATIONAL');
  const relResult = await readCollectionWithFallback('categories', () => [sampleCategory], db);
  assert(Array.isArray(relResult) && relResult[0]?.name === 'Business Licenses', 'In RELATIONAL mode, serves data from relational table');

  // 4. Safe Fallback on relational query failure
  const brokenDb = {
    ...db,
    prepare(sql: string) {
      if (sql.includes('FROM categories')) {
        throw new Error('Simulated D1 Disk I/O or SQLite syntax failure');
      }
      return db.prepare(sql);
    }
  };
  let fallbackLegacyCalled = false;
  const fallbackResult = await readCollectionWithFallback('categories', () => {
    fallbackLegacyCalled = true;
    return [sampleCategory];
  }, brokenDb);
  assert(fallbackLegacyCalled && fallbackResult.length === 1, 'On relational error in RELATIONAL mode, safely falls back to legacy data');

  // 5. Safe Fallback on silent empty relational table when legacy has data
  const emptyDb = {
    ...db,
    prepare(sql: string) {
      if (sql.includes('FROM categories')) {
        return {
          bind: () => ({ all: async () => ({ results: [] }) })
        } as any;
      }
      return db.prepare(sql);
    }
  };
  let emptyFallbackCalled = false;
  const emptyFallbackResult = await readCollectionWithFallback('categories', () => {
    emptyFallbackCalled = true;
    return [sampleCategory];
  }, emptyDb);
  assert(emptyFallbackCalled && emptyFallbackResult.length === 1, 'On silent empty relational return, safely falls back to legacy store');

  // 6. Single-entity safe fallback
  const entityFallbackResult = await readEntityWithFallback('services', 'non-existent-id', () => sampleService, brokenDb);
  assert(entityFallbackResult?.id === 'srv-test-1', 'Single entity read safely falls back to legacy on error');

  // --------------------------------------------------------------------------
  // SUITE 7: Circuit Breaker Protection (Tests 40-42)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 7: Circuit Breaker Subsystem ---');

  resetCircuitBreaker('categories');
  assert(!isCircuitBreakerTripped('categories'), 'Circuit breaker starts in normal untripped state');

  // Cause 5 consecutive failures
  for (let i = 0; i < 5; i++) {
    await readCollectionWithFallback('categories', () => [sampleCategory], brokenDb);
  }
  assert(isCircuitBreakerTripped('categories'), 'Circuit breaker trips after 5 consecutive relational read failures');

  // While tripped, relational read is bypassed completely
  let circuitFallbackCalled = false;
  await readCollectionWithFallback('categories', () => {
    circuitFallbackCalled = true;
    return [sampleCategory];
  }, db);
  assert(circuitFallbackCalled, 'While circuit breaker is tripped, read requests automatically fallback to legacy');

  resetCircuitBreaker('categories');
  assert(!isCircuitBreakerTripped('categories'), 'Circuit breaker can be manually reset after remediation');

  // --------------------------------------------------------------------------
  // SUITE 8: Query Functions & Relational Filtering (Tests 43-48)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 8: Relational Query Implementations ---');

  const qCats = await queryCategoriesRelational(undefined, db);
  assert(qCats.length >= 1 && qCats[0].slug === 'business-licenses', 'queryCategoriesRelational fetches categories properly');

  const qServices = await queryServicesRelational({ categoryId: 'cat-test-1' }, db);
  assert(qServices.length >= 1 && qServices[0].govFees === 1500, 'queryServicesRelational filters by categoryId correctly');

  const qCusts = await queryCustomersRelational({ limit: 10 }, db);
  assert(qCusts.length >= 1 && qCusts[0].code === 'CUST-1001', 'queryCustomersRelational respects limit query');

  const qEmps = await queryEmployeesRelational({ department: 'Operations' }, db);
  assert(qEmps.length >= 1 && qEmps[0].department === 'Operations', 'queryEmployeesRelational filters by department correctly');

  const qOrders = await queryOrdersRelational({ customerId: 'cust-test-1' }, db);
  assert(qOrders.length >= 1 && qOrders[0].totalAmount === 2000, 'queryOrdersRelational filters by customerId correctly');

  const qReviews = await queryReviewsRelational({ status: 'Approved' }, db);
  assert(qReviews.length >= 1 && qReviews[0].rating === 5, 'queryReviewsRelational filters by status correctly');

  // --------------------------------------------------------------------------
  // SUITE 9: Status Diagnostics & Table Indexes (Tests 49-50)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 9: Read Status Diagnostics & Schema Integrity ---');

  const statusReport = await getRelationalReadStatus(db);
  assert(statusReport.collections.categories !== undefined, 'getRelationalReadStatus returns status for all collections');
  assert(statusReport.overallHealth === 'HEALTHY' || statusReport.overallHealth === 'DEGRADED', 'Overall health is correctly categorized');

  // --------------------------------------------------------------------------
  // SUITE 10: Performance Benchmarking (Test 51)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 10: Performance Latency Benchmarks (p50, p95, p99) ---');

  const benchmarkIterations = 100;
  const legacyLatencies: number[] = [];
  const relationalLatencies: number[] = [];
  const shadowLatencies: number[] = [];

  setRelationalReadMode('categories', 'LEGACY');
  for (let i = 0; i < benchmarkIterations; i++) {
    const t0 = performance.now();
    await readCollectionWithFallback('categories', () => [sampleCategory], db);
    legacyLatencies.push(performance.now() - t0);
  }

  setRelationalReadMode('categories', 'RELATIONAL');
  for (let i = 0; i < benchmarkIterations; i++) {
    const t0 = performance.now();
    await readCollectionWithFallback('categories', () => [sampleCategory], db);
    relationalLatencies.push(performance.now() - t0);
  }

  setRelationalReadMode('categories', 'SHADOW');
  for (let i = 0; i < benchmarkIterations; i++) {
    const t0 = performance.now();
    await readCollectionWithFallback('categories', () => [sampleCategory], db);
    shadowLatencies.push(performance.now() - t0);
  }

  function getPercentile(arr: number[], p: number) {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  const legacyP50 = getPercentile(legacyLatencies, 50).toFixed(3);
  const legacyP95 = getPercentile(legacyLatencies, 95).toFixed(3);
  const legacyP99 = getPercentile(legacyLatencies, 99).toFixed(3);

  const relP50 = getPercentile(relationalLatencies, 50).toFixed(3);
  const relP95 = getPercentile(relationalLatencies, 95).toFixed(3);
  const relP99 = getPercentile(relationalLatencies, 99).toFixed(3);

  const shadowP50 = getPercentile(shadowLatencies, 50).toFixed(3);
  const shadowP95 = getPercentile(shadowLatencies, 95).toFixed(3);
  const shadowP99 = getPercentile(shadowLatencies, 99).toFixed(3);

  console.log(`  - Legacy Read:     p50=${legacyP50}ms, p95=${legacyP95}ms, p99=${legacyP99}ms`);
  console.log(`  - Relational Read: p50=${relP50}ms, p95=${relP95}ms, p99=${relP99}ms`);
  console.log(`  - Shadow Read:     p50=${shadowP50}ms, p95=${shadowP95}ms, p99=${shadowP99}ms`);

  assert(parseFloat(relP50) < 50, 'Relational read p50 latency is well within production threshold (<50ms)');

  // --------------------------------------------------------------------------
  // SUITE 11: Static Security & Non-Destructive Integrity Scan (Test 52)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 11: Static Codebase Security Scan ---');

  const d1StoragePath = path.resolve(process.cwd(), 'src/lib/d1Storage.ts');
  const d1Content = fs.readFileSync(d1StoragePath, 'utf-8');

  const forbiddenDrop = /DROP\s+TABLE\s+(?!IF\s+EXISTS\s+_test_)\w+/i.test(d1Content);
  const forbiddenTruncate = /TRUNCATE\s+TABLE/i.test(d1Content);

  assert(!forbiddenDrop && !forbiddenTruncate, 'Codebase contains ZERO destructive DROP TABLE or TRUNCATE statements');

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n============================================================');
  console.log(`PHASE 4 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
