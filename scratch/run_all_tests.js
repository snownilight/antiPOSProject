const { execSync } = require('child_process');
const path = require('path');

const tests = [
  'test_login_response.js',
  'test_e2e.js',
  'test_orders.js',
  'test_checkout.js',
  'test_compound_checkout.js',
  'test_stock_lifecycle.js',
  'test_combo_stock_and_stats.js',
  'test_modifiers.js',
  'test_qrcode_ordering.js',
  'test_concurrent.js',
  'test_websocket.js'
];

console.log('==================================================');
console.log('🚀 Starting Master Edge & Regression Testing Runner');
console.log('==================================================\n');

let passCount = 0;
let failCount = 0;
const results = [];

for (const testFile of tests) {
  // Reset database to default baseline state to ensure test isolation
  try {
    execSync('node scratch/reset_db.js', {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'ignore'
    });
  } catch (err) {
    console.error(`⚠️ Database reset failed before running ${testFile}`);
  }

  console.log(`Running: ${testFile}...`);
  try {
    const stdout = execSync(`node scratch/${testFile}`, {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'pipe'
    }).toString();
    console.log(`✓ ${testFile} passed successfully.`);
    results.push({ name: testFile, status: 'PASS', error: null });
    passCount++;
  } catch (err) {
    console.error(`❌ ${testFile} failed!`);
    const errorMsg = err.stdout ? err.stdout.toString() : (err.stderr ? err.stderr.toString() : err.message);
    console.error(errorMsg);
    results.push({ name: testFile, status: 'FAIL', error: errorMsg });
    failCount++;
  }
  console.log('--------------------------------------------------');
}

console.log('\n==================================================');
console.log('📊 Test Execution Summary');
console.log('==================================================');
console.log(`Total tests run: ${tests.length}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}\n`);

for (const res of results) {
  const statusSymbol = res.status === 'PASS' ? '✅' : '❌';
  console.log(`${statusSymbol} ${res.name}: ${res.status}`);
}
console.log('==================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
