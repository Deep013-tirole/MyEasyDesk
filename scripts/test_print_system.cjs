/**
 * EASYDESK — GLOBAL PRINT SYSTEM VERIFICATION SUITE
 * 
 * Verifies:
 * 1. Global Print Stylesheet (src/index.css):
 *    - Absence of '#root' in display:none
 *    - Presence of '#root' display: block !important
 *    - Presence of @page { size: A4 portrait; margin: 12mm 15mm 15mm 15mm; }
 *    - Exact color preservation (-webkit-print-color-adjust & print-color-adjust)
 *    - .print-only utility defined outside and inside @media print
 *    - .printable-modal-overlay & .printable-modal-card classes
 *    - Suppression of screen chrome (nav, aside, header, footer, .no-print, .print:hidden)
 * 2. Track Application Official Acknowledgement Slip (src/components/TrackingView.tsx):
 *    - handlePrint triggers printElement
 *    - Screen controls container has print:hidden
 *    - Dedicated printable container with .print-only and .printable-tracking-document
 *    - Official Organization header ('EasyDesk Solutions Private Limited')
 *    - Document title ('Application Acknowledgement & Service Status Record')
 *    - Reference ID, submission date, status badge, category
 *    - Full applicant details + structured Indian address
 *    - Service details & fulfillment mode
 *    - Payment & consultation billing summary table
 *    - Milestone audit trail table
 *    - Citizen guidelines & IT Act statutory disclaimer
 *    - Electronic verification seal & helpdesk contact
 * 3. Unified Print Utility (src/lib/printUtils.ts):
 *    - Exports printCurrentWindow and printElement
 *    - Double requestAnimationFrame layout paint flush
 *    - Hidden iframe fallback for sandboxed preview environments
 * 4. Employee ID Card Modal (src/components/admin/EmployeeIDCardModal.tsx):
 *    - Uses .printable-modal-overlay and .printable-modal-card
 *    - Absence of broken 'body * { visibility: hidden }'
 *    - Presence of .id-card-print-area styling
 * 5. Employee Master Sheet (src/components/admin/EmployeeManagementModule.tsx):
 *    - Uses .printable-modal-overlay and .printable-modal-card
 * 6. Customer Master Record & Service Dossier (src/components/admin/CustomerManagementModule.tsx):
 *    - Uses .printable-modal-overlay and .printable-modal-card on both modals
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let totalTests = 0;
let passedTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log('  [PASS] ' + desc);
  } catch (err) {
    console.error('  [FAIL] ' + desc);
    console.error('         ' + err.message);
    process.exitCode = 1;
  }
}

console.log('\n========================================================');
console.log(' EASYDESK — GLOBAL PRINT SYSTEM VERIFICATION SUITE');
console.log('========================================================\n');

// --------------------------------------------------------------------------
// 1. GLOBAL CSS PRINT STYLESHEET (src/index.css)
// --------------------------------------------------------------------------
console.log('--- 1. Global Print Stylesheet (src/index.css) ---');
const indexCssPath = path.resolve(__dirname, '../src/index.css');
const indexCss = fs.readFileSync(indexCssPath, 'utf8');

it('CRITICAL: #root must NOT be set to display:none in @media print', () => {
  const printBlockMatch = indexCss.match(/@media\s+print\s*\{([\s\S]*?)(?:\n\}\n\n|\n\}\s*$)/);
  assert(printBlockMatch, '@media print block must exist in src/index.css');
  const printBlock = printBlockMatch[1];
  
  // Ensure #root is not in the hidden elements selector list
  const hiddenSelectorMatch = printBlock.match(/([^{]+)\{[^}]*display:\s*none\s*!important/g);
  assert(hiddenSelectorMatch, 'Hidden elements rules must exist');
  for (const match of hiddenSelectorMatch) {
    assert(!match.includes('#root'), '#root selector must NEVER have display: none in @media print!');
  }
});

it('#root must be explicitly set to display: block !important in @media print', () => {
  assert(indexCss.includes('#root {'), 'CSS must define #root rule');
  assert(indexCss.includes('display: block !important'), '#root must have display: block !important');
});

it('@page must specify A4 portrait size with appropriate margins', () => {
  assert(indexCss.includes('@page {'), '@page rule must exist');
  assert(/size:\s*A4\s+portrait/i.test(indexCss), '@page must specify A4 portrait');
  assert(/margin:\s*12mm\s+15mm/i.test(indexCss), '@page must specify clean margins');
});

it('Print color adjust must be enforced for background and graphics preservation', () => {
  assert(indexCss.includes('-webkit-print-color-adjust: exact !important'), 'webkit print color adjust must be exact');
  assert(indexCss.includes('print-color-adjust: exact !important'), 'print-color-adjust must be exact');
});

it('.print-only class must be hidden on screen and visible in print', () => {
  assert(indexCss.includes('.print-only {'), '.print-only class must be defined');
  // Outside print, .print-only has display: none
  assert(/\.print-only\s*\{[^}]*display:\s*none\s*!important/i.test(indexCss), '.print-only must be display:none outside print');
  // Inside print, .print-only has display: block
  assert(/\.print-only\s*\{[^}]*display:\s*block\s*!important/i.test(indexCss), '.print-only must be display:block in print');
});

it('Screen chrome elements must be hidden during print', () => {
  const printMatch = indexCss.match(/@media\s+print\s*\{([\s\S]*?)\n\}/);
  const content = printMatch ? printMatch[1] : indexCss;
  assert(content.includes('nav'), 'nav must be hidden');
  assert(content.includes('aside'), 'aside must be hidden');
  assert(content.includes('header'), 'header must be hidden');
  assert(content.includes('footer'), 'footer must be hidden');
  assert(content.includes('.no-print'), '.no-print must be hidden');
  assert(content.includes('.print\\:hidden'), '.print:hidden must be hidden');
});

it('Printable modal overlay and card classes must be properly defined', () => {
  assert(indexCss.includes('.printable-modal-overlay'), '.printable-modal-overlay must be defined');
  assert(indexCss.includes('.printable-modal-card'), '.printable-modal-card must be defined');
  assert(indexCss.includes('position: static !important'), 'printable modal must reset position to static');
  assert(indexCss.includes('background: transparent !important'), 'printable modal must reset background');
});

// --------------------------------------------------------------------------
// 2. TRACK APPLICATION VIEW (src/components/TrackingView.tsx)
// --------------------------------------------------------------------------
console.log('\n--- 2. Track Application Official Acknowledgement Slip (src/components/TrackingView.tsx) ---');
const trackingPath = path.resolve(__dirname, '../src/components/TrackingView.tsx');
const trackingCode = fs.readFileSync(trackingPath, 'utf8');

it('handlePrint must call printElement with structured document title', () => {
  assert(trackingCode.includes('handlePrint'), 'handlePrint must be defined');
  assert(trackingCode.includes('printElement('), 'handlePrint must call printElement');
  assert(trackingCode.includes('EasyDesk-Tracking-Receipt'), 'Title must be professional');
});

it('Interactive screen controls must be hidden during print via print:hidden', () => {
  assert(trackingCode.includes('space-y-6 print:hidden'), 'Screen status sections must have print:hidden');
  assert(trackingCode.includes('print:hidden'), 'Form and controls must have print:hidden');
});

it('Dedicated official printable acknowledgement document must exist with .print-only and .printable-tracking-document', () => {
  assert(trackingCode.includes('printable-tracking-document'), 'printable-tracking-document container must exist');
  assert(trackingCode.includes('print-only'), 'Must use print-only class');
});

it('Official printable slip must contain complete organization header and branding', () => {
  assert(trackingCode.includes('EasyDesk Solutions Private Limited'), 'Must include official company name');
  assert(trackingCode.includes('Government Services Citizen Advisory'), 'Must include portal subtitle');
  assert(trackingCode.includes('CIN: U72900MH2024PTC123456'), 'Must include statutory company CIN');
});

it('Official printable slip must display prominent application reference and status', () => {
  assert(trackingCode.includes('#{order.id}'), 'Must display application order ID');
  assert(trackingCode.includes('{order.orderStatus}'), 'Must display current real-time status');
  assert(trackingCode.includes('{order.category'), 'Must display service category');
});

it('Official printable slip must render complete applicant details and structured address', () => {
  assert(trackingCode.includes('{order.name}'), 'Must display applicant name');
  assert(trackingCode.includes('{order.mobile}'), 'Must display applicant mobile');
  assert(trackingCode.includes('{order.email}'), 'Must display applicant email');
  assert(trackingCode.includes('order.addressLine1') || trackingCode.includes('order.address'), 'Must display address line 1');
  assert(trackingCode.includes('order.state'), 'Must display state');
  assert(trackingCode.includes('order.pinCode'), 'Must display pinCode');
});

it('Official printable slip must render payment breakdown table', () => {
  assert(trackingCode.includes('{order.totalAmount}'), 'Must display total amount paid');
  assert(trackingCode.includes('order.paymentMethod'), 'Must display payment method');
  assert(trackingCode.includes('order.paymentStatus'), 'Must display payment status');
  assert(trackingCode.includes('order.utr'), 'Must display transaction UTR reference');
});

it('Official printable slip must render milestone audit logs trail', () => {
  assert(trackingCode.includes('order.logs.map'), 'Must render logs table');
  assert(trackingCode.includes('log.status'), 'Must show log status');
  assert(trackingCode.includes('log.comment'), 'Must show log comment');
});

it('Official printable slip must contain IT Act 2000 disclaimer and security token', () => {
  assert(trackingCode.includes('Information Technology Act, 2000'), 'Must contain IT Act statutory notice');
  assert(trackingCode.includes('AUTH-ED-'), 'Must contain verification security token');
  assert(trackingCode.includes('support@easydesk.in'), 'Must contain support contact info');
});

// --------------------------------------------------------------------------
// 3. PRINT UTILITY (src/lib/printUtils.ts)
// --------------------------------------------------------------------------
console.log('\n--- 3. Unified Print Utility (src/lib/printUtils.ts) ---');
const printUtilsPath = path.resolve(__dirname, '../src/lib/printUtils.ts');
const printUtilsCode = fs.readFileSync(printUtilsPath, 'utf8');

it('printUtils must export printCurrentWindow and printElement', () => {
  assert(printUtilsCode.includes('export function printCurrentWindow'), 'printCurrentWindow must be exported');
  assert(printUtilsCode.includes('export function printElement'), 'printElement must be exported');
});

it('printCurrentWindow must use double requestAnimationFrame timing flush', () => {
  assert(printUtilsCode.includes('requestAnimationFrame'), 'Must use requestAnimationFrame');
  assert(printUtilsCode.includes('window.print()'), 'Must call window.print()');
  assert(printUtilsCode.includes('afterprint'), 'Must listen to afterprint to restore document title');
});

it('printElement must handle iframe sandboxes using isolated print iframe', () => {
  assert(printUtilsCode.includes('easydesk-print-frame'), 'Must use hidden print iframe for sandboxes');
  assert(printUtilsCode.includes('iframe.contentWindow?.print()'), 'Must invoke print on iframe');
});

// --------------------------------------------------------------------------
// 4. EMPLOYEE ID CARD MODAL (src/components/admin/EmployeeIDCardModal.tsx)
// --------------------------------------------------------------------------
console.log('\n--- 4. Employee ID Card Modal (src/components/admin/EmployeeIDCardModal.tsx) ---');
const idCardPath = path.resolve(__dirname, '../src/components/admin/EmployeeIDCardModal.tsx');
const idCardCode = fs.readFileSync(idCardPath, 'utf8');

it('Employee ID Card modal must apply .printable-modal-overlay and .printable-modal-card', () => {
  assert(idCardCode.includes('printable-modal-overlay'), 'Must include printable-modal-overlay');
  assert(idCardCode.includes('printable-modal-card'), 'Must include printable-modal-card');
});

it('Employee ID Card modal must NOT use broken body * { visibility: hidden }', () => {
  assert(!idCardCode.includes('body * {\n            visibility: hidden'), 'Must not use broken body * visibility hidden rule');
  assert(!idCardCode.includes('body * {\r\n            visibility: hidden'), 'Must not use broken body * visibility hidden rule (CRLF)');
});

it('Employee ID Card modal must format .id-card-print-area cleanly for A4 printing', () => {
  assert(idCardCode.includes('.id-card-print-area'), 'id-card-print-area must be defined');
  assert(idCardCode.includes('size: A4 portrait;'), 'Must specify A4 portrait size');
});

it('Employee ID Card modal must NOT hardcode Devendra Sharma in signatory line', () => {
  assert(!idCardCode.includes("authorizedSignatoryName: 'Devendra Sharma'"), 'Must NOT hardcode Devendra Sharma in defaults');
  assert(!idCardCode.includes("|| 'Devendra Sharma'"), 'Must NOT fallback to Devendra Sharma');
});

it('Employee ID Card modal must use neutral fallback "Authorized Authority" when unconfigured', () => {
  assert(idCardCode.includes("'Authorized Authority'"), 'Must fallback to Authorized Authority');
  assert(idCardCode.includes("'Authorized Signatory'"), 'Must fallback to Authorized Signatory designation');
});

it('Employee ID Card settings drawer must provide editable inputs for Authority Name and Designation', () => {
  assert(idCardCode.includes('Authorized Signatory Name'), 'Must have Authorized Signatory Name label');
  assert(idCardCode.includes('Authority Designation'), 'Must have Authority Designation label');
  assert(idCardCode.includes('formCompany.authorizedSignatoryName'), 'Must bind to formCompany.authorizedSignatoryName');
  assert(idCardCode.includes('formCompany.authorizedSignatoryDesignation'), 'Must bind to formCompany.authorizedSignatoryDesignation');
});

it('server.ts PRESEEDED_COMPANY_PROFILE must NOT hardcode Devendra Sharma', () => {
  const serverPath = path.resolve(__dirname, '../server.ts');
  const serverCode = fs.readFileSync(serverPath, 'utf8');
  assert(!serverCode.includes("authorizedSignatoryName: 'Devendra Sharma'"), 'server.ts PRESEEDED_COMPANY_PROFILE must not hardcode Devendra Sharma');
});

it('db_store.json companyProfile must NOT have authorizedSignatoryName set to Devendra Sharma', () => {
  const dbPath = path.resolve(__dirname, '../db_store.json');
  if (fs.existsSync(dbPath)) {
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    if (db.companyProfile) {
      assert(db.companyProfile.authorizedSignatoryName !== 'Devendra Sharma', 'db_store.json companyProfile must not be Devendra Sharma');
    }
  }
});

// --------------------------------------------------------------------------
// 5. EMPLOYEE MANAGEMENT MODULE (src/components/admin/EmployeeManagementModule.tsx)
// --------------------------------------------------------------------------
console.log('\n--- 5. Employee Master Sheet (src/components/admin/EmployeeManagementModule.tsx) ---');
const empModulePath = path.resolve(__dirname, '../src/components/admin/EmployeeManagementModule.tsx');
const empModuleCode = fs.readFileSync(empModulePath, 'utf8');

it('Employee Record Sheet modal must apply .printable-modal-overlay and .printable-modal-card', () => {
  assert(empModuleCode.includes('printable-modal-overlay'), 'Must include printable-modal-overlay');
  assert(empModuleCode.includes('printable-modal-card'), 'Must include printable-modal-card');
});

// --------------------------------------------------------------------------
// 6. CUSTOMER MANAGEMENT MODULE (src/components/admin/CustomerManagementModule.tsx)
// --------------------------------------------------------------------------
console.log('\n--- 6. Customer Master Record & Dossier (src/components/admin/CustomerManagementModule.tsx) ---');
const custModulePath = path.resolve(__dirname, '../src/components/admin/CustomerManagementModule.tsx');
const custModuleCode = fs.readFileSync(custModulePath, 'utf8');

it('Customer Master Record modal must apply .printable-modal-overlay and .printable-modal-card', () => {
  assert(custModuleCode.includes('printable-modal-overlay'), 'Customer Master Record modal must include printable-modal-overlay');
  assert(custModuleCode.includes('printable-modal-card'), 'Customer Master Record modal must include printable-modal-card');
});

console.log('\n--------------------------------------------------------');
console.log(`Results: ${passedTests} / ${totalTests} tests passed.`);
console.log('--------------------------------------------------------\n');

if (passedTests === totalTests) {
  console.log('>>> ALL GLOBAL PRINT SYSTEM TESTS PASSED SUCCESSFULLY! <<<\n');
} else {
  console.error('>>> SOME TESTS FAILED. Please review output above. <<<\n');
  process.exit(1);
}
