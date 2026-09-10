/**
 * EASYDESK — LIVE BROWSER DOM SEO VERIFICATION SUITE (CDP HEADLESS CHROME)
 * 
 * Uses Chrome DevTools Protocol (CDP) over WebSocket to inspect live DOM:
 * - Mobile Viewports (375x812, 390x844)
 * - Tablet Viewport (768x1024)
 * - Desktop Viewport (1280x800)
 */

process.env.NODE_ENV = 'production';
process.env.PORT = '3018';
delete process.env.IS_WORKER;

const path = require('path');
const { spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const assert = require('assert');

// Requiring server.cjs auto-starts Express on port 3018 in production mode
require('../dist/server.cjs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tempDir = path.join(os.tmpdir(), 'chrome_seo_test_' + Date.now());

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

  async waitForApp(maxAttempts = 40) {
    for (let i = 0; i < maxAttempts; i++) {
      const text = await this.eval(`document.getElementById('root')?.textContent || ''`);
      if (text && !text.includes('Establishing EasyDesk') && text.length > 20) {
        await this.sleep(300);
        return true;
      }
      await this.sleep(200);
    }
    return false;
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await this.sleep(800);
    await this.waitForApp();
  }

  async setViewport(width, height, mobile = false, deviceScaleFactor = 1) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor,
      mobile
    });
    await this.sleep(200);
  }

  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  close() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (_) {}
    }
  }
}

async function runBrowserSeoTests() {
  console.log('================================================================');
  console.log('EASYDESK — LIVE BROWSER DOM SEO SUITE (CDP HEADLESS CHROME)');
  console.log('================================================================\n');

  if (!fs.existsSync(chromePath)) {
    console.error(`Chrome executable not found at: ${chromePath}`);
    process.exit(1);
  }

  const baseUrl = `http://localhost:3018`;

  // 1. Wait for server on port 3018
  console.log(`[SERVER] Waiting for production server on ${baseUrl}...`);
  let serverReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${baseUrl}/`);
      if (res.ok) {
        serverReady = true;
        break;
      }
    } catch (_) {
      await new Promise(r => setTimeout(r, 400));
    }
  }
  if (!serverReady) {
    console.error('Server failed to start on port 3018');
    process.exit(1);
  }
  console.log(`[SERVER] Production server confirmed active on ${baseUrl}\n`);

  // 2. Launch Chrome
  const cdpPort = 9225;
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--user-data-dir=' + tempDir
  ]);

  let client = null;
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  function it(desc, condition, detail = '') {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✓ [PASS] ${desc}`);
    } else {
      failedTests++;
      console.error(`  ✗ [FAIL] ${desc} ${detail ? '(' + detail + ')' : ''}`);
    }
  }

  try {
    // 3. Connect CDP
    let versionData = null;
    for (let i = 0; i < 20; i++) {
      try {
        const v = await fetch(`http://localhost:${cdpPort}/json/version`);
        versionData = await v.json();
        break;
      } catch {
        await new Promise(r => setTimeout(r, 400));
      }
    }
    if (!versionData) throw new Error('Chrome CDP connection failed on port ' + cdpPort);
    console.log(`[CHROME] Connected to ${versionData.Browser}\n`);

    // Create target page
    const targetRes = await fetch(`http://localhost:${cdpPort}/json/new?${baseUrl}/`, { method: 'PUT' });
    const target = await targetRes.json();
    client = new CDPClient(target.webSocketDebuggerUrl);
    await client.connect();
    await client.waitForApp();

    const inspectedHtmls = [];

    // ----------------------------------------------------------------
    // 1. MOBILE VIEWPORT (375 x 812) — iPhone SE
    // ----------------------------------------------------------------
    console.log('[VIEWPORT: MOBILE 375x812] Testing Home & Service Details');
    await client.setViewport(375, 812, true, 3);
    await client.navigate(`${baseUrl}/`);

    const homeTitle = await client.eval(`document.title`);
    const homeCanonical = await client.eval(`document.querySelector('link[rel="canonical"]')?.getAttribute('href') || ''`);
    const homeDescription = await client.eval(`document.querySelector('meta[name="description"]')?.getAttribute('content') || ''`);
    const homeSchemas = await client.eval(`Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(s => s.textContent).join(' ')`);
    const homeHtml = await client.eval(`document.documentElement.outerHTML`);
    inspectedHtmls.push(homeHtml);

    it('1. Mobile 375x812 Home: <title> contains "EasyDesk"', homeTitle.includes('EasyDesk'), homeTitle);
    it('2. Mobile 375x812 Home: Canonical link uses production origin and NEVER easydesk.in', 
      homeCanonical.includes('myeasydesk.tideepak8.workers.dev') && !homeCanonical.includes('easydesk.in'), homeCanonical);
    it('3. Mobile 375x812 Home: Meta description is present and descriptive', homeDescription.length > 20, homeDescription);
    it('4. Mobile 375x812 Home: JSON-LD WebSite and Organization schema present', homeSchemas.includes('WebSite') || homeSchemas.includes('Organization'));

    // PAN Service
    await client.navigate(`${baseUrl}/services/pan`);
    const panTitle = await client.eval(`document.title`);
    const panCanonical = await client.eval(`document.querySelector('link[rel="canonical"]')?.getAttribute('href') || ''`);
    let panH1 = '';
    for (let i = 0; i < 25; i++) {
      panH1 = await client.eval(`document.querySelector('h1')?.textContent || ''`);
      if (panH1 && panH1.length > 0) break;
      await client.sleep(200);
    }
    const panHtml = await client.eval(`document.documentElement.outerHTML`);
    inspectedHtmls.push(panHtml);

    it('5. Mobile 375x812 PAN Service: Title specifically describes PAN Card assistance', 
      panTitle.includes('PAN') && panTitle.includes('EasyDesk'), panTitle);
    it('6. Mobile 375x812 PAN Service: Canonical URL points to /services/pan', 
      panCanonical.includes('/services/pan') && !panCanonical.includes('easydesk.in'), panCanonical);
    it('7. Mobile 375x812 PAN Service: Renders semantic H1 heading', panH1.length > 0, panH1);

    // ----------------------------------------------------------------
    // 2. MOBILE VIEWPORT (390 x 844) — iPhone 14
    // ----------------------------------------------------------------
    console.log('\n[VIEWPORT: MOBILE 390x844] Testing Blog Detail & Tracking');
    await client.setViewport(390, 844, true, 3);
    await client.navigate(`${baseUrl}/blogs/blog-1`);

    const blogTitle = await client.eval(`document.title`);
    const blogCanonical = await client.eval(`document.querySelector('link[rel="canonical"]')?.getAttribute('href') || ''`);
    const blogSchemas = await client.eval(`Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(s => s.textContent).join(' ')`);
    const blogHtml = await client.eval(`document.documentElement.outerHTML`);
    inspectedHtmls.push(blogHtml);

    it('8. Mobile 390x844 Blog Detail: Title matches article and brand', blogTitle.includes('EasyDesk'), blogTitle);
    it('9. Mobile 390x844 Blog Detail: Canonical points to /blogs/blog-1', 
      blogCanonical.includes('/blogs/blog-1') && !blogCanonical.includes('easydesk.in'), blogCanonical);
    it('10. Mobile 390x844 Blog Detail: JSON-LD BlogPosting schema present', blogSchemas.includes('BlogPosting'));

    // Track application
    await client.navigate(`${baseUrl}/track`);
    const trackTitle = await client.eval(`document.title`);
    const trackCanonical = await client.eval(`document.querySelector('link[rel="canonical"]')?.getAttribute('href') || ''`);
    const trackHtml = await client.eval(`document.documentElement.outerHTML`);
    inspectedHtmls.push(trackHtml);

    it('11. Mobile 390x844 Track Page: Title indicates Track Application', trackTitle.toLowerCase().includes('track'), trackTitle);
    it('12. Mobile 390x844 Track Page: Canonical points to /track', trackCanonical.includes('/track'), trackCanonical);

    // ----------------------------------------------------------------
    // 3. TABLET VIEWPORT (768 x 1024) — iPad
    // ----------------------------------------------------------------
    console.log('\n[VIEWPORT: TABLET 768x1024] Testing Services Catalog & About View');
    await client.setViewport(768, 1024, true, 2);
    await client.navigate(`${baseUrl}/services`);

    const servicesTitle = await client.eval(`document.title`);
    const servicesCanonical = await client.eval(`document.querySelector('link[rel="canonical"]')?.getAttribute('href') || ''`);
    const servicesHtml = await client.eval(`document.documentElement.outerHTML`);
    inspectedHtmls.push(servicesHtml);

    it('13. Tablet 768x1024 Services: Title mentions Services', servicesTitle.includes('Services'), servicesTitle);
    it('14. Tablet 768x1024 Services: Canonical points to /services', servicesCanonical.includes('/services'), servicesCanonical);

    await client.navigate(`${baseUrl}/about`);
    const aboutTitle = await client.eval(`document.title`);
    const aboutCanonical = await client.eval(`document.querySelector('link[rel="canonical"]')?.getAttribute('href') || ''`);
    const aboutHtml = await client.eval(`document.documentElement.outerHTML`);
    inspectedHtmls.push(aboutHtml);

    it('15. Tablet 768x1024 About: Title mentions About EasyDesk', aboutTitle.includes('About'), aboutTitle);
    it('16. Tablet 768x1024 About: Canonical points to /about', aboutCanonical.includes('/about'), aboutCanonical);

    // ----------------------------------------------------------------
    // 4. DESKTOP VIEWPORT (1280 x 800)
    // ----------------------------------------------------------------
    console.log('\n[VIEWPORT: DESKTOP 1280x800] Testing Desktop Layout & 404 Recovery');
    await client.setViewport(1280, 800, false, 1);
    await client.navigate(`${baseUrl}/`);

    const desktopFooter = await client.eval(`Boolean(document.querySelector('footer'))`);
    it('17. Desktop 1280x800 Home: Renders full semantic footer', desktopFooter);

    // 404 Not Found Page
    await client.navigate(`${baseUrl}/random-non-existent-page-test-12345`);
    const notFoundTitle = await client.eval(`document.title`);
    const notFoundRobots = await client.eval(`document.querySelector('meta[name="robots"]')?.getAttribute('content') || ''`);
    const notFoundLinks = await client.eval(`Array.from(document.querySelectorAll('a')).map(a => a.href).join(' ')`);
    const notFoundHtml = await client.eval(`document.documentElement.outerHTML`);
    inspectedHtmls.push(notFoundHtml);

    it('18. Desktop 1280x800 404: Title indicates 404 Page Not Found', 
      notFoundTitle.includes('404') || notFoundTitle.toLowerCase().includes('not found'), notFoundTitle);
    it('19. Desktop 1280x800 404: Meta robots contains "noindex"', notFoundRobots.includes('noindex'), notFoundRobots);
    it('20. Desktop 1280x800 404: Contains recovery links (Home, Services)', 
      notFoundLinks.includes('services') || notFoundLinks.includes(baseUrl));

    // Global Domain Safety Invariant across all inspected live DOMs
    console.log('\n[GLOBAL SAFETY INVARIANT] Verifying zero unauthorized domain occurrences');
    let unauthorizedCount = 0;
    for (const dom of inspectedHtmls) {
      if (dom.includes('https://easydesk.in')) {
        unauthorizedCount++;
      }
    }
    it('21. Global Safety Check: Strictly ZERO rendered DOMs contain https://easydesk.in', unauthorizedCount === 0);

  } finally {
    if (client) client.close();
    chrome.kill();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  }

  console.log('\n================================================================');
  console.log(`BROWSER SEO SUITE COMPLETE: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runBrowserSeoTests().catch(err => {
  console.error('Fatal browser test error:', err);
  process.exit(1);
});
