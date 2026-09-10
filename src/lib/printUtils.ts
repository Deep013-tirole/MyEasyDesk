/**
 * EasyDesk Unified Print Utility
 * Reliable document printing across all browser environments,
 * supporting direct top-level printing and sandboxed iframe previews.
 */

/**
 * Triggers standard window print with document title preservation and paint flush.
 */
export function printCurrentWindow(title?: string): void {
  const originalTitle = document.title;
  if (title) {
    document.title = title;
  }

  let restored = false;
  const restoreTitle = () => {
    if (restored) return;
    restored = true;
    document.title = originalTitle;
    window.removeEventListener('afterprint', restoreTitle);
  };

  window.addEventListener('afterprint', restoreTitle);

  // Double requestAnimationFrame ensures that any recently rendered DOM elements
  // and fonts are completely committed to the layout before print dialog freezes rendering.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        window.focus();
        window.print();
      } catch (err) {
        console.error('Print execution error:', err);
      } finally {
        // Fallback restore in case browser does not trigger afterprint
        setTimeout(restoreTitle, 2000);
      }
    });
  });
}

/**
 * Prints a target DOM element reliably.
 * If running inside an iframe (like AI preview sandboxes), uses an isolated hidden iframe.
 * If running top-level, triggers clean window.print() with target document title.
 */
export function printElement(element: HTMLElement | null, documentTitle: string = 'EasyDesk Document Record'): void {
  if (!element) {
    console.warn('Print target element not found in DOM, printing current window.');
    printCurrentWindow(documentTitle);
    return;
  }

  const isInsideIframe = window.self !== window.top;

  // If inside an iframe sandbox where top window.print() might be restricted,
  // use a hidden in-memory iframe with copied stylesheets.
  if (isInsideIframe) {
    try {
      const oldFrame = document.getElementById('easydesk-print-frame');
      if (oldFrame) {
        oldFrame.remove();
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'easydesk-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const styleSheets = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(el => el.outerHTML)
        .join('\n');

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html lang="en" translate="no" class="notranslate">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>${documentTitle}</title>
              ${styleSheets}
              <style>
                @page { size: A4 portrait; margin: 12mm 15mm; }
                *, *::before, *::after {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                body {
                  background-color: #ffffff !important;
                  color: #0f172a !important;
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
                  margin: 0 !important;
                  padding: 16px !important;
                }
                .no-print, .print\:hidden, nav, header, footer, button, input {
                  display: none !important;
                }
                .print-only {
                  display: block !important;
                }
              </style>
            </head>
            <body class="notranslate" translate="no">
              <div class="easydesk-print-wrapper notranslate" translate="no">
                ${element.innerHTML}
              </div>
            </body>
          </html>
        `);
        doc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (frameErr) {
            console.warn('Iframe print failed, falling back to top window:', frameErr);
            printCurrentWindow(documentTitle);
          }
        }, 350);
        return;
      }
    } catch (sandboxErr) {
      console.warn('Sandbox iframe print failed, falling back to window.print():', sandboxErr);
    }
  }

  // Top-level direct print execution
  printCurrentWindow(documentTitle);
}
