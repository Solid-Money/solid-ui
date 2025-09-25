#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Installing @merkl/api with catalog: fix...');

try {
  // Step 1: Download the original package
  console.log('1. Downloading original package...');
  execSync('npm pack @merkl/api@1.4.15', { stdio: 'inherit' });

  // Step 2: Extract and patch
  console.log('2. Extracting and patching package.json...');
  execSync('tar -xzf merkl-api-1.4.15.tgz', { stdio: 'inherit' });

  // Read the package.json
  const packageJsonPath = path.join(__dirname, '..', 'package', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  // Fix the catalog: dependencies
  packageJson.dependencies['@elysiajs/eden'] = '^1.4.1';
  packageJson.dependencies['elysia'] = '^1.4.7';

  // Write back the patched package.json
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  // Step 3: Create patched tarball
  console.log('3. Creating patched tarball...');
  execSync('tar -czf merkl-api-1.4.15-patched.tgz -C package .', { stdio: 'inherit' });

  // Step 4: Install the patched tarball
  console.log('4. Installing patched package...');
  execSync('npm install ./merkl-api-1.4.15-patched.tgz', { stdio: 'inherit' });

  // Step 5: Clean up
  console.log('5. Cleaning up...');
  execSync('rm -rf package merkl-api-1.4.15.tgz merkl-api-1.4.15-patched.tgz', { stdio: 'inherit' });

  console.log('✅ @merkl/api installed successfully!');
} catch (error) {
  console.error('❌ Error installing @merkl/api:', error.message);
  process.exit(1);
}
