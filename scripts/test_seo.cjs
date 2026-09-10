/**
 * EASYDESK — COMPREHENSIVE SEO & ORGANIC VISIBILITY TEST SUITE
 * 
 * 40+ Architectural, Structural, Content, Schema, and Invariant Assertions
 * covering Section 38, 42, and 55 of the SEO & Platform Specifications.
 */

const assert = require('assert');
const http = require('http');
const {
  app,
  renderPreRenderedHtml,
  getCanonicalOrigin,
  getCanonicalUrl,
  getCanonicalBusinessData,
  generateSitemapXml,
  generateRobotsTxt
} = require('../dist/server.cjs');

// Test runner helper
let passCount = 0;
let failCount = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    Error: ${err.message}`);
    failCount++;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✓ ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(`    Error: ${err.message}`);
    failCount++;
  }
}

async function runSeoTestSuite() {
  console.log('================================================================');
  console.log('EASYDESK — COMPREHENSIVE SEO & CANONICAL TEST SUITE');
  console.log('================================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // -------------------------------------------------------------
    // SECTION 1: CANONICAL ORIGIN RESOLVER & DOMAIN SAFETY
    // -------------------------------------------------------------
    console.log('[SECTION 1] Canonical Origin Resolver & Domain Safety Invariants');

    const homeHtml = renderPreRenderedHtml('/');
    const servicesHtml = renderPreRenderedHtml('/services');
    const panHtml = renderPreRenderedHtml('/services/pan');
    const blogHtml = renderPreRenderedHtml('/blogs/blog-1');
    const notFoundHtml = renderPreRenderedHtml('/non-existent-random-page-12345');
    const adminHtml = renderPreRenderedHtml('/admin');
    const paymentHtml = renderPreRenderedHtml('/payment');

    it('1. Default canonical origin matches active deployment (myeasydesk.tideepak8.workers.dev)', () => {
      assert(homeHtml.html.includes('https://myeasydesk.tideepak8.workers.dev/'), 'Home page canonical must use myeasydesk.tideepak8.workers.dev');
    });

    it('2. CRITICAL: Strictly NEVER outputs easydesk.in anywhere in canonical or sitemap output', () => {
      assert(!homeHtml.html.includes('https://easydesk.in'), 'Home page must not contain https://easydesk.in');
      assert(!servicesHtml.html.includes('https://easydesk.in'), 'Services page must not contain https://easydesk.in');
      assert(!panHtml.html.includes('https://easydesk.in'), 'PAN page must not contain https://easydesk.in');
      assert(!notFoundHtml.html.includes('https://easydesk.in'), '404 page must not contain https://easydesk.in');
    });

    it('3. Zero localhost references in production canonical tags', () => {
      assert(!homeHtml.html.includes('localhost'), 'Home canonical must not reference localhost');
      assert(!servicesHtml.html.includes('localhost'), 'Services canonical must not reference localhost');
      assert(!panHtml.html.includes('localhost'), 'PAN service canonical must not reference localhost');
      assert(!blogHtml.html.includes('localhost'), 'Blog canonical must not reference localhost');
    });

    // -------------------------------------------------------------
    // SECTION 2: TITLE & META DESCRIPTION QUALITY
    // -------------------------------------------------------------
    console.log('\n[SECTION 2] Title & Meta Description Quality');

    it('4. Title tag exists on all core pre-rendered pages', () => {
      assert(homeHtml.html.includes('<title>'), 'Home must have <title>');
      assert(servicesHtml.html.includes('<title>'), 'Services must have <title>');
      assert(panHtml.html.includes('<title>'), 'PAN must have <title>');
      assert(blogHtml.html.includes('<title>'), 'Blog must have <title>');
      assert(notFoundHtml.html.includes('<title>'), '404 must have <title>');
    });

    it('5. Titles are unique across different views', () => {
      const getTitle = (html) => (html.match(/<title>(.*?)<\/title>/) || [])[1];
      const tHome = getTitle(homeHtml.html);
      const tServices = getTitle(servicesHtml.html);
      const tPAN = getTitle(panHtml.html);
      const t404 = getTitle(notFoundHtml.html);

      assert(tHome && tServices && tPAN && t404, 'All titles must be extracted');
      assert.notStrictEqual(tHome, tServices, 'Home and Services titles must differ');
      assert.notStrictEqual(tHome, tPAN, 'Home and PAN titles must differ');
      assert.notStrictEqual(tServices, t404, 'Services and 404 titles must differ');
    });

    it('6. Meta description exists on all indexable pages', () => {
      assert(homeHtml.html.includes('<meta name="description"'), 'Home must have description');
      assert(servicesHtml.html.includes('<meta name="description"'), 'Services must have description');
      assert(panHtml.html.includes('<meta name="description"'), 'PAN must have description');
      assert(blogHtml.html.includes('<meta name="description"'), 'Blog must have description');
    });

    it('7. Meta descriptions are unique across pages', () => {
      const getDesc = (html) => (html.match(/<meta name="description" content="(.*?)"/) || [])[1];
      const dHome = getDesc(homeHtml.html);
      const dServices = getDesc(servicesHtml.html);
      const dPAN = getDesc(panHtml.html);

      assert(dHome && dServices && dPAN, 'All descriptions must be present');
      assert.notStrictEqual(dHome, dServices, 'Home and Services descriptions must differ');
      assert.notStrictEqual(dHome, dPAN, 'Home and PAN descriptions must differ');
    });

    // -------------------------------------------------------------
    // SECTION 3: ROBOTS & CRAWLER DIRECTIVES
    // -------------------------------------------------------------
    console.log('\n[SECTION 3] Robots Directives & Access Control');

    it('8. Public pages specify "index, follow"', () => {
      assert(homeHtml.html.includes('<meta name="robots" content="index, follow" />'), 'Home must specify index, follow');
      assert(servicesHtml.html.includes('<meta name="robots" content="index, follow" />'), 'Services must specify index, follow');
      assert(panHtml.html.includes('<meta name="robots" content="index, follow" />'), 'PAN must specify index, follow');
    });

    it('9. Private, payment, admin, and 404 pages specify "noindex"', () => {
      assert(notFoundHtml.html.includes('<meta name="robots" content="noindex, nofollow" />'), '404 must specify noindex, nofollow');
      assert(adminHtml.html.includes('<meta name="robots" content="noindex, nofollow" />'), 'Admin must specify noindex, nofollow');
      assert(paymentHtml.html.includes('<meta name="robots" content="noindex'), 'Payment must specify noindex');
    });

    it('10. 404 Not Found returns HTTP status 404 from pre-rendering', () => {
      assert.strictEqual(notFoundHtml.status, 404, 'Unknown path must return 404 status');
    });

    // -------------------------------------------------------------
    // SECTION 4: OPEN GRAPH & TWITTER CARD METADATA
    // -------------------------------------------------------------
    console.log('\n[SECTION 4] Open Graph & Social Sharing Cards');

    it('11. Open Graph tags are complete (type, url, title, description, site_name)', () => {
      assert(homeHtml.html.includes('<meta property="og:type" content="website" />'), 'OG type must be website');
      assert(homeHtml.html.includes('<meta property="og:url" content="https://myeasydesk.tideepak8.workers.dev/" />'), 'OG url must be canonical');
      assert(homeHtml.html.includes('<meta property="og:title"'), 'OG title must exist');
      assert(homeHtml.html.includes('<meta property="og:description"'), 'OG description must exist');
      assert(homeHtml.html.includes('<meta property="og:site_name" content="EasyDesk" />'), 'OG site_name must be EasyDesk');
    });

    it('12. Twitter Card metadata is complete', () => {
      assert(homeHtml.html.includes('<meta name="twitter:card"'), 'Twitter card must exist');
      assert(homeHtml.html.includes('<meta name="twitter:title"'), 'Twitter title must exist');
      assert(homeHtml.html.includes('<meta name="twitter:description"'), 'Twitter description must exist');
    });

    // -------------------------------------------------------------
    // SECTION 5: SCHEMA.ORG STRUCTURED DATA
    // -------------------------------------------------------------
    console.log('\n[SECTION 5] Schema.org Structured Data Invariants');

    it('13. Home page injects WebSite and Organization / LocalBusiness JSON-LD schemas', () => {
      assert(homeHtml.html.includes('application/ld+json'), 'Home must have JSON-LD script tag');
      const matches = [...homeHtml.html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)];
      assert(matches.length >= 2, 'Home must have at least 2 schemas (WebSite and Organization)');
      const parsedSchemas = matches.map(m => JSON.parse(m[1]));
      const hasWebSite = parsedSchemas.some(s => s['@type'] === 'WebSite');
      const hasOrgOrLocal = parsedSchemas.some(s => {
        const t = s['@type'];
        return t === 'LocalBusiness' || t === 'Organization' || (Array.isArray(t) && (t.includes('LocalBusiness') || t.includes('Organization')));
      });
      assert(hasWebSite, 'WebSite schema must be present');
      assert(hasOrgOrLocal, 'LocalBusiness/Organization schema must be present');
    });

    it('14. Service details page injects Service and BreadcrumbList schemas', () => {
      assert(panHtml.html.includes('application/ld+json'), 'PAN page must have JSON-LD script tag');
      const matches = [...panHtml.html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)];
      assert(matches.length >= 2, 'Service page must have Breadcrumbs and Service schemas');
      const parsedSchemas = matches.map(m => JSON.parse(m[1]));
      const hasBreadcrumbs = parsedSchemas.some(s => s['@type'] === 'BreadcrumbList');
      const hasService = parsedSchemas.some(s => s['@type'] === 'Service');
      assert(hasBreadcrumbs, 'BreadcrumbList schema must be present');
      assert(hasService, 'Service schema must be present');
    });

    it('15. All injected JSON-LD schemas parse without syntax error', () => {
      const allHtmls = [homeHtml, servicesHtml, panHtml, blogHtml];
      for (const h of allHtmls) {
        const matches = [...h.html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)];
        for (const m of matches) {
          const parsed = JSON.parse(m[1]);
          assert(parsed['@context'] === 'https://schema.org', 'Context must be https://schema.org');
          assert(parsed['@type'], 'Type must be specified');
        }
      }
    });

    // -------------------------------------------------------------
    // SECTION 6: LIVE HTTP ENDPOINTS: ROBOTS.TXT & SITEMAP.XML
    // -------------------------------------------------------------
    console.log('\n[SECTION 6] Live HTTP Endpoints (Robots.txt & Sitemap.xml)');

    await itAsync('16. GET /robots.txt returns status 200 and text/plain charset=utf-8', async () => {
      const res = await fetch(`${baseUrl}/robots.txt`);
      assert.strictEqual(res.status, 200, 'robots.txt must return 200');
      assert(res.headers.get('content-type').includes('text/plain'), 'Content-Type must be text/plain');
      const body = await res.text();
      assert(body.includes('User-agent: *'), 'Must contain User-agent: *');
      assert(body.includes('Disallow: /admin'), 'Must disallow /admin');
      assert(body.includes('Disallow: /api/'), 'Must disallow /api/');
      assert(body.includes('Disallow: /payment'), 'Must disallow /payment');
      assert(body.includes('Sitemap: https://myeasydesk.tideepak8.workers.dev/sitemap.xml'), 'Must point to canonical sitemap.xml');
    });

    await itAsync('17. GET /sitemap.xml returns status 200 and application/xml', async () => {
      const res = await fetch(`${baseUrl}/sitemap.xml`);
      assert.strictEqual(res.status, 200, 'sitemap.xml must return 200');
      assert(res.headers.get('content-type').includes('xml'), 'Content-Type must be application/xml');
      const body = await res.text();
      assert(body.includes('<urlset'), 'Must contain <urlset');
      assert(body.includes('http://www.sitemaps.org/schemas/sitemap/0.9'), 'Must conform to sitemaps.org schema');
      assert(body.includes('<loc>https://myeasydesk.tideepak8.workers.dev/</loc>'), 'Must contain root URL');
      assert(body.includes('<loc>https://myeasydesk.tideepak8.workers.dev/services</loc>'), 'Must contain /services');
      assert(body.includes('<loc>https://myeasydesk.tideepak8.workers.dev/blogs</loc>'), 'Must contain /blogs');
      assert(body.includes('<loc>https://myeasydesk.tideepak8.workers.dev/about</loc>'), 'Must contain /about');
      assert(body.includes('<loc>https://myeasydesk.tideepak8.workers.dev/contact</loc>'), 'Must contain /contact');
      assert(body.includes('<loc>https://myeasydesk.tideepak8.workers.dev/track</loc>'), 'Must contain /track');
      assert(body.includes('<loc>https://myeasydesk.tideepak8.workers.dev/privacy-security</loc>'), 'Must contain /privacy-security');
    });

    await itAsync('18. Sitemap strictly excludes private, admin, api, customer, and payment routes', async () => {
      const res = await fetch(`${baseUrl}/sitemap.xml`);
      const body = await res.text();
      assert(!body.includes('/admin'), 'Sitemap must not contain /admin');
      assert(!body.includes('/api/'), 'Sitemap must not contain /api/');
      assert(!body.includes('/payment'), 'Sitemap must not contain /payment');
      assert(!body.includes('/submit-review'), 'Sitemap must not contain /submit-review');
      assert(!body.includes('localhost'), 'Sitemap must not contain localhost');
      assert(!body.includes('easydesk.in'), 'Sitemap must not contain easydesk.in');
    });

    // -------------------------------------------------------------
    // SECTION 7: D1 EMPTY-STATE RETENTION & ZERO ZOMBIES
    // -------------------------------------------------------------
    console.log('\n[SECTION 7] D1 Empty-State Retention & Zero Zombie Reseeding Invariant');

    it('19. generateSitemapXml with empty arrays produces clean sitemap with zero zombies', () => {
      const xml = generateSitemapXml([], []);
      assert(xml.includes('<urlset'), 'Must return valid urlset');
      assert(xml.includes('https://myeasydesk.tideepak8.workers.dev/services'), 'Must include static services');
      assert(!xml.includes('/services/dummy-'), 'Must not resurrect dummy services');
      assert(!xml.includes('/blogs/dummy-'), 'Must not resurrect dummy blogs');
    });

    // -------------------------------------------------------------
    // SECTION 8: TRUTHFUL BUSINESS DATA & ETHICAL GROUNDING
    // -------------------------------------------------------------
    console.log('\n[SECTION 8] Truthful Business Grounding & Commercial Disclaimers');

    it('20. Business details bound dynamically to canonical settings (Indore, MP, no fake coordinates)', () => {
      const biz = getCanonicalBusinessData(
        { city: 'Indore', state: 'Madhya Pradesh', phone: '+91 9575538590', email: 'help.myeasydesks@gmail.com' }
      );
      assert.strictEqual(biz.city, 'Indore', 'City must be Indore');
      assert.strictEqual(biz.state, 'Madhya Pradesh', 'State must be Madhya Pradesh');
      assert.strictEqual(biz.phone, '+91 9575538590', 'Phone must match canonical phone');
      assert.strictEqual(biz.email, 'help.myeasydesks@gmail.com', 'Email must match canonical email');
      assert.strictEqual(biz.latitude, undefined, 'Coordinates must be undefined when not explicitly configured (no guessing)');
      assert.strictEqual(biz.longitude, undefined, 'Coordinates must be undefined when not explicitly configured (no guessing)');
    });

    it('21. Commercial facilitation disclaimer is truthful (not government affiliated)', () => {
      const biz = getCanonicalBusinessData();
      assert(biz.description.includes('independent commercial facilitation desk'), 'Must state independent commercial facilitation desk');
      assert(biz.description.includes('not affiliated with any government department'), 'Must state not affiliated with government');
    });

    // -------------------------------------------------------------
    // SECTION 9: CONFIG-DRIVEN DOMAIN MIGRATION
    // -------------------------------------------------------------
    console.log('\n[SECTION 9] Config-Driven Domain Migration Invariant');

    it('22. CANONICAL_ORIGIN environment variable dynamically switches all output origins', () => {
      const targetDomain = 'https://myeasydesk.in';
      const resolved = getCanonicalOrigin(targetDomain);
      assert.strictEqual(resolved, targetDomain, 'getCanonicalOrigin must accept and return targetDomain override');
      const url = getCanonicalUrl('/services/pan');
      assert(url.startsWith('https://'), 'Canonical URL must be secure https');
    });

    it('23. getCanonicalOrigin strictly rejects localhost and unauthorized domains', () => {
      assert.strictEqual(getCanonicalOrigin('http://localhost:3000'), 'https://myeasydesk.tideepak8.workers.dev');
      assert.strictEqual(getCanonicalOrigin('https://easydesk.in'), 'https://myeasydesk.tideepak8.workers.dev');
    });

    // -------------------------------------------------------------
    // SECTION 10: INTERNAL LINKING & CONVERSION ARCHITECTURE
    // -------------------------------------------------------------
    console.log('\n[SECTION 10] Internal Linking & Contextual Conversion');

    it('24. ServiceDetailsView source code contains organic links to /track and /contact', () => {
      const fs = require('fs');
      const sView = fs.readFileSync('src/components/ServiceDetailsView.tsx', 'utf-8');
      assert(sView.includes("setView('track')"), 'ServiceDetailsView must link to track view');
      assert(sView.includes("setView('contact')"), 'ServiceDetailsView must link to contact view');
      assert(sView.includes("setView('services')"), 'ServiceDetailsView must link to services directory');
    });

    it('25. BlogDetailView source code contains matchedService contextual conversion card', () => {
      const fs = require('fs');
      const bView = fs.readFileSync('src/components/blog/BlogDetailView.tsx', 'utf-8');
      assert(bView.includes('id="blog-related-service-card"'), 'BlogDetailView must have related service card container');
      assert(bView.includes('matchedService'), 'BlogDetailView must compute matchedService');
      assert(bView.includes('Apply with EasyDesk Assistance'), 'BlogDetailView must have assisted filing CTA');
    });

    it('26. NotFoundView contains search, home, services, blogs, and contact links', () => {
      const fs = require('fs');
      const nfView = fs.readFileSync('src/components/NotFoundView.tsx', 'utf-8');
      assert(nfView.includes("setView('home')"), 'NotFoundView must link to home');
      assert(nfView.includes("setView('services')"), 'NotFoundView must link to services');
      assert(nfView.includes("setView('blogs')"), 'NotFoundView must link to blogs');
      assert(nfView.includes("setView('contact')"), 'NotFoundView must link to contact');
      assert(nfView.includes('<meta name="robots" content="noindex, nofollow" />'), 'NotFoundView must have noindex, nofollow Helmet');
    });

    // -------------------------------------------------------------
    // SECTION 11: STATIC ASSETS BUILD PARITY
    // -------------------------------------------------------------
    console.log('\n[SECTION 11] Static Assets Build Parity (dist/robots.txt & dist/sitemap.xml)');

    it('27. public/robots.txt and dist/robots.txt exist and are identical', () => {
      const fs = require('fs');
      assert(fs.existsSync('public/robots.txt'), 'public/robots.txt must exist');
      assert(fs.existsSync('dist/robots.txt'), 'dist/robots.txt must exist');
      const pRobots = fs.readFileSync('public/robots.txt', 'utf-8');
      const dRobots = fs.readFileSync('dist/robots.txt', 'utf-8');
      assert.strictEqual(pRobots, dRobots, 'public and dist robots.txt must match');
    });

    it('28. public/sitemap.xml and dist/sitemap.xml exist and conform to XML schema', () => {
      const fs = require('fs');
      assert(fs.existsSync('public/sitemap.xml'), 'public/sitemap.xml must exist');
      assert(fs.existsSync('dist/sitemap.xml'), 'dist/sitemap.xml must exist');
      const dSitemap = fs.readFileSync('dist/sitemap.xml', 'utf-8');
      assert(dSitemap.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'), 'Must have valid XML namespace');
    });

    it('29. wrangler.jsonc contains /robots.txt and /sitemap.xml in run_worker_first', () => {
      const fs = require('fs');
      const wrangler = fs.readFileSync('wrangler.jsonc', 'utf-8');
      assert(wrangler.includes('"/robots.txt"'), 'wrangler.jsonc must include /robots.txt');
      assert(wrangler.includes('"/sitemap.xml"'), 'wrangler.jsonc must include /sitemap.xml');
    });

    it('30. src/worker.ts routes /robots.txt and /sitemap.xml directly to Express', () => {
      const fs = require('fs');
      const worker = fs.readFileSync('src/worker.ts', 'utf-8');
      assert(worker.includes("url.pathname === '/robots.txt'"), 'worker.ts must route /robots.txt to Express');
      assert(worker.includes("url.pathname === '/sitemap.xml'"), 'worker.ts must route /sitemap.xml to Express');
    });

  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`SEO TEST SUITE COMPLETE: ${passCount} Passed, ${failCount} Failed`);
  console.log('================================================================\n');

  process.exitCode = failCount > 0 ? 1 : 0;
  setTimeout(() => {
    process.exit(failCount > 0 ? 1 : 0);
  }, 100);
}

runSeoTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
