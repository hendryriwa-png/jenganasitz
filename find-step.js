const fs = require('fs');
const content = fs.readFileSync('C:/Users/hendr/OneDrive/Documents/New OpenCode Project/index.html', 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('id="authStep1"')) {
    console.log('authStep1 at line:', i+1);
    break;
  }
}