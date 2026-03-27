const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'server.ts');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');
if (lines[1239] && lines[1239].includes('});')) {
  lines[1237] = '';
  lines[1238] = '';
  lines[1239] = '';
  fs.writeFileSync(filePath, lines.join('\n'));
  console.log('Fixed server.ts');
} else {
  console.log('Line 1240 did not match:', lines[1239]);
}
