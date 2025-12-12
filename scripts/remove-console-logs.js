#!/usr/bin/env node

/**
 * Remove Console Logs Script
 * 
 * Removes all console.log, console.warn, console.error, console.debug statements
 * from TypeScript and JavaScript files in the project.
 * 
 * Usage:
 *   node scripts/remove-console-logs.js          # Dry run (preview changes)
 *   node scripts/remove-console-logs.js --apply  # Actually remove the logs
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const isDryRun = !args.includes('--apply');

// Directories to scan
const SCAN_DIRS = [
  'app',
  'components',
  'hooks',
  'utils',
  'config',
  'lib',
];

// Directories/files to skip
const SKIP_PATTERNS = [
  'node_modules',
  '.next',
  'dist',
  'build',
  '.git',
  'scripts', // Don't modify scripts themselves
  '.test.',
  '.spec.',
];

// Console method patterns
const CONSOLE_PATTERNS = [
  /console\.log\([^)]*\);?/g,
  /console\.warn\([^)]*\);?/g,
  /console\.error\([^)]*\);?/g,
  /console\.debug\([^)]*\);?/g,
  /console\.info\([^)]*\);?/g,
];

let filesScanned = 0;
let filesModified = 0;
let logsRemoved = 0;

function shouldSkip(filePath) {
  return SKIP_PATTERNS.some(pattern => filePath.includes(pattern));
}

function findFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    
    if (shouldSkip(filePath)) return;
    
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findFiles(filePath, fileList);
    } else if (file.match(/\.(ts|tsx|js|jsx)$/)) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function removeConsoleLogs(content) {
  let modified = content;
  let count = 0;
  
  CONSOLE_PATTERNS.forEach(pattern => {
    const matches = modified.match(pattern);
    if (matches) {
      count += matches.length;
      // Remove the console statement
      modified = modified.replace(pattern, '');
    }
  });
  
  // Clean up extra blank lines (more than 2 consecutive)
  modified = modified.replace(/\n\n\n+/g, '\n\n');
  
  return { modified, count };
}

function processFile(filePath) {
  filesScanned++;
  
  const content = fs.readFileSync(filePath, 'utf8');
  const { modified, count } = removeConsoleLogs(content);
  
  if (count > 0) {
    filesModified++;
    logsRemoved += count;
    
    console.log(`📝 ${filePath}`);
    console.log(`   Removed ${count} console statement(s)`);
    
    if (!isDryRun) {
      fs.writeFileSync(filePath, modified, 'utf8');
      console.log(`   ✅ File updated`);
    } else {
      console.log(`   [DRY RUN - no changes made]`);
    }
    console.log('');
  }
}

function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         Remove Console Logs Script                       ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  
  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No files will be modified');
    console.log('   Run with --apply flag to actually remove console logs');
    console.log('');
  } else {
    console.log('⚠️  APPLY MODE - Files will be modified!');
    console.log('');
  }
  
  const allFiles = [];
  
  SCAN_DIRS.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);
    if (fs.existsSync(dirPath)) {
      findFiles(dirPath, allFiles);
    }
  });
  
  console.log(`Found ${allFiles.length} files to scan\n`);
  console.log('───────────────────────────────────────────────────────────\n');
  
  allFiles.forEach(processFile);
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Files scanned:    ${filesScanned}`);
  console.log(`Files modified:   ${filesModified}`);
  console.log(`Logs removed:     ${logsRemoved}`);
  console.log('═══════════════════════════════════════════════════════════');
  
  if (isDryRun && filesModified > 0) {
    console.log('\n💡 Run with --apply to actually remove these console logs:');
    console.log('   node scripts/remove-console-logs.js --apply\n');
  } else if (!isDryRun && filesModified > 0) {
    console.log('\n✅ All console logs have been removed!\n');
  } else {
    console.log('\n✨ No console logs found!\n');
  }
}

main();

