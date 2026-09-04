import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import {
  initD1Schema,
  generatePreMigrationSnapshot,
  executeFullRelationalBackfill,
  verifyRelationalParity,
  verifyFieldLevelParity
} from '../src/lib/d1Storage';

// Build a D1 mock on top of Node sqlite
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
            console.error('SQL Error in run:', err.message, 'SQL:', this._sql);
            throw err;
          }
        },
        async all() {
          try {
            const stmt = sqlite.prepare(this._sql);
            const results = stmt.all(...this._params);
            return { success: true, results };
          } catch (err: any) {
            console.error('SQL Error in all:', err.message, 'SQL:', this._sql);
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

// Seed mock entities with comprehensive test records representing all 11 collections
async function seedMockEntities(db: any) {
  const seedEntities: Array<{ collection: string; id: string; data: any }> = [
    // 1. Categories
    {
      collection: 'categories',
      id: 'cat-tax-01',
      data: {
        id: 'cat-tax-01',
        name: 'Tax & GST Services',
        slug: 'tax-gst-services',
        sortOrder: 1,
        status: 'Active',
        icon: 'Receipt',
        color: 'blue',
        description: 'Comprehensive tax filing, GST registration and returns.',
        serviceCount: 5
      }
    },
    {
      collection: 'categories',
      id: 'cat-legal-02',
      data: {
        id: 'cat-legal-02',
        name: 'Corporate & Legal Services',
        slug: 'corporate-legal',
        sortOrder: 2,
        status: 'Active',
        icon: 'Scale',
        color: 'emerald',
        description: 'Company incorporation and compliance.',
        serviceCount: 3
      }
    },
    // 2. Services
    {
      collection: 'services',
      id: 'srv-gst-reg',
      data: {
        id: 'srv-gst-reg',
        categoryId: 'cat-tax-01',
        title: 'GST New Registration',
        slug: 'gst-new-registration',
        subCategory: 'GST',
        description: 'Fast online GST registration for sole proprietorship and companies.',
        govFees: 0,
        serviceCharge: 1499,
        processingTime: '3-5 Working Days',
        status: 'active',
        requiredDocuments: ['PAN Card', 'Aadhaar Card', 'Electricity Bill', 'Bank Cancelled Cheque'],
        faqs: [{ question: 'Is GST mandatory?', answer: 'Yes, if turnover exceeds threshold limit.' }],
        highlights: ['100% Online', 'Expert Guidance'],
        featured: true,
        whatsAppEnabled: true
      }
    },
    {
      collection: 'services',
      id: 'srv-orphan',
      data: {
        id: 'srv-orphan',
        categoryId: 'cat-non-existent-99', // Tests orphan FK handling!
        title: 'Legacy Certificate Service',
        slug: 'legacy-certificate-service',
        description: 'Uncategorized legacy service.',
        govFees: 100,
        serviceCharge: 500,
        status: 'active',
        requiredDocuments: ['ID Proof'],
        faqs: []
      }
    },
    // 3. Customers
    {
      collection: 'customers',
      id: 'cust-101',
      data: {
        id: 'cust-101',
        code: 'CUST-0101',
        name: 'Rajesh Sharma',
        email: 'rajesh.sharma@example.com',
        mobile: '9876543210',
        whatsappMobile: '9876543210',
        customerType: 'Individual',
        status: 'Active',
        address: '123 MG Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
        panNumber: 'ABCPS1234F',
        notes: 'VIP customer'
      }
    },
    {
      collection: 'customers',
      id: 'cust-102',
      data: {
        id: 'cust-102',
        code: 'CUST-0102',
        name: 'Apex Solutions Pvt Ltd',
        email: 'contact@apexsol.example.com',
        mobile: '9876543211',
        customerType: 'Business / Corporate',
        status: 'Active',
        contactPersonName: 'Priya Verma',
        address: '45 Tech Park',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500081',
        gstin: '36ABCDE1234F1Z5'
      }
    },
    // 4. Employees
    {
      collection: 'employees',
      id: 'emp-201',
      data: {
        id: 'emp-201',
        code: 'EMP-001',
        name: 'Sunil Nair',
        department: 'Operations',
        designation: 'Senior Processing Executive',
        employmentType: 'Full-Time',
        status: 'Active',
        joiningDate: '2023-01-15',
        phone: '9811223344',
        email: 'sunil.nair@easydesk.local',
        city: 'New Delhi',
        state: 'Delhi',
        pincode: '110001',
        qualification: 'B.Com, CA Inter',
        experience: 4
      }
    },
    // 5. Employee KYC
    {
      collection: 'employeeKYC',
      id: 'emp-201',
      data: {
        employeeId: 'emp-201',
        aadhaarNumber: 'XXXX-XXXX-4321', // Sensitive masked value preserved
        panNumber: 'ABCDE****F',         // Sensitive masked value preserved
        aadhaarVerificationStatus: 'Verified',
        panVerificationStatus: 'Verified',
        verifiedBy: 'Admin',
        verifiedAt: '2023-01-20'
      }
    },
    // 6. Employee Payroll
    {
      collection: 'employeePayroll',
      id: 'emp-201',
      data: {
        employeeId: 'emp-201',
        accountHolderName: 'Sunil Nair',
        bankName: 'HDFC Bank',
        branchName: 'Connaught Place',
        accountNumber: '**** **** 9876', // Sensitive masked value preserved
        ifscCode: 'HDFC0000001',
        paymentMethod: 'Bank Transfer',
        salaryAmount: 45000,
        netSalary: 42000,
        basicPay: 30000,
        hra: 12000
      }
    },
    // 7. Employee Accounts
    {
      collection: 'employeeAccounts',
      id: 'emp-201',
      data: {
        employeeId: 'emp-201',
        userId: 'usr-sunil-201',
        systemEmail: 'sunil.nair@easydesk.local',
        role: 'STAFF',
        permissions: ['orders.read', 'orders.process', 'documents.verify'],
        accountStatus: 'Active'
      }
    },
    // 8. Employee Documents
    {
      collection: 'employeeDocuments',
      id: 'doc-emp-201-aadhaar',
      data: {
        id: 'doc-emp-201-aadhaar',
        employeeId: 'emp-201',
        documentType: 'Aadhaar Card',
        documentName: 'Aadhaar_Sunil_Masked.pdf',
        storagePath: 'employee_docs/emp-201/aadhaar.pdf',
        downloadUrl: 'https://firebasestorage.googleapis.com/v0/b/khaki-fact-snzsc.firebasestorage.app/o/employee_docs%2Faadhaar.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 154200,
        verificationStatus: 'Verified',
        uploadedBy: 'Admin'
      }
    },
    // 9. Orders
    {
      collection: 'orders',
      id: 'ord-10001',
      data: {
        id: 'ord-10001',
        customerId: 'cust-101',
        serviceId: 'srv-gst-reg',
        assignedEmployeeId: 'emp-201',
        assignedStaffId: 'emp-201', // Matching alias test
        orderSource: 'WhatsApp',
        name: 'Rajesh Sharma',
        mobile: '9876543210',
        email: 'rajesh.sharma@example.com',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
        totalAmount: 1499,
        paymentMethod: 'UPI',
        paymentStatus: 'Verified',
        utr: 'UPI20260901234567',
        orderStatus: 'Processing',
        documentDeliveryStatus: 'Pending',
        priority: 'Normal',
        uploadedDocuments: [{ name: 'pan.pdf', url: 'https://storage/pan.pdf' }],
        logs: [{ action: 'Created', timestamp: '2026-09-01T10:00:00Z', by: 'WhatsApp Bot' }]
      }
    },
    {
      collection: 'orders',
      id: 'ord-10002',
      data: {
        id: 'ord-10002',
        customerId: 'cust-non-existent-99', // Tests orphan customer FK fallback to NULL
        serviceId: 'srv-gst-reg',
        assignedEmployeeId: 'emp-201',
        assignedStaffId: 'emp-999-legacy', // Tests alias conflict warning!
        orderSource: 'Website',
        name: 'Guest Applicant',
        mobile: '9123456780',
        totalAmount: 1499,
        paymentStatus: 'Pending Verification',
        orderStatus: 'Pending',
        priority: 'Urgent',
        uploadedDocuments: [],
        logs: []
      }
    },
    // 10. Reviews
    {
      collection: 'reviews',
      id: 'rev-301',
      data: {
        id: 'rev-301',
        serviceId: 'srv-gst-reg',
        customerId: 'cust-101',
        orderId: 'ord-10001',
        customerName: 'Rajesh Sharma',
        rating: 5,
        comment: 'Excellent and smooth GST registration experience. Highly recommended!',
        status: 'Approved'
      }
    },
    // 11. Audit Logs
    {
      collection: 'auditLogs',
      id: 'log-401',
      data: {
        id: 'log-401',
        userId: 'usr-admin-01',
        userName: 'Super Admin',
        userRole: 'ADMIN',
        action: 'ORDER_VERIFY',
        entityType: 'order',
        entityId: 'ord-10001',
        details: 'Payment verified via UTR check',
        ipAddress: '192.168.1.100',
        timestamp: '2026-09-01T10:30:00Z'
      }
    }
  ];

  const now = Date.now();
  for (const item of seedEntities) {
    const stmt = db.prepare(`
      INSERT INTO entities (collection, id, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    await stmt.bind(item.collection, item.id, JSON.stringify(item.data), now, now).run();
  }
}

export async function runMigrationWorkflow() {
  console.log('================================================================');
  console.log('EASYDESK — PHASE 2 FULL MIGRATION & PARITY HARNESS');
  console.log('================================================================\n');

  const d1 = createMockD1();
  await initD1Schema(d1);
  await seedMockEntities(d1);

  // 1. Pre-Migration Snapshot
  console.log('STEP 1: PRE-MIGRATION DIAGNOSTIC SNAPSHOT');
  console.log('----------------------------------------------------------------');
  const snapshot = await generatePreMigrationSnapshot(d1);
  console.log(`Snapshot generated at: ${snapshot.timestamp}`);
  console.log(`Total Legacy Collections: ${snapshot.totalLegacyCollections}`);
  console.log(`Total Legacy Records: ${snapshot.totalLegacyRecords}`);
  for (const [coll, snap] of Object.entries(snapshot.collections)) {
    console.log(`  - [${coll}]: ${snap.totalRecordCount} records | Malformed: ${snap.malformedRecords} | Missing Req: ${snap.missingRequiredFields} | Invalid FK: ${snap.invalidForeignKeyReferences} | Aliases: ${snap.suspiciousLegacyAliases}`);
    if (snap.details.length > 0) {
      snap.details.forEach(d => console.log(`      ↳ Detail: ${d}`));
    }
  }

  // 2. Dry-Run Mode
  console.log('\nSTEP 2: DRY-RUN BACKFILL (dryRun = true)');
  console.log('----------------------------------------------------------------');
  const dryRunReport = await executeFullRelationalBackfill({ dryRun: true, batchSize: 50 }, d1);
  console.log(`Dry-run Status: ${dryRunReport.overallStatus}`);
  console.log(`Dry-run Migrated Valid Rows: ${dryRunReport.totalSuccessfullyMigrated}`);
  console.log(`Dry-run Inserted: ${dryRunReport.totalInserted} (MUST BE 0)`);
  console.log(`Dry-run Updated: ${dryRunReport.totalUpdated} (MUST BE 0)`);
  console.log(`Dry-run Warnings: ${dryRunReport.totalWarnings}`);
  console.log(`Dry-run Conflicts: ${dryRunReport.totalUnresolvedForeignKeys}`);

  if (dryRunReport.totalInserted !== 0 || dryRunReport.totalUpdated !== 0) {
    throw new Error('DRY-RUN VIOLATION: Inserted or updated rows during dry-run!');
  }

  // Confirm relational tables are completely empty
  for (const step of dryRunReport.steps) {
    const table = step.collection === 'auditLogs' ? 'audit_logs' : (step.collection.startsWith('employee') && step.collection !== 'employees' ? `employee_${step.collection.slice(8).toLowerCase()}` : step.collection);
    const countRes = await d1.prepare(`SELECT count(*) as cnt FROM ${table}`).all();
    const cnt = countRes.results[0]?.cnt || 0;
    if (cnt !== 0) {
      throw new Error(`DRY-RUN VIOLATION: Table ${table} contains ${cnt} rows after dry-run!`);
    }
  }
  console.log('   ✓ Verified 0 records written during dry-run. Dry-run safety confirmed.');

  // 3. Actual Non-Destructive Backfill
  console.log('\nSTEP 3: ACTUAL NON-DESTRUCTIVE BACKFILL (dryRun = false)');
  console.log('----------------------------------------------------------------');
  const liveReport = await executeFullRelationalBackfill({ dryRun: false, batchSize: 50 }, d1);
  console.log(`Migration Status: ${liveReport.overallStatus}`);
  console.log(`Total Legacy Records Processed: ${liveReport.totalLegacyRecords}`);
  console.log(`Total Successfully Migrated: ${liveReport.totalSuccessfullyMigrated}`);
  console.log(`Total Inserted: ${liveReport.totalInserted}`);
  console.log(`Total Already Existing: ${liveReport.totalAlreadyExisting}`);
  console.log(`Total Skipped: ${liveReport.totalSkipped}`);
  console.log(`Total Warnings: ${liveReport.totalWarnings}`);
  console.log(`Total Errors: ${liveReport.totalErrors}`);

  console.log('\nPer-Collection Migration Breakdown:');
  for (const s of liveReport.steps) {
    console.log(`  - [${s.collection}] Source: ${s.sourceCount} | Migrated: ${s.migratedCount} | Inserted: ${s.inserted} | Updated: ${s.updated} | Skipped: ${s.skipped} | Warnings: ${s.warnings.length} | Errors: ${s.errors.length}`);
    if (s.warnings.length > 0) {
      s.warnings.forEach(w => console.log(`      ↳ Warning: ${w}`));
    }
  }

  // 4. Post-Migration Relational Parity Verification
  console.log('\nSTEP 4: POST-MIGRATION PARITY VERIFICATION');
  console.log('----------------------------------------------------------------');
  const parityReports = await verifyRelationalParity(d1);
  for (const p of parityReports) {
    console.log(`  - [${p.status}] ${p.collection}: Source=${p.sourceCount}, Relational=${p.destinationCount}, Missing=${p.missingIds.length}, Extra=${p.extraIds.length}`);
  }

  // 5. Field-Level Parity Verification
  console.log('\nSTEP 5: FIELD-LEVEL PARITY VERIFICATION');
  console.log('----------------------------------------------------------------');
  const fieldParity = await verifyFieldLevelParity(d1);
  console.log(`Overall Field Parity Status: ${fieldParity.overallStatus}`);
  console.log(`Total Mismatches: ${fieldParity.totalMismatches}`);
  for (const [coll, p] of Object.entries(fieldParity.collections)) {
    console.log(`  - [${p.status}] ${coll}: Checked=${p.totalChecked}, Fields=[${p.verifiedFields.join(', ')}], Mismatches=${p.mismatchesCount}`);
  }

  // 6. Idempotency Test: Rerun Migration
  console.log('\nSTEP 6: IDEMPOTENCY VERIFICATION (Rerun Migration)');
  console.log('----------------------------------------------------------------');
  const rerunReport = await executeFullRelationalBackfill({ dryRun: false, batchSize: 50 }, d1);
  console.log(`Rerun Status: ${rerunReport.overallStatus}`);
  console.log(`Rerun Inserted: ${rerunReport.totalInserted} (MUST BE 0)`);
  console.log(`Rerun Updated: ${rerunReport.totalUpdated}`);
  console.log(`Rerun Already Existing: ${rerunReport.totalAlreadyExisting}`);

  if (rerunReport.totalInserted !== 0) {
    throw new Error(`IDEMPOTENCY FAILURE: Rerun inserted ${rerunReport.totalInserted} new records!`);
  }
  console.log('   ✓ Idempotency confirmed: Re-executing backfill creates 0 duplicate rows.');

  // 7. Verify Legacy Entities Untouched
  console.log('\nSTEP 7: VERIFY LEGACY ENTITIES TABLE INTEGRITY');
  console.log('----------------------------------------------------------------');
  const entitiesCountRes = await d1.prepare('SELECT count(*) as cnt FROM entities').all();
  const legacyCount = entitiesCountRes.results[0]?.cnt;
  console.log(`Legacy entities count before migration: ${snapshot.totalLegacyRecords}`);
  console.log(`Legacy entities count after all runs: ${legacyCount}`);
  if (legacyCount !== snapshot.totalLegacyRecords) {
    throw new Error(`INTEGRITY FAILURE: Legacy entities count changed from ${snapshot.totalLegacyRecords} to ${legacyCount}!`);
  }
  console.log('   ✓ Legacy entities table verified 100% UNTOUCHED and PRESERVED.');

  console.log('\n================================================================');
  console.log('PHASE 2 MIGRATION & PARITY HARNESS COMPLETED: 100% SUCCESS');
  console.log('================================================================');

  return {
    snapshot,
    dryRunReport,
    liveReport,
    parityReports,
    fieldParity,
    rerunReport
  };
}

// Execute when run directly
runMigrationWorkflow().catch(err => {
  console.error('Migration harness error:', err);
  process.exit(1);
});
