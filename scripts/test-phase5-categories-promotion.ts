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
  queryCategoriesRelational,
  queryCollectionRelational,
  queryEntityRelational,
  shadowCompareCollection,
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
  console.log('EASYDESK PHASE 5A — CATEGORIES RELATIONAL READ PILOT SUITE');
  console.log('============================================================\n');

  const db = createMockD1();
  await initD1Schema(db);
  resetRelationalReadConfig();

  // --------------------------------------------------------------------------
  // SUITE 1: Pre-Promotion Configuration & Promotion State (Step 9)
  // --------------------------------------------------------------------------
  console.log('--- SUITE 1: Promotion Configuration State ---');

  const modes = getAllRelationalReadModes();
  assert(modes.categories === 'RELATIONAL', 'categories is promoted to RELATIONAL mode');

  const remainingCollections = [
    'employeeKYC',
    'employeePayroll', 'employeeAccounts',
    'orders', 'auditLogs'
  ];

  for (const col of remainingCollections) {
    assert(modes[col] === 'SHADOW', `Collection '${col}' remains in unpromoted SHADOW mode`);
  }

  // --------------------------------------------------------------------------
  // SUITE 2: Categories Data Seeding via Phase 3 Dual-Write (Step 7)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 2: Dual-Write Seeding & Field Parity ---');

  const testCategories = [
    { id: 'gov', name: 'Government Services', slug: 'government-services', icon: 'FileText', color: 'blue', status: 'Active', sortOrder: 1, description: 'Official documents and certificates' },
    { id: 'biz', name: 'Business Services', slug: 'business-services', icon: 'Briefcase', color: 'emerald', status: 'Active', sortOrder: 2, description: 'Registrations and compliance' },
    { id: 'edu', name: 'Education Services', slug: 'education-services', icon: 'GraduationCap', color: 'purple', status: 'Active', sortOrder: 3, description: 'Scholarships and forms' },
    { id: 'doc', name: 'Document Services', slug: 'document-services', icon: 'FileCheck', color: 'amber', status: 'Active', sortOrder: 4, description: 'Scanning and translations' },
    { id: 'archived', name: 'Legacy Archived Category', slug: 'legacy-archived-category', icon: 'Archive', color: 'gray', status: 'Inactive', sortOrder: 99, description: 'Archived services' }
  ];

  for (const cat of testCategories) {
    const res = await saveEntityToD1('categories', cat.id, cat, db);
    assert(res.success, `Dual-write successfully synced category: ${cat.id}`);
  }

  // Verify legacy entities table vs relational categories table count
  const legacyRows = await db.prepare("SELECT * FROM entities WHERE collection = 'categories'").all();
  const relRows = await db.prepare('SELECT * FROM categories').all();

  const legacyCount = legacyRows.results.length;
  const relCount = relRows.results.length;

  assert(legacyCount === testCategories.length, `Legacy entities count matches seeded count (${legacyCount}/${testCategories.length})`);
  assert(relCount === testCategories.length, `Relational categories count matches seeded count (${relCount}/${testCategories.length})`);
  assert(legacyCount === relCount, 'Legacy and Relational table counts are in 100% parity');

  // Field-level parity verification
  for (const cat of testCategories) {
    const relItem = relRows.results.find((r: any) => r.id === cat.id);
    assert(relItem !== undefined, `Category ${cat.id} exists in relational table`);
    assert(relItem.name === cat.name, `Field 'name' parity for ${cat.id}`);
    assert(relItem.slug === cat.slug, `Field 'slug' parity for ${cat.id}`);
    assert(relItem.sort_order === cat.sortOrder, `Field 'sort_order' parity for ${cat.id}`);
    assert(relItem.status === cat.status, `Field 'status' parity for ${cat.id}`);
    assert(relItem.icon === cat.icon, `Field 'icon' parity for ${cat.id}`);
    assert(relItem.color === cat.color, `Field 'color' parity for ${cat.id}`);
    assert(relItem.description === cat.description, `Field 'description' parity for ${cat.id}`);
  }

  // --------------------------------------------------------------------------
  // SUITE 3: Relational Query Behavior (Step 3)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 3: queryCategoriesRelational Query Behaviors ---');

  // 1. List all categories
  const allRel = await queryCategoriesRelational(undefined, db);
  assert(allRel.length === testCategories.length, '1. Full category listing returns all records');

  // 2. Single category by ID
  const singleById = await queryCategoriesRelational({ id: 'biz' }, db);
  assert(singleById.length === 1 && singleById[0].name === 'Business Services', '2. Single category lookup by ID works');

  // 3. Category lookup by slug
  const singleBySlug = await queryCategoriesRelational({ slug: 'education-services' }, db);
  assert(singleBySlug.length === 1 && singleBySlug[0].id === 'edu', '3. Category lookup by slug works');

  // 4. Active/Inactive filtering
  const activeOnly = await queryCategoriesRelational({ status: 'Active' }, db);
  assert(activeOnly.length === 4 && activeOnly.every(c => c.status === 'Active'), '4. Active filtering returns only active categories');

  const inactiveOnly = await queryCategoriesRelational({ status: 'Inactive' }, db);
  assert(inactiveOnly.length === 1 && inactiveOnly[0].id === 'archived', '4. Inactive filtering returns only inactive categories');

  // 5. Ordering verification (sort_order ASC, name ASC)
  const isSorted = allRel.every((cat, i) => {
    if (i === 0) return true;
    return cat.sortOrder >= allRel[i - 1].sortOrder;
  });
  assert(isSorted, '5. Categories are returned sorted in ascending sortOrder sequence');

  // 6. Pagination (limit and offset)
  const paginated = await queryCategoriesRelational({ limit: 2, offset: 1 }, db);
  assert(paginated.length === 2 && paginated[0].id === 'biz' && paginated[1].id === 'edu', '6. Pagination limit & offset query behaves correctly');

  // 7. Empty result handling
  const emptyResult = await queryCategoriesRelational({ id: 'non-existent-id' }, db);
  assert(Array.isArray(emptyResult) && emptyResult.length === 0, '7. Querying non-existent category returns empty array');

  // 8. Missing ID / malformed ID handling
  const malformedResult = await queryCategoriesRelational({ id: "'; DROP TABLE categories; --" }, db);
  assert(Array.isArray(malformedResult) && malformedResult.length === 0, '8. Malformed injection ID safely handled by bound parameter');

  // 9. Single Entity Read Helper
  const entityRead = await readEntityWithFallback('categories', 'gov', () => testCategories[0], db);
  assert(entityRead?.id === 'gov' && entityRead.name === 'Government Services', '9. readEntityWithFallback fetches category correctly');

  // --------------------------------------------------------------------------
  // SUITE 4: API Contract Parity (Step 4)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 4: API Contract Parity ---');

  // Mock services for serviceCount calculation
  const mockServices = [
    { id: 's1', categoryId: 'gov' },
    { id: 's2', categoryId: 'gov' },
    { id: 's3', categoryId: 'biz' }
  ];

  // Emulate handleGetCategories with LEGACY read
  setRelationalReadMode('categories', 'LEGACY');
  const legacyReadCats = await readCollectionWithFallback('categories', () => testCategories, db);
  const legacyMapped = legacyReadCats.filter(c => c.status === 'Active').map(c => ({
    ...c,
    serviceCount: mockServices.filter(s => s.categoryId === c.id).length
  }));

  // Emulate handleGetCategories with RELATIONAL read
  setRelationalReadMode('categories', 'RELATIONAL');
  const relReadCats = await readCollectionWithFallback('categories', () => testCategories, db);
  const relMapped = relReadCats.filter(c => c.status === 'Active').map(c => ({
    ...c,
    serviceCount: mockServices.filter(s => s.categoryId === c.id).length
  }));

  assert(legacyMapped.length === relMapped.length, 'API Contract: Active categories count identical');
  assert(relMapped[0].id === 'gov' && relMapped[0].serviceCount === 2, 'API Contract: gov serviceCount is 2');
  assert(relMapped[1].id === 'biz' && relMapped[1].serviceCount === 1, 'API Contract: biz serviceCount is 1');
  assert(relMapped[2].id === 'edu' && relMapped[2].serviceCount === 0, 'API Contract: edu serviceCount is 0');

  // Verify all contract keys are present
  const requiredKeys = ['id', 'name', 'slug', 'sortOrder', 'status', 'icon', 'color', 'description', 'serviceCount'];
  for (const key of requiredKeys) {
    assert(key in relMapped[0], `API Contract: Key '${key}' is preserved in relational response`);
  }

  // --------------------------------------------------------------------------
  // SUITE 5: Guaranteed Safe Fallback Testing (Step 5)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 5: Resilient Fallback Under Failure Conditions ---');

  // Case A: Query Exception (SQLite syntax or disk failure)
  const brokenQueryDb = {
    ...db,
    prepare(sql: string) {
      if (sql.includes('FROM categories')) {
        throw new Error('Simulated SQLite disk corruption / syntax error');
      }
      return db.prepare(sql);
    }
  };

  let fallbackACalled = false;
  const resultA = await readCollectionWithFallback('categories', () => {
    fallbackACalled = true;
    return testCategories;
  }, brokenQueryDb);
  assert(fallbackACalled && resultA.length === testCategories.length, 'Case A: Query exception triggers seamless legacy fallback');

  // Case B: Table Missing
  const missingTableDb = {
    ...db,
    prepare(sql: string) {
      if (sql.includes('FROM categories')) {
        throw new Error('no such table: categories');
      }
      return db.prepare(sql);
    }
  };

  let fallbackBCalled = false;
  const resultB = await readCollectionWithFallback('categories', () => {
    fallbackBCalled = true;
    return testCategories;
  }, missingTableDb);
  assert(fallbackBCalled && resultB.length === testCategories.length, 'Case B: Missing table triggers seamless legacy fallback');

  // Case C: Malformed return (non-array)
  const malformedDb = {
    ...db,
    prepare(sql: string) {
      if (sql.includes('FROM categories')) {
        return {
          bind: () => ({ all: async () => ({ results: 'corrupted-non-array-string' }) })
        } as any;
      }
      return db.prepare(sql);
    }
  };

  let fallbackCCalled = false;
  const resultC = await readCollectionWithFallback('categories', () => {
    fallbackCCalled = true;
    return testCategories;
  }, malformedDb);
  assert(fallbackCCalled && resultC.length === testCategories.length, 'Case C: Malformed result triggers seamless legacy fallback');

  // Case D: Empty relational result while legacy has data
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

  let fallbackDCalled = false;
  const resultD = await readCollectionWithFallback('categories', () => {
    fallbackDCalled = true;
    return testCategories;
  }, emptyDb);
  assert(fallbackDCalled && resultD.length === testCategories.length, 'Case D: Silent empty relational result triggers defensive fallback');

  // Case E: Single entity fallback
  let entityFallbackCalled = false;
  const resultE = await readEntityWithFallback('categories', 'gov', () => {
    entityFallbackCalled = true;
    return testCategories[0];
  }, brokenQueryDb);
  assert(entityFallbackCalled && resultE?.id === 'gov', 'Case E: Single entity lookup falls back to legacy on error');

  // --------------------------------------------------------------------------
  // SUITE 6: Circuit Breaker Verification (Step 6)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 6: Circuit Breaker Protection ---');

  resetCircuitBreaker('categories');
  assert(!isCircuitBreakerTripped('categories'), 'Circuit breaker starts in untripped healthy state');

  // Fail 5 times in a row
  for (let i = 0; i < 5; i++) {
    await readCollectionWithFallback('categories', () => testCategories, brokenQueryDb);
  }

  assert(isCircuitBreakerTripped('categories'), 'Circuit breaker trips after 5 consecutive failures');

  // Subsequent reads bypass relational query immediately
  let bypassedLegacyCalled = false;
  await readCollectionWithFallback('categories', () => {
    bypassedLegacyCalled = true;
    return testCategories;
  }, db);
  assert(bypassedLegacyCalled, 'While circuit breaker is tripped, reads bypass relational and serve legacy fallback directly');

  // Manual reset
  resetCircuitBreaker('categories');
  assert(!isCircuitBreakerTripped('categories'), 'Circuit breaker successfully resets manually');

  // --------------------------------------------------------------------------
  // SUITE 7: Dual-Write Mutation & Read-After-Write Consistency (Steps 7 & 11)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 7: Read-After-Write Consistency ---');

  // 1. CREATE
  const newCat = {
    id: 'health',
    name: 'Healthcare & Wellness',
    slug: 'healthcare-wellness',
    icon: 'Heart',
    color: 'red',
    status: 'Active',
    sortOrder: 5,
    description: 'Health insurance, clinic licenses, and medical clearances'
  };
  await saveEntityToD1('categories', newCat.id, newCat, db);

  const postCreateReads = await readCollectionWithFallback('categories', () => [...testCategories, newCat], db);
  const foundCreated = postCreateReads.find((c: any) => c.id === 'health');
  assert(foundCreated !== undefined && foundCreated.name === 'Healthcare & Wellness', 'Read-After-Write: Newly created category read immediately from relational table');

  // 2. UPDATE
  const updatedCat = {
    ...newCat,
    name: 'Healthcare, Wellness & Medical',
    sortOrder: 6
  };
  await saveEntityToD1('categories', updatedCat.id, updatedCat, db);

  const postUpdateReads = await readCollectionWithFallback('categories', () => [...testCategories, updatedCat], db);
  const foundUpdated = postUpdateReads.find((c: any) => c.id === 'health');
  assert(foundUpdated !== undefined && foundUpdated.name === 'Healthcare, Wellness & Medical' && foundUpdated.sortOrder === 6, 'Read-After-Write: Updated category reflects modifications immediately');

  // 3. DELETE
  await deleteEntityFromD1('categories', 'health', db);

  const postDeleteReads = await readCollectionWithFallback('categories', () => testCategories, db);
  const foundDeleted = postDeleteReads.find((c: any) => c.id === 'health');
  assert(foundDeleted === undefined, 'Read-After-Write: Deleted category is immediately absent from relational read');

  // --------------------------------------------------------------------------
  // SUITE 8: Shadow Mode Parity Verification (Step 8)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 8: Shadow Comparison Check ---');

  const shadowRes = await shadowCompareCollection('categories', testCategories, db);
  assert(shadowRes.success && shadowRes.mismatches === 0, 'Shadow comparison confirms 0 mismatches on live data');

  // --------------------------------------------------------------------------
  // SUITE 9: Diagnostic Logging Verification (Step 5)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 9: Diagnostics Recording ---');

  const diagRows = await db.prepare("SELECT * FROM relational_read_diagnostics WHERE collection = 'categories' ORDER BY created_at DESC").all();
  assert(diagRows.results.length > 0, 'Diagnostics table recorded fallback and shadow audit logs');

  const hasFallbackRecord = diagRows.results.some((r: any) => r.status === 'FAILED' && r.mode === 'RELATIONAL');
  assert(hasFallbackRecord, 'Diagnostics recorded RELATIONAL_FALLBACK entries accurately');

  // --------------------------------------------------------------------------
  // SUITE 10: Security & Static Integrity Scan (Step 12)
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 10: Security & Non-Destructive Codebase Scan ---');

  const d1StoragePath = path.resolve(process.cwd(), 'src/lib/d1Storage.ts');
  const d1Content = fs.readFileSync(d1StoragePath, 'utf-8');

  const forbiddenDrop = /DROP\s+TABLE\s+(?!IF\s+EXISTS\s+_test_)\w+/i.test(d1Content);
  const forbiddenTruncate = /TRUNCATE\s+TABLE/i.test(d1Content);
  const forbiddenDropCol = /ALTER\s+TABLE\s+\w+\s+DROP\s+COLUMN/i.test(d1Content);

  assert(!forbiddenDrop, 'Codebase contains ZERO DROP TABLE statements');
  assert(!forbiddenTruncate, 'Codebase contains ZERO TRUNCATE statements');
  assert(!forbiddenDropCol, 'Codebase contains ZERO DROP COLUMN statements');

  // --------------------------------------------------------------------------
  // SUITE 11: Rollback Verification
  // --------------------------------------------------------------------------
  console.log('\n--- SUITE 11: Rollback Procedure Verification ---');

  // Rollback to SHADOW
  setRelationalReadMode('categories', 'SHADOW');
  assert(getRelationalReadMode('categories') === 'SHADOW', 'Rollback to SHADOW succeeds immediately');

  // Rollback to LEGACY
  setRelationalReadMode('categories', 'LEGACY');
  assert(getRelationalReadMode('categories') === 'LEGACY', 'Rollback to LEGACY succeeds immediately');

  // Re-promote to RELATIONAL for Phase 5A completion
  setRelationalReadMode('categories', 'RELATIONAL');
  assert(getRelationalReadMode('categories') === 'RELATIONAL', 'Re-promoted to RELATIONAL for pilot operation');

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n============================================================');
  console.log(`PHASE 5A TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
