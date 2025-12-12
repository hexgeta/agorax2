const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const logosDir = path.join(__dirname, '../public/coin-logos');

// Get file hash to detect true duplicates
function getFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('md5');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

console.log('🔍 Scanning for duplicate logo files...\n');

// Read all files
const files = fs.readdirSync(logosDir);
const pngFiles = files.filter(f => f.endsWith('.png'));
const svgFiles = files.filter(f => f.endsWith('.svg'));

// Track files by ticker name
const tickerMap = new Map();
const fileHashes = new Map();
const duplicatesByHash = new Map();

// First pass: detect exact file duplicates (same content)
console.log('📋 Phase 1: Detecting exact duplicates (same file content)...');
files.forEach(file => {
  const ext = path.extname(file);
  if (ext === '.png' || ext === '.svg') {
    const filePath = path.join(logosDir, file);
    const hash = getFileHash(filePath);
    
    if (!fileHashes.has(hash)) {
      fileHashes.set(hash, []);
    }
    fileHashes.get(hash).push(file);
  }
});

// Find duplicate files (same hash)
let exactDuplicates = [];
fileHashes.forEach((fileList, hash) => {
  if (fileList.length > 1) {
    // Keep the first one, mark others as duplicates
    const toKeep = fileList[0];
    const toRemove = fileList.slice(1);
    exactDuplicates.push(...toRemove);
    console.log(`  ⚠️  Found ${fileList.length} identical copies: ${fileList.join(', ')}`);
    console.log(`      Keeping: ${toKeep}`);
    console.log(`      Removing: ${toRemove.join(', ')}`);
  }
});

console.log(`\n✅ Found ${exactDuplicates.length} exact duplicate(s)\n`);

// Second pass: detect ticker conflicts (same name, different format)
console.log('📋 Phase 2: Detecting ticker conflicts (both PNG and SVG exist)...');
pngFiles.forEach(pngFile => {
  const ticker = path.basename(pngFile, '.png');
  if (!tickerMap.has(ticker)) {
    tickerMap.set(ticker, { png: null, svg: null });
  }
  tickerMap.get(ticker).png = pngFile;
});

svgFiles.forEach(svgFile => {
  const ticker = path.basename(svgFile, '.svg');
  if (!tickerMap.has(ticker)) {
    tickerMap.set(ticker, { png: null, svg: null });
  }
  tickerMap.get(ticker).svg = svgFile;
});

// Find tickers with both formats
const conflicts = [];
tickerMap.forEach((formats, ticker) => {
  if (formats.png && formats.svg) {
    conflicts.push({ ticker, png: formats.png, svg: formats.svg });
  }
});

console.log(`\n✅ Found ${conflicts.length} ticker(s) with both PNG and SVG\n`);

if (conflicts.length > 0) {
  console.log('📊 Conflicts (both formats exist):');
  conflicts.forEach(({ ticker, png, svg }) => {
    const pngPath = path.join(logosDir, png);
    const svgPath = path.join(logosDir, svg);
    const pngSize = (fs.statSync(pngPath).size / 1024).toFixed(1);
    const svgSize = (fs.statSync(svgPath).size / 1024).toFixed(1);
    console.log(`  • ${ticker}:`);
    console.log(`    - ${png} (${pngSize} KB)`);
    console.log(`    - ${svg} (${svgSize} KB)`);
  });
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 SUMMARY');
console.log('='.repeat(60));
console.log(`Total logo files: ${files.filter(f => f.endsWith('.png') || f.endsWith('.svg')).length}`);
console.log(`PNG files: ${pngFiles.length}`);
console.log(`SVG files: ${svgFiles.length}`);
console.log(`Exact duplicates to remove: ${exactDuplicates.length}`);
console.log(`Tickers with both formats: ${conflicts.length}`);
console.log('='.repeat(60));

// Ask for confirmation before removing
if (exactDuplicates.length === 0) {
  console.log('\n✨ No exact duplicates found! Your logos are clean.');
  process.exit(0);
}

console.log('\n⚠️  WARNING: This will permanently delete the duplicate files!');
console.log('\nTo proceed with deletion, run:');
console.log('  node scripts/remove-duplicate-logos.js --remove\n');

// Remove duplicates if --remove flag is present
if (process.argv.includes('--remove')) {
  console.log('\n🗑️  Removing exact duplicates...\n');
  
  let removed = 0;
  exactDuplicates.forEach(file => {
    const filePath = path.join(logosDir, file);
    try {
      fs.unlinkSync(filePath);
      console.log(`  ✅ Removed: ${file}`);
      removed++;
    } catch (error) {
      console.log(`  ❌ Failed to remove ${file}: ${error.message}`);
    }
  });
  
  console.log(`\n✨ Successfully removed ${removed} duplicate file(s)!`);
  console.log('\n💡 Run "npm run generate-logos" to update the manifest.\n');
}

