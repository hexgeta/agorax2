const fs = require('fs');
const path = require('path');

// Generate a manifest of all coin logos and their formats
const logosDir = path.join(__dirname, '../public/coin-logos');
const outputPath = path.join(__dirname, '../constants/logo-manifest.json');

const manifest = {};

// Read all files in coin-logos directory
const files = fs.readdirSync(logosDir);

files.forEach(file => {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.png' || ext === '.svg') {
    const ticker = path.basename(file, ext);
    
    // If ticker already exists, prefer PNG over SVG (since we have more PNGs)
    if (!manifest[ticker] || ext === '.png') {
      manifest[ticker] = ext.slice(1); // Remove the dot
    }
  }
});

// Write manifest to file
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));

console.log(`✅ Generated logo manifest with ${Object.keys(manifest).length} entries`);
console.log(`   Output: ${outputPath}`);

