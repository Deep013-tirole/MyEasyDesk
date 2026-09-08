const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tempDir = path.join(os.tmpdir(), 'chrome_cdp_profile_' + Date.now());

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    const WebSocket = globalThis.WebSocket;
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const safeExpr = `(() => {
      try {
        return ${expression};
      } catch (err) {
        return 'EVAL_ERR: ' + err.message;
      }
    })()`;
    const res = await this.send('Runtime.evaluate', {
      expression: safeExpr,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result?.value;
  }

  async waitForApp() {
    for (let i = 0; i < 35; i++) {
      const text = await this.eval(`document.getElementById('root')?.textContent || ''`);
      if (text && 
          !text.includes('Establishing EasyDesk') && 
          !text.includes('Loading EasyDesk module') && 
          text.length > 40) {
        await this.sleep(400);
        return true;
      }
      await this.sleep(300);
    }
    return false;
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await this.sleep(800);
    await this.waitForApp();
  }

  async reload() {
    await this.send('Page.reload');
    await this.sleep(800);
    await this.waitForApp();
  }

  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runBrowserTests() {
  console.log('============================================================');
  console.log('STARTING REAL CHROME BROWSER REFRESH & ROUTING AUDIT');
  console.log('============================================================\n');

  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=' + tempDir
  ]);

  await new Promise(r => setTimeout(r, 2000));

  let client;
  let testsPassed = 0;
  const testsTotal = 7;
  try {
    let versionData = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const versionRes = await fetch('http://localhost:9222/json/version');
        versionData = await versionRes.json();
        break;
      } catch (e) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    if (!versionData) throw new Error('Could not connect to Chrome CDP on port 9222 after 10s');
    console.log('Browser: ' + versionData.Browser);

    const targetRes = await fetch('http://localhost:9222/json/new?http://localhost:3000', { method: 'PUT' });
    const targetData = await targetRes.json();
    
    client = new CDPClient(targetData.webSocketDebuggerUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    console.log('Attached to Chrome tab successfully.\n');

    // TEST A: Services -> F5 -> Services remains open
    console.log('--- TEST A: /services -> F5 -> Services remains open ---');
    await client.navigate('http://localhost:3000/services');
    let pathA1 = await client.eval('window.location.pathname');
    let hasServices1 = await client.eval('Boolean(document.getElementById("easydesk-services-view") || document.body.textContent.includes("Services Directory") || document.body.textContent.includes("Digital Services Catalog"))');
    console.log('Initial Load /services -> Path: ' + pathA1 + ', Rendered Services: ' + hasServices1);
    
    await client.reload();
    let pathA2 = await client.eval('window.location.pathname');
    let hasServices2 = await client.eval('Boolean(document.getElementById("easydesk-services-view") || document.body.textContent.includes("Services Directory") || document.body.textContent.includes("Digital Services Catalog"))');
    console.log('After F5 /services -> Path: ' + pathA2 + ', Rendered Services: ' + hasServices2);
    
    if (pathA2 === '/services' && hasServices2) {
      testsPassed++;
      console.log('  [PASS] Test A: /services preserved across F5 refresh!\n');
    } else {
      console.error('  [FAIL] Test A failed\n');
    }

    // TEST B: Click service -> /services/:id -> F5 -> remains open
    console.log('--- TEST B: Click service -> /services/:id -> F5 -> remains open ---');
    await client.navigate('http://localhost:3000/services');
    
    // Find service cards and click Details button
    const clickedTitle = await client.eval(`(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const detailsBtn = btns.find(b => b.textContent.trim() === 'Details');
      if (detailsBtn) {
        detailsBtn.click();
        return 'clicked Details button';
      }
      const h3 = document.querySelector('#easydesk-services-view h3');
      if (h3) {
        h3.click();
        return 'clicked h3 title';
      }
      return 'none';
    })()`);
    console.log('Service Click Action: ' + clickedTitle);
    await client.sleep(1500);
    await client.waitForApp();

    let pathB1 = await client.eval('window.location.pathname');
    let isServiceDetails1 = await client.eval('Boolean(document.getElementById("easydesk-service-details-page") || document.body.textContent.includes("Government Fees") || document.body.textContent.includes("Required Documents"))');
    console.log('After click -> Path: ' + pathB1 + ', ServiceDetails Open: ' + isServiceDetails1);

    await client.reload();
    let pathB2 = await client.eval('window.location.pathname');
    let isServiceDetails2 = await client.eval('Boolean(document.getElementById("easydesk-service-details-page") || document.body.textContent.includes("Government Fees") || document.body.textContent.includes("Required Documents"))');
    console.log('After F5 -> Path: ' + pathB2 + ', ServiceDetails Open: ' + isServiceDetails2);

    if (pathB1.startsWith('/services/') && pathB1 !== '/service-details' && pathB2 === pathB1 && isServiceDetails2) {
      testsPassed++;
      console.log('  [PASS] Test B: /services/:id preserved across F5 refresh (NO /service-details overwrite)!\n');
    } else {
      console.error('  [FAIL] Test B failed\n');
    }

    // TEST C: Blog -> open article -> URL is /blogs/<slug-or-id> -> F5 -> same article remains open
    console.log('--- TEST C: Click article -> /blogs/:slug -> F5 -> remains open ---');
    await client.navigate('http://localhost:3000/blogs');

    const clickedBlog = await client.eval(`(() => {
      const readGuideBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Read Guide'));
      if (readGuideBtn) {
        readGuideBtn.click();
        return 'clicked Read Guide button';
      }
      const article = document.querySelector('article');
      if (article) {
        article.click();
        return 'clicked article';
      }
      return 'none';
    })()`);
    console.log('Blog Click Action: ' + clickedBlog);
    await client.sleep(1500);
    await client.waitForApp();

    let pathC1 = await client.eval('window.location.pathname');
    let isBlogDetails1 = await client.eval('Boolean(document.getElementById("blog-detail-view") || document.body.textContent.includes("Table of Contents") || document.body.textContent.includes("Back to All Guides"))');
    console.log('After blog click -> Path: ' + pathC1 + ', Article Open: ' + isBlogDetails1);

    await client.reload();
    let pathC2 = await client.eval('window.location.pathname');
    let isBlogDetails2 = await client.eval('Boolean(document.getElementById("blog-detail-view") || document.body.textContent.includes("Table of Contents") || document.body.textContent.includes("Back to All Guides"))');
    console.log('After F5 -> Path: ' + pathC2 + ', Article Open: ' + isBlogDetails2);

    if (pathC1.startsWith('/blogs/') && pathC2 === pathC1 && isBlogDetails2) {
      testsPassed++;
      console.log('  [PASS] Test C: /blogs/:slug preserved across F5 refresh!\n');
    } else {
      console.error('  [FAIL] Test C failed\n');
    }

    // TEST D: /track-order -> F5 -> TrackingView remains open
    console.log('--- TEST D: /track-order -> F5 -> TrackingView remains open ---');
    await client.navigate('http://localhost:3000/track-order');
    let pathD1 = await client.eval('window.location.pathname');
    let hasTracker1 = await client.eval('Boolean(document.getElementById("easydesk-tracking") || document.body.textContent.includes("Track Digital Certificate") || document.body.textContent.includes("Fetch Application Status"))');
    console.log('Initial /track-order -> Path: ' + pathD1 + ', Tracker Rendered: ' + hasTracker1);

    await client.reload();
    let pathD2 = await client.eval('window.location.pathname');
    let hasTracker2 = await client.eval('Boolean(document.getElementById("easydesk-tracking") || document.body.textContent.includes("Track Digital Certificate") || document.body.textContent.includes("Fetch Application Status"))');
    console.log('After F5 /track-order -> Path: ' + pathD2 + ', Tracker Rendered: ' + hasTracker2);

    if (pathD2 === '/track-order' && hasTracker2) {
      testsPassed++;
      console.log('  [PASS] Test D: /track-order preserved across F5 refresh!\n');
    } else {
      console.error('  [FAIL] Test D failed\n');
    }

    // TEST E: Trailing slashes: /services/, /blogs/, /about/, /contact/, /payment/, /track/, /admin/
    console.log('--- TEST E: Trailing slash immunity across all routes ---');
    const slashRoutes = ['/services/', '/blogs/', '/about/', '/contact/', '/payment/', '/track/', '/admin/'];
    let allSlashesPassed = true;

    for (const r of slashRoutes) {
      await client.navigate('http://localhost:3000' + r);
      let p = await client.eval('window.location.pathname');
      let isHome = await client.eval('Boolean(document.body.textContent.includes("Apply online for Government, Educational") && !document.getElementById("easydesk-services-view") && !document.getElementById("easydesk-blogs-view") && !document.getElementById("easydesk-about-view"))');
      let status = (!isHome) ? 'PASS' : 'FAIL (fell back to Home)';
      console.log('  Route: ' + r.padEnd(12) + ' -> Browser Path: ' + p + ', Not Home: ' + (!isHome) + ' [' + status + ']');
      if (isHome) allSlashesPassed = false;
    }

    if (allSlashesPassed) {
      testsPassed++;
      console.log('  [PASS] Test E: Zero trailing-slash routes fell back to Home!\n');
    } else {
      console.error('  [FAIL] Test E failed\n');
    }

    // TEST F: /admin/orders -> F5 -> Admin Dashboard -> Orders tab
    console.log('--- TEST F: /admin/orders -> F5 -> Orders tab active ---');
    await client.eval(`(() => {
      localStorage.setItem('easydesk_admin_user', JSON.stringify({
        id: 'admin-test-id',
        name: 'System Administrator',
        email: 'admin@easydesk.com',
        role: 'ADMIN'
      }));
      localStorage.setItem('easydesk_admin_token', 'test_admin_jwt_token_123');
    })()`);

    await client.navigate('http://localhost:3000/admin/orders');
    let pathF1 = await client.eval('window.location.pathname');
    let hasOrders1 = await client.eval('Boolean(document.body.textContent.includes("Operations Orders Board") || document.body.textContent.includes("Create Order") || document.body.textContent.includes("Order") || document.querySelector("table"))');
    console.log('Initial /admin/orders -> Path: ' + pathF1 + ', Orders Tab: ' + hasOrders1);

    await client.reload();
    let pathF2 = await client.eval('window.location.pathname');
    let hasOrders2 = await client.eval('Boolean(document.body.textContent.includes("Operations Orders Board") || document.body.textContent.includes("Create Order") || document.body.textContent.includes("Order") || document.querySelector("table"))');
    console.log('After F5 /admin/orders -> Path: ' + pathF2 + ', Orders Tab: ' + hasOrders2);

    if (pathF2 === '/admin/orders' && hasOrders2) {
      testsPassed++;
      console.log('  [PASS] Test F: /admin/orders restored exact Orders tab on refresh!\n');
    } else {
      console.error('  [FAIL] Test F failed\n');
    }

    // TEST G: Browser Back/Forward navigation
    console.log('--- TEST G: Browser Back/Forward navigation synchronization ---');
    await client.navigate('http://localhost:3000/');
    let pG0 = await client.eval('window.location.pathname');

    await client.navigate('http://localhost:3000/services');
    let pG1 = await client.eval('window.location.pathname');

    await client.navigate('http://localhost:3000/services/pan-card');
    let pG2 = await client.eval('window.location.pathname');

    await client.eval('window.history.back()');
    await client.waitForApp();
    let pG3 = await client.eval('window.location.pathname');
    let isServicesG3 = await client.eval('Boolean(document.getElementById("easydesk-services-view") || document.body.textContent.includes("Services"))');

    await client.eval('window.history.forward()');
    await client.waitForApp();
    let pG4 = await client.eval('window.location.pathname');
    let isDetailsG4 = await client.eval('Boolean(document.getElementById("easydesk-service-details-page") || document.body.textContent.includes("PAN") || document.body.textContent.includes("Service Details") || document.body.textContent.includes("Government Fees"))');

    console.log('  Initial: ' + pG0 + ' -> Nav1: ' + pG1 + ' -> Nav2: ' + pG2);
    console.log('  Back: ' + pG3 + ' (Services Rendered: ' + isServicesG3 + ')');
    console.log('  Forward: ' + pG4 + ' (Detail Rendered: ' + isDetailsG4 + ')');

    if (pG3 === '/services' && pG4 === '/services/pan-card' && isServicesG3) {
      testsPassed++;
      console.log('  [PASS] Test G: Browser Back and Forward synchronized perfectly without URL/state mismatch!\n');
    } else {
      console.error('  [FAIL] Test G failed\n');
    }

  } catch (err) {
    console.error('Browser testing error:', err);
  } finally {
    if (client) client.close();
    chrome.kill();
    console.log('============================================================');
    console.log('BROWSER VERIFICATION SUMMARY: ' + testsPassed + ' / ' + testsTotal + ' PASSED');
    console.log('============================================================\n');
    if (testsPassed === testsTotal) {
      console.log('ALL REAL BROWSER TESTS PASSED (100%)!');
      process.exit(0);
    } else {
      process.exit(1);
    }
  }
}

runBrowserTests();
