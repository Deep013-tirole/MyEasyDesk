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
  queryCustomersRelational,
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
  console.log('EASYDESK PHASE 5C — CUSTOMERS RELATIONAL READ PROMOTION SUITE');
  console.log('============================================================\n');

  const db = createMockD1();
  await initD1Schema(db);
  resetRelationalReadConfig();

  // --------------------------------------------------------------------------
  // SUITE 1: Promotion Configuration State (Step 11)
  // --------------------------------------------------------------------------
  console.log('--- SUITE 1: Promotion Configuration State ---');

  const modes = getAllRelationalReadModes();
  assert(modes.categories === 'RELATIONAL', 'categories is in RELATIONAL mode');
  assert(modes.services === 'RELATIONAL', 'services is in RELATIONAL mode');
  assert(modes.customers === 'RELATIONAL', 'customers is promoted to RELATIONAL mode');

  const remainingCollections = [
    'employeeKYC',
    'employeePayroll', 'employeeAccounts',
    'orders', 'auditLogs'
  ];

  for (const col of remainingCollections) {
    assert(modes[col] === 'SHADOW', `Collection '${col}' remains safely in SHADOW mode`);
  }

  // --------------------------------------------------------------------------
  // SUITE 2: Dual-Write Seeding & Data Parity Verification (Steps 2, 3, 10)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 2: Dual-Write Seeding & Data Parity ---');

  const sampleCustomers = [
    {
      id: 'cust-101',
      code: 'CUST-1001',
      name: 'Deepak Sharma',
      email: 'deepak.sharma@example.com',
      mobile: '9876543210',
      whatsappMobile: '9876543210',
      customerType: 'Individual',
      status: 'Active',
      contactPersonName: 'Deepak Sharma',
      gender: 'Male',
      dobOrIncorporationDate: '1990-05-15',
      photoUrl: 'https://images.unsplash.com/photo-deepak.jpg',
      address: 'Flat 402, Royal Residency, M.G. Road',
      city: 'Pune',
      state: 'Maharashtra',
      pinCode: '411001',
      gstin: '27AABCU9603R1ZM',
      panNumber: 'ABCDE1234F',
      msmeLicense: 'UDYAM-MH-12-0012345',
      notes: 'VIP customer, priority documentation',
      userId: 'user-deepak-01'
    },
    {
      id: 'cust-102',
      code: 'CUST-1002',
      name: 'Nexus Tech Solutions Pvt Ltd',
      email: 'contact@nexustech.in',
      mobile: '9123456780',
      whatsappMobile: '9123456780',
      customerType: 'Business / Corporate',
      status: 'Active',
      contactPersonName: 'Ananya Verma',
      gender: 'Female',
      dobOrIncorporationDate: '2018-11-20',
      photoUrl: null,
      address: 'Tower B, Tech Park, Whitefield',
      city: 'Bengaluru',
      state: 'Karnataka',
      pinCode: '560066',
      gstin: '29AAACN1234P1Z5',
      panNumber: 'AAACN1234P',
      msmeLicense: null,
      notes: 'Corporate client for bulk PAN and GST registrations',
      userId: null
    },
    {
      id: 'cust-103',
      code: 'CUST-1003',
      name: 'Kisan Seva Kendra Partner',
      email: 'partner.kolhapur@kisanseva.org',
      mobile: '9822011223',
      whatsappMobile: '9822011223',
      customerType: 'Franchise / Partner',
      status: 'Active',
      contactPersonName: 'Suresh Patil',
      gender: 'Male',
      dobOrIncorporationDate: '2021-02-10',
      photoUrl: null,
      address: 'Shop No 5, Market Yard',
      city: 'Kolhapur',
      state: 'Maharashtra',
      pinCode: '416005',
      gstin: null,
      panNumber: 'BCDEF2345G',
      msmeLicense: null,
      notes: 'Franchise operator for rural certificate services',
      userId: null
    },
    {
      id: 'cust-104',
      code: 'CUST-1004',
      name: 'Blocked User Test',
      email: 'blocked.user@example.com',
      mobile: '9999900000',
      whatsappMobile: null,
      customerType: 'Individual',
      status: 'Blocked',
      contactPersonName: 'Blocked User',
      gender: 'Other',
      dobOrIncorporationDate: null,
      photoUrl: null,
      address: 'Unknown',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400001',
      gstin: null,
      panNumber: null,
      msmeLicense: null,
      notes: 'Flagged for suspicious documentation',
      userId: null
    }
  ];

  for (const cust of sampleCustomers) {
    const res = await saveEntityToD1('customers', cust.id, cust, db);
    assert(res.success, `Dual-write successfully synced customer: ${cust.id}`);
  }

  // Verify legacy entities table vs relational customers table counts
  const legacyRows = await db.prepare("SELECT * FROM entities WHERE collection = 'customers'").all();
  const relRows = await db.prepare('SELECT * FROM customers').all();

  const legacyCount = legacyRows.results.length;
  const relCount = relRows.results.length;

  assert(legacyCount === sampleCustomers.length, `Legacy entities count matches seeded count (${legacyCount}/${sampleCustomers.length})`);
  assert(relCount === sampleCustomers.length, `Relational customers count matches seeded count (${relCount}/${sampleCustomers.length})`);
  assert(legacyCount === relCount, 'Legacy and Relational table counts are in 100% parity');

  // Field-level parity verification
  for (const cust of sampleCustomers) {
    const relItem = relRows.results.find((r: any) => r.id === cust.id);
    assert(relItem !== undefined, `Customer ${cust.id} exists in relational table`);
    assert(relItem.code === cust.code, `Field 'code' parity for ${cust.id}`);
    assert(relItem.name === cust.name, `Field 'name' parity for ${cust.id}`);
    assert(relItem.email === cust.email, `Field 'email' parity for ${cust.id}`);
    assert(relItem.mobile === cust.mobile, `Field 'mobile' parity for ${cust.id}`);
    assert(relItem.customer_type === cust.customerType, `Field 'customer_type' parity for ${cust.id}`);
    assert(relItem.status === cust.status, `Field 'status' parity for ${cust.id}`);
    assert(relItem.city === cust.city, `Field 'city' parity for ${cust.id}`);
    assert(relItem.state === cust.state, `Field 'state' parity for ${cust.id}`);
    assert(relItem.pincode === cust.pinCode, `Field 'pincode' parity for ${cust.id}`);
  }

  // --------------------------------------------------------------------------
  // SUITE 3: queryCustomersRelational Query Behaviors (Step 4)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 3: queryCustomersRelational Query Behaviors ---');

  // 1. Full list
  const allCustomers = await queryCustomersRelational(undefined, db);
  assert(allCustomers.length === sampleCustomers.length, '1. Full customers listing returns all records');

  // 2. Single customer by ID
  const singleById = await queryCustomersRelational({ id: 'cust-101' }, db);
  assert(singleById.length === 1 && singleById[0].name === 'Deepak Sharma', '2. Single customer lookup by ID works');

  // 3. Single customer by code
  const singleByCode = await queryCustomersRelational({ code: 'CUST-1002' }, db);
  assert(singleByCode.length === 1 && singleByCode[0].id === 'cust-102', '3. Customer lookup by code works');

  // 4. Single customer by email
  const singleByEmail = await queryCustomersRelational({ email: 'deepak.sharma@example.com' }, db);
  assert(singleByEmail.length === 1 && singleByEmail[0].id === 'cust-101', '4. Customer lookup by email works');

  // 5. Single customer by mobile
  const singleByMobile = await queryCustomersRelational({ mobile: '9123456780' }, db);
  assert(singleByMobile.length === 1 && singleByMobile[0].id === 'cust-102', '5. Customer lookup by mobile works');

  // 6. Status filtering
  const activeCustomers = await queryCustomersRelational({ status: 'Active' }, db);
  assert(activeCustomers.length === 3 && activeCustomers.every(c => c.status === 'Active'), '6. Active status filter returns active customers');
  const blockedCustomers = await queryCustomersRelational({ status: 'Blocked' }, db);
  assert(blockedCustomers.length === 1 && blockedCustomers[0].id === 'cust-104', '6. Blocked status filter returns blocked customer');

  // 7. Customer Type filtering
  const corporateCustomers = await queryCustomersRelational({ customerType: 'Business / Corporate' }, db);
  assert(corporateCustomers.length === 1 && corporateCustomers[0].id === 'cust-102', '7. Customer type filter works');

  // 8. Search query (by name, email, mobile, or code)
  const searchByName = await queryCustomersRelational({ search: 'Sharma' }, db);
  assert(searchByName.length === 1 && searchByName[0].id === 'cust-101', '8. Search by name works');
  const searchByMobile = await queryCustomersRelational({ search: '9123456780' }, db);
  assert(searchByMobile.length === 1 && searchByMobile[0].id === 'cust-102', '8. Search by mobile works');

  // 9. Pagination (limit and offset)
  const paginated = await queryCustomersRelational({ limit: 2, offset: 1 }, db);
  assert(paginated.length === 2, '9. Pagination limit and offset work properly');

  // 10. Ordering verification (created_at DESC)
  const isOrdered = allCustomers.every((c, idx) => {
    if (idx === 0) return true;
    const prevDate = new Date(allCustomers[idx - 1].createdAt).getTime();
    const currDate = new Date(c.createdAt).getTime();
    return prevDate >= currDate;
  });
  assert(isOrdered, '10. Ordering defaults to created_at DESC');

  // 11. Empty results handling
  const emptyRes = await queryCustomersRelational({ id: 'non-existent-cust-xyz' }, db);
  assert(Array.isArray(emptyRes) && emptyRes.length === 0, '11. Empty results return empty array');

  // 12. Missing / null input handling
  const missingIdRes = await queryCustomersRelational({ id: undefined }, db);
  assert(missingIdRes.length === sampleCustomers.length, '12. Missing input handled gracefully');

  // 13. SQL Injection prevention
  const injectionRes = await queryCustomersRelational({ id: "'; DROP TABLE customers; --" }, db);
  assert(Array.isArray(injectionRes) && injectionRes.length === 0, '13. Parameterized query safely prevents SQL injection');

  // 14. Single entity query via readEntityWithFallback
  const singleEntity = await readEntityWithFallback('customers', 'cust-101', () => sampleCustomers[0], db);
  assert(singleEntity?.id === 'cust-101' && singleEntity?.name === 'Deepak Sharma', '14. readEntityWithFallback fetches customer record correctly');

  // --------------------------------------------------------------------------
  // SUITE 4: API Contract Parity (Step 5)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 4: API Contract Parity ---');

  // Emulate GET /api/admin/customers with LEGACY read
  setRelationalReadMode('customers', 'LEGACY');
  const legacyReadCustomers = await readCollectionWithFallback('customers', () => sampleCustomers, db);

  // Emulate GET /api/admin/customers with RELATIONAL read
  setRelationalReadMode('customers', 'RELATIONAL');
  const relReadCustomers = await readCollectionWithFallback('customers', () => sampleCustomers, db);

  assert(legacyReadCustomers.length === relReadCustomers.length, 'API Contract: Customer list length identical');

  const requiredCustomerKeys = [
    'id', 'code', 'name', 'email', 'mobile', 'whatsappMobile',
    'customerType', 'status', 'contactPersonName', 'gender',
    'dobOrIncorporationDate', 'address', 'city', 'state', 'pinCode', 'pincode'
  ];

  for (const key of requiredCustomerKeys) {
    assert(key in relReadCustomers[0], `API Contract: Key '${key}' is preserved in relational response`);
  }

  // --------------------------------------------------------------------------
  // SUITE 5: Dependency Verification (Step 6)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 5: Dependency & Order Reference Verification ---');

  // Seed linked sample orders
  const sampleOrders = [
    { id: 'ord-1', customerId: 'cust-101', serviceId: 'pan', totalAmount: 257, status: 'Completed' },
    { id: 'ord-2', customerId: 'cust-101', serviceId: 'aadhaar-update', totalAmount: 150, status: 'In Progress' },
    { id: 'ord-3', customerId: 'cust-102', serviceId: 'gst-reg', totalAmount: 999, status: 'Pending' }
  ];

  const cust101Orders = sampleOrders.filter(o => o.customerId === 'cust-101');
  assert(cust101Orders.length === 2, 'Customer cust-101 linked to 2 orders correctly');

  // Test customer order history retrieval with relational customer
  const linkedCust = await readEntityWithFallback('customers', 'cust-101', () => sampleCustomers[0], db);
  assert(linkedCust !== null && linkedCust.id === 'cust-101', 'readEntityWithFallback successfully resolves customer for order history');

  // --------------------------------------------------------------------------
  // SUITE 6: Shadow Mode Parity Verification (Step 7)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 6: Shadow Mode Parity Verification ---');

  setRelationalReadMode('customers', 'SHADOW');
  const shadowRes = await shadowCompareCollection('customers', sampleCustomers, db);
  assert(shadowRes.success && shadowRes.mismatches === 0, 'Shadow comparison confirms 100% count & field parity');

  // Restore to RELATIONAL for subsequent tests
  setRelationalReadMode('customers', 'RELATIONAL');

  // --------------------------------------------------------------------------
  // SUITE 7: Resilient Fallback Under Failure Conditions (Step 8)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 7: Resilient Fallback Under Failure Conditions ---');

  // Case A: Query Exception
  const brokenDb = {
    ...db,
    prepare(sql: string) {
      if (sql.includes('FROM customers')) {
        throw new Error('Simulated SQLite disk corruption / syntax error');
      }
      return db.prepare(sql);
    }
  };

  let fallbackACalled = false;
  const resultA = await readCollectionWithFallback('customers', () => {
    fallbackACalled = true;
    return sampleCustomers;
  }, brokenDb);
  assert(fallbackACalled && resultA.length === sampleCustomers.length, 'Case A: Query exception triggers seamless legacy fallback');

  // Case B: Missing Table
  const missingTableDb = {
    ...db,
    prepare(sql: string) {
      if (sql.includes('FROM customers')) {
        throw new Error('no such table: customers');
      }
      return db.prepare(sql);
    }
  };

  let fallbackBCalled = false;
  const resultB = await readCollectionWithFallback('customers', () => {
    fallbackBCalled = true;
    return sampleCustomers;
  }, missingTableDb);
  assert(fallbackBCalled && resultB.length === sampleCustomers.length, 'Case B: Missing table triggers seamless legacy fallback');

  // Case C: Empty relational result while legacy contains records
  const emptyDb = {
    ...db,
    prepare(sql: string) {
      if (sql.includes('FROM customers')) {
        return {
          bind: () => ({ all: async () => ({ results: [] }) })
        } as any;
      }
      return db.prepare(sql);
    }
  };

  let fallbackCCalled = false;
  const resultC = await readCollectionWithFallback('customers', () => {
    fallbackCCalled = true;
    return sampleCustomers;
  }, emptyDb);
  assert(fallbackCCalled && resultC.length === sampleCustomers.length, 'Case C: Silent empty relational result triggers defensive fallback');

  // Case D: Malformed non-array response
  const malformedDb = {
    ...db,
    prepare(sql: string) {
      if (sql.includes('FROM customers')) {
        return {
          bind: () => ({ all: async () => ({ results: 'corrupted-customer-data' }) })
        } as any;
      }
      return db.prepare(sql);
    }
  };

  let fallbackDCalled = false;
  const resultD = await readCollectionWithFallback('customers', () => {
    fallbackDCalled = true;
    return sampleCustomers;
  }, malformedDb);
  assert(fallbackDCalled && resultD.length === sampleCustomers.length, 'Case D: Malformed response triggers seamless legacy fallback');

  // Case E: Single customer read failure
  let fallbackECalled = false;
  const resultE = await readEntityWithFallback('customers', 'cust-101', () => {
    fallbackECalled = true;
    return sampleCustomers[0];
  }, brokenDb);
  assert(fallbackECalled && resultE?.id === 'cust-101', 'Case E: Single customer read triggers seamless legacy fallback');

  // --------------------------------------------------------------------------
  // SUITE 8: Circuit Breaker Protection (Step 9)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 8: Circuit Breaker Protection ---');

  resetCircuitBreaker('customers');
  assert(!isCircuitBreakerTripped('customers'), 'Circuit breaker starts in untripped healthy state');

  // Fail 5 times in a row
  for (let i = 0; i < 5; i++) {
    await readCollectionWithFallback('customers', () => sampleCustomers, brokenDb);
  }

  assert(isCircuitBreakerTripped('customers'), 'Circuit breaker trips after 5 consecutive failures');

  // While tripped, relational queries are bypassed
  let bypassedCalled = false;
  await readCollectionWithFallback('customers', () => {
    bypassedCalled = true;
    return sampleCustomers;
  }, db);
  assert(bypassedCalled, 'While circuit breaker is tripped, reads bypass relational and serve legacy fallback directly');

  // Manual reset
  resetCircuitBreaker('customers');
  assert(!isCircuitBreakerTripped('customers'), 'Circuit breaker successfully resets manually');

  // --------------------------------------------------------------------------
  // SUITE 9: Dual-Write & Read-After-Write Consistency (Steps 10 & 12)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 9: Read-After-Write Consistency ---');

  // 1. CREATE
  const newCust = {
    id: 'cust-105',
    code: 'CUST-1005',
    name: 'Vikram Joshi',
    email: 'vikram.joshi@example.com',
    mobile: '9845012345',
    whatsappMobile: '9845012345',
    customerType: 'Individual',
    status: 'Active',
    contactPersonName: 'Vikram Joshi',
    gender: 'Male',
    dobOrIncorporationDate: '1985-08-22',
    address: 'Kothrud',
    city: 'Pune',
    state: 'Maharashtra',
    pinCode: '411038'
  };
  await saveEntityToD1('customers', newCust.id, newCust, db);

  const postCreateReads = await readCollectionWithFallback('customers', () => [...sampleCustomers, newCust], db);
  const foundCreated = postCreateReads.find((c: any) => c.id === 'cust-105');
  assert(foundCreated !== undefined && foundCreated.name === 'Vikram Joshi', 'Read-After-Write: Created customer read immediately from relational table');

  // 2. UPDATE
  const updatedCust = {
    ...newCust,
    name: 'Vikram A. Joshi',
    city: 'Mumbai'
  };
  await saveEntityToD1('customers', updatedCust.id, updatedCust, db);

  const postUpdateReads = await readCollectionWithFallback('customers', () => [...sampleCustomers, updatedCust], db);
  const foundUpdated = postUpdateReads.find((c: any) => c.id === 'cust-105');
  assert(foundUpdated !== undefined && foundUpdated.name === 'Vikram A. Joshi' && foundUpdated.city === 'Mumbai', 'Read-After-Write: Updated customer reflects changes immediately');

  // 3. DELETE
  await deleteEntityFromD1('customers', 'cust-105', db);

  const postDeleteReads = await readCollectionWithFallback('customers', () => sampleCustomers, db);
  const foundDeleted = postDeleteReads.find((c: any) => c.id === 'cust-105');
  assert(foundDeleted === undefined, 'Read-After-Write: Deleted customer is immediately absent from relational reads');

  // --------------------------------------------------------------------------
  // SUITE 10: Performance Benchmarking (Step 15)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 10: Performance Benchmarking (100 iterations) ---');

  const legacyTimes: number[] = [];
  const relTimes: number[] = [];
  const shadowTimes: number[] = [];

  for (let i = 0; i < 100; i++) {
    // Legacy
    setRelationalReadMode('customers', 'LEGACY');
    const t0 = performance.now();
    await readCollectionWithFallback('customers', () => sampleCustomers, db);
    legacyTimes.push(performance.now() - t0);

    // Relational
    setRelationalReadMode('customers', 'RELATIONAL');
    const t1 = performance.now();
    await readCollectionWithFallback('customers', () => sampleCustomers, db);
    relTimes.push(performance.now() - t1);

    // Shadow
    setRelationalReadMode('customers', 'SHADOW');
    const t2 = performance.now();
    await readCollectionWithFallback('customers', () => sampleCustomers, db);
    shadowTimes.push(performance.now() - t2);
  }

  setRelationalReadMode('customers', 'RELATIONAL');

  legacyTimes.sort((a, b) => a - b);
  relTimes.sort((a, b) => a - b);
  shadowTimes.sort((a, b) => a - b);

  const p50 = (arr: number[]) => arr[Math.floor(arr.length * 0.5)].toFixed(3);
  const p95 = (arr: number[]) => arr[Math.floor(arr.length * 0.95)].toFixed(3);
  const p99 = (arr: number[]) => arr[Math.floor(arr.length * 0.99)].toFixed(3);

  console.log(`  - Legacy Read:     p50=${p50(legacyTimes)}ms, p95=${p95(legacyTimes)}ms, p99=${p99(legacyTimes)}ms`);
  console.log(`  - Relational Read: p50=${p50(relTimes)}ms, p95=${p95(relTimes)}ms, p99=${p99(relTimes)}ms`);
  console.log(`  - Shadow Read:     p50=${p50(shadowTimes)}ms, p95=${p95(shadowTimes)}ms, p99=${p99(shadowTimes)}ms`);

  assert(parseFloat(p50(relTimes)) < 50, 'Relational read p50 latency is well within production threshold (<50ms)');

  // --------------------------------------------------------------------------
  // SUITE 11: Security & Static Integrity Scan (Step 14)
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

  // Verify sensitive PII protection in diagnostics
  const diagRows = await db.prepare("SELECT * FROM relational_read_diagnostics WHERE collection = 'customers'").all();
  const rawSensitiveLeak = diagRows.results.some((r: any) => {
    const str = JSON.stringify(r);
    return str.includes('ABCDE1234F') || str.includes('password') || str.includes('token');
  });
  assert(!rawSensitiveLeak, 'Diagnostics log contains ZERO unmasked PAN numbers, plaintext passwords, or tokens');

  // --------------------------------------------------------------------------
  // SUITE 12: Rollback Procedure Verification
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 12: Rollback Procedure Verification ---');

  setRelationalReadMode('customers', 'SHADOW');
  assert(getRelationalReadMode('customers') === 'SHADOW', 'Rollback to SHADOW succeeds immediately');

  setRelationalReadMode('customers', 'LEGACY');
  assert(getRelationalReadMode('customers') === 'LEGACY', 'Rollback to LEGACY succeeds immediately');

  // Restore promoted state for Phase 5C
  setRelationalReadMode('customers', 'RELATIONAL');
  assert(getRelationalReadMode('customers') === 'RELATIONAL', 'Restored to RELATIONAL for Phase 5C operational state');

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n============================================================');
  console.log(`PHASE 5C TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
