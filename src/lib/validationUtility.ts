import { 
  EmployeeProfile, 
  EmployeeKYC, 
  EmployeePayroll, 
  EmployeeAccount, 
  EmployeeDocument, 
  CustomerRecord, 
  Order, 
  ValidationReport, 
  ValidationFinding, 
  CollectionIntegritySummary 
} from '../types.js';
import { ENTITY_COLLECTIONS } from './serverDb.js';

export interface ValidationScanOptions {
  scanDatabase?: boolean;
  autoFix?: boolean;
}

/**
 * Normalizes an identifier string for resilient matching.
 */
function cleanKey(val?: string | null): string {
  return (val || '').trim().toLowerCase();
}

/**
 * Centralized Validation Utility to check and report orphaned or mismatched
 * record relationships across Employees, Customers, KYC, Payroll, Documents, and Orders.
 */
export async function validateRecordRelationships(
  dbState: Record<string, any>,
  options: ValidationScanOptions = {}
): Promise<ValidationReport> {
  const findings: ValidationFinding[] = [];
  const timestamp = new Date().toISOString();

  // Active dataset scan source
  let scanSource: 'D1_LIVE' | 'D1_STORE' | 'LOCAL_STATE' = 'D1_STORE';

  // Active dataset references
  const employees: EmployeeProfile[] = Array.isArray(dbState.employees) ? dbState.employees : [];
  const customers: CustomerRecord[] = Array.isArray(dbState.customers) ? dbState.customers : [];
  const orders: Order[] = Array.isArray(dbState.orders) ? dbState.orders : [];
  const employeeKYC: Record<string, EmployeeKYC> = dbState.employeeKYC || {};
  const employeePayroll: Record<string, EmployeePayroll> = dbState.employeePayroll || {};
  const employeeAccounts: Record<string, EmployeeAccount> = dbState.employeeAccounts || {};
  const employeeDocuments: EmployeeDocument[] = Array.isArray(dbState.employeeDocuments) ? dbState.employeeDocuments : [];

  // Lookup Indexes for Fast Canonical Resolution
  const employeeIdSet = new Set<string>();
  const employeeCodeMap = new Map<string, EmployeeProfile>();
  const employeeEmailMap = new Map<string, EmployeeProfile>();
  const employeeByIdMap = new Map<string, EmployeeProfile>();

  employees.forEach((emp) => {
    if (emp.id) {
      employeeIdSet.add(emp.id);
      employeeByIdMap.set(emp.id, emp);
    }
    if (emp.employeeCode) {
      const codeKey = cleanKey(emp.employeeCode);
      if (employeeCodeMap.has(codeKey)) {
        findings.push({
          id: `find-emp-dup-code-${emp.id}`,
          domain: 'EMPLOYEE',
          collection: 'employees',
          recordId: emp.id,
          severity: 'CRITICAL',
          issueType: 'DUPLICATE_IDENTIFIER',
          title: `Duplicate Employee Code: ${emp.employeeCode}`,
          description: `Employee ${emp.fullName} shares code ${emp.employeeCode} with another employee profile (${employeeCodeMap.get(codeKey)?.fullName}).`,
          suggestedFix: `Reassign a unique employeeCode (e.g. EMP-${1000 + employees.length + 1}).`,
          autoFixable: true
        });
      } else {
        employeeCodeMap.set(codeKey, emp);
      }
    }
    if (emp.personalEmail) {
      const emailKey = cleanKey(emp.personalEmail);
      if (employeeEmailMap.has(emailKey)) {
        findings.push({
          id: `find-emp-dup-email-${emp.id}`,
          domain: 'EMPLOYEE',
          collection: 'employees',
          recordId: emp.id,
          severity: 'WARNING',
          issueType: 'DUPLICATE_IDENTIFIER',
          title: `Duplicate Employee Email: ${emp.personalEmail}`,
          description: `Employee profile ${emp.fullName} has the same personal email as ${employeeEmailMap.get(emailKey)?.fullName}.`,
          suggestedFix: `Verify and update employee contact email.`,
          autoFixable: false
        });
      } else {
        employeeEmailMap.set(emailKey, emp);
      }
    }
  });

  const customerIdSet = new Set<string>();
  const customerCodeMap = new Map<string, CustomerRecord>();
  const customerEmailMap = new Map<string, CustomerRecord>();
  const customerMobileMap = new Map<string, CustomerRecord>();
  const customerByIdMap = new Map<string, CustomerRecord>();

  customers.forEach((cust) => {
    if (cust.id) {
      customerIdSet.add(cust.id);
      customerByIdMap.set(cust.id, cust);
    }
    if (cust.code) {
      const codeKey = cleanKey(cust.code);
      if (customerCodeMap.has(codeKey)) {
        findings.push({
          id: `find-cust-dup-code-${cust.id}`,
          domain: 'CUSTOMER',
          collection: 'customers',
          recordId: cust.id,
          severity: 'CRITICAL',
          issueType: 'DUPLICATE_IDENTIFIER',
          title: `Duplicate Customer Code: ${cust.code}`,
          description: `Customer ${cust.name} shares code ${cust.code} with another customer (${customerCodeMap.get(codeKey)?.name}).`,
          suggestedFix: `Reassign unique customer code (e.g. CUST-${1000 + customers.length + 1}).`,
          autoFixable: true
        });
      } else {
        customerCodeMap.set(codeKey, cust);
      }
    }
    if (cust.email) {
      customerEmailMap.set(cleanKey(cust.email), cust);
    }
    if (cust.mobile) {
      customerMobileMap.set(cleanKey(cust.mobile), cust);
    }
  });

  // Helper to resolve employee by any identifier
  const resolveEmployee = (idOrCodeOrEmail?: string): EmployeeProfile | undefined => {
    if (!idOrCodeOrEmail) return undefined;
    const clean = cleanKey(idOrCodeOrEmail);
    if (employeeByIdMap.has(idOrCodeOrEmail)) return employeeByIdMap.get(idOrCodeOrEmail);
    if (employeeCodeMap.has(clean)) return employeeCodeMap.get(clean);
    if (employeeEmailMap.has(clean)) return employeeEmailMap.get(clean);
    return undefined;
  };

  // Helper to resolve customer by any identifier
  const resolveCustomer = (idOrCodeOrEmailOrPhone?: string): CustomerRecord | undefined => {
    if (!idOrCodeOrEmailOrPhone) return undefined;
    const clean = cleanKey(idOrCodeOrEmailOrPhone);
    if (customerByIdMap.has(idOrCodeOrEmailOrPhone)) return customerByIdMap.get(idOrCodeOrEmailOrPhone);
    if (customerCodeMap.has(clean)) return customerCodeMap.get(clean);
    if (customerEmailMap.has(clean)) return customerEmailMap.get(clean);
    if (customerMobileMap.has(clean)) return customerMobileMap.get(clean);
    return undefined;
  };

  // ==========================================
  // 1. SCAN EMPLOYEE KYC RECORDS
  // ==========================================
  let kycOrphanedCount = 0;
  let kycMismatchedCount = 0;

  for (const [key, kyc] of Object.entries(employeeKYC)) {
    if (!kyc || typeof kyc !== 'object') continue;
    const targetEmpId = kyc.employeeId || key;
    const matchedEmp = resolveEmployee(targetEmpId) || resolveEmployee(key);

    if (!matchedEmp) {
      kycOrphanedCount++;
      findings.push({
        id: `find-kyc-orphan-${key}`,
        domain: 'EMPLOYEE',
        collection: 'employeeKYC',
        recordId: key,
        targetReferenceId: targetEmpId,
        severity: 'CRITICAL',
        issueType: 'ORPHANED_KYC',
        title: `Orphaned Employee KYC Record: ${key}`,
        description: `KYC entry '${key}' (Aadhaar: ${kyc.aadhaarNumber || 'N/A'}, PAN: ${kyc.panNumber || 'N/A'}) points to non-existent EmployeeID '${targetEmpId}'.`,
        suggestedFix: `Relink to a valid employee profile or remove orphaned KYC record.`,
        autoFixable: false
      });
    } else {
      // Check for dictionary key mismatch or target ID mismatch
      if (key !== matchedEmp.id || kyc.employeeId !== matchedEmp.id) {
        kycMismatchedCount++;
        findings.push({
          id: `find-kyc-mismatch-${key}`,
          domain: 'EMPLOYEE',
          collection: 'employeeKYC',
          recordId: key,
          targetReferenceId: matchedEmp.id,
          severity: 'WARNING',
          issueType: 'MISMATCHED_KEY',
          title: `KYC Key/ID Mismatch for ${matchedEmp.fullName}`,
          description: `KYC record is stored under key '${key}' with employeeId '${kyc.employeeId}', but the canonical Employee ID is '${matchedEmp.id}' (${matchedEmp.employeeCode}).`,
          suggestedFix: `Migrate dictionary key to canonical employee ID '${matchedEmp.id}' and synchronize employeeId property.`,
          autoFixable: true
        });
      }
    }
  }

  // ==========================================
  // 2. SCAN EMPLOYEE PAYROLL RECORDS
  // ==========================================
  let payrollOrphanedCount = 0;
  let payrollMismatchedCount = 0;

  for (const [key, payroll] of Object.entries(employeePayroll)) {
    if (!payroll || typeof payroll !== 'object') continue;
    const targetEmpId = payroll.employeeId || key;
    const matchedEmp = resolveEmployee(targetEmpId) || resolveEmployee(key);

    if (!matchedEmp) {
      payrollOrphanedCount++;
      findings.push({
        id: `find-payroll-orphan-${key}`,
        domain: 'EMPLOYEE',
        collection: 'employeePayroll',
        recordId: key,
        targetReferenceId: targetEmpId,
        severity: 'CRITICAL',
        issueType: 'ORPHANED_PAYROLL',
        title: `Orphaned Employee Payroll Record: ${key}`,
        description: `Payroll record '${key}' (Bank: ${payroll.bankName || 'N/A'}, Account: ${payroll.accountNumber || 'N/A'}) references non-existent EmployeeID '${targetEmpId}'.`,
        suggestedFix: `Relink to an active employee record or prune orphaned payroll node.`,
        autoFixable: false
      });
    } else {
      if (key !== matchedEmp.id || payroll.employeeId !== matchedEmp.id) {
        payrollMismatchedCount++;
        findings.push({
          id: `find-payroll-mismatch-${key}`,
          domain: 'EMPLOYEE',
          collection: 'employeePayroll',
          recordId: key,
          targetReferenceId: matchedEmp.id,
          severity: 'WARNING',
          issueType: 'MISMATCHED_KEY',
          title: `Payroll Key/ID Mismatch for ${matchedEmp.fullName}`,
          description: `Payroll record stored under key '${key}' references employeeId '${payroll.employeeId}', differing from canonical ID '${matchedEmp.id}'.`,
          suggestedFix: `Re-key payroll dictionary under '${matchedEmp.id}' with employeeId '${matchedEmp.id}'.`,
          autoFixable: true
        });
      }
    }
  }

  // ==========================================
  // 3. SCAN EMPLOYEE SYSTEM ACCOUNTS
  // ==========================================
  let accountsOrphanedCount = 0;
  let accountsMismatchedCount = 0;

  for (const [key, account] of Object.entries(employeeAccounts)) {
    if (!account || typeof account !== 'object') continue;
    const targetEmpId = account.employeeId || key;
    const matchedEmp = resolveEmployee(targetEmpId) || resolveEmployee(account.systemEmail) || resolveEmployee(key);

    if (!matchedEmp) {
      accountsOrphanedCount++;
      findings.push({
        id: `find-account-orphan-${key}`,
        domain: 'EMPLOYEE',
        collection: 'employeeAccounts',
        recordId: key,
        targetReferenceId: targetEmpId,
        severity: 'CRITICAL',
        issueType: 'ORPHANED_ACCOUNT',
        title: `Orphaned Staff Account: ${account.systemEmail || key}`,
        description: `System account '${key}' (${account.systemEmail}) references missing employee ID '${targetEmpId}'.`,
        suggestedFix: `Link account to an existing employee profile or archive credentials.`,
        autoFixable: false
      });
    } else {
      if (key !== matchedEmp.id || account.employeeId !== matchedEmp.id) {
        accountsMismatchedCount++;
        findings.push({
          id: `find-account-mismatch-${key}`,
          domain: 'EMPLOYEE',
          collection: 'employeeAccounts',
          recordId: key,
          targetReferenceId: matchedEmp.id,
          severity: 'WARNING',
          issueType: 'MISMATCHED_KEY',
          title: `Staff Account Key Mismatch for ${matchedEmp.fullName}`,
          description: `Staff account is mapped to key '${key}', but canonical Employee ID is '${matchedEmp.id}'.`,
          suggestedFix: `Normalize staff account mapping key to '${matchedEmp.id}'.`,
          autoFixable: true
        });
      }
    }
  }

  // ==========================================
  // 4. SCAN EMPLOYEE DOCUMENTS
  // ==========================================
  let docOrphanedCount = 0;
  let docMismatchedCount = 0;

  for (const docItem of employeeDocuments) {
    if (!docItem || !docItem.id) continue;
    const matchedEmp = resolveEmployee(docItem.employeeId);

    if (!matchedEmp) {
      docOrphanedCount++;
      findings.push({
        id: `find-doc-orphan-${docItem.id}`,
        domain: 'EMPLOYEE',
        collection: 'employeeDocuments',
        recordId: docItem.id,
        targetReferenceId: docItem.employeeId,
        severity: 'CRITICAL',
        issueType: 'ORPHANED_DOCUMENT',
        title: `Orphaned Employee Document: ${docItem.documentName || docItem.id}`,
        description: `Document '${docItem.documentName}' (${docItem.documentType}) points to non-existent employee ID '${docItem.employeeId}'.`,
        suggestedFix: `Reassign document to a valid employee or delete unreferenced file record.`,
        autoFixable: false
      });
    } else if (docItem.employeeId !== matchedEmp.id) {
      docMismatchedCount++;
      findings.push({
        id: `find-doc-mismatch-${docItem.id}`,
        domain: 'EMPLOYEE',
        collection: 'employeeDocuments',
        recordId: docItem.id,
        targetReferenceId: matchedEmp.id,
        severity: 'WARNING',
        issueType: 'MISMATCHED_KEY',
        title: `Document Employee Reference Non-Canonical: ${docItem.documentName}`,
        description: `Document references employeeCode '${docItem.employeeId}' instead of canonical ID '${matchedEmp.id}'.`,
        suggestedFix: `Update document.employeeId to canonical '${matchedEmp.id}'.`,
        autoFixable: true
      });
    }
  }

  // ==========================================
  // 5. SCAN ORDERS (EMPLOYEE ASSIGNMENTS & CUSTOMER LINKS)
  // ==========================================
  let orderAssignedOrphanCount = 0;
  let orderAssignedMismatchCount = 0;
  let orderCustomerOrphanCount = 0;
  let orderCustomerUnlinkedCount = 0;
  let orderCustomerMismatchCount = 0;

  for (const order of orders) {
    if (!order || !order.id) continue;

    // Check Employee Assignment Integrity
    const hasAssignment = !!(order.assignedEmployeeId || order.assignedStaffId || order.assignedEmployeeCode);
    if (hasAssignment) {
      const targetEmpRef = order.assignedEmployeeId || order.assignedStaffId || order.assignedEmployeeCode;
      const matchedEmp = resolveEmployee(targetEmpRef);

      if (!matchedEmp) {
        orderAssignedOrphanCount++;
        findings.push({
          id: `find-order-emp-orphan-${order.id}`,
          domain: 'ORDER',
          collection: 'orders',
          recordId: order.id,
          targetReferenceId: targetEmpRef,
          severity: 'CRITICAL',
          issueType: 'ORPHANED_ORDER_ASSIGNMENT',
          title: `Orphaned Order Assignment in ${order.id}`,
          description: `Order ${order.id} (${order.serviceTitle}) is assigned to employee '${targetEmpRef}', who does not exist in the employee directory.`,
          suggestedFix: `Unassign order or reassign to an active employee.`,
          autoFixable: true
        });
      } else {
        // Verify consistency between assignedEmployeeId, assignedStaffId, assignedEmployeeCode, assignedEmployeeName
        const hasCodeMismatch = order.assignedEmployeeCode && order.assignedEmployeeCode !== matchedEmp.employeeCode;
        const hasNameMismatch = order.assignedEmployeeName && order.assignedEmployeeName !== matchedEmp.fullName;
        const hasIdMismatch = (order.assignedEmployeeId && order.assignedEmployeeId !== matchedEmp.id) || 
                              (order.assignedStaffId && order.assignedStaffId !== matchedEmp.id);

        if (hasCodeMismatch || hasNameMismatch || hasIdMismatch) {
          orderAssignedMismatchCount++;
          findings.push({
            id: `find-order-emp-mismatch-${order.id}`,
            domain: 'ORDER',
            collection: 'orders',
            recordId: order.id,
            targetReferenceId: matchedEmp.id,
            severity: 'WARNING',
            issueType: 'MISMATCHED_EMPLOYEE_DATA',
            title: `Order Assignment Detail Mismatch in ${order.id}`,
            description: `Order assignment details are out of sync with canonical employee profile ${matchedEmp.fullName} (${matchedEmp.employeeCode}).`,
            suggestedFix: `Synchronize order assignment fields to canonical ID '${matchedEmp.id}', code '${matchedEmp.employeeCode}', name '${matchedEmp.fullName}', department '${matchedEmp.department}'.`,
            autoFixable: true
          });
        }
      }
    }

    // Check Customer Relationship Integrity
    if (order.customerId) {
      const matchedCust = resolveCustomer(order.customerId);
      if (!matchedCust) {
        orderCustomerOrphanCount++;
        findings.push({
          id: `find-order-cust-orphan-${order.id}`,
          domain: 'ORDER',
          collection: 'orders',
          recordId: order.id,
          targetReferenceId: order.customerId,
          severity: 'CRITICAL',
          issueType: 'ORPHANED_CUSTOMER_ORDER',
          title: `Orphaned Customer Reference in Order ${order.id}`,
          description: `Order ${order.id} references customerId '${order.customerId}', but no corresponding customer record exists in the customer directory.`,
          suggestedFix: `Link to existing customer by email/phone or register a new customer profile.`,
          autoFixable: true
        });
      } else {
        // Check if customer email / mobile match
        const orderEmail = cleanKey(order.email);
        const custEmail = cleanKey(matchedCust.email);
        const orderMobile = cleanKey(order.mobile);
        const custMobile = cleanKey(matchedCust.mobile);

        if (orderEmail && custEmail && orderEmail !== custEmail) {
          orderCustomerMismatchCount++;
          findings.push({
            id: `find-order-cust-email-mismatch-${order.id}`,
            domain: 'CUSTOMER',
            collection: 'orders',
            recordId: order.id,
            targetReferenceId: matchedCust.id,
            severity: 'INFO',
            issueType: 'MISMATCHED_CUSTOMER_DATA',
            title: `Order/Customer Email Discrepancy in ${order.id}`,
            description: `Order ${order.id} contact email '${order.email}' differs from linked customer profile email '${matchedCust.email}'.`,
            suggestedFix: `Verify if order was placed on behalf of customer or update customer profile email.`,
            autoFixable: false
          });
        }
      }
    } else {
      // Order has no explicit customerId. Check if order email or mobile matches a customer
      const matchedCustByContact = resolveCustomer(order.email) || resolveCustomer(order.mobile);
      if (matchedCustByContact) {
        orderCustomerUnlinkedCount++;
        findings.push({
          id: `find-order-cust-unlinked-${order.id}`,
          domain: 'CUSTOMER',
          collection: 'orders',
          recordId: order.id,
          targetReferenceId: matchedCustByContact.id,
          severity: 'WARNING',
          issueType: 'UNLINKED_CUSTOMER_ORDER',
          title: `Unlinked Order for Customer ${matchedCustByContact.name}: ${order.id}`,
          description: `Order ${order.id} matches customer profile ${matchedCustByContact.name} (${matchedCustByContact.code}) via ${order.email || order.mobile}, but customerId is not set.`,
          suggestedFix: `Link order ${order.id} to customerId '${matchedCustByContact.id}'.`,
          autoFixable: true
        });
      }
    }
  }

  // ==========================================
  // 6. BUILD COLLECTION INTEGRITY SUMMARIES
  // ==========================================
  const summaryByCollection: Record<string, CollectionIntegritySummary> = {
    employees: {
      collection: 'employees',
      totalRecords: employees.length,
      healthyCount: employees.length - findings.filter(f => f.collection === 'employees').length,
      orphanedCount: 0,
      mismatchedCount: findings.filter(f => f.collection === 'employees' && f.issueType === 'DUPLICATE_IDENTIFIER').length,
      warningCount: findings.filter(f => f.collection === 'employees').length,
      status: findings.some(f => f.collection === 'employees' && f.severity === 'CRITICAL') ? 'CRITICAL' : 
              findings.some(f => f.collection === 'employees') ? 'WARNINGS' : 'HEALTHY'
    },
    employeeKYC: {
      collection: 'employeeKYC',
      totalRecords: Object.keys(employeeKYC).length,
      healthyCount: Object.keys(employeeKYC).length - kycOrphanedCount - kycMismatchedCount,
      orphanedCount: kycOrphanedCount,
      mismatchedCount: kycMismatchedCount,
      warningCount: kycMismatchedCount,
      status: kycOrphanedCount > 0 ? 'CRITICAL' : kycMismatchedCount > 0 ? 'WARNINGS' : 'HEALTHY'
    },
    employeePayroll: {
      collection: 'employeePayroll',
      totalRecords: Object.keys(employeePayroll).length,
      healthyCount: Object.keys(employeePayroll).length - payrollOrphanedCount - payrollMismatchedCount,
      orphanedCount: payrollOrphanedCount,
      mismatchedCount: payrollMismatchedCount,
      warningCount: payrollMismatchedCount,
      status: payrollOrphanedCount > 0 ? 'CRITICAL' : payrollMismatchedCount > 0 ? 'WARNINGS' : 'HEALTHY'
    },
    employeeAccounts: {
      collection: 'employeeAccounts',
      totalRecords: Object.keys(employeeAccounts).length,
      healthyCount: Object.keys(employeeAccounts).length - accountsOrphanedCount - accountsMismatchedCount,
      orphanedCount: accountsOrphanedCount,
      mismatchedCount: accountsMismatchedCount,
      warningCount: accountsMismatchedCount,
      status: accountsOrphanedCount > 0 ? 'CRITICAL' : accountsMismatchedCount > 0 ? 'WARNINGS' : 'HEALTHY'
    },
    employeeDocuments: {
      collection: 'employeeDocuments',
      totalRecords: employeeDocuments.length,
      healthyCount: employeeDocuments.length - docOrphanedCount - docMismatchedCount,
      orphanedCount: docOrphanedCount,
      mismatchedCount: docMismatchedCount,
      warningCount: docMismatchedCount,
      status: docOrphanedCount > 0 ? 'CRITICAL' : docMismatchedCount > 0 ? 'WARNINGS' : 'HEALTHY'
    },
    customers: {
      collection: 'customers',
      totalRecords: customers.length,
      healthyCount: customers.length - findings.filter(f => f.collection === 'customers').length,
      orphanedCount: 0,
      mismatchedCount: findings.filter(f => f.collection === 'customers' && f.issueType === 'DUPLICATE_IDENTIFIER').length,
      warningCount: findings.filter(f => f.collection === 'customers').length,
      status: findings.some(f => f.collection === 'customers' && f.severity === 'CRITICAL') ? 'CRITICAL' : 
              findings.some(f => f.collection === 'customers') ? 'WARNINGS' : 'HEALTHY'
    },
    orders: {
      collection: 'orders',
      totalRecords: orders.length,
      healthyCount: orders.length - orderAssignedOrphanCount - orderAssignedMismatchCount - orderCustomerOrphanCount - orderCustomerUnlinkedCount,
      orphanedCount: orderAssignedOrphanCount + orderCustomerOrphanCount,
      mismatchedCount: orderAssignedMismatchCount + orderCustomerMismatchCount,
      warningCount: orderCustomerUnlinkedCount + orderAssignedMismatchCount,
      status: (orderAssignedOrphanCount + orderCustomerOrphanCount) > 0 ? 'CRITICAL' : 
              (orderAssignedMismatchCount + orderCustomerUnlinkedCount) > 0 ? 'WARNINGS' : 'HEALTHY'
    }
  };

  const criticalIssuesCount = findings.filter(f => f.severity === 'CRITICAL').length;
  const warningIssuesCount = findings.filter(f => f.severity === 'WARNING').length;
  const infoIssuesCount = findings.filter(f => f.severity === 'INFO').length;
  const autoFixableCount = findings.filter(f => f.autoFixable).length;

  const overallStatus = criticalIssuesCount > 0 ? 'CRITICAL_ERRORS' : warningIssuesCount > 0 ? 'WARNINGS_FOUND' : 'HEALTHY';

  return {
    timestamp,
    scanSource,
    overallStatus,
    stats: {
      totalEmployeesChecked: employees.length,
      totalCustomersChecked: customers.length,
      totalOrdersChecked: orders.length,
      totalKYCChecked: Object.keys(employeeKYC).length,
      totalPayrollChecked: Object.keys(employeePayroll).length,
      totalAccountsChecked: Object.keys(employeeAccounts).length,
      totalDocumentsChecked: employeeDocuments.length,
      totalIssuesFound: findings.length,
      criticalIssuesCount,
      warningIssuesCount,
      infoIssuesCount,
      autoFixableCount
    },
    summaryByCollection,
    findings
  };
}

/**
 * Automatically repairs and normalizes orphaned and mismatched relationships across collections.
 */
export async function repairRecordRelationships(
  dbState: Record<string, any>,
  persistFn: (collectionOrKey?: string, id?: string) => Promise<void>
): Promise<{
  beforeReport: ValidationReport;
  afterReport: ValidationReport;
  repairsApplied: {
    repairedKeysCount: number;
    relinkedOrdersCount: number;
    repairedEmployeesCount: number;
    repairedCustomersCount: number;
    details: string[];
  };
}> {
  const beforeReport = await validateRecordRelationships(dbState, { scanDatabase: true });
  const details: string[] = [];
  let repairedKeysCount = 0;
  let relinkedOrdersCount = 0;
  let repairedEmployeesCount = 0;
  let repairedCustomersCount = 0;

  const employees: EmployeeProfile[] = Array.isArray(dbState.employees) ? dbState.employees : [];
  const customers: CustomerRecord[] = Array.isArray(dbState.customers) ? dbState.customers : [];
  const orders: Order[] = Array.isArray(dbState.orders) ? dbState.orders : [];

  // Index employees
  const empById = new Map<string, EmployeeProfile>();
  const empByCode = new Map<string, EmployeeProfile>();
  const empByEmail = new Map<string, EmployeeProfile>();

  employees.forEach((emp) => {
    if (emp.id) empById.set(emp.id, emp);
    if (emp.employeeCode) empByCode.set(cleanKey(emp.employeeCode), emp);
    if (emp.personalEmail) empByEmail.set(cleanKey(emp.personalEmail), emp);
  });

  const findEmp = (ref?: string): EmployeeProfile | undefined => {
    if (!ref) return undefined;
    const clean = cleanKey(ref);
    return empById.get(ref) || empByCode.get(clean) || empByEmail.get(clean);
  };

  // Index customers
  const custById = new Map<string, CustomerRecord>();
  const custByCode = new Map<string, CustomerRecord>();
  const custByEmail = new Map<string, CustomerRecord>();
  const custByMobile = new Map<string, CustomerRecord>();

  customers.forEach((c) => {
    if (c.id) custById.set(c.id, c);
    if (c.code) custByCode.set(cleanKey(c.code), c);
    if (c.email) custByEmail.set(cleanKey(c.email), c);
    if (c.mobile) custByMobile.set(cleanKey(c.mobile), c);
  });

  const findCust = (ref?: string): CustomerRecord | undefined => {
    if (!ref) return undefined;
    const clean = cleanKey(ref);
    return custById.get(ref) || custByCode.get(clean) || custByEmail.get(clean) || custByMobile.get(clean);
  };

  // 1. Repair Employee KYC Dictionary Keys & employeeId
  if (dbState.employeeKYC && typeof dbState.employeeKYC === 'object') {
    const newKycMap: Record<string, EmployeeKYC> = {};
    for (const [key, kyc] of Object.entries(dbState.employeeKYC as Record<string, EmployeeKYC>)) {
      if (!kyc) continue;
      const emp = findEmp(kyc.employeeId) || findEmp(key);
      if (emp) {
        const canonicalId = emp.id;
        const normalizedKyc = {
          ...kyc,
          employeeId: canonicalId,
          updatedAt: new Date().toISOString()
        };
        newKycMap[canonicalId] = normalizedKyc;
        if (key !== canonicalId || kyc.employeeId !== canonicalId) {
          repairedKeysCount++;
          details.push(`Re-keyed KYC record from '${key}' to canonical Employee ID '${canonicalId}' (${emp.fullName})`);
        }
      } else {
        // Retain unresolvable to avoid data loss, but note it
        newKycMap[key] = kyc;
      }
    }
    dbState.employeeKYC = newKycMap;
    await persistFn('employeeKYC');
  }

  // 2. Repair Employee Payroll Dictionary Keys & employeeId
  if (dbState.employeePayroll && typeof dbState.employeePayroll === 'object') {
    const newPayrollMap: Record<string, EmployeePayroll> = {};
    for (const [key, payroll] of Object.entries(dbState.employeePayroll as Record<string, EmployeePayroll>)) {
      if (!payroll) continue;
      const emp = findEmp(payroll.employeeId) || findEmp(key);
      if (emp) {
        const canonicalId = emp.id;
        const normalizedPayroll = {
          ...payroll,
          employeeId: canonicalId,
          updatedAt: new Date().toISOString()
        };
        newPayrollMap[canonicalId] = normalizedPayroll;
        if (key !== canonicalId || payroll.employeeId !== canonicalId) {
          repairedKeysCount++;
          details.push(`Re-keyed Payroll record from '${key}' to canonical Employee ID '${canonicalId}' (${emp.fullName})`);
        }
      } else {
        newPayrollMap[key] = payroll;
      }
    }
    dbState.employeePayroll = newPayrollMap;
    await persistFn('employeePayroll');
  }

  // 3. Repair Employee System Accounts
  if (dbState.employeeAccounts && typeof dbState.employeeAccounts === 'object') {
    const newAccountMap: Record<string, EmployeeAccount> = {};
    for (const [key, acc] of Object.entries(dbState.employeeAccounts as Record<string, EmployeeAccount>)) {
      if (!acc) continue;
      const emp = findEmp(acc.employeeId) || findEmp(acc.systemEmail) || findEmp(key);
      if (emp) {
        const canonicalId = emp.id;
        const normalizedAcc = {
          ...acc,
          employeeId: canonicalId,
          systemEmail: acc.systemEmail || emp.personalEmail,
          updatedAt: new Date().toISOString()
        };
        newAccountMap[canonicalId] = normalizedAcc;
        if (key !== canonicalId || acc.employeeId !== canonicalId) {
          repairedKeysCount++;
          details.push(`Normalized Staff Account mapping from '${key}' to canonical ID '${canonicalId}' (${emp.fullName})`);
        }
      } else {
        newAccountMap[key] = acc;
      }
    }
    dbState.employeeAccounts = newAccountMap;
    await persistFn('employeeAccounts');
  }

  // 4. Repair Employee Documents
  if (Array.isArray(dbState.employeeDocuments)) {
    for (const docItem of dbState.employeeDocuments) {
      if (!docItem || !docItem.id) continue;
      const emp = findEmp(docItem.employeeId);
      if (emp && docItem.employeeId !== emp.id) {
        docItem.employeeId = emp.id;
        repairedKeysCount++;
        details.push(`Updated Document '${docItem.documentName}' employee reference to canonical ID '${emp.id}'`);
      }
    }
    await persistFn('employeeDocuments');
  }

  // 5. Repair Orders (Employee assignments & Customer relationships)
  if (Array.isArray(dbState.orders)) {
    for (const order of dbState.orders) {
      if (!order || !order.id) continue;

      // Repair Employee Assignment
      if (order.assignedEmployeeId || order.assignedStaffId || order.assignedEmployeeCode) {
        const emp = findEmp(order.assignedEmployeeId || order.assignedStaffId || order.assignedEmployeeCode);
        if (emp) {
          const changed = 
            order.assignedEmployeeId !== emp.id ||
            order.assignedStaffId !== emp.id ||
            order.assignedEmployeeCode !== emp.employeeCode ||
            order.assignedEmployeeName !== emp.fullName ||
            order.assignedEmployeeDepartment !== emp.department;

          if (changed) {
            order.assignedEmployeeId = emp.id;
            order.assignedStaffId = emp.id;
            order.assignedEmployeeCode = emp.employeeCode;
            order.assignedEmployeeName = emp.fullName;
            order.assignedEmployeeDepartment = emp.department;
            order.assignedEmployeeDesignation = emp.designation;
            relinkedOrdersCount++;
            details.push(`Synchronized order ${order.id} assignment details to ${emp.fullName} (${emp.employeeCode})`);
          }
        } else {
          // Unassign orphaned assignment
          order.assignedEmployeeId = undefined;
          order.assignedStaffId = undefined;
          order.assignedEmployeeCode = undefined;
          order.assignedEmployeeName = undefined;
          order.assignmentStatus = 'Unassigned';
          relinkedOrdersCount++;
          details.push(`Unassigned orphaned employee reference from order ${order.id}`);
        }
      }

      // Repair Customer Linkage
      if (!order.customerId) {
        const cust = findCust(order.email) || findCust(order.mobile);
        if (cust) {
          order.customerId = cust.id;
          relinkedOrdersCount++;
          details.push(`Linked order ${order.id} (${order.serviceTitle}) to Customer ${cust.name} (${cust.code})`);
        }
      } else {
        const cust = findCust(order.customerId);
        if (cust && order.customerId !== cust.id) {
          order.customerId = cust.id;
          relinkedOrdersCount++;
          details.push(`Updated order ${order.id} customer reference to canonical ID '${cust.id}'`);
        }
      }
    }
    await persistFn('orders');
  }

  const afterReport = await validateRecordRelationships(dbState, { scanDatabase: true });

  const repairsApplied = {
    repairedKeysCount,
    relinkedOrdersCount,
    repairedEmployeesCount,
    repairedCustomersCount,
    details
  };

  afterReport.repairsApplied = repairsApplied;

  return {
    beforeReport,
    afterReport,
    repairsApplied
  };
}
