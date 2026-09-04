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
  queryServicesRelational,
  queryCategoriesRelational,
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
  console.log('EASYDESK PHASE 5B — SERVICES RELATIONAL READ PROMOTION SUITE');
  console.log('============================================================\n');

  const db = createMockD1();
  await initD1Schema(db);
  resetRelationalReadConfig();

  // --------------------------------------------------------------------------
  // SUITE 1: Promotion Configuration State (Step 13)
  // --------------------------------------------------------------------------
  console.log('--- SUITE 1: Promotion Configuration State ---');

  const modes = getAllRelationalReadModes();
  assert(modes.categories === 'RELATIONAL', 'categories is in RELATIONAL mode');
  assert(modes.services === 'RELATIONAL', 'services is promoted to RELATIONAL mode');

  const remainingCollections = [
    'employeeKYC',
    'employeePayroll', 'employeeAccounts',
    'orders', 'auditLogs'
  ];

  for (const col of remainingCollections) {
    assert(modes[col] === 'SHADOW', `Collection '${col}' remains safely in SHADOW mode`);
  }

  // --------------------------------------------------------------------------
  // SUITE 2: Dual-Write Seeding & Category Dependency Verification (Steps 2, 3, 9)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 2: Dual-Write Seeding & Category Dependency ---');

  // Seed parent categories
  const categories = [
    { id: 'gov', name: 'Government Services', slug: 'government-services', sortOrder: 1, status: 'Active' },
    { id: 'biz', name: 'Business Services', slug: 'business-services', sortOrder: 2, status: 'Active' },
    { id: 'edu', name: 'Education Services', slug: 'education-services', sortOrder: 3, status: 'Active' }
  ];
  for (const cat of categories) {
    await saveEntityToD1('categories', cat.id, cat, db);
  }

  const sampleServices = [
    {
      id: 'pan',
      categoryId: 'gov',
      title: 'New PAN Card / Correction',
      slug: 'new-pan-card',
      subCategory: 'Taxation ID',
      description: 'Official Permanent Account Number card application and correction.',
      govFees: 107,
      serviceCharge: 150,
      processingTime: '5-7 Working Days',
      status: 'active',
      bannerImage: 'https://images.unsplash.com/pan.jpg',
      icon: 'FileText',
      requiredDocuments: ['Aadhaar Card', 'Passport Photo', 'Signature Proof'],
      faqs: [
        { question: 'What is e-PAN?', answer: 'Digitally signed PAN.' },
        { question: 'Minor application?', answer: 'Yes, through guardian.' }
      ],
      eligibility: 'All Indian Citizens and Entities',
      popularity: 98,
      featured: true,
      popular: true,
      displayOrder: 1
    },
    {
      id: 'aadhaar-update',
      categoryId: 'gov',
      title: 'Aadhaar Demographics Update',
      slug: 'aadhaar-demographics-update',
      subCategory: 'Identity',
      description: 'Update address, mobile number, or name in official Aadhaar profile.',
      govFees: 50,
      serviceCharge: 100,
      processingTime: '3-5 Working Days',
      status: 'active',
      bannerImage: null,
      icon: 'UserCheck',
      requiredDocuments: ['Proof of Address', 'Old Aadhaar Copy'],
      faqs: [{ question: 'Is physical presence needed?', answer: 'Not for demographics.' }],
      eligibility: 'All Aadhaar Holders',
      popularity: 95,
      featured: true,
      popular: false,
      displayOrder: 2
    },
    {
      id: 'gst-reg',
      categoryId: 'biz',
      title: 'GST Registration',
      slug: 'gst-registration',
      subCategory: 'Tax Compliance',
      description: 'New Goods and Services Tax identification number registration.',
      govFees: 0,
      serviceCharge: 999,
      processingTime: '7-10 Working Days',
      status: 'active',
      bannerImage: null,
      icon: 'Briefcase',
      requiredDocuments: ['PAN Card', 'Electricity Bill', 'Bank Statement'],
      faqs: [{ question: 'Is GST mandatory?', answer: 'Mandatory if turnover exceeds threshold.' }],
      eligibility: 'Businesses and Freelancers',
      popularity: 90,
      featured: false,
      popular: true,
      displayOrder: 3
    },
    {
      id: 'archived-scholarship',
      categoryId: 'edu',
      title: 'Archived Scholarship Scheme',
      slug: 'archived-scholarship-scheme',
      subCategory: 'Welfare',
      description: 'Expired scholarship program.',
      govFees: 0,
      serviceCharge: 50,
      processingTime: '15 Days',
      status: 'inactive',
      bannerImage: null,
      icon: 'Archive',
      requiredDocuments: ['Income Certificate'],
      faqs: [],
      eligibility: 'Students',
      popularity: 10,
      featured: false,
      popular: false,
      displayOrder: 99
    }
  ];

  for (const s of sampleServices) {
    const res = await saveEntityToD1('services', s.id, s, db);
    assert(res.success, `Dual-write successfully synced service: ${s.id}`);
  }

  // Verify legacy entities table vs relational services table counts
  const legacyRows = await db.prepare("SELECT * FROM entities WHERE collection = 'services'").all();
  const relRows = await db.prepare('SELECT * FROM services').all();

  const legacyCount = legacyRows.results.length;
  const relCount = relRows.results.length;

  assert(legacyCount === sampleServices.length, `Legacy entities count matches seeded count (${legacyCount}/${sampleServices.length})`);
  assert(relCount === sampleServices.length, `Relational services count matches seeded count (${relCount}/${sampleServices.length})`);
  assert(legacyCount === relCount, 'Legacy and Relational table counts are in 100% parity');

  // Verify foreign key integrity & zero orphaned services
  const orphanRows = await db.prepare(`
    SELECT s.id, s.category_id 
    FROM services s 
    LEFT JOIN categories c ON s.category_id = c.id 
    WHERE s.category_id IS NOT NULL AND c.id IS NULL
  `).all();
  assert(orphanRows.results.length === 0, 'Zero orphaned services: all category_id references resolve to existing categories');

  // Field-level parity verification
  for (const s of sampleServices) {
    const relItem = relRows.results.find((r: any) => r.id === s.id);
    assert(relItem !== undefined, `Service ${s.id} exists in relational table`);
    assert(relItem.category_id === s.categoryId, `Field 'category_id' parity for ${s.id}`);
    assert(relItem.title === s.title, `Field 'title' parity for ${s.id}`);
    assert(relItem.slug === s.slug, `Field 'slug' parity for ${s.id}`);
    assert(relItem.sub_category === s.subCategory, `Field 'sub_category' parity for ${s.id}`);
    assert(relItem.description === s.description, `Field 'description' parity for ${s.id}`);
    assert(Math.abs(Number(relItem.gov_fees) - s.govFees) < 0.001, `Field 'gov_fees' numeric parity for ${s.id}`);
    assert(Math.abs(Number(relItem.service_charge) - s.serviceCharge) < 0.001, `Field 'service_charge' numeric parity for ${s.id}`);
    assert(relItem.processing_time === s.processingTime, `Field 'processing_time' parity for ${s.id}`);
    assert(relItem.status === s.status, `Field 'status' parity for ${s.id}`);
  }

  // --------------------------------------------------------------------------
  // SUITE 3: Relational Query Audit & Operational Behaviors (Step 4)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 3: queryServicesRelational Query Behaviors ---');

  // 1. List services
  const allServices = await queryServicesRelational(undefined, db);
  assert(allServices.length === sampleServices.length, '1. Full services listing returns all records');

  // 2. Single service by ID
  const singleById = await queryServicesRelational({ id: 'pan' }, db);
  assert(singleById.length === 1 && singleById[0].title === 'New PAN Card / Correction', '2. Single service lookup by ID works');

  // 3. Search by slug
  const singleBySlug = await queryServicesRelational({ slug: 'gst-registration' }, db);
  assert(singleBySlug.length === 1 && singleBySlug[0].id === 'gst-reg', '3. Search by slug works');

  // 4. Category filtering
  const govServices = await queryServicesRelational({ categoryId: 'gov' }, db);
  assert(govServices.length === 2 && govServices.every(s => s.categoryId === 'gov'), '4. Category filtering returns only matching services');

  // 5. Active/Inactive filtering
  const activeServices = await queryServicesRelational({ status: 'active' }, db);
  assert(activeServices.length === 3 && activeServices.every(s => s.status === 'active'), '5. Active filtering returns active services');
  const inactiveServices = await queryServicesRelational({ status: 'inactive' }, db);
  assert(inactiveServices.length === 1 && inactiveServices[0].id === 'archived-scholarship', '5. Inactive filtering returns inactive service');

  // 6. Text search filtering
  const searchResults = await queryServicesRelational({ search: 'Aadhaar' }, db);
  assert(searchResults.length === 1 && searchResults[0].id === 'aadhaar-update', '6. Text search filtering works');

  // 7. Pagination (limit and offset)
  const paginated = await queryServicesRelational({ limit: 2, offset: 1 }, db);
  assert(paginated.length === 2, '7. Pagination limit and offset work properly');

  // 8. Empty results on non-existent query
  const emptyRes = await queryServicesRelational({ id: 'non-existent-service-xyz' }, db);
  assert(Array.isArray(emptyRes) && emptyRes.length === 0, '8. Empty result handling returns empty array');

  // 9. Missing ID / null input
  const missingIdRes = await queryServicesRelational({ id: undefined }, db);
  assert(missingIdRes.length === sampleServices.length, '9. Missing ID query handled gracefully');

  // 10. Malformed input / injection safety
  const injectionRes = await queryServicesRelational({ id: "'; DROP TABLE services; --" }, db);
  assert(Array.isArray(injectionRes) && injectionRes.length === 0, '10. Parameterized SQL prevents injection attacks');

  // 11. Numeric fee calculations & totalAmount
  const panService = allServices.find(s => s.id === 'pan');
  assert(panService?.govFees === 107 && panService?.serviceCharge === 150 && panService?.totalAmount === 257, '11. Fee numeric values and totalAmount calculated accurately');

  // 12. Nested JSON: requiredDocuments and FAQs
  assert(Array.isArray(panService?.requiredDocuments) && panService?.requiredDocuments.length === 3, '12. requiredDocuments parsed to array correctly');
  assert(Array.isArray(panService?.faqs) && panService?.faqs.length === 2, '12. FAQs parsed to array correctly');

  // 13. Single Entity Query via readEntityWithFallback
  const singleEntity = await readEntityWithFallback('services', 'gst-reg', () => sampleServices[2], db);
  assert(singleEntity?.id === 'gst-reg' && singleEntity?.serviceCharge === 999, '13. readEntityWithFallback returns single service correctly');

  // --------------------------------------------------------------------------
  // SUITE 4: API Contract Parity (Step 5)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 4: API Contract Parity ---');

  // Emulate GET /api/services with LEGACY read
  setRelationalReadMode('services', 'LEGACY');
  const legacyReadServices = await readCollectionWithFallback('services', () => sampleServices, db);
  const legacyCategories = await readCollectionWithFallback('categories', () => categories, db);
  const legacyMapped = legacyReadServices.map(s => {
    const cat = legacyCategories.find(c => c.id === s.categoryId);
    return {
      ...s,
      categoryName: cat ? cat.name : s.categoryId
    };
  });

  // Emulate GET /api/services with RELATIONAL read
  setRelationalReadMode('services', 'RELATIONAL');
  const relReadServices = await readCollectionWithFallback('services', () => sampleServices, db);
  const relCategories = await readCollectionWithFallback('categories', () => categories, db);
  const relMapped = relReadServices.map(s => {
    const cat = relCategories.find(c => c.id === s.categoryId);
    return {
      ...s,
      categoryName: cat ? cat.name : s.categoryId
    };
  });

  assert(legacyMapped.length === relMapped.length, 'API Contract: Total service count identical');

  const reqKeys = ['id', 'categoryId', 'title', 'slug', 'description', 'govFees', 'serviceCharge', 'processingTime', 'status', 'categoryName', 'requiredDocuments', 'faqs'];
  for (const key of reqKeys) {
    assert(key in relMapped[0], `API Contract: Key '${key}' is preserved in relational response`);
  }

  // Verify categoryName enrichment
  const relPan = relMapped.find(s => s.id === 'pan');
  const legacyPan = legacyMapped.find(s => s.id === 'pan');
  assert(relPan?.categoryName === 'Government Services' && relPan?.categoryName === legacyPan?.categoryName, 'API Contract: categoryName enriched correctly from categories table');

  // --------------------------------------------------------------------------
  // SUITE 5: Shadow Mode Parity Verification (Step 6)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 5: Shadow Mode Parity Verification ---');

  setRelationalReadMode('services', 'SHADOW');
  const shadowRes = await shadowCompareCollection('services', sampleServices, db);
  assert(shadowRes.success && shadowRes.mismatches === 0, 'Shadow comparison confirms 100% count & field parity');

  // Restore to RELATIONAL
  setRelationalReadMode('services', 'RELATIONAL');

  // --------------------------------------------------------------------------
  // SUITE 6: Guaranteed Safe Fallback Testing (Step 7)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 6: Resilient Fallback Under Failure Conditions ---');

  // Case A: Query Exception
  const brokenDb = {
    ...db,
    prepare(sql: string) {
      if (sql.includes('FROM services')) {
        throw new Error('Simulated SQLite disk corruption / syntax error');
      }
      return db.prepare(sql);
    }
  };

  let fallbackACalled = false;
  const resultA = await readCollectionWithFallback('services', () => {
    fallbackACalled = true;
    return sampleServices;
  }, brokenDb);
  assert(fallbackACalled && resultA.length === sampleServices.length, 'Case A: Query exception triggers seamless legacy fallback');

  // Case B: Table Missing
  const missingTableDb = {
    ...db,
    prepare(sql: string) {
      if (sql.includes('FROM services')) {
        throw new Error('no such table: services');
      }
      return db.prepare(sql);
    }
  };

  let fallbackBCalled = false;
  const resultB = await readCollectionWithFallback('services', () => {
    fallbackBCalled = true;
    return sampleServices;
  }, missingTableDb);
  assert(fallbackBCalled && resultB.length === sampleServices.length, 'Case B: Missing table triggers seamless legacy fallback');

  // Case C: Empty relational result while legacy has records
  const emptyDb = {
    ...db,
    prepare(sql: string) {
      if (sql.includes('FROM services')) {
        return {
          bind: () => ({ all: async () => ({ results: [] }) })
        } as any;
      }
      return db.prepare(sql);
    }
  };

  let fallbackCCalled = false;
  const resultC = await readCollectionWithFallback('services', () => {
    fallbackCCalled = true;
    return sampleServices;
  }, emptyDb);
  assert(fallbackCCalled && resultC.length === sampleServices.length, 'Case C: Silent empty relational result triggers defensive fallback');

  // Case D: Malformed non-array response
  const malformedDb = {
    ...db,
    prepare(sql: string) {
      if (sql.includes('FROM services')) {
        return {
          bind: () => ({ all: async () => ({ results: 'corrupted-non-array-data' }) })
        } as any;
      }
      return db.prepare(sql);
    }
  };

  let fallbackDCalled = false;
  const resultD = await readCollectionWithFallback('services', () => {
    fallbackDCalled = true;
    return sampleServices;
  }, malformedDb);
  assert(fallbackDCalled && resultD.length === sampleServices.length, 'Case D: Malformed response triggers seamless legacy fallback');

  // Case E: Single entity fallback
  let fallbackECalled = false;
  const resultE = await readEntityWithFallback('services', 'pan', () => {
    fallbackECalled = true;
    return sampleServices[0];
  }, brokenDb);
  assert(fallbackECalled && resultE?.id === 'pan', 'Case E: Single service read triggers seamless legacy fallback');

  // --------------------------------------------------------------------------
  // SUITE 7: Circuit Breaker Protection (Step 8)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 7: Circuit Breaker Protection ---');

  resetCircuitBreaker('services');
  assert(!isCircuitBreakerTripped('services'), 'Circuit breaker starts in untripped healthy state');

  // Fail 5 times in a row
  for (let i = 0; i < 5; i++) {
    await readCollectionWithFallback('services', () => sampleServices, brokenDb);
  }

  assert(isCircuitBreakerTripped('services'), 'Circuit breaker trips after 5 consecutive failures');

  // While tripped, relational queries are bypassed
  let bypassedCalled = false;
  await readCollectionWithFallback('services', () => {
    bypassedCalled = true;
    return sampleServices;
  }, db);
  assert(bypassedCalled, 'While circuit breaker is tripped, reads bypass relational and serve legacy fallback directly');

  // Manual reset
  resetCircuitBreaker('services');
  assert(!isCircuitBreakerTripped('services'), 'Circuit breaker successfully resets manually');

  // --------------------------------------------------------------------------
  // SUITE 8: Read-After-Write Consistency (Steps 9 & 10)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 8: Read-After-Write Consistency ---');

  // 1. CREATE
  const newService = {
    id: 'itr-filing',
    categoryId: 'biz',
    title: 'Income Tax Return (ITR) Filing',
    slug: 'itr-filing',
    subCategory: 'Taxation',
    description: 'Expert individual and salaried ITR e-filing.',
    govFees: 0,
    serviceCharge: 499,
    processingTime: '24-48 Hours',
    status: 'active',
    requiredDocuments: ['Form 16', 'PAN Card', 'Bank Statements'],
    faqs: [{ question: 'What is Form 16?', answer: 'TDS certificate.' }]
  };
  await saveEntityToD1('services', newService.id, newService, db);

  const postCreateReads = await readCollectionWithFallback('services', () => [...sampleServices, newService], db);
  const foundCreated = postCreateReads.find((s: any) => s.id === 'itr-filing');
  assert(foundCreated !== undefined && foundCreated.serviceCharge === 499, 'Read-After-Write: Created service read immediately from relational table');

  // 2. UPDATE
  const updatedService = {
    ...newService,
    title: 'Income Tax Return (ITR) Filing - FastTrack',
    serviceCharge: 699
  };
  await saveEntityToD1('services', updatedService.id, updatedService, db);

  const postUpdateReads = await readCollectionWithFallback('services', () => [...sampleServices, updatedService], db);
  const foundUpdated = postUpdateReads.find((s: any) => s.id === 'itr-filing');
  assert(foundUpdated !== undefined && foundUpdated.title.includes('FastTrack') && foundUpdated.serviceCharge === 699, 'Read-After-Write: Updated service reflects changes immediately');

  // 3. DELETE
  await deleteEntityFromD1('services', 'itr-filing', db);

  const postDeleteReads = await readCollectionWithFallback('services', () => sampleServices, db);
  const foundDeleted = postDeleteReads.find((s: any) => s.id === 'itr-filing');
  assert(foundDeleted === undefined, 'Read-After-Write: Deleted service is immediately absent from relational reads');

  // --------------------------------------------------------------------------
  // SUITE 9: Performance Benchmarking (Step 12)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 9: Performance Benchmarking (100 iterations) ---');

  const legacyTimes: number[] = [];
  const relTimes: number[] = [];
  const shadowTimes: number[] = [];

  for (let i = 0; i < 100; i++) {
    // Legacy
    setRelationalReadMode('services', 'LEGACY');
    const t0 = performance.now();
    await readCollectionWithFallback('services', () => sampleServices, db);
    legacyTimes.push(performance.now() - t0);

    // Relational
    setRelationalReadMode('services', 'RELATIONAL');
    const t1 = performance.now();
    await readCollectionWithFallback('services', () => sampleServices, db);
    relTimes.push(performance.now() - t1);

    // Shadow
    setRelationalReadMode('services', 'SHADOW');
    const t2 = performance.now();
    await readCollectionWithFallback('services', () => sampleServices, db);
    shadowTimes.push(performance.now() - t2);
  }

  setRelationalReadMode('services', 'RELATIONAL');

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
  // SUITE 10: Security & Static Integrity Scan (Step 11)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 10: Security & Static Integrity Scan ---');

  const d1StoragePath = path.resolve(process.cwd(), 'src/lib/d1Storage.ts');
  const d1Content = fs.readFileSync(d1StoragePath, 'utf-8');

  const forbiddenDrop = /DROP\s+TABLE\s+(?!IF\s+EXISTS\s+_test_)\w+/i.test(d1Content);
  const forbiddenTruncate = /TRUNCATE\s+TABLE/i.test(d1Content);
  const forbiddenDropCol = /ALTER\s+TABLE\s+\w+\s+DROP\s+COLUMN/i.test(d1Content);

  assert(!forbiddenDrop, 'Codebase contains ZERO DROP TABLE statements');
  assert(!forbiddenTruncate, 'Codebase contains ZERO TRUNCATE statements');
  assert(!forbiddenDropCol, 'Codebase contains ZERO DROP COLUMN statements');

  // --------------------------------------------------------------------------
  // SUITE 11: Rollback Procedure Verification
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 11: Rollback Procedure Verification ---');

  setRelationalReadMode('services', 'SHADOW');
  assert(getRelationalReadMode('services') === 'SHADOW', 'Rollback to SHADOW succeeds immediately');

  setRelationalReadMode('services', 'LEGACY');
  assert(getRelationalReadMode('services') === 'LEGACY', 'Rollback to LEGACY succeeds immediately');

  // Restore promoted state for Phase 5B
  setRelationalReadMode('services', 'RELATIONAL');
  assert(getRelationalReadMode('services') === 'RELATIONAL', 'Restored to RELATIONAL for Phase 5B operational state');

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n============================================================');
  console.log(`PHASE 5B TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
