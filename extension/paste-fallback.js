async function readClipboardHtmlFallback() {
  return new Promise((resolve, reject) => {
    // Create a hidden contenteditable div
    const div = document.createElement('div');
    div.contentEditable = true;
    div.style.position = 'fixed';
    div.style.left = '-9999px';
    document.body.appendChild(div);

    // Listen for the paste event
    div.addEventListener('paste', (e) => {
      e.preventDefault();
      const html = e.clipboardData.getData('text/html');
      document.body.removeChild(div);
      resolve(html || "");
    }, { once: true });

    // Focus the div and trigger paste
    div.focus();
    try {
      const success = document.execCommand('paste');
      if (!success) {
        document.body.removeChild(div);
        reject(new Error("execCommand('paste') failed"));
      }
    } catch (err) {
      document.body.removeChild(div);
      reject(err);
    }
  });
}
