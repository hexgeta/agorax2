import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

// Parse tokens from crypto.ts
const content = fs.readFileSync('constants/crypto.ts', 'utf-8');
const tokens = [];
const regex = /\{\s*chain:\s*(\d+)\s*,\s*a:\s*"(0x[a-fA-F0-9]+)"\s*,[\s\S]*?ticker:\s*"([^"]+)"[\s\S]*?decimals:\s*(\d+)[\s\S]*?name:\s*"([^"]+)"[\s\S]*?\}/g;
let match;
while ((match = regex.exec(content)) !== null) {
  tokens.push({
    chain: parseInt(match[1]),
    address: match[2],
    ticker: match[3],
    decimals: parseInt(match[4]),
    name: match[5],
  });
}

// Confirmed tax tokens from v3 transfer simulation
const confirmedTax = {
  '0xb6bad00525221eb28eb911a0b1162a0709b4ce57': { tax: 10, sent: '1000000000', received: '900000000' },
  '0x74758472addc95944769e8adac07e391c31cac82': { tax: 6, sent: '1000000000000000000', received: '940000000000000000' },
  '0xd11f64ced78fd0235433fb737c992781e5ce0c82': { tax: 5, sent: '1000000000', received: '950000000' },
  '0x0bc1e003e2a3ce1428ec1c3b846e99ebc246baa7': { tax: 5, sent: '1000000000000000000', received: '950000000000000000' },
  '0x677090251191ab1ae104e4f6919431e19361c893': { tax: 5, sent: '1000000000000000000', received: '950000000000000000' },
  '0xa8dcd0eb29f6f918289b5c14634c1b5f443af826': { tax: 2, sent: '1000000000', received: '980000000' },
  '0x645c33e6ecc5e5fd67bcc248cad29b1950e469c6': { tax: 1.1, sent: '1000000000000000000', received: '988928980000000000' },
  '0x45804880de22913dafe09f4980848ece6ecbaf78': { tax: 0.02, sent: '1000000000000000000', received: '999800000000000000' },
};

// Transfer blocked (returned 0)
const transferBlocked = new Set([
  '0x95b303987a60c71504d99aa1b13b4da07b0790ab',
  '0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d',
  '0x4cb4edde04772332a42ecb039f3790e17733b4b8',
  '0x54f667db585b7b10347429c72c36c8b59ab441cb',
  '0x749ccf4c4308490f3c395de897f58e091090b461',
  '0x97f7259931f98cc64ebcd993fde03d71716f3e07',
  '0x51ad4671492dcf0544506f1fe13c82c1fb874fa2',
  '0xbbea78397d4d4590882efcc4820f03074ab2ab29',
]);

// Could not simulate (non-standard storage)
const couldNotSimulate = new Set([
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  '0xa5b0d537cebe97f087dc5fe5732d70719caaec1d',
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  '0x0000000000085d4780b73119b644ae5ecd22b376',
  '0x5a98fcbea516cf06857215779fd812ca3bef1b32',
  '0xd46ba6d942050d489dbd938a2c909a5d5039a161',
  '0xae7ab96520de3a18e5e111b5eaab095312d7fe84',
  '0x697fc467720b2a8e1b2f7f665d0e3f28793e65e8',
  '0xc589905ef2c8892af8ecef36b1190cd0141e3199',
  '0x6de1bb62c13394b7db57a25477dbedd76b3e9a90',
  '0xc9f523fce37a28893a83da68bba03835d97ae059',
  '0xeda0073b4aa1b1b6f9c718c3036551ab46e5ec32',
  '0xc581b735a1688071a1746c968e0798d642ede491',
  '0x46565877e756b2acca78faf2f7ff558dafbdd3e4',
  '0x0b14edb2ffaea3888f62d5fbfb2b88c53a987ddd',
  '0x8edb13ce75562056dff2221d193557fb4a05770d',
  '0xe2892c876c5e52a4413ba5f373d1a6e5f2e9116d',
  '0x8f1d7d2f81be5dbd82313beeda0877fb34351756',
  '0x0784e455d0a3adb2c02aa241f029b9fc3f55fa5a',
  '0x5a24d7129b6f3fcad2220296df28911880ad22b0',
  '0x88df592f8eb5d7bd38bfef7deb0fbc02cf3778a0',
  '0x9dc1684fa60458faf59af2a7538ff9bd59a62bd6',
  '0xeab7c22b8f5111559a2c2b1a3402d3fc713cac27',
  '0x1c81b4358246d3088ab4361ab755f3d8d4dd62d2',
  '0x04a3f80869edd465b79bd8868bde1a843c521b80',
  '0x616cb6a245ed4c11216ec58d10b6a2e87271845d',
  '0x9fc97f73a610318fee90a8bdfcc2ad08e2e884dd',
  '0xadbd09faf339bd18d00430be1c2cba6c1119df1e',
  '0xe3b3f5f95d263edc6a5e3d4b7314728a390a4342',
  '0xb6fdd8a5b6069de409288bc30c69c5856dc67ac8',
  '0xe65112d2f120c8cb23adc80d8e8122c0c8b7ff8d',
  '0x8357aa9070dc7d8d154da74561cec58ca30c41c3',
  '0x042b48a98b37042d58bc8defeeb7ca4ec76e6106',
  '0xf5d0140b4d53c9476dc1488bc6d8597d7393f074',
  '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643',
  '0xeb2ceed77147893ba8b250c796c2d4ef02a72b68',
]);

// Build rows
const rows = tokens.map(t => {
  const addrLower = t.address.toLowerCase();
  const taxInfo = confirmedTax[addrLower];

  let taxStatus = 'Clean';
  let taxPercent = '';
  let sent = '';
  let received = '';

  if (taxInfo) {
    taxStatus = 'TAX TOKEN (confirmed)';
    taxPercent = taxInfo.tax + '%';
    sent = taxInfo.sent;
    received = taxInfo.received;
  } else if (transferBlocked.has(addrLower)) {
    taxStatus = 'Transfer Blocked (possible tax)';
  } else if (couldNotSimulate.has(addrLower)) {
    taxStatus = 'Could Not Simulate (non-standard storage)';
  }

  return {
    'Ticker': t.ticker,
    'Name': t.name,
    'Address': t.address,
    'Chain': t.chain,
    'Decimals': t.decimals,
    'Tax Status': taxStatus,
    'Tax %': taxPercent,
    'Sent (wei)': sent,
    'Received (wei)': received,
  };
});

// Sort: confirmed tax first, then blocked, then unknown, then clean
const statusOrder = {
  'TAX TOKEN (confirmed)': 0,
  'Transfer Blocked (possible tax)': 1,
  'Could Not Simulate (non-standard storage)': 2,
  'Clean': 3,
};
rows.sort((a, b) => {
  const diff = statusOrder[a['Tax Status']] - statusOrder[b['Tax Status']];
  if (diff !== 0) return diff;
  if (a['Tax %'] && b['Tax %']) {
    return parseFloat(b['Tax %']) - parseFloat(a['Tax %']);
  }
  return a.Ticker.localeCompare(b.Ticker);
});

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(rows);

ws['!cols'] = [
  { wch: 18 },  // Ticker
  { wch: 30 },  // Name
  { wch: 44 },  // Address
  { wch: 6 },   // Chain
  { wch: 9 },   // Decimals
  { wch: 42 },  // Tax Status
  { wch: 8 },   // Tax %
  { wch: 22 },  // Sent
  { wch: 22 },  // Received
];

XLSX.utils.book_append_sheet(wb, ws, 'Tax Token Audit');
XLSX.writeFile(wb, 'tax-token-audit.xlsx');

console.log('Written to tax-token-audit.xlsx');
console.log(`Rows: ${rows.length}`);
console.log(`Confirmed tax: ${rows.filter(r => r['Tax Status'].includes('confirmed')).length}`);
console.log(`Transfer blocked: ${rows.filter(r => r['Tax Status'].includes('Blocked')).length}`);
console.log(`Could not simulate: ${rows.filter(r => r['Tax Status'].includes('Could Not')).length}`);
console.log(`Clean: ${rows.filter(r => r['Tax Status'] === 'Clean').length}`);
