/**
 * Utility to print a target DOM element reliably across all browser environments,
 * including inside iframe preview sandboxes and popups.
 */
export function printElement(element: HTMLElement | null, documentTitle: string = 'Document Record') {
  if (!element) {
    console.warn('Print target element not found in DOM.');
    try {
      window.focus();
      window.print();
    } catch (e) {
      console.error('Fallback print error:', e);
    }
    return;
  }

  const isInsideIframe = window.self !== window.top;

  // If inside an iframe (like AI Studio preview iframe), direct window.print() is blocked by browser policies.
  // We open a clean printable window containing the styled element content.
  if (isInsideIframe) {
    try {
      const printWin = window.open('', '_blank', 'width=950,height=900,toolbar=0,scrollbars=1,status=0');
      if (printWin) {
        // Collect all styling from parent document
        const styleSheets = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
          .map(el => el.outerHTML)
          .join('\n');

        printWin.document.open();
        printWin.document.write(`
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>${documentTitle}</title>
              ${styleSheets}
              <style>
                @media print {
                  @page { margin: 12mm; size: auto; }
                  body {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    background: white !important;
                    color: black !important;
                    margin: 0 !important;
                    padding: 0 !important;
                  }
                  .no-print { display: none !important; }
                }
                body {
                  background-color: #ffffff !important;
                  padding: 24px !important;
                  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                }
                .no-print { display: none !important; }
              </style>
            </head>
            <body>
              <div class="print-container">
                ${element.innerHTML}
              </div>
              <script>
                window.onload = function() {
                  setTimeout(function() {
                    try {
                      window.focus();
                      window.print();
                    } catch(e) {
                      console.error('Inner window print failed:', e);
                    }
                  }, 250);
                };
              </script>
            </body>
          </html>
        `);
        printWin.document.close();
        return;
      }
    } catch (popupErr) {
      console.warn('Popup window blocked, trying direct window.print()', popupErr);
    }
  }

  // Direct top window print call
  try {
    window.focus();
    window.print();
  } catch (err) {
    console.error('Direct window.print() execution error:', err);
  }
}
