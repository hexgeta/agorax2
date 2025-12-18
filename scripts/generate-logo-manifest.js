const fs = require('fs');
const path = require('path');

const logosDir = path.join(__dirname, '../public/coin-logos');
const outputPath = path.join(__dirname, '../constants/logo-manifest.json');

console.log('🎨 Generating logo manifest...');
console.log('📁 Scanning:', logosDir);

const manifest = {};

try {
const files = fs.readdirSync(logosDir);

files.forEach(file => {
    // Skip default.svg
    if (file === 'default.svg') return;
    
    const ext = path.extname(file);
  if (ext === '.png' || ext === '.svg') {
    const ticker = path.basename(file, ext);
    
      // Only add if not already in manifest (PNG takes precedence)
      if (!manifest[ticker]) {
        manifest[ticker] = ext.slice(1); // 'png' or 'svg'
    }
  }
});

fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));

  console.log('✅ Generated logo manifest with', Object.keys(manifest).length, 'tokens');
  console.log('📄 Saved to:', outputPath);
} catch (error) {
  console.error('❌ Error generating logo manifest:', error);
  process.exit(1);
}
