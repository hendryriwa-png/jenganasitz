const fs = require('fs');
const content = fs.readFileSync('C:/Users/hendr/OneDrive/Documents/New OpenCode Project/index.html', 'utf8');

const domIdx = content.indexOf('document.addEventListener("DOMContentLoaded"');
console.log('DOMContentLoaded at:', domIdx);

if (domIdx !== -1) {
  const context = content.substring(Math.max(0, domIdx - 200), domIdx + 200);
  console.log('Context:', context);
}