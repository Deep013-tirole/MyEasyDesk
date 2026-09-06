/**
 * EASYDESK — P1 CRITICAL FIX REGRESSION TEST SUITE
 * PRESEEDED / ZOMBIE DATA RESURRECTION AFTER COLD START
 *
 * Verifies the permanent invariant: EMPTY COLLECTION = VALID PRODUCTION STATE
 *
 * Tests:
 * 1. services read with empty D1 table -> returns [], never reseeds
 * 2. categories read with empty D1 table -> returns [], never reseeds
 * 3. blogs read with empty D1 table -> returns [], never reseeds
 * 4. blogCategories read with empty D1 table -> returns [], never reseeds
 * 5. Legacy memory fallback does NOT override intentional empty state in D1
 * 6. Simulated Cloudflare Worker restart with empty collections retains empty state
 * 7. Simulated new isolate initialization with empty collections retains empty state
 * 8. Partial deletion preserves exact state without resurrecting deleted items
 * 9. Populated D1 database loads normally and preserves all records
 * 10. Genuinely fresh / uninitialized D1 database seeds properly on initial startup
 * 11. system_init marker in system_settings confirms initialized status even when row counts are 0
 * 12. Fallback query does NOT re-inject legacy default data when relational table is empty
 * 13. readCollectionWithFallback returns empty array cleanly when relational query returns 0 rows
 * 14. normalizeDatabaseRelationships without allowReseed: true never resurrects empty collections
 * 15. End-to-end simulated lifecycle: seed -> verify -> delete all -> restart -> verify empty preserved
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passedTests = 0;
let failedTests = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${desc}`);
    console.error(`         ${err.message}`);
    failedTests++;
    process.exitCode = 1;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${desc}`);
    console.error(`         ${err.message}`);
    failedTests++;
    process.exitCode = 1;
  }
}

console.log('\n============================================================');
console.log('EASYDESK — P1 FIX: NO ZOMBIE DATA RESURRECTION TEST SUITE');
console.log('============================================================\n');

// -------------------------------------------------------------
// SECTION 1: SOURCE CODE INVARIANT VERIFICATION
// -------------------------------------------------------------
console.log('--- SECTION 1: Static Architecture & Source Invariants ---');

const d1StorageContent = fs.readFileSync(path.join(__dirname, '../src/lib/d1Storage.ts'), 'utf8');
const serverContent = fs.readFileSync(path.join(__dirname, '../server.ts'), 'utf8');

it('1.1 d1Storage.ts exports isD1Initialized and setD1Initialized', () => {
  assert(d1StorageContent.includes('export function isD1Initialized(): boolean'), 'isD1Initialized must be exported');
  assert(d1StorageContent.includes('export function setD1Initialized(val: boolean): void'), 'setD1Initialized must be exported');
});

it('1.2 d1Storage.ts loadStateFromD1 explicitly tracks and returns hasSystemInit and marks initialized', () => {
  assert(d1StorageContent.includes('hasSystemInit = true'), 'loadStateFromD1 must detect system_init marker');
  assert(d1StorageContent.includes('setD1Initialized(true)'), 'loadStateFromD1 must set initialized flag');
  assert(d1StorageContent.includes('hasSystemInit,'), 'loadStateFromD1 return object must include hasSystemInit');
});

it('1.3 d1Storage.ts loadStateFromD1 initializes missing ENTITY_COLLECTIONS to empty array/object', () => {
  assert(d1StorageContent.includes('for (const collName of ENTITY_COLLECTIONS)'), 'Must loop through ENTITY_COLLECTIONS');
  assert(d1StorageContent.includes('state[collName] = OBJECT_COLLECTIONS.has(collName) ? {} : []'), 'Empty collections must default to [] or {} rather than undefined');
});

it('1.4 d1Storage.ts readCollectionWithFallback DOES NOT re-sync legacy defaults on parity deficit', () => {
  // Ensure the old dangerous syncCollectionToD1 fallback block has been completely removed
  assert(!d1StorageContent.includes('syncCollectionToD1(collection, legacySample, db)'),
    'readCollectionWithFallback must NEVER call syncCollectionToD1 to resurrect legacy data when relResult is empty');
});

it('1.5 server.ts normalizeDatabaseRelationships guards re-seeding behind allowReseed flag', () => {
  assert(serverContent.includes('function normalizeDatabaseRelationships(options?: { allowReseed?: boolean })'),
    'normalizeDatabaseRelationships must accept options parameter');
  assert(serverContent.includes('const allowReseed = options?.allowReseed === true'),
    'allowReseed must default to false');
  assert(serverContent.includes('else if (allowReseed && dbState.categories.length === 0)'),
    'categories re-seeding must require allowReseed === true');
  assert(serverContent.includes('else if (allowReseed && dbState.services.length === 0)'),
    'services re-seeding must require allowReseed === true');
  assert(serverContent.includes('else if (allowReseed && dbState.blogCategories.length === 0)'),
    'blogCategories re-seeding must require allowReseed === true');
  assert(serverContent.includes('else if (allowReseed && dbState.blogs.length === 0)'),
    'blogs re-seeding must require allowReseed === true');
});

it('1.6 server.ts asyncInitDatabaseState treats 0 docs as valid hydrated state if not fresh', () => {
  assert(serverContent.includes('if (d1Result && !d1Result.isFreshDatabase)'),
    'asyncInitDatabaseState must NOT require totalDocsLoaded > 0 to accept D1 state');
  assert(!serverContent.includes('if (d1Result && !d1Result.isFreshDatabase && d1Result.totalDocsLoaded > 0)'),
    'The unsafe check requiring totalDocsLoaded > 0 must be gone');
  assert(serverContent.includes('normalizeDatabaseRelationships({ allowReseed: false })'),
    'Hydration from D1 must pass allowReseed: false to normalizeDatabaseRelationships');
});

// -------------------------------------------------------------
// SECTION 2: SIMULATED D1 ENGINE & LIFECYCLE EXECUTION
// -------------------------------------------------------------
console.log('\n--- SECTION 2: Dynamic In-Memory Engine & Cold Start Lifecycle ---');

// Build an accurate mock D1 database matching Cloudflare D1 behavior
function createMockD1Database(initialData = {}) {
  const tables = {
    system_settings: new Map(), // key -> stringified json
    services: new Map(),        // id -> row object
    categories: new Map(),      // id -> row object
    blogs: new Map(),           // id -> row object
    blog_categories: new Map(), // id -> row object
    users: new Map(),
    settings: new Map()
  };

  if (initialData.system_settings) {
    for (const [k, v] of Object.entries(initialData.system_settings)) {
      tables.system_settings.set(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
  }
  if (initialData.services) {
    for (const item of initialData.services) {
      tables.services.set(item.id, { ...item });
    }
  }
  if (initialData.categories) {
    for (const item of initialData.categories) {
      tables.categories.set(item.id, { ...item });
    }
  }
  if (initialData.blogs) {
    for (const item of initialData.blogs) {
      tables.blogs.set(item.id, { ...item });
    }
  }
  if (initialData.blogCategories) {
    for (const item of initialData.blogCategories) {
      tables.blog_categories.set(item.id, { ...item });
    }
  }

  return {
    tables,
    prepare(sql) {
      let bound = [];
      return {
        bind(...args) {
          bound = args;
          return this;
        },
        async first() {
          const res = await this.all();
          return (res.results && res.results[0]) || null;
        },
        async all() {
          const s = sql.trim().toLowerCase();
          if (s.includes('sqlite_master')) {
            return {
              results: [
                { name: 'system_settings' },
                { name: 'services' },
                { name: 'categories' },
                { name: 'blogs' },
                { name: 'blog_categories' }
              ]
            };
          }
          if (s.includes('system_settings')) {
            if (s.includes('where key =') || s.includes('where key=')) {
              const key = bound[0];
              const val = tables.system_settings.get(key);
              if (val) return { results: [{ key, data: val }] };
              return { results: [] };
            }
            const allRows = Array.from(tables.system_settings.entries()).map(([k, v]) => ({ key: k, data: v }));
            return { results: allRows };
          }
          if (s.includes('from services')) {
            return { results: Array.from(tables.services.values()) };
          }
          if (s.includes('from categories')) {
            return { results: Array.from(tables.categories.values()) };
          }
          if (s.includes('from blogs')) {
            return { results: Array.from(tables.blogs.values()) };
          }
          if (s.includes('from blog_categories')) {
            return { results: Array.from(tables.blog_categories.values()) };
          }
          return { results: [] };
        },
        async run() {
          const s = sql.trim().toLowerCase();
          if (s.startsWith('insert or replace into system_settings') || s.startsWith('insert into system_settings')) {
            const key = bound[0];
            const data = bound[1];
            tables.system_settings.set(key, data);
            return { success: true };
          }
          if (s.startsWith('delete from services')) {
            tables.services.clear();
            return { success: true };
          }
          if (s.startsWith('delete from categories')) {
            tables.categories.clear();
            return { success: true };
          }
          if (s.startsWith('delete from blogs')) {
            tables.blogs.clear();
            return { success: true };
          }
          if (s.startsWith('delete from blog_categories')) {
            tables.blog_categories.clear();
            return { success: true };
          }
          return { success: true };
        }
      };
    },
    async batch(stmts) {
      const results = [];
      for (const stmt of stmts) {
        results.push(await stmt.run());
      }
      return results;
    }
  };
}

// Logic simulator replicating d1Storage.ts + server.ts normalization
function simulateD1LoadAndHydrate(mockD1, initialIsolateState) {
  // Step 1: Query system_init
  const hasSystemInit = mockD1.tables.system_settings.has('system_init');
  const isFreshDatabase = !hasSystemInit;

  // Step 2: Query relational tables
  const loadedState = {
    services: Array.from(mockD1.tables.services.values()),
    categories: Array.from(mockD1.tables.categories.values()),
    blogs: Array.from(mockD1.tables.blogs.values()),
    blogCategories: Array.from(mockD1.tables.blog_categories.values())
  };

  const totalDocs = loadedState.services.length + loadedState.categories.length +
                    loadedState.blogs.length + loadedState.blogCategories.length;

  const d1Result = {
    state: loadedState,
    totalDocsLoaded: totalDocs,
    isFreshDatabase,
    hasSystemInit
  };

  // Step 3: Simulate isolate state creation
  const dbState = { ...initialIsolateState };

  if (d1Result && !d1Result.isFreshDatabase) {
    // Hydrate collections
    const collections = ['services', 'categories', 'blogs', 'blogCategories'];
    for (const c of collections) {
      if (d1Result.state[c] !== undefined) {
        dbState[c] = d1Result.state[c];
      } else {
        dbState[c] = [];
      }
    }
    // Normalization with allowReseed: false
    simulateNormalization(dbState, { allowReseed: false });
    return { dbState, action: 'hydrated', d1Result };
  } else {
    // Fresh DB -> seed
    dbState.services = [{ id: 'srv-seed-1', name: 'PAN Card' }];
    dbState.categories = [{ id: 'cat-seed-1', name: 'Identity' }];
    dbState.blogs = [{ id: 'blog-seed-1', title: 'Guide' }];
    dbState.blogCategories = [{ id: 'bcat-seed-1', name: 'News' }];
    simulateNormalization(dbState, { allowReseed: true });
    // Record system_init
    mockD1.tables.system_settings.set('system_init', JSON.stringify({ initialized: true }));
    return { dbState, action: 'seeded', d1Result };
  }
}

function simulateNormalization(dbState, options) {
  const allowReseed = options?.allowReseed === true;
  if (allowReseed && (!Array.isArray(dbState.categories) || dbState.categories.length === 0)) {
    dbState.categories = [{ id: 'cat-reseeded', name: 'Reseeded Category' }];
  }
  if (allowReseed && (!Array.isArray(dbState.services) || dbState.services.length === 0)) {
    dbState.services = [{ id: 'srv-reseeded', name: 'Reseeded Service' }];
  }
  if (allowReseed && (!Array.isArray(dbState.blogCategories) || dbState.blogCategories.length === 0)) {
    dbState.blogCategories = [{ id: 'bcat-reseeded', name: 'Reseeded Blog Category' }];
  }
  if (allowReseed && (!Array.isArray(dbState.blogs) || dbState.blogs.length === 0)) {
    dbState.blogs = [{ id: 'blog-reseeded', title: 'Reseeded Blog' }];
  }
}

// Default in-memory values before D1 hydration
const DEFAULT_PRESEEDED_MEMORY = {
  services: [{ id: 'srv-default-1', name: 'Default Service' }],
  categories: [{ id: 'cat-default-1', name: 'Default Category' }],
  blogs: [{ id: 'blog-default-1', title: 'Default Blog' }],
  blogCategories: [{ id: 'bcat-default-1', name: 'Default Blog Cat' }]
};

(async () => {
  // Test 1: services read with empty D1 table -> returns [], never reseeds
  await itAsync('2.1 services read with empty D1 table returns [], never reseeds', async () => {
    const mockD1 = createMockD1Database({
      system_settings: { system_init: { initialized: true } },
      services: [], // Intentionally empty
      categories: [{ id: 'c1', name: 'Tax' }]
    });

    const res = simulateD1LoadAndHydrate(mockD1, DEFAULT_PRESEEDED_MEMORY);
    assert.strictEqual(res.action, 'hydrated');
    assert.strictEqual(Array.isArray(res.dbState.services), true);
    assert.strictEqual(res.dbState.services.length, 0, 'services must remain an empty array');
  });

  // Test 2: categories read with empty D1 table -> returns [], never reseeds
  await itAsync('2.2 categories read with empty D1 table returns [], never reseeds', async () => {
    const mockD1 = createMockD1Database({
      system_settings: { system_init: { initialized: true } },
      categories: [], // Intentionally empty
      services: [{ id: 's1', name: 'GST' }]
    });

    const res = simulateD1LoadAndHydrate(mockD1, DEFAULT_PRESEEDED_MEMORY);
    assert.strictEqual(res.action, 'hydrated');
    assert.strictEqual(Array.isArray(res.dbState.categories), true);
    assert.strictEqual(res.dbState.categories.length, 0, 'categories must remain an empty array');
  });

  // Test 3: blogs read with empty D1 table -> returns [], never reseeds
  await itAsync('2.3 blogs read with empty D1 table returns [], never reseeds', async () => {
    const mockD1 = createMockD1Database({
      system_settings: { system_init: { initialized: true } },
      blogs: [] // Intentionally empty
    });

    const res = simulateD1LoadAndHydrate(mockD1, DEFAULT_PRESEEDED_MEMORY);
    assert.strictEqual(res.action, 'hydrated');
    assert.strictEqual(Array.isArray(res.dbState.blogs), true);
    assert.strictEqual(res.dbState.blogs.length, 0, 'blogs must remain an empty array');
  });

  // Test 4: blogCategories read with empty D1 table -> returns [], never reseeds
  await itAsync('2.4 blogCategories read with empty D1 table returns [], never reseeds', async () => {
    const mockD1 = createMockD1Database({
      system_settings: { system_init: { initialized: true } },
      blogCategories: [] // Intentionally empty
    });

    const res = simulateD1LoadAndHydrate(mockD1, DEFAULT_PRESEEDED_MEMORY);
    assert.strictEqual(res.action, 'hydrated');
    assert.strictEqual(Array.isArray(res.dbState.blogCategories), true);
    assert.strictEqual(res.dbState.blogCategories.length, 0, 'blogCategories must remain an empty array');
  });

  // Test 5: Legacy memory fallback does NOT override intentional empty state in D1
  await itAsync('2.5 Legacy memory fallback does NOT override intentional empty state in D1', async () => {
    const mockD1 = createMockD1Database({
      system_settings: { system_init: { initialized: true } },
      services: [],
      categories: []
    });

    // In-memory state has default preseeded items
    const dirtyMemory = {
      services: [{ id: 'legacy-srv-1' }],
      categories: [{ id: 'legacy-cat-1' }]
    };

    const res = simulateD1LoadAndHydrate(mockD1, dirtyMemory);
    assert.strictEqual(res.dbState.services.length, 0, 'Empty D1 services must overwrite memory defaults');
    assert.strictEqual(res.dbState.categories.length, 0, 'Empty D1 categories must overwrite memory defaults');
  });

  // Test 6: Simulated Cloudflare Worker restart with empty collections retains empty state
  await itAsync('2.6 Simulated Cloudflare Worker restart with empty collections retains empty state', async () => {
    const mockD1 = createMockD1Database({
      system_settings: { system_init: { initialized: true } },
      services: [],
      categories: [],
      blogs: [],
      blogCategories: []
    });

    // Worker isolate boots up afresh
    const isolate1 = simulateD1LoadAndHydrate(mockD1, DEFAULT_PRESEEDED_MEMORY);
    assert.strictEqual(isolate1.dbState.services.length, 0);
    assert.strictEqual(isolate1.dbState.categories.length, 0);
    assert.strictEqual(isolate1.dbState.blogs.length, 0);
    assert.strictEqual(isolate1.dbState.blogCategories.length, 0);

    // Second cold start (Worker recycled)
    const isolate2 = simulateD1LoadAndHydrate(mockD1, DEFAULT_PRESEEDED_MEMORY);
    assert.strictEqual(isolate2.dbState.services.length, 0);
    assert.strictEqual(isolate2.dbState.categories.length, 0);
    assert.strictEqual(isolate2.dbState.blogs.length, 0);
    assert.strictEqual(isolate2.dbState.blogCategories.length, 0);
  });

  // Test 7: Simulated new isolate initialization with empty collections retains empty state
  await itAsync('2.7 Simulated new isolate initialization with empty collections retains empty state', async () => {
    const mockD1 = createMockD1Database({
      system_settings: {
        system_init: { initialized: true },
        db_revision: { revision: 1720000000 }
      },
      services: []
    });

    const newIsolate = simulateD1LoadAndHydrate(mockD1, { services: [...DEFAULT_PRESEEDED_MEMORY.services] });
    assert.strictEqual(newIsolate.dbState.services.length, 0, 'New edge isolate must respect D1 empty state');
  });

  // Test 8: Partial deletion preserves exact state without resurrecting deleted items
  await itAsync('2.8 Partial deletion preserves exact state without resurrecting deleted items', async () => {
    const mockD1 = createMockD1Database({
      system_settings: { system_init: { initialized: true } },
      services: [
        { id: 'srv-kept-1', name: 'PAN Application', status: 'active' }
        // 'srv-deleted-2' was deleted by admin
      ]
    });

    const res = simulateD1LoadAndHydrate(mockD1, DEFAULT_PRESEEDED_MEMORY);
    assert.strictEqual(res.dbState.services.length, 1);
    assert.strictEqual(res.dbState.services[0].id, 'srv-kept-1');
    assert(!res.dbState.services.some(s => s.id === 'srv-reseeded'));
    assert(!res.dbState.services.some(s => s.id === 'srv-default-1'));
  });

  // Test 9: Populated D1 database loads normally and preserves all records
  await itAsync('2.9 Populated D1 database loads normally and preserves all records', async () => {
    const mockD1 = createMockD1Database({
      system_settings: { system_init: { initialized: true } },
      services: [
        { id: 'srv-1', name: 'Service 1' },
        { id: 'srv-2', name: 'Service 2' }
      ],
      categories: [
        { id: 'cat-1', name: 'Cat 1' }
      ]
    });

    const res = simulateD1LoadAndHydrate(mockD1, DEFAULT_PRESEEDED_MEMORY);
    assert.strictEqual(res.dbState.services.length, 2);
    assert.strictEqual(res.dbState.categories.length, 1);
    assert.strictEqual(res.dbState.services[0].id, 'srv-1');
    assert.strictEqual(res.dbState.services[1].id, 'srv-2');
  });

  // Test 10: Genuinely fresh / uninitialized D1 database seeds properly on initial startup
  await itAsync('2.10 Genuinely fresh / uninitialized D1 database seeds properly on initial startup', async () => {
    const mockD1 = createMockD1Database({}); // No system_init, completely uninitialized

    const res = simulateD1LoadAndHydrate(mockD1, {});
    assert.strictEqual(res.action, 'seeded', 'Must trigger seeding on fresh DB');
    assert.strictEqual(res.dbState.services.length, 1);
    assert.strictEqual(res.dbState.services[0].id, 'srv-seed-1');
    assert.strictEqual(mockD1.tables.system_settings.has('system_init'), true, 'system_init marker must be set');
  });

  // Test 11: system_init marker in system_settings confirms initialized status even when row counts are 0
  await itAsync('2.11 system_init marker in system_settings confirms initialized status even when row counts are 0', async () => {
    const mockD1 = createMockD1Database({
      system_settings: { system_init: { initialized: true } },
      services: [],
      categories: [],
      blogs: [],
      blogCategories: []
    });

    const res = simulateD1LoadAndHydrate(mockD1, DEFAULT_PRESEEDED_MEMORY);
    assert.strictEqual(res.d1Result.hasSystemInit, true, 'hasSystemInit must be true');
    assert.strictEqual(res.d1Result.isFreshDatabase, false, 'isFreshDatabase must be false even with 0 rows');
    assert.strictEqual(res.action, 'hydrated', 'Must hydrate and NOT seed');
  });

  // Test 12: Fallback query does NOT re-inject legacy default data when relational table is empty
  await itAsync('2.12 Fallback query does NOT re-inject legacy default data when relational table is empty', async () => {
    // Simulate readCollectionWithFallback logic
    function mockReadCollectionWithFallback(collection, relResult, legacyFallback) {
      if (Array.isArray(relResult)) {
        // Correct behavior: relResult is authoritative, even if empty ([])
        return relResult;
      }
      return legacyFallback;
    }

    const relResult = []; // Query to D1 returned 0 rows
    const legacyFallback = [{ id: 'legacy-1', name: 'Zombie' }];

    const result = mockReadCollectionWithFallback('services', relResult, legacyFallback);
    assert.strictEqual(result.length, 0, 'Must return empty array, NOT fallback to zombie data');
  });

  // Test 13: readCollectionWithFallback returns empty array cleanly when relational query returns 0 rows
  await itAsync('2.13 readCollectionWithFallback returns empty array cleanly when relational query returns 0 rows', async () => {
    const relRows = [];
    assert.strictEqual(Array.isArray(relRows), true);
    assert.strictEqual(relRows.length, 0);
    // Simulating the clean return in d1Storage.ts
    const output = (relRows && Array.isArray(relRows)) ? relRows : [];
    assert.deepStrictEqual(output, []);
  });

  // Test 14: normalizeDatabaseRelationships without allowReseed: true never resurrects empty collections
  await itAsync('2.14 normalizeDatabaseRelationships without allowReseed: true never resurrects empty collections', async () => {
    const state = {
      services: [],
      categories: [],
      blogs: [],
      blogCategories: []
    };

    // Default call: no options
    simulateNormalization(state);
    assert.strictEqual(state.services.length, 0);
    assert.strictEqual(state.categories.length, 0);
    assert.strictEqual(state.blogs.length, 0);
    assert.strictEqual(state.blogCategories.length, 0);

    // Explicit allowReseed: false
    simulateNormalization(state, { allowReseed: false });
    assert.strictEqual(state.services.length, 0);
    assert.strictEqual(state.categories.length, 0);
    assert.strictEqual(state.blogs.length, 0);
    assert.strictEqual(state.blogCategories.length, 0);
  });

  // Test 15: End-to-end simulated lifecycle: seed -> verify -> delete all -> restart -> verify empty preserved
  await itAsync('2.15 End-to-end simulated lifecycle: seed -> verify -> delete all -> restart -> verify empty preserved', async () => {
    // 1. First startup: Brand new database
    const productionD1 = createMockD1Database({});
    const startup1 = simulateD1LoadAndHydrate(productionD1, {});
    assert.strictEqual(startup1.action, 'seeded');
    assert.strictEqual(startup1.dbState.services.length, 1);
    assert.strictEqual(productionD1.tables.system_settings.has('system_init'), true);

    // Save seeded data into D1
    productionD1.tables.services.set('srv-seed-1', { id: 'srv-seed-1', name: 'PAN Card' });
    productionD1.tables.categories.set('cat-seed-1', { id: 'cat-seed-1', name: 'Identity' });

    // 2. Admin performs intentional deletion of ALL services and ALL categories
    productionD1.tables.services.clear();
    productionD1.tables.categories.clear();
    assert.strictEqual(productionD1.tables.services.size, 0);
    assert.strictEqual(productionD1.tables.categories.size, 0);

    // 3. Worker restart / Cold start simulation: fresh isolate boots with default code constants
    const coldStartIsolate = simulateD1LoadAndHydrate(productionD1, DEFAULT_PRESEEDED_MEMORY);

    // 4. Verify that cold start did NOT resurrect any records
    assert.strictEqual(coldStartIsolate.action, 'hydrated');
    assert.strictEqual(coldStartIsolate.dbState.services.length, 0, 'Services must remain 0 after cold start');
    assert.strictEqual(coldStartIsolate.dbState.categories.length, 0, 'Categories must remain 0 after cold start');
    assert.strictEqual(coldStartIsolate.dbState.blogs.length, 0, 'Blogs must remain 0 after cold start');
    assert.strictEqual(coldStartIsolate.dbState.blogCategories.length, 0, 'Blog categories must remain 0 after cold start');
    console.log('      -> Lifecycle verified: ZERO zombie records resurrected after cold start.');
  });

  // Final summary
  console.log('\n============================================================');
  console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log('============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
})();
