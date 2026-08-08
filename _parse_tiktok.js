const XLSX = require('xlsx');
const fs = require('fs');

const wb = XLSX.readFile('C:/Users/MSI GF63/Downloads/MMA-ProSync/tiktok mma 1.xlsx');
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

let out = 'Sheets: ' + JSON.stringify(wb.SheetNames) + '\n';
out += 'Total rows: ' + rows.length + '\n\n';
out += '=== HEADERS ===\n';
const headers = rows[0];
headers.forEach((h, i) => {
  out += `  [${i}] ${h}\n`;
});
out += '\n=== SAMPLE ROWS ===\n';
for (let i = 1; i < Math.min(rows.length, 6); i++) {
  out += `Row ${i}: ${JSON.stringify(rows[i])}\n`;
}

console.log(out);
fs.writeFileSync('C:/Users/MSI GF63/Downloads/MMA-ProSync/_tiktok_headers.txt', out);
