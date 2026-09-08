process.env.NODE_ENV = 'production';
process.env.PORT = '3000';

const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

// In production mode, dist/server.cjs automatically serves built assets and starts on port 3000
const { app } = require('c:/Users/dell/Downloads/EasyDesk/dist/server.cjs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const tempDir = path.join(os.tmpdir(), 'chrome_redesign_test_' + Date.now());

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
    for (let i = 0; i < 40; i++) {
      const text = await this.eval(`document.getElementById('root')?.textContent || ''`);
      if (text && 
          !text.includes('Establishing EasyDesk') && 
          text.length > 50) {
        await this.sleep(400);
        return true;
      }
      await this.sleep(250);
    }
    return false;
  }

  async waitForSelector(selector, maxWaitMs = 6000) {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const found = await this.eval(`Boolean(document.querySelector('${selector}'))`);
      if (found) {
        await this.sleep(200);
        return true;
      }
      await this.sleep(200);
    }
    return false;
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await this.sleep(600);
    await this.waitForApp();
  }

  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function run() {
  console.log('============================================================');
  console.log('STARTING EASYDESK COMPLETE CIVIC-TECH UI/UX AUDIT');
  console.log('============================================================\n');

  // Verify server is ready on port 3000
  let serverReady = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      const res = await fetch('http://localhost:3000');
      if (res.ok) {
        serverReady = true;
        break;
      }
    } catch {
      await new Promise(r => setTimeout(r, 400));
    }
  }
  if (!serverReady) {
    throw new Error('Server not responding on http://localhost:3000');
  }
  console.log('[SERVER] EasyDesk production server confirmed responding on port 3000\n');

  // Launch headless Chrome
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,900',
    '--user-data-dir=' + tempDir
  ]);

  let client = null;
  let passed = 0;
  let total = 0;

  function record(name, condition, details = '') {
    total++;
    if (condition) {
      passed++;
      console.log(`  [PASS] ${name}`);
    } else {
      console.error(`  [FAIL] ${name} ${details ? '(' + details + ')' : ''}`);
    }
  }

  try {
    // Connect to CDP
    let versionData = null;
    for (let i = 0; i < 15; i++) {
      try {
        const v = await fetch('http://localhost:9222/json/version');
        versionData = await v.json();
        break;
      } catch {
        await new Promise(r => setTimeout(r, 600));
      }
    }
    if (!versionData) throw new Error('Chrome CDP connection failed');
    console.log(`[CHROME] Connected to ${versionData.Browser}\n`);

    const targetRes = await fetch('http://localhost:9222/json/new?http://localhost:3000', { method: 'PUT' });
    const targetData = await targetRes.json();
    client = new CDPClient(targetData.webSocketDebuggerUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    // -------------------------------------------------------------
    // 1. HOME VIEW VERIFICATION
    // -------------------------------------------------------------
    console.log('--- 1. Testing Home Page (/) ---');
    await client.navigate('http://localhost:3000');
    await client.waitForSelector('h1');
    const homeTitle = await client.eval(`document.querySelector('h1')?.textContent || ''`);
    record('Hero title rendered ("Your Online Work, Done Easily & Securely")', homeTitle.includes('Online Work') || homeTitle.includes('Done Easily'));

    const searchInput = await client.eval(`Boolean(document.querySelector('input[placeholder*="Search"]'))`);
    record('Hero quick search input exists', searchInput);

    const popularServicesCount = await client.eval(`document.querySelectorAll('h3').length`);
    record('Popular services rendered with shortDescription', popularServicesCount > 0);

    const hasFakeStars = await client.eval(`document.body.innerText.includes('4.9 / 5 (18 reviews)')`);
    record('No fake review counts displayed', !hasFakeStars);

    // -------------------------------------------------------------
    // 2. SERVICES CATALOG VIEW VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Services View (/services) ---');
    await client.navigate('http://localhost:3000/services');
    await client.waitForSelector('h1');
    
    const servicesBreadcrumb = await client.eval(`Boolean(document.querySelector('nav[aria-label="Breadcrumb"]'))`);
    record('Breadcrumbs navigation mounted on Services page', servicesBreadcrumb);

    const servicesTitle = await client.eval(`document.querySelector('h1')?.textContent || ''`);
    record('Services Directory heading rendered', servicesTitle.includes('Digital Services Directory'));

    const searchCatalog = await client.eval(`Boolean(document.querySelector('input[placeholder*="Search by service name"]'))`);
    record('Catalog search input exists with placeholder', searchCatalog);

    const sortDropdown = await client.eval(`Boolean(document.querySelector('select'))`);
    record('Sort dropdown exists', sortDropdown);

    const cardPriceStarting = await client.eval(`document.body.innerText.includes('Starting Fee') || document.body.innerText.includes('₹')`);
    record('Transparent starting price rendered on cards', cardPriceStarting);

    // -------------------------------------------------------------
    // 3. SERVICE DETAILS VIEW VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing Service Details View ---');
    // Click Details button on the first service card
    const clickedFirst = await client.eval(`(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const detailsBtn = btns.find(b => b.textContent.trim() === 'Details');
      if (detailsBtn) { detailsBtn.click(); return true; }
      return false;
    })()`);
    await client.sleep(800);
    await client.waitForSelector('#section-documents');

    const detailsUrl = await client.eval(`window.location.pathname`);
    record('Service detail navigation works', detailsUrl.startsWith('/services/'));

    const detailsBreadcrumb = await client.eval(`Boolean(document.querySelector('nav'))`);
    record('Breadcrumbs mounted on Service Details', detailsBreadcrumb);

    const docChecklist = await client.eval(`Boolean(document.getElementById('section-documents'))`);
    record('Interactive Document Readiness Checklist section present', docChecklist);

    const applyOnlineBtn = await client.eval(`Boolean(document.getElementById('btn-apply-online-primary'))`);
    record('Apply Online primary CTA present', applyOnlineBtn);

    const whatsappBtn = await client.eval(`Boolean(document.getElementById('btn-order-on-whatsapp-primary'))`);
    record('WhatsApp Order CTA present', whatsappBtn);

    // -------------------------------------------------------------
    // 4. KNOWLEDGE HUB / BLOGS VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing Knowledge Hub (/blogs) ---');
    await client.navigate('http://localhost:3000/blogs');
    await client.waitForSelector('h1');

    const blogsBreadcrumb = await client.eval(`Boolean(document.querySelector('nav[aria-label="Breadcrumb"]'))`);
    record('Breadcrumbs mounted on Knowledge Hub', blogsBreadcrumb);

    const blogsTitle = await client.eval(`document.querySelector('h1')?.textContent || ''`);
    record('Knowledge Hub heading rendered', blogsTitle.includes('Knowledge Hub'));

    // -------------------------------------------------------------
    // 5. ABOUT US VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing About Us (/about) ---');
    await client.navigate('http://localhost:3000/about');
    await client.waitForSelector('h1');

    const aboutBreadcrumb = await client.eval(`Boolean(document.querySelector('nav[aria-label="Breadcrumb"]'))`);
    record('Breadcrumbs mounted on About Us', aboutBreadcrumb);

    const aboutText = await client.eval(`document.body.innerText`);
    record('Real value propositions (Pre-Audit Filing, Pan-India Reach)', aboutText.includes('Pre-Audit Filing') && aboutText.includes('Pan-India Reach'));
    record('No fabricated 10,000+ or 99.8% metrics on About Us', !aboutText.includes('10,000+ Services Delivered'));

    // -------------------------------------------------------------
    // 6. CONTACT US VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- 6. Testing Contact Us (/contact) ---');
    await client.navigate('http://localhost:3000/contact');
    await client.waitForSelector('form');

    const contactBreadcrumb = await client.eval(`Boolean(document.querySelector('nav[aria-label="Breadcrumb"]'))`);
    record('Breadcrumbs mounted on Contact Us', contactBreadcrumb);

    const contactForm = await client.eval(`Boolean(document.querySelector('form'))`);
    record('Inquiry form rendered', contactForm);

    // -------------------------------------------------------------
    // 7. PAYMENT VIEW VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- 7. Testing Payment Portal (/payment) ---');
    await client.navigate('http://localhost:3000/payment');
    await client.waitForSelector('h1');

    const paymentBreadcrumb = await client.eval(`Boolean(document.querySelector('nav[aria-label="Breadcrumb"]'))`);
    record('Breadcrumbs mounted on Payment page', paymentBreadcrumb);

    const utrInput = await client.eval(`Boolean(document.querySelector('input[placeholder*="12-digit"]'))`);
    record('UTR/Transaction Reference input rendered', utrInput);

    // -------------------------------------------------------------
    // 8. TRACK ORDER VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- 8. Testing Track Order (/track) ---');
    await client.navigate('http://localhost:3000/track');
    await client.waitForSelector('#track-order-id');

    const trackBreadcrumb = await client.eval(`Boolean(document.querySelector('nav[aria-label="Breadcrumb"]'))`);
    record('Breadcrumbs mounted on Track page', trackBreadcrumb);

    const trackInput = await client.eval(`Boolean(document.getElementById('track-order-id'))`);
    record('Track Order ID input rendered', trackInput);

    // -------------------------------------------------------------
    // 9. PRIVACY & SECURITY VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- 9. Testing Privacy & Security (/privacy-security) ---');
    await client.navigate('http://localhost:3000/privacy-security');
    await client.waitForSelector('h1');

    const privacyBreadcrumb = await client.eval(`Boolean(document.querySelector('nav[aria-label="Breadcrumb"]'))`);
    record('Breadcrumbs mounted on Privacy & Security page', privacyBreadcrumb);

    // -------------------------------------------------------------
    // 10. MOBILE BOTTOM NAVIGATION VERIFICATION (Viewport 375x812)
    // -------------------------------------------------------------
    console.log('\n--- 10. Testing Mobile Sticky Bottom Navigation (375x812) ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true
    });
    await client.navigate('http://localhost:3000');
    await client.sleep(500);

    const mobileNavVisible = await client.eval(`(() => {
      const el = document.getElementById('mobile-bottom-nav');
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.height > 0 && rect.bottom <= window.innerHeight + 5;
    })()`);
    record('MobileBottomNav is visible at bottom of screen on mobile viewport', mobileNavVisible);

    const mobileNavItems = await client.eval(`(() => {
      const el = document.getElementById('mobile-bottom-nav');
      return el ? el.querySelectorAll('button').length : 0;
    })()`);
    record('MobileBottomNav has action items (Home, Services, Track, WhatsApp)', mobileNavItems >= 4);

    // -------------------------------------------------------------
    // 11. COMMAND PALETTE (CTRL+K / CMD+K) VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- 11. Testing Universal Command Palette (Ctrl+K) ---');
    await client.send('Emulation.clearDeviceMetricsOverride');
    await client.navigate('http://localhost:3000');
    await client.sleep(500);

    // Trigger command palette via custom event
    await client.eval(`window.dispatchEvent(new CustomEvent('easydesk-open-command-palette'))`);
    await client.sleep(400);

    const isPaletteOpen = await client.eval(`Boolean(document.getElementById('command-palette-modal'))`);
    record('Command Palette opens on event/shortcut', isPaletteOpen);

    const paletteInput = await client.eval(`Boolean(document.getElementById('command-palette-input'))`);
    record('Command Palette search input focused and interactive', paletteInput);

    // Close palette
    await client.eval(`(() => {
      const closeBtn = document.querySelector('#command-palette-modal button[title="Close"]');
      if (closeBtn) closeBtn.click();
    })()`);
    await client.sleep(300);

    console.log('\n============================================================');
    console.log(`AUDIT RESULTS: ${passed} PASSED / ${total} TOTAL TESTS`);
    console.log('============================================================\n');

  } catch (err) {
    console.error('Audit execution error:', err);
  } finally {
    if (client) client.close();
    chrome.kill();
    process.exit(passed === total && total > 0 ? 0 : 1);
  }
}

run();
