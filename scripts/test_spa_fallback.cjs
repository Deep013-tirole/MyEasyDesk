const http = require('http');
const path = require('path');
const express = require('c:/Users/dell/Downloads/EasyDesk/node_modules/express');
const { app } = require('c:/Users/dell/Downloads/EasyDesk/dist/server.cjs');

const distPath = 'c:/Users/dell/Downloads/EasyDesk/dist';
app.use(express.static(distPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const server = http.createServer(app);
server.listen(0, async () => {
  const port = server.address().port;
  const paths = [
    '/',
    '/services',
    '/services/pan-card',
    '/blogs',
    '/blogs/test-blog',
    '/about',
    '/contact',
    '/payment',
    '/track',
    '/admin'
  ];

  for (const p of paths) {
    try {
      const res = await fetch(`http://localhost:${port}${p}`, { redirect: 'manual' });
      const text = await res.text();
      const hasIndexHtml = text.includes('<div id="root"></div>');
      console.log(`GET ${p} -> Status: ${res.status}, hasRootDiv: ${hasIndexHtml}`);
    } catch (e) {
      console.log(`GET ${p} -> Error: ${e.message}`);
    }
  }

  server.close(() => process.exit(0));
});
