const fs = require('fs');
const path = require('path');

const logosDir = path.join(__dirname, '../public/coin-logos');
const storageDir = path.join(__dirname, '../public/coin-logos-storage');
const cryptoPath = path.join(__dirname, '../constants/crypto.ts');

// Create storage directory if it doesn't exist
if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir);
    console.log('Created storage directory:', storageDir);
}

// Read crypto.ts and extract tickers
const cryptoContent = fs.readFileSync(cryptoPath, 'utf8');
const tickerRegex = /ticker:\s*["']([^"']+)["']/g;
const whitelistedTickers = new Set();
let match;

while ((match = tickerRegex.exec(cryptoContent)) !== null) {
    whitelistedTickers.add(match[1]); // Keep original case
}

// Add known exceptions (default logo, etc.)
whitelistedTickers.add('default');
whitelistedTickers.add('favicon');
whitelistedTickers.add('favicon-apple');

console.log(`Found ${whitelistedTickers.size} whitelisted tickers.`);

// Process logo files
const files = fs.readdirSync(logosDir);
let movedCount = 0;

files.forEach(file => {
    if (file === '.DS_Store') return; // Skip system file

    const ext = path.extname(file);
    const name = path.basename(file, ext);

    // Check if ticker exists (case-sensitive preference, fallback to case-insensitive)
    let isWhitelisted = whitelistedTickers.has(name);
    if (!isWhitelisted) {
        // Check case-insensitive
        for (const ticker of whitelistedTickers) {
            if (ticker.toLowerCase() === name.toLowerCase()) {
                isWhitelisted = true;
                break;
            }
        }
    }

    if (!isWhitelisted) {
        const srcPath = path.join(logosDir, file);
        const destPath = path.join(storageDir, file);
        fs.renameSync(srcPath, destPath);
        console.log(`Moved: ${file}`);
        movedCount++;
    }
});

console.log(`organization complete. Moved ${movedCount} files to storage.`);
