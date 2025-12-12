const fs = require('fs');
const path = require('path');

const logosDir = path.join(__dirname, '../public/coin-logos');

console.log('🔍 Finding PNGs that have SVG equivalents...\n');

// Read all files
const files = fs.readdirSync(logosDir);
const pngFiles = files.filter(f => f.endsWith('.png'));
const svgFiles = files.filter(f => f.endsWith('.svg'));

// Create a Set of SVG ticker names for quick lookup
const svgTickers = new Set(svgFiles.map(f => path.basename(f, '.svg')));

// Find PNGs that have an SVG with the same ticker name
const pngsToRemove = [];
pngFiles.forEach(pngFile => {
  const ticker = path.basename(pngFile, '.png');
  if (svgTickers.has(ticker)) {
    pngsToRemove.push({
      png: pngFile,
      svg: `${ticker}.svg`,
      ticker: ticker
    });
  }
});

console.log(`Found ${pngsToRemove.length} PNG(s) that have SVG equivalents:\n`);

if (pngsToRemove.length === 0) {
  console.log('✨ No PNGs to remove - all tickers are unique!\n');
  process.exit(0);
}

// Show what will be removed
pngsToRemove.forEach(({ png, svg, ticker }) => {
  const pngPath = path.join(logosDir, png);
  const svgPath = path.join(logosDir, svg);
  const pngSize = (fs.statSync(pngPath).size / 1024).toFixed(1);
  const svgSize = (fs.statSync(svgPath).size / 1024).toFixed(1);
  
  console.log(`  🗑️  ${ticker}:`);
  console.log(`      Remove: ${png} (${pngSize} KB)`);
  console.log(`      Keep:   ${svg} (${svgSize} KB)`);
});

console.log('\n' + '='.repeat(60));
console.log(`📊 Total PNGs to remove: ${pngsToRemove.length}`);
console.log('='.repeat(60));

console.log('\n⚠️  This will permanently delete the PNG files!');
console.log('\nTo proceed with deletion, run:');
console.log('  node scripts/remove-png-with-svg.js --remove\n');

// Remove PNGs if --remove flag is present
if (process.argv.includes('--remove')) {
  console.log('\n🗑️  Removing PNG files that have SVG equivalents...\n');
  
  let removed = 0;
  pngsToRemove.forEach(({ png }) => {
    const filePath = path.join(logosDir, png);
    try {
      fs.unlinkSync(filePath);
      console.log(`  ✅ Removed: ${png}`);
      removed++;
    } catch (error) {
      console.log(`  ❌ Failed to remove ${png}: ${error.message}`);
    }
  });
  
  console.log(`\n✨ Successfully removed ${removed} PNG file(s)!`);
  console.log('\n💡 Run "npm run generate-logos" to update the manifest.\n');
}

