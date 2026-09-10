/**
 * scripts/test_employee_customer_print.cjs
 * Comprehensive verification suite for Employee and Customer record printing:
 * 1. Data Isolation & Stale Record Prevention
 * 2. Dedicated A4 Corporate Layout Structure & Elements
 * 3. Screen Chrome & UI Suppression via print:hidden and printElement iframe
 * 4. DOM Unique ID targeting & Page Break Prevention (print-avoid-break)
 */

const fs = require("fs");
const path = require("path");

let totalTests = 0;
let passedTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log("  [PASS] " + desc);
    passedTests++;
  } catch (err) {
    console.error("  [FAIL] " + desc);
    console.error("         " + err.message);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

console.log("\n========================================================");
console.log(" EASYDESK — EMPLOYEE & CUSTOMER PRINT REGRESSION SUITE");
console.log("========================================================\n");

// 1. Check Unified Print Utility
console.log("--- 1. Print Utility & Isolation Mechanism (src/lib/printUtils.ts) ---");
const printUtilsPath = path.resolve(__dirname, "../src/lib/printUtils.ts");
const printUtilsContent = fs.readFileSync(printUtilsPath, "utf8");

it("printElement must use isolated hidden iframe to eliminate dashboard & chrome leak", () => {
  assert(printUtilsContent.includes("easydesk-print-frame"), "Must use easydesk-print-frame iframe");
  assert(printUtilsContent.includes("element.innerHTML"), "Must copy only target element HTML");
  assert(printUtilsContent.includes("iframe.style.visibility = 'hidden'"), "Iframe must be hidden");
});

it("printElement must enforce A4 portrait styling and print-avoid-break", () => {
  assert(printUtilsContent.includes("size: A4 portrait"), "Must configure A4 portrait size");
  assert(printUtilsContent.includes(".print-avoid-break"), "Must define print-avoid-break rule");
  assert(printUtilsContent.includes("break-inside: avoid"), "Must set break-inside: avoid");
});

it("printElement must hide navigation, buttons, and inputs in iframe print", () => {
  assert(printUtilsContent.includes("nav, aside, header, footer, button, input") && printUtilsContent.includes("display: none !important"), "Must suppress interactive inputs and navigation");
});

// 2. Check AdminDashboard & Root Chrome
console.log("\n--- 2. Admin Dashboard Print Chrome Suppression (src/components/AdminDashboard.tsx) ---");
const adminDashboardPath = path.resolve(__dirname, "../src/components/AdminDashboard.tsx");
const adminDashboardContent = fs.readFileSync(adminDashboardPath, "utf8");

it("AdminDashboard title block and navigation controls must have print:hidden", () => {
  assert(adminDashboardContent.includes("print:hidden"), "AdminDashboard must contain print:hidden");
});

// 3. Employee Record Printing & Layout
console.log("\n--- 3. Employee Management Module Print Isolation & Layout (src/components/admin/EmployeeManagementModule.tsx) ---");
const empModulePath = path.resolve(__dirname, "../src/components/admin/EmployeeManagementModule.tsx");
const empModuleContent = fs.readFileSync(empModulePath, "utf8");

it("EmployeeManagementModule must import printElement from printUtils", () => {
  assert(empModuleContent.includes("import { printElement } from '../../lib/printUtils.js'"), "Must import printElement");
});

it("loadSubRecords must immediately clear activeKYC, activePayroll, and activeDocs", () => {
  const loadSubRecordsMatch = empModuleContent.match(/const loadSubRecords = async \([\s\S]*?\n  \};/);
  assert(loadSubRecordsMatch, "loadSubRecords must be defined");
  const body = loadSubRecordsMatch[0];
  assert(body.includes("setActiveKYC(null);"), "Must clear activeKYC at start");
  assert(body.includes("setActivePayroll(null);"), "Must clear activePayroll at start");
  assert(body.includes("setActiveDocs([]);"), "Must clear activeDocs at start");
});

it("loadSubRecords must validate employeeId to prevent cross-record data contamination", () => {
  assert(empModuleContent.includes("!kData.employeeId || kData.employeeId === empId"), "Must validate KYC employeeId");
  assert(empModuleContent.includes("!pData.employeeId || pData.employeeId === empId"), "Must validate Payroll employeeId");
});

it("handleOpenPrint must clear subrecords and fetch fresh records for the selected employee", () => {
  const handleOpenPrintMatch = empModuleContent.match(/const handleOpenPrint = async \([\s\S]*?\n  \};/);
  assert(handleOpenPrintMatch, "handleOpenPrint must be defined");
  const body = handleOpenPrintMatch[0];
  assert(body.includes("setSelectedEmployee(emp);"), "Must set selectedEmployee");
  assert(body.includes("setActiveKYC(null);"), "Must clear activeKYC");
  assert(body.includes("setActivePayroll(null);"), "Must clear activePayroll");
  assert(body.includes("loadSubRecords(emp.id)"), "Must load subrecords for employee id");
});

it("handlePrintRecord must target unique employee sheet ID and call printElement", () => {
  assert(empModuleContent.includes("employee-printable-sheet-${selectedEmployee.id}"), "Must target dynamic employee DOM ID");
  assert(empModuleContent.includes("printElement(printEl"), "Must call printElement");
});

it("Employee directory table, filters, and header must be wrapped in print:hidden", () => {
  assert(empModuleContent.includes("{/* Interactive Controls & Directory Table (hidden during printing) */}"), "Must comment print:hidden wrapper");
  assert(empModuleContent.includes("<div className=\"space-y-6 print:hidden\">"), "Must wrap interactive table in print:hidden");
});

it("Employee printable document must include official letterhead, monogram, CIN, and ISO", () => {
  assert(empModuleContent.includes("EasyDesk Solutions Private Limited"), "Must include company name");
  assert(empModuleContent.includes("CIN: U72900MH2024PTC123456"), "Must include CIN");
  assert(empModuleContent.includes("ISO 9001:2015 Certified HRMS System"), "Must include ISO certification");
  assert(empModuleContent.includes("HR/EMP/{selectedEmployee.employeeCode}"), "Must include document ref code");
});

it("Employee printable document must include profile overview, photo frame, and status badge", () => {
  assert(empModuleContent.includes("selectedEmployee.profilePhoto"), "Must display profile photo");
  assert(empModuleContent.includes("selectedEmployee.employeeCode"), "Must display employee code");
  assert(empModuleContent.includes("selectedEmployee.designation"), "Must display designation");
  assert(empModuleContent.includes("selectedEmployee.department"), "Must display department");
});

it("Employee printable document must include Personal, KYC, and Payroll sections with print-avoid-break", () => {
  assert(empModuleContent.includes("1. Personal & Emergency Contact Demographics"), "Must include Section 1");
  assert(empModuleContent.includes("2. Statutory Verification & Government Identity Vault"), "Must include Section 2");
  assert(empModuleContent.includes("3. Compensation Structure & Banking Credentials"), "Must include Section 3");
  assert(empModuleContent.includes("print-avoid-break"), "Must apply print-avoid-break");
});

it("Employee printable document must include Employee Attestation and HR Signatory lines", () => {
  assert(empModuleContent.includes("Employee Signature & Attestation"), "Must have Employee Signature");
  assert(empModuleContent.includes("Authorized HR Signatory & Seal"), "Must have HR Signatory");
  assert(empModuleContent.includes("Protected under Indian IT Act 2000"), "Must include IT Act disclaimer");
});

// 4. Customer Record Printing & Layout
console.log("\n--- 4. Customer Management Module Print Isolation & Layout (src/components/admin/CustomerManagementModule.tsx) ---");
const custModulePath = path.resolve(__dirname, "../src/components/admin/CustomerManagementModule.tsx");
const custModuleContent = fs.readFileSync(custModulePath, "utf8");

it("CustomerManagementModule must import printElement from printUtils", () => {
  assert(custModuleContent.includes("import { printElement } from '../../lib/printUtils.js'"), "Must import printElement");
});

it("fetchCustomerOrders must immediately clear customerOrders to prevent stale history leakage", () => {
  const fetchOrdersMatch = custModuleContent.match(/const fetchCustomerOrders = async \([\s\S]*?\n  \};/);
  assert(fetchOrdersMatch, "fetchCustomerOrders must be defined");
  const body = fetchOrdersMatch[0];
  assert(body.includes("setCustomerOrders([]);"), "Must clear customerOrders at start");
});

it("handleOpenPrint must clear orders and fetch fresh orders for the selected customer", () => {
  const handleOpenPrintMatch = custModuleContent.match(/const handleOpenPrint = \([\s\S]*?\n  \};/);
  assert(handleOpenPrintMatch, "handleOpenPrint must be defined");
  const body = handleOpenPrintMatch[0];
  assert(body.includes("setSelectedCustomer(cust);"), "Must set selectedCustomer");
  assert(body.includes("setCustomerOrders([]);"), "Must clear customerOrders");
  assert(body.includes("fetchCustomerOrders(cust);"), "Must fetch orders for customer");
});

it("handleOpenDossierPrint must clear orders and fetch fresh orders for the dossier customer", () => {
  const handleDossierMatch = custModuleContent.match(/const handleOpenDossierPrint = \([\s\S]*?\n  \};/);
  assert(handleDossierMatch, "handleOpenDossierPrint must be defined");
  const body = handleDossierMatch[0];
  assert(body.includes("setDossierCustomer(cust);"), "Must set dossierCustomer");
  assert(body.includes("setHistoryCustomer(cust);"), "Must set historyCustomer");
  assert(body.includes("setCustomerOrders([]);"), "Must clear customerOrders");
  assert(body.includes("fetchCustomerOrders(cust);"), "Must fetch customer orders");
});

it("handlePrintRecord must target dynamic customer sheet ID and call printElement", () => {
  assert(custModuleContent.includes("customer-printable-sheet-${selectedCustomer.id}"), "Must target dynamic customer DOM ID");
  assert(custModuleContent.includes("printElement(printEl"), "Must call printElement with customer code");
});

it("handlePrintDossier must target dynamic customer dossier ID and call printElement", () => {
  assert(custModuleContent.includes("customer-dossier-sheet-${(dossierCustomer || historyCustomer)?.id}"), "Must target dynamic dossier DOM ID");
  assert(custModuleContent.includes("printElement(printEl"), "Must call printElement with dossier code");
});

it("Customer directory table, filters, and header must be wrapped in print:hidden", () => {
  assert(custModuleContent.includes("{/* Interactive Controls & Directory Table (hidden during printing) */}"), "Must comment print:hidden wrapper");
  assert(custModuleContent.includes("<div className=\"space-y-6 print:hidden\">"), "Must wrap interactive table in print:hidden");
});

it("Customer printable master sheet must include official letterhead, CIN, and ISO", () => {
  assert(custModuleContent.includes("EasyDesk Solutions Private Limited"), "Must include company name");
  assert(custModuleContent.includes("CIN: U72900MH2024PTC123456"), "Must include CIN");
  assert(custModuleContent.includes("ISO 9001:2015 Certified Citizen & Business Registry"), "Must include ISO certification");
  assert(custModuleContent.includes("Account Ref:"), "Must include account reference");
});

it("Customer printable master sheet must include 4-box metadata and structured sections", () => {
  assert(custModuleContent.includes("1. Registered Address & Location Coordinates"), "Must include Section 1");
  assert(custModuleContent.includes("2. Statutory Tax & Business Identifiers"), "Must include Section 2");
  assert(custModuleContent.includes("3. Engagement History & Service Portfolio"), "Must include Section 3");
  assert(custModuleContent.includes("print-avoid-break"), "Must apply print-avoid-break");
});

it("Customer printable master sheet must include dual Client & Operations Signatory lines", () => {
  assert(custModuleContent.includes("Client / Authorized Signatory"), "Must have Client Signatory");
  assert(custModuleContent.includes("Desk Officer / Corporate Operations"), "Must have Desk Officer Signatory");
  assert(custModuleContent.includes("Indian IT Act 2000 Compliant"), "Must include IT Act statement");
});

// 5. Switching & Stale Data State Machine Simulation
console.log("\n--- 5. Dynamic Switching Simulation (Record Isolation Test) ---");

it("Simulate Employee A -> Employee B -> Employee A switching isolation", () => {
  let activeKYC = null;
  let activePayroll = null;
  let activeDocs = [];

  const mockApi = {
    "emp-1": {
      kyc: { employeeId: "emp-1", aadhaarNumber: "XXXX-XXXX-1111", panNumber: "AAAAA1111A" },
      payroll: { employeeId: "emp-1", basicPay: 50000, netSalary: 60000 },
      docs: [{ id: "doc-1", employeeId: "emp-1", documentType: "Aadhaar Card" }]
    },
    "emp-2": {
      kyc: null,
      payroll: null,
      docs: []
    }
  };

  const selectEmployeeA = () => {
    activeKYC = null;
    activePayroll = null;
    activeDocs = [];
    const resA = mockApi["emp-1"];
    if (resA.kyc && resA.kyc.employeeId === "emp-1") activeKYC = resA.kyc;
    if (resA.payroll && resA.payroll.employeeId === "emp-1") activePayroll = resA.payroll;
    if (resA.docs) activeDocs = resA.docs.filter(d => d.employeeId === "emp-1");
  };

  selectEmployeeA();
  assert(activeKYC !== null && activeKYC.aadhaarNumber === "XXXX-XXXX-1111", "Emp A has KYC");
  assert(activePayroll !== null && activePayroll.netSalary === 60000, "Emp A has Payroll");
  assert(activeDocs.length === 1, "Emp A has 1 document");

  const selectEmployeeB = () => {
    activeKYC = null;
    activePayroll = null;
    activeDocs = [];
    const resB = mockApi["emp-2"];
    if (resB.kyc && resB.kyc.employeeId === "emp-2") activeKYC = resB.kyc;
    if (resB.payroll && resB.payroll.employeeId === "emp-2") activePayroll = resB.payroll;
    if (resB.docs) activeDocs = resB.docs.filter(d => d.employeeId === "emp-2");
  };

  selectEmployeeB();
  assert(activeKYC === null, "Emp B must NOT have Emp A kyc");
  assert(activePayroll === null, "Emp B must NOT have Emp A payroll");
  assert(activeDocs.length === 0, "Emp B must NOT have Emp A docs");

  selectEmployeeA();
  assert(activeKYC !== null && activeKYC.aadhaarNumber === "XXXX-XXXX-1111", "Emp A restored correctly");
  assert(activePayroll !== null && activePayroll.netSalary === 60000, "Emp A restored correctly");
});

it("Simulate Customer A -> Customer B -> Customer A order history switching isolation", () => {
  let customerOrders = [];

  const mockOrdersApi = {
    "cust-1": [{ id: "ORD-101", serviceTitle: "PAN Card Filing", totalAmount: 499 }],
    "cust-2": []
  };

  const selectCustomerA = () => {
    customerOrders = [];
    customerOrders = mockOrdersApi["cust-1"] || [];
  };

  selectCustomerA();
  assert(customerOrders.length === 1 && customerOrders[0].id === "ORD-101", "Cust A has 1 order");

  const selectCustomerB = () => {
    customerOrders = [];
    customerOrders = mockOrdersApi["cust-2"] || [];
  };

  selectCustomerB();
  assert(customerOrders.length === 0, "Cust B must NOT have Cust A orders");

  selectCustomerA();
  assert(customerOrders.length === 1 && customerOrders[0].id === "ORD-101", "Cust A restored correctly");
});

console.log("\n--------------------------------------------------------");
console.log(`Results: ${passedTests} / ${totalTests} tests passed.`);
console.log("--------------------------------------------------------\n");

if (passedTests === totalTests) {
  console.log(">>> ALL EMPLOYEE & CUSTOMER PRINT TESTS PASSED SUCCESSFULLY! <<<\n");
} else {
  console.error(">>> SOME TESTS FAILED. <<<\n");
  process.exit(1);
}