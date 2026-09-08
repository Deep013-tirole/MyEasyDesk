const assert = require('assert');

function parseRouteFromLocation(rawPath = '/', rawHash = '', rawSearch = '') {
  let pathname = (rawPath || '/').trim().replace(/\/+/g, '/');
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  const hash = (rawHash || '').trim();
  const searchParams = new URLSearchParams(rawSearch || '');

  const servicePathMatch = pathname.match(/^\/services\/([a-zA-Z0-9_.-]+)/);
  if (servicePathMatch && servicePathMatch[1]) {
    return { view: 'service-details', serviceId: servicePathMatch[1], blogId: null, adminTab: 'analytics' };
  }

  const serviceHashMatch = hash.match(/^#(?:services|service)\/([a-zA-Z0-9_.-]+)/);
  if (serviceHashMatch && serviceHashMatch[1]) {
    return { view: 'service-details', serviceId: serviceHashMatch[1], blogId: null, adminTab: 'analytics' };
  }

  const queryService = searchParams.get('service') || searchParams.get('serviceId') || searchParams.get('id');
  if (queryService && (pathname === '/services' || pathname === '/service-details' || hash.startsWith('#service'))) {
    return { view: 'service-details', serviceId: queryService, blogId: null, adminTab: 'analytics' };
  }

  const blogPathMatch = pathname.match(/^\/blogs\/([a-zA-Z0-9_.-]+)/);
  if (blogPathMatch && blogPathMatch[1]) {
    return { view: 'blogs', serviceId: null, blogId: blogPathMatch[1], adminTab: 'analytics' };
  }

  const blogHashMatch = hash.match(/^#(?:blogs|blog)\/([a-zA-Z0-9_.-]+)/);
  if (blogHashMatch && blogHashMatch[1]) {
    return { view: 'blogs', serviceId: null, blogId: blogHashMatch[1], adminTab: 'analytics' };
  }

  const queryBlog = searchParams.get('blog') || searchParams.get('blogId');
  if (queryBlog && (pathname === '/blogs' || hash.startsWith('#blog'))) {
    return { view: 'blogs', serviceId: null, blogId: queryBlog, adminTab: 'analytics' };
  }

  if (pathname === '/services' || hash === '#services') {
    return { view: 'services', serviceId: null, blogId: null, adminTab: 'analytics' };
  }

  if (pathname === '/blogs' || hash === '#blogs') {
    return { view: 'blogs', serviceId: null, blogId: null, adminTab: 'analytics' };
  }

  if (pathname === '/about' || pathname === '/terms' || hash === '#about' || hash === '#terms') {
    return { view: 'about', serviceId: null, blogId: null, adminTab: 'analytics' };
  }

  if (pathname === '/contact' || hash === '#contact') {
    return { view: 'contact', serviceId: null, blogId: null, adminTab: 'analytics' };
  }

  if (pathname === '/payment' || hash === '#payment') {
    return { view: 'payment', serviceId: null, blogId: null, adminTab: 'analytics' };
  }

  if (
    pathname === '/privacy-security' ||
    pathname === '/privacy-policy' ||
    pathname === '/privacy' ||
    hash === '#privacy-security' ||
    hash === '#privacy'
  ) {
    return { view: 'privacy-security', serviceId: null, blogId: null, adminTab: 'analytics' };
  }

  if (
    pathname === '/track' ||
    pathname === '/track-order' ||
    hash === '#track' ||
    hash === '#track-order'
  ) {
    return { view: 'track', serviceId: null, blogId: null, adminTab: 'analytics' };
  }

  if (
    pathname === '/submit-review' ||
    pathname === '/review' ||
    hash === '#submit-review' ||
    hash === '#review'
  ) {
    return { view: 'submit-review', serviceId: null, blogId: null, adminTab: 'analytics' };
  }

  if (pathname === '/admin-login' || hash === '#admin-login') {
    return { view: 'admin-login', serviceId: null, blogId: null, adminTab: 'analytics' };
  }

  if (pathname === '/admin' || pathname.startsWith('/admin/') || hash === '#admin' || hash.startsWith('#admin/')) {
    let subTab = '';
    if (pathname.startsWith('/admin/')) {
      subTab = pathname.replace(/^\/admin\//, '').split('/')[0];
    } else if (hash.startsWith('#admin/')) {
      subTab = hash.replace(/^#admin\//, '').split('/')[0];
    }
    const queryTab = searchParams.get('tab');
    const resolvedTab = subTab || queryTab || 'analytics';
    return { view: 'admin', serviceId: null, blogId: null, adminTab: resolvedTab };
  }

  if (pathname === '' || pathname === '/') {
    return { view: 'home', serviceId: null, blogId: null, adminTab: 'analytics' };
  }

  return { view: 'home', serviceId: null, blogId: null, adminTab: 'analytics' };
}

const testCases = [
  { path: '/', expected: { view: 'home', serviceId: null, blogId: null, adminTab: 'analytics' } },
  { path: '/services', expected: { view: 'services', serviceId: null, blogId: null, adminTab: 'analytics' } },
  { path: '/services/', expected: { view: 'services', serviceId: null, blogId: null, adminTab: 'analytics' } },
  { path: '/about', expected: { view: 'about', serviceId: null, blogId: null, adminTab: 'analytics' } },
  { path: '/about/', expected: { view: 'about', serviceId: null, blogId: null, adminTab: 'analytics' } },
  { path: '/contact', expected: { view: 'contact', serviceId: null, blogId: null, adminTab: 'analytics' } },
  { path: '/contact/', expected: { view: 'contact', serviceId: null, blogId: null, adminTab: 'analytics' } },
  { path: '/payment', expected: { view: 'payment', serviceId: null, blogId: null, adminTab: 'analytics' } },
  { path: '/payment/', expected: { view: 'payment', serviceId: null, blogId: null, adminTab: 'analytics' } },
  { path: '/blogs', expected: { view: 'blogs', serviceId: null, blogId: null, adminTab: 'analytics' } },
  { path: '/blogs/', expected: { view: 'blogs', serviceId: null, blogId: null, adminTab: 'analytics' } },
  { path: '/track', expected: { view: 'track', serviceId: null, blogId: null, adminTab: 'analytics' } },
  { path: '/track/', expected: { view: 'track', serviceId: null, blogId: null, adminTab: 'analytics' } },
  { path: '/track-order', expected: { view: 'track', serviceId: null, blogId: null, adminTab: 'analytics' } },
  { path: '/track-order/', expected: { view: 'track', serviceId: null, blogId: null, adminTab: 'analytics' } },
  { path: '/privacy-security', expected: { view: 'privacy-security', serviceId: null, blogId: null, adminTab: 'analytics' } },
  { path: '/privacy-security/', expected: { view: 'privacy-security', serviceId: null, blogId: null, adminTab: 'analytics' } },
  { path: '/privacy-policy', expected: { view: 'privacy-security', serviceId: null, blogId: null, adminTab: 'analytics' } },
  { path: '/privacy', expected: { view: 'privacy-security', serviceId: null, blogId: null, adminTab: 'analytics' } },
  { path: '/terms', expected: { view: 'about', serviceId: null, blogId: null, adminTab: 'analytics' } },
  { path: '/submit-review', expected: { view: 'submit-review', serviceId: null, blogId: null, adminTab: 'analytics' } },
  { path: '/admin-login', expected: { view: 'admin-login', serviceId: null, blogId: null, adminTab: 'analytics' } },
  { path: '/services/pan-card', expected: { view: 'service-details', serviceId: 'pan-card', blogId: null, adminTab: 'analytics' } },
  { path: '/services/pan-card/', expected: { view: 'service-details', serviceId: 'pan-card', blogId: null, adminTab: 'analytics' } },
  { path: '/services/passport-seva-101', expected: { view: 'service-details', serviceId: 'passport-seva-101', blogId: null, adminTab: 'analytics' } },
  { path: '/service-details', search: '?service=pan-card', expected: { view: 'service-details', serviceId: 'pan-card', blogId: null, adminTab: 'analytics' } },
  { path: '/service-details', search: '?serviceId=pan-card', expected: { view: 'service-details', serviceId: 'pan-card', blogId: null, adminTab: 'analytics' } },
  { path: '/blogs/test-blog', expected: { view: 'blogs', serviceId: null, blogId: 'test-blog', adminTab: 'analytics' } },
  { path: '/blogs/test-blog/', expected: { view: 'blogs', serviceId: null, blogId: 'test-blog', adminTab: 'analytics' } },
  { path: '/blogs/123', expected: { view: 'blogs', serviceId: null, blogId: '123', adminTab: 'analytics' } },
  { path: '/blogs', search: '?blog=how-to-apply', expected: { view: 'blogs', serviceId: null, blogId: 'how-to-apply', adminTab: 'analytics' } },
  { path: '/admin', expected: { view: 'admin', serviceId: null, blogId: null, adminTab: 'analytics' } },
  { path: '/admin/', expected: { view: 'admin', serviceId: null, blogId: null, adminTab: 'analytics' } },
  { path: '/admin/orders', expected: { view: 'admin', serviceId: null, blogId: null, adminTab: 'orders' } },
  { path: '/admin/orders/', expected: { view: 'admin', serviceId: null, blogId: null, adminTab: 'orders' } },
  { path: '/admin/services', expected: { view: 'admin', serviceId: null, blogId: null, adminTab: 'services' } },
  { path: '/admin/blogs', expected: { view: 'admin', serviceId: null, blogId: null, adminTab: 'blogs' } },
  { path: '/admin/customers', expected: { view: 'admin', serviceId: null, blogId: null, adminTab: 'customers' } },
  { path: '/admin/employees', expected: { view: 'admin', serviceId: null, blogId: null, adminTab: 'employees' } },
  { path: '/admin', search: '?tab=orders', expected: { view: 'admin', serviceId: null, blogId: null, adminTab: 'orders' } }
];

console.log('====================================================');
console.log('RUNNING EASYDESK ROUTE PARSER REGRESSION TESTS');
console.log('====================================================\n');

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  const result = parseRouteFromLocation(tc.path, tc.hash || '', tc.search || '');
  const urlDisplay = tc.path + (tc.search || '') + (tc.hash || '');
  
  let match = true;
  let reason = '';

  if (result.view !== tc.expected.view) {
    match = false;
    reason += 'view mismatch (got: ' + result.view + ', expected: ' + tc.expected.view + ') ';
  }
  if (result.serviceId !== tc.expected.serviceId) {
    match = false;
    reason += 'serviceId mismatch (got: ' + result.serviceId + ', expected: ' + tc.expected.serviceId + ') ';
  }
  if (result.blogId !== tc.expected.blogId) {
    match = false;
    reason += 'blogId mismatch (got: ' + result.blogId + ', expected: ' + tc.expected.blogId + ') ';
  }
  if (result.adminTab !== tc.expected.adminTab) {
    match = false;
    reason += 'adminTab mismatch (got: ' + result.adminTab + ', expected: ' + tc.expected.adminTab + ') ';
  }

  if (tc.path !== '/' && result.view === 'home') {
    match = false;
    reason += 'CRITICAL: URL resolved to home fallback! ';
  }

  if (match) {
    passed++;
    console.log('[PASS] ' + urlDisplay.padEnd(35) + ' -> view: ' + result.view + ', service: ' + (result.serviceId || 'none') + ', blog: ' + (result.blogId || 'none') + ', adminTab: ' + result.adminTab);
  } else {
    failed++;
    console.error('[FAIL] ' + urlDisplay.padEnd(35) + ' -> FAILED: ' + reason);
  }
}

console.log('\n====================================================');
console.log('TOTAL TESTS: ' + testCases.length + ' | PASSED: ' + passed + ' | FAILED: ' + failed);
console.log('====================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL ROUTE PARSER REGRESSION TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}
