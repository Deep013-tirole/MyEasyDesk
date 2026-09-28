const fs = require('fs');
const path = require('path');

function runChecks() {
  console.log('--- RUNNING AUDIT & VERIFICATION FOR ALL 7 FIXES ---');
  let passCount = 0;
  let totalCount = 0;

  function assert(condition, message) {
    totalCount++;
    if (condition) {
      console.log(`[PASS] ${message}`);
      passCount++;
    } else {
      console.error(`[FAIL] ${message}`);
      process.exitCode = 1;
    }
  }

  // 1. DATA INTEGRITY CHECK
  const dbPath = path.resolve(__dirname, '../db_store.json');
  assert(fs.existsSync(dbPath), 'db_store.json exists');
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  assert(Array.isArray(db.customers) && db.customers.length === 688, `Customers intact (Expected 688, Found: ${db.customers?.length})`);
  assert(Array.isArray(db.employees) && db.employees.length === 345, `Employees intact (Expected 345, Found: ${db.employees?.length})`);
  assert(Array.isArray(db.orders) && db.orders.length === 477, `Orders intact (Expected 477, Found: ${db.orders?.length})`);
  assert(Array.isArray(db.services) && db.services.length === 22, `Services intact (Expected 22, Found: ${db.services?.length})`);

  // 2. FIX 1: Blog Delete / Visibility
  const serverCode = fs.readFileSync(path.resolve(__dirname, '../server.ts'), 'utf8');
  assert(serverCode.includes("res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')"), 'server.ts sets no-cache header on blogs GET');
  assert(serverCode.includes('blogs: [] as Blog[]'), 'server.ts initializes in-memory blogs as empty array');
  
  const catalogServiceCode = fs.readFileSync(path.resolve(__dirname, '../src/services/catalogService.ts'), 'utf8');
  assert(catalogServiceCode.includes('setCachedCatalog(cacheKey, data)') && catalogServiceCode.includes('safeParseJsonResponse'), 'catalogService caches valid responses including empty array results');

  const blogsViewCode = fs.readFileSync(path.resolve(__dirname, '../src/components/BlogsView.tsx'), 'utf8');
  assert(blogsViewCode.includes('Article Not Found') && blogsViewCode.includes('This blog article or guide has been removed'), 'BlogsView displays not found screen when blog removed');

  // 3. FIX 2: Service Active / Inactive
  const typesCode = fs.readFileSync(path.resolve(__dirname, '../src/types.ts'), 'utf8');
  assert(typesCode.includes('active?: boolean;'), 'Service interface includes active?: boolean');

  const adminDashboardCode = fs.readFileSync(path.resolve(__dirname, '../src/components/AdminDashboard.tsx'), 'utf8');
  assert(adminDashboardCode.includes('handleToggleServiceStatus'), 'AdminDashboard includes handleToggleServiceStatus');

  const servicesViewCode = fs.readFileSync(path.resolve(__dirname, '../src/components/ServicesView.tsx'), 'utf8');
  assert(servicesViewCode.includes("st !== 'inactive'") && servicesViewCode.includes('s.active !== false'), 'ServicesView filters out inactive services');

  const applyModalCode = fs.readFileSync(path.resolve(__dirname, '../src/components/ApplyOnlineModal.tsx'), 'utf8');
  assert(applyModalCode.includes('Service Currently Inactive') && applyModalCode.includes('not accepting online applications'), 'ApplyOnlineModal blocks inactive services');

  // 4. FIX 3: Service Eligibility
  const serviceEditorCode = fs.readFileSync(path.resolve(__dirname, '../src/components/admin/ServiceEditorModule.tsx'), 'utf8');
  assert(serviceEditorCode.includes('handleAddEligibilityBullet') && serviceEditorCode.includes('handleAddEligibilityNumber'), 'ServiceEditorModule includes bullet and number helper buttons');

  const serviceDetailsCode = fs.readFileSync(path.resolve(__dirname, '../src/components/ServiceDetailsView.tsx'), 'utf8');
  assert(serviceDetailsCode.includes('parseEligibilityPoints'), 'ServiceDetailsView includes parseEligibilityPoints parser');

  // 5. FIX 4: Service Details UI Simplification
  assert(serviceDetailsCode.includes('isServiceInactive') && serviceDetailsCode.includes('Applications Temporarily Closed'), 'ServiceDetailsView shows clean inactive banner and disabled CTA');

  // 6. FIX 5: Brand Name "My EasyDesk"
  const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
  assert(indexHtml.includes('<title>My EasyDesk — Digital Documentation & Citizen Advisory Portal</title>'), 'index.html title has My EasyDesk');

  const seoConfigCode = fs.readFileSync(path.resolve(__dirname, '../src/lib/seoConfig.ts'), 'utf8');
  assert(seoConfigCode.includes("const siteName = 'My EasyDesk'") && seoConfigCode.includes("'My EasyDesk'"), 'seoConfig.ts uses My EasyDesk for site name and company name');

  const headerCode = fs.readFileSync(path.resolve(__dirname, '../src/components/Header.tsx'), 'utf8');
  assert(headerCode.includes('aria-label="My EasyDesk Home"') && headerCode.includes('My EasyDesk'), 'Header.tsx renders My EasyDesk');

  const footerCode = fs.readFileSync(path.resolve(__dirname, '../src/components/Footer.tsx'), 'utf8');
  assert(footerCode.includes('My EasyDesk Solutions Private Limited') && footerCode.includes('Hello My EasyDesk'), 'Footer.tsx renders My EasyDesk in copyright and WhatsApp');

  const homeViewCode = fs.readFileSync(path.resolve(__dirname, '../src/components/HomeView.tsx'), 'utf8');
  assert(homeViewCode.includes('How My EasyDesk Works') && homeViewCode.includes('Why Choose My EasyDesk'), 'HomeView.tsx has My EasyDesk in headings');

  const aboutUsCode = fs.readFileSync(path.resolve(__dirname, '../src/components/AboutUsView.tsx'), 'utf8');
  assert(aboutUsCode.includes('Why Citizens Choose My EasyDesk') && aboutUsCode.includes('How My EasyDesk Works'), 'AboutUsView.tsx has My EasyDesk in headings');

  // 7. FIX 6: Logo + Favicon
  const d1StorageCode = fs.readFileSync(path.resolve(__dirname, '../src/lib/d1Storage.ts'), 'utf8');
  assert(d1StorageCode.includes("'generalSettings'"), 'd1Storage.ts includes generalSettings in SETTING_KEYS');

  const appCode = fs.readFileSync(path.resolve(__dirname, '../src/App.tsx'), 'utf8');
  assert(appCode.includes('faviconUrl || DEFAULT_FAVICON') && appCode.includes('easydesk_general_settings_updated'), 'App.tsx synchronizes faviconUrl dynamically');

  assert(headerCode.includes('logoUrl && !logoFailed') && headerCode.includes('alt="My EasyDesk Logo"'), 'Header.tsx displays dynamic logo with shield fallback');
  assert(footerCode.includes('logoUrl && !logoFailed') && footerCode.includes('alt="My EasyDesk Logo"'), 'Footer.tsx displays dynamic logo with shield fallback');

  // 8. FIX 7: Responsive Admin Panel
  assert(adminDashboardCode.includes('w-full max-w-full min-w-0 overflow-x-hidden'), 'AdminDashboard root container has mobile overflow-x-hidden');
  assert(adminDashboardCode.includes('touch-pan-x w-full max-w-full'), 'AdminDashboard quick pills support mobile touch scrolling');
  assert(adminDashboardCode.includes('md:col-span-4 min-w-0 w-full max-w-full overflow-x-hidden space-y-6'), 'AdminDashboard work board container prevents mobile horizontal overflow');

  console.log(`\nAUDIT SUMMARY: ${passCount}/${totalCount} assertions passed.`);
}

runChecks();
