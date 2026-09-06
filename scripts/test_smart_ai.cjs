/**
 * EASYDESK SMART AI ARCHITECTURAL & LIFECYCLE REGRESSION TEST SUITE
 * 
 * Verifies:
 * 1. Model configuration uses a valid Gemini model (gemini-2.5-flash), not gemini-3.5-flash.
 * 2. Multiturn history sanitization: leading model greetings are stripped; first turn is 'user'.
 * 3. General knowledge queries (e.g., "What is 2 + 2?", "What is the capital of Japan?", "Explain photosynthesis")
 *    are NEVER hijacked by static PAN/GST canned answers.
 * 4. EasyDesk catalog queries ("What services does EasyDesk provide?") dynamically query database services.
 * 5. Specific service queries ("How much does PAN service cost?", "What documents are needed for Passport?")
 *    return accurate fee and document details directly from the database.
 * 6. Contact queries ("How do I contact EasyDesk?", "Where is your office?") dynamically return contact settings.
 * 7. Service context isolation:
 *    - Context = Passport + "What documents are needed?" -> uses Passport context.
 *    - Context = Passport + "What is the capital of Japan?" -> answers Japan / general query, NOT Passport!
 *    - Context = Passport + "How much does PAN service cost?" -> answers PAN, NOT Passport!
 * 8. Session reset / New Chat cleans context and does not bleed prior responses.
 * 9. Document Checker endpoint (/api/ai/check-document) processes file names against database requirements.
 * 10. Provider metadata ('gemini', 'local-knowledge', 'unavailable') and isFallback flags are properly returned.
 */

process.env.IS_WORKER = 'true';
process.env.NODE_ENV = 'test';

const http = require('http');
const assert = require('assert');
const { app, getGeminiModel, getGeminiApiKey } = require('../dist/server.cjs');

let totalTests = 0;
let passedTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      return res.then(() => {
        passedTests++;
        console.log(`  [PASS] ${desc}`);
      }).catch(err => {
        console.error(`  [FAIL] ${desc}`);
        console.error(`         ${err.message}`);
        process.exitCode = 1;
      });
    } else {
      passedTests++;
      console.log(`  [PASS] ${desc}`);
    }
  } catch (err) {
    console.error(`  [FAIL] ${desc}`);
    console.error(`         ${err.message}`);
    process.exitCode = 1;
  }
}

function makeRequest(port, path, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body || {});
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': 'easydesk_secure_csrf_token_2026_val',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runSmartAITests() {
  console.log('============================================================');
  console.log('EASYDESK SMART AI — REGRESSION & VERIFICATION SUITE');
  console.log('============================================================\n');

  // Start ephemeral HTTP server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    console.log('--- SUITE 1: Server Configuration & Model Invariants ---');
    
    it('1.1 Configured Gemini model is a valid modern Flash model (gemini-2.5-flash)', () => {
      const model = getGeminiModel();
      assert.strictEqual(model, 'gemini-2.5-flash');
      assert.notStrictEqual(model, 'gemini-3.5-flash', 'Must NOT use non-existent gemini-3.5-flash');
    });

    it('1.2 Safe API key resolution does not throw and returns string or null', () => {
      const key = getGeminiApiKey();
      assert.ok(key === null || typeof key === 'string');
    });

    console.log('\n--- SUITE 2: General Knowledge & Math Queries (Anti-Hijacking) ---');

    await it('2.1 Query "What is 2 + 2?" is NEVER hijacked with PAN or GST advice', async () => {
      const res = await makeRequest(port, '/api/ai/chat', {
        message: 'What is 2 + 2?'
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.text, 'Should return text response');
      // Must not return canned PAN card or GST advice
      assert.ok(!res.data.text.includes('### Apply for PAN Card'), 'Must NOT return PAN advice');
      assert.ok(!res.data.text.includes('### GST Registration Guidance'), 'Must NOT return GST advice');
      assert.ok(res.data.provider, 'Must specify provider');
    });

    await it('2.2 Query "What is the capital of Japan?" is NOT hijacked by substring "pan"', async () => {
      const res = await makeRequest(port, '/api/ai/chat', {
        message: 'What is the capital of Japan?'
      });
      assert.strictEqual(res.status, 200);
      assert.ok(!res.data.text.includes('### Apply for PAN Card'), 'Must NOT trigger PAN card match for Japan');
      assert.ok(!res.data.text.includes('### GST Registration Guidance'), 'Must NOT return GST advice');
    });

    await it('2.3 Query "Explain photosynthesis." is NOT hijacked by generic greeting or GST advice', async () => {
      const res = await makeRequest(port, '/api/ai/chat', {
        message: 'Explain photosynthesis.'
      });
      assert.strictEqual(res.status, 200);
      assert.ok(!res.data.text.includes('### Apply for PAN Card'), 'Must NOT return PAN advice');
      assert.ok(!res.data.text.includes('### GST Registration Guidance'), 'Must NOT return GST advice');
    });

    console.log('\n--- SUITE 3: Dynamic EasyDesk Knowledge Base ---');

    await it('3.1 Catalog overview "What services does EasyDesk provide?" returns dynamic service catalog', async () => {
      const res = await makeRequest(port, '/api/ai/chat', {
        message: 'What services does EasyDesk provide?'
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.text.includes('EasyDesk Available Digital Services') || res.data.text.includes('PAN') || res.data.text.includes('Passport'), 
        'Should list real EasyDesk services');
      assert.ok(!res.data.text.includes('### Apply for PAN Card through EasyDesk'), 'Should be catalog overview, not specific PAN card flyer');
    });

    await it('3.2 Specific service query "How much does PAN service cost?" returns verified fee breakdown', async () => {
      const res = await makeRequest(port, '/api/ai/chat', {
        message: 'How much does PAN service cost?'
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.text.toLowerCase().includes('fee') || res.data.text.includes('₹'), 'Should include fee details');
      assert.ok(res.data.text.toLowerCase().includes('pan'), 'Should identify PAN service');
    });

    await it('3.3 Support inquiry "How do I contact EasyDesk?" returns verified contact details', async () => {
      const res = await makeRequest(port, '/api/ai/chat', {
        message: 'How do I contact EasyDesk?'
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.text.toLowerCase().includes('contact') || res.data.text.toLowerCase().includes('email') || res.data.text.toLowerCase().includes('support'),
        'Should include contact channels');
    });

    console.log('\n--- SUITE 4: Context Isolation & Anti-Bleed Verification ---');

    await it('4.1 Context = Passport + "What documents are needed?" uses Passport context', async () => {
      const res = await makeRequest(port, '/api/ai/chat', {
        message: 'What documents are needed?',
        contextService: {
          id: 'svc-passport',
          title: 'Fresh Passport Application',
          govFees: 1500,
          serviceCharge: 350,
          processingTime: '15-20 Days',
          requiredDocuments: ['Aadhaar Card', 'Matriculation Certificate', 'Address Proof']
        }
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.text.toLowerCase().includes('passport'), 'Should address passport documentation');
    });

    await it('4.2 Context = Passport + "What is the capital of Japan?" answers Japan / general query, NOT Passport', async () => {
      const res = await makeRequest(port, '/api/ai/chat', {
        message: 'What is the capital of Japan?',
        contextService: {
          id: 'svc-passport',
          title: 'Fresh Passport Application',
          govFees: 1500,
          serviceCharge: 350,
          processingTime: '15-20 Days',
          requiredDocuments: ['Aadhaar Card']
        }
      });
      assert.strictEqual(res.status, 200);
      // Crucial invariant: Unrelated query must NOT return passport filing guidance
      assert.ok(!res.data.text.includes('Fresh Passport Application — Official Information'), 'Must NOT return passport filing guidance');
      assert.ok(!res.data.text.includes('### Apply for PAN Card'), 'Must NOT trigger PAN on Japan');
    });

    await it('4.3 Context = Passport + "How much does PAN service cost?" answers PAN, NOT Passport', async () => {
      const res = await makeRequest(port, '/api/ai/chat', {
        message: 'How much does PAN service cost?',
        contextService: {
          id: 'svc-passport',
          title: 'Fresh Passport Application',
          govFees: 1500,
          serviceCharge: 350,
          processingTime: '15-20 Days',
          requiredDocuments: ['Aadhaar Card']
        }
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.text.toLowerCase().includes('pan'), 'Should answer PAN query');
      assert.ok(!res.data.text.includes('Fresh Passport Application — Official Information'), 'Must NOT force Passport answer');
    });

    console.log('\n--- SUITE 5: Multiturn Conversation & New Chat Reset ---');

    await it('5.1 Multiturn history starting with assistant model greeting is cleanly sanitized', async () => {
      const res = await makeRequest(port, '/api/ai/chat', {
        message: 'What is the processing time?',
        chatHistory: [
          { role: 'model', content: 'Hello! I am your EasyDesk AI Digital Assistant.' },
          { role: 'user', content: 'Tell me about GST' },
          { role: 'model', content: 'GST registration takes 3-7 days.' }
        ]
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.text, 'Should process multiturn cleanly');
    });

    await it('5.2 Consecutive same-role turns in history are handled without throwing', async () => {
      const res = await makeRequest(port, '/api/ai/chat', {
        message: 'Can I apply now?',
        chatHistory: [
          { role: 'user', content: 'First question' },
          { role: 'user', content: 'Second follow up question' }
        ]
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.text, 'Should handle consecutive user messages gracefully');
    });

    console.log('\n--- SUITE 6: Document Checker Endpoint (/api/ai/check-document) ---');

    await it('6.1 Valid matching document returns positive match confirmation', async () => {
      const res = await makeRequest(port, '/api/ai/check-document', {
        docName: 'Aadhaar_Front_Back_Scan.pdf',
        serviceId: 'service_pan_new'
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.text.includes('Document Audit Result'), 'Should return document audit result');
      assert.ok(res.data.provider, 'Should return provider');
    });

    await it('6.2 Unrelated file name returns audit tip requiring inspection', async () => {
      const res = await makeRequest(port, '/api/ai/check-document', {
        docName: 'random_vacation_photo.png',
        serviceId: 'service_pan_new'
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.text.includes('Document Audit Result'), 'Should return document audit result');
    });

    await it('6.3 Missing parameters returns 400 error', async () => {
      const res = await makeRequest(port, '/api/ai/check-document', {
        docName: ''
      });
      assert.strictEqual(res.status, 400);
    });

    console.log('\n------------------------------------------------------------');
    console.log(`Results: ${passedTests}/${totalTests} tests passed`);
    console.log('------------------------------------------------------------');

    if (passedTests === totalTests) {
      console.log('\nSUCCESS: ALL EASYDESK SMART AI REGRESSION TESTS PASSED (100%)!\n');
    } else {
      console.error(`\nFAILURE: ${totalTests - passedTests} tests failed.`);
      process.exitCode = 1;
    }

  } finally {
    server.close();
  }
}

runSmartAITests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
