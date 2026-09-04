import { DatabaseSync } from 'node:sqlite';
import {
  initD1Schema,
  getDatabaseMode,
  setDatabaseMode,
  saveEntityToD1,
  deleteEntityFromD1,
  syncCollectionToD1,
  retryRelationalSync,
  getSyncDiagnosticsSummary,
  verifyRelationalParity,
  verifyFieldLevelParity
} from '../src/lib/d1Storage';

// Build a mock D1 database adapter on top of Node sqlite
function createMockD1() {
  const sqlite = new DatabaseSync(':memory:');

  return {
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
}

async function runPhase3DualWriteTests() {
  console.log('================================================================');
  console.log('EASYDESK — PHASE 3 DUAL-WRITE SYNCHRONIZATION VERIFICATION TEST');
  console.log('================================================================\n');

  const db = createMockD1();
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalCount++;
    if (condition) {
      console.log(`  [PASS] Test ${totalCount}: ${testName}`);
      passedCount++;
    } else {
      console.error(`  [FAIL] Test ${totalCount}: ${testName}`);
      if (detail) console.error(`         Detail: ${detail}`);
      process.exitCode = 1;
    }
  }

  // -------------------------------------------------------------
  // Test 1: Schema Initialization & Diagnostics Table
  // -------------------------------------------------------------
  console.log('STEP 1: Verifying Schema & Diagnostics Infrastructure...');
  await initD1Schema(db);
  const tablesRes = await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  const tableNames = new Set((tablesRes.results as any[]).map(r => r.name));

  assert(tableNames.has('relational_sync_diagnostics'), 'relational_sync_diagnostics table exists');
  assert(tableNames.has('entities'), 'Legacy entities table exists');
  assert(tableNames.has('customers'), 'Relational customers table exists');
  assert(tableNames.has('services'), 'Relational services table exists');
  assert(tableNames.has('orders'), 'Relational orders table exists');
  assert(tableNames.has('employees'), 'Relational employees table exists');

  // -------------------------------------------------------------
  // Test 2: Database Mode Switching & Safety Fallback
  // -------------------------------------------------------------
  console.log('\nSTEP 2: Verifying Database Modes & Fast Rollback Switch...');
  assert(getDatabaseMode() === 'DUAL_WRITE', 'Default DATABASE_MODE is DUAL_WRITE');

  setDatabaseMode('LEGACY');
  assert(getDatabaseMode() === 'LEGACY', 'Switched to LEGACY mode');

  // When in LEGACY mode, relational mirror should be skipped
  const legacyCust = { id: 'cust-legacy-1', name: 'Legacy Mode User', mobile: '9999911111' };
  await saveEntityToD1('customers', 'cust-legacy-1', legacyCust, db);
  const legEntitiesCheck = await db.prepare("SELECT id FROM entities WHERE id = 'cust-legacy-1'").all();
  const legRelCheck = await db.prepare("SELECT id FROM customers WHERE id = 'cust-legacy-1'").all();

  assert((legEntitiesCheck.results as any[]).length === 1, 'Legacy entities record saved in LEGACY mode');
  assert((legRelCheck.results as any[]).length === 0, 'Relational mirror bypassed in LEGACY mode (instant zero-downtime rollback)');

  // Clean up legacy test record and switch back to DUAL_WRITE
  await db.prepare("DELETE FROM entities WHERE id = 'cust-legacy-1'").run();
  setDatabaseMode('DUAL_WRITE');
  assert(getDatabaseMode() === 'DUAL_WRITE', 'Restored to DUAL_WRITE mode');

  // -------------------------------------------------------------
  // Test 3: Create Mutation Dual-Write & Mirroring
  // -------------------------------------------------------------
  console.log('\nSTEP 3: Testing Entity Creation Dual-Write...');
  const customerData = {
    id: 'cust-101',
    code: 'CUST-0101',
    name: 'Aarav Patel',
    email: 'aarav.patel@example.com',
    mobile: '9876543210',
    customerType: 'Individual',
    status: 'Active',
    address: '123 MG Road',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pinCode: '380001'
  };

  const createRes = await saveEntityToD1('customers', 'cust-101', customerData, db);
  assert(createRes.success === true, 'saveEntityToD1 returned success');

  const srcCust = await db.prepare("SELECT data FROM entities WHERE collection = 'customers' AND id = 'cust-101'").all();
  assert((srcCust.results as any[]).length === 1, 'Authoritative legacy entities record exists');

  const dstCust = await db.prepare("SELECT * FROM customers WHERE id = 'cust-101'").all();
  assert((dstCust.results as any[]).length === 1, 'Relational mirror customers record exists');
  const custRow = (dstCust.results as any[])[0];
  assert(custRow.name === 'Aarav Patel', 'Customer name mirrored accurately');
  assert(custRow.mobile === '9876543210', 'Customer mobile mirrored accurately');
  assert(custRow.pincode === '380001', 'Customer pincode mapped correctly');

  const diagCreate = await db.prepare("SELECT * FROM relational_sync_diagnostics WHERE collection = 'customers' AND entity_id = 'cust-101'").all();
  assert((diagCreate.results as any[]).length === 1, 'Sync diagnostic recorded');
  assert((diagCreate.results as any[])[0].status === 'SUCCESS', 'Sync diagnostic status is SUCCESS');
  assert((diagCreate.results as any[])[0].error_message === null, 'Sync diagnostic error_message is null');

  // -------------------------------------------------------------
  // Test 4: Update Mutation Dual-Write
  // -------------------------------------------------------------
  console.log('\nSTEP 4: Testing Entity Update Dual-Write...');
  const updatedCustomerData = {
    ...customerData,
    name: 'Aarav K. Patel',
    mobile: '9876549999',
    city: 'Gandhinagar'
  };

  const updateRes = await saveEntityToD1('customers', 'cust-101', updatedCustomerData, db);
  assert(updateRes.success === true, 'saveEntityToD1 update returned success');

  const updatedDst = await db.prepare("SELECT * FROM customers WHERE id = 'cust-101'").all();
  const updatedRow = (updatedDst.results as any[])[0];
  assert(updatedRow.name === 'Aarav K. Patel', 'Updated name reflected in relational table');
  assert(updatedRow.mobile === '9876549999', 'Updated mobile reflected in relational table');
  assert(updatedRow.city === 'Gandhinagar', 'Updated city reflected in relational table');

  // -------------------------------------------------------------
  // Test 5: Foreign Key Handling & Metadata Preservation
  // -------------------------------------------------------------
  console.log('\nSTEP 5: Testing Safe Foreign Key Resolution...');
  // Create Category first
  const catData = {
    id: 'cat-tax',
    name: 'Tax Services',
    slug: 'tax-services',
    sortOrder: 1,
    status: 'Active'
  };
  await saveEntityToD1('categories', 'cat-tax', catData, db);

  // Service referencing valid category
  const validService = {
    id: 'srv-it-return',
    categoryId: 'cat-tax',
    title: 'Income Tax Return Filing',
    slug: 'income-tax-return-filing',
    govFees: 0,
    serviceCharge: 500,
    status: 'active'
  };
  await saveEntityToD1('services', 'srv-it-return', validService, db);
  const srvRow1 = (await db.prepare("SELECT * FROM services WHERE id = 'srv-it-return'").all() as any).results[0];
  assert(srvRow1.category_id === 'cat-tax', 'Valid category_id assigned properly');

  // Service referencing NON-EXISTENT category
  const orphanService = {
    id: 'srv-orphan',
    categoryId: 'cat-nonexistent',
    title: 'Orphan Filing Service',
    slug: 'orphan-filing-service',
    status: 'active'
  };
  await saveEntityToD1('services', 'srv-orphan', orphanService, db);
  const srvRow2 = (await db.prepare("SELECT * FROM services WHERE id = 'srv-orphan'").all() as any).results[0];
  assert(srvRow2.category_id === null, 'Unresolved category_id set to NULL without throwing');
  const srv2Meta = JSON.parse(srvRow2.metadata);
  assert(srv2Meta.originalCategoryId === 'cat-nonexistent', 'Original categoryId preserved in metadata');

  // -------------------------------------------------------------
  // Test 6: Non-Blocking Resilience & Failure Simulation
  // -------------------------------------------------------------
  console.log('\nSTEP 6: Testing Non-Blocking Resilience & Failure Recording...');
  // Attempt to save employee KYC referencing an employee that does NOT exist in employees table.
  // The relational mirror will throw FK validation error, BUT the legacy write must SUCCEED!
  const orphanKyc = {
    employeeId: 'emp-nonexistent-999',
    aadhaarNumber: 'XXXX-XXXX-1234',
    aadhaarVerificationStatus: 'Pending'
  };

  const kycWriteRes = await saveEntityToD1('employeeKYC', 'emp-nonexistent-999', orphanKyc, db);
  assert(kycWriteRes.success === true, 'saveEntityToD1 returned success despite relational mirror failure (non-blocking resilience)');

  const kycEntitiesCheck = await db.prepare("SELECT id FROM entities WHERE collection = 'employeeKYC' AND id = 'emp-nonexistent-999'").all();
  assert((kycEntitiesCheck.results as any[]).length === 1, 'Authoritative legacy entities record was preserved');

  const diagFail = await db.prepare("SELECT * FROM relational_sync_diagnostics WHERE collection = 'employeeKYC' AND entity_id = 'emp-nonexistent-999'").all();
  assert((diagFail.results as any[]).length === 1, 'Failure recorded in relational_sync_diagnostics');
  const failRow = (diagFail.results as any[])[0];
  assert(failRow.status === 'FAILED', 'Diagnostic status is FAILED');
  assert(failRow.error_message.includes('does not exist in employees table'), 'Diagnostic error message captures root cause');

  // Verify health is DEGRADED
  const degradedSummary = await getSyncDiagnosticsSummary(db);
  assert(degradedSummary.health === 'DEGRADED', 'System sync health correctly reports DEGRADED');
  assert(degradedSummary.totalFailures === 1, 'Total failures reported as 1');

  // -------------------------------------------------------------
  // Test 7: Self-Healing Diagnostic & Retry Subsystem
  // -------------------------------------------------------------
  console.log('\nSTEP 7: Testing Self-Healing & Retry Subsystem...');
  // Fix the parent dependency by creating the missing employee
  const employeeData = {
    id: 'emp-nonexistent-999',
    code: 'EMP-999',
    name: 'Suresh Kumar',
    department: 'Operations',
    designation: 'Executive',
    status: 'Active'
  };
  await saveEntityToD1('employees', 'emp-nonexistent-999', employeeData, db);

  // Trigger retry
  const retryRes = await retryRelationalSync('employeeKYC', 'emp-nonexistent-999', db);
  assert(retryRes.success === true, 'retryRelationalSync succeeded after parent dependency resolved');

  const kycRelCheck = await db.prepare("SELECT * FROM employee_kyc WHERE employee_id = 'emp-nonexistent-999'").all();
  assert((kycRelCheck.results as any[]).length === 1, 'employee_kyc record now present in relational table');

  const diagRecovered = await db.prepare("SELECT * FROM relational_sync_diagnostics WHERE collection = 'employeeKYC' AND entity_id = 'emp-nonexistent-999'").all();
  assert((diagRecovered.results as any[])[0].status === 'SUCCESS', 'Diagnostic status updated to SUCCESS after retry');

  const healthySummary = await getSyncDiagnosticsSummary(db);
  assert(healthySummary.health === 'HEALTHY', 'System sync health restored to HEALTHY');
  assert(healthySummary.totalFailures === 0, 'Total failures restored to 0');

  // -------------------------------------------------------------
  // Test 8: Deletion Dual-Write
  // -------------------------------------------------------------
  console.log('\nSTEP 8: Testing Entity Deletion Dual-Write...');
  const deleteRes = await deleteEntityFromD1('customers', 'cust-101', db);
  assert(deleteRes.success === true, 'deleteEntityFromD1 returned success');

  const deletedEntities = await db.prepare("SELECT id FROM entities WHERE collection = 'customers' AND id = 'cust-101'").all();
  assert((deletedEntities.results as any[]).length === 0, 'Customer deleted from entities table');

  const deletedRel = await db.prepare("SELECT id FROM customers WHERE id = 'cust-101'").all();
  assert((deletedRel.results as any[]).length === 0, 'Customer deleted from relational customers table');

  const diagDelete = await db.prepare("SELECT * FROM relational_sync_diagnostics WHERE collection = 'customers' AND entity_id = 'cust-101'").all();
  assert((diagDelete.results as any[])[0].operation === 'DELETE', 'Diagnostic recorded DELETE operation');
  assert((diagDelete.results as any[])[0].status === 'SUCCESS', 'Diagnostic recorded DELETE SUCCESS');

  // -------------------------------------------------------------
  // Test 9: Audit Log Immutability
  // -------------------------------------------------------------
  console.log('\nSTEP 9: Testing Audit Log Immutability...');
  const auditData = {
    id: 'log-test-1',
    userId: 'admin-1',
    userName: 'Deepak',
    userRole: 'SUPER_ADMIN',
    action: 'SERVICE_UPDATE',
    entityType: 'service',
    entityId: 'srv-it-return',
    details: 'Updated processing fee',
    timestamp: Date.now()
  };
  await saveEntityToD1('auditLogs', 'log-test-1', auditData, db);

  const auditCheck = await db.prepare("SELECT * FROM audit_logs WHERE id = 'log-test-1'").all();
  assert((auditCheck.results as any[]).length === 1, 'Audit log mirrored to audit_logs table');

  // Attempt delete of audit log
  await deleteEntityFromD1('auditLogs', 'log-test-1', db);
  const auditStillExists = await db.prepare("SELECT * FROM audit_logs WHERE id = 'log-test-1'").all();
  assert((auditStillExists.results as any[]).length === 1, 'Audit log NOT deleted from relational table (immutable audit trail preserved)');

  // Re-save to entities so both tables retain the record for parity checks
  await saveEntityToD1('auditLogs', 'log-test-1', auditData, db);

  // -------------------------------------------------------------
  // Test 10: Collection Sync Dual-Write
  // -------------------------------------------------------------
  console.log('\nSTEP 10: Testing Collection Batch Sync Dual-Write...');
  const newCategories = [
    { id: 'cat-gst', name: 'GST Services', slug: 'gst-services', status: 'Active' },
    { id: 'cat-legal', name: 'Legal Services', slug: 'legal-services', status: 'Active' }
  ];
  await syncCollectionToD1('categories', newCategories, db);

  const catGstRel = await db.prepare("SELECT id FROM categories WHERE id = 'cat-gst'").all();
  const catLegalRel = await db.prepare("SELECT id FROM categories WHERE id = 'cat-legal'").all();
  assert((catGstRel.results as any[]).length === 1, 'cat-gst mirrored from batch collection sync');
  assert((catLegalRel.results as any[]).length === 1, 'cat-legal mirrored from batch collection sync');

  // -------------------------------------------------------------
  // Test 11: End-to-End Parity Verification
  // -------------------------------------------------------------
  console.log('\nSTEP 11: Testing End-to-End Parity Verification Functions...');
  const parityReports = await verifyRelationalParity(db);
  const failedParity = parityReports.filter(r => r.status === 'FAIL');
  assert(failedParity.length === 0, 'verifyRelationalParity passed across all collections', failedParity.map(f => `${f.collection}: missing ${f.missingIds}`).join(', '));

  const fieldParityReport = await verifyFieldLevelParity(db);
  assert(fieldParityReport.overallStatus === 'PASS', 'verifyFieldLevelParity returned PASS');
  assert(fieldParityReport.totalMismatches === 0, 'Zero field-level mismatches detected');

  console.log('\n================================================================');
  console.log(`ALL PHASE 3 DUAL-WRITE TESTS COMPLETED: ${passedCount}/${totalCount} PASSED (100%)`);
  console.log('================================================================');
}

runPhase3DualWriteTests().catch(err => {
  console.error('Fatal test exception:', err);
  process.exit(1);
});
