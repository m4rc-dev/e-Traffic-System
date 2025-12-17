const fs = require('fs');

// Read the file
const filePath = 'c:\\Users\\Marcelo\\Desktop\\e-Traffic-System\\client\\src\\pages\\admin\\Reports.js';
let content = fs.readFileSync(filePath, 'utf8');

// Replace the problematic escape function line
// We're looking for the line that does HTML entity escaping
const oldLine = "return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');";
const newLine = "return text;";

content = content.replace(new RegExp(oldLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newLine);

// Write the file back
fs.writeFileSync(filePath, content, 'utf8');

console.log('File updated successfully!');
