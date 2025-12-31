import fs from 'fs';

const content = fs.readFileSync('src\\components\\Whiteboard.tsx', 'utf8');
const lines = content.split('\n');

for (let i = 462; i < 485 && i < lines.length; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
