import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('=== Environment Variable Test ===');
console.log('Current working directory:', process.cwd());
console.log('Script directory:', __dirname);

// Try loading from different locations
const envPaths = [
  '.env',
  '../.env',
  path.join(__dirname, '.env'),
  path.join(__dirname, '../.env')
];

for (const envPath of envPaths) {
  try {
    const result = dotenv.config({ path: envPath });
    console.log(`Trying ${envPath}:`, result.error ? 'FAILED' : 'SUCCESS');
    if (!result.error && process.env.OPENROUTER_API_KEY) {
      console.log(`✓ Found OPENROUTER_API_KEY in ${envPath}`);
      break;
    }
  } catch (error) {
    console.log(`Error loading ${envPath}:`, error.message);
  }
}

console.log('\n=== Final Environment Status ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('OPENROUTER_API_KEY exists:', !!process.env.OPENROUTER_API_KEY);
console.log('OPENROUTER_API_KEY length:', process.env.OPENROUTER_API_KEY?.length || 0);
console.log('OPENROUTER_API_KEY starts with:', process.env.OPENROUTER_API_KEY?.substring(0, 10) || 'undefined');

// Test other env vars
console.log('REDIS_URL exists:', !!process.env.REDIS_URL);
console.log('APP_URL:', process.env.APP_URL);

// Check if we can find .env files
console.log('\n=== .env File Search ===');
import fs from 'fs';

const searchPaths = ['.env', '../.env'];
for (const searchPath of searchPaths) {
  try {
    const stats = fs.statSync(searchPath);
    console.log(`${searchPath}: EXISTS (${stats.size} bytes)`);
    
    // Try to read first few lines (safely)
    const content = fs.readFileSync(searchPath, 'utf8');
    const lines = content.split('\n').slice(0, 5);
    console.log(`  First few lines:`);
    lines.forEach((line, i) => {
      if (line.trim()) {
        // Mask sensitive values
        const maskedLine = line.includes('=') 
          ? line.split('=')[0] + '=***MASKED***'
          : line;
        console.log(`    ${i + 1}: ${maskedLine}`);
      }
    });
  } catch (error) {
    console.log(`${searchPath}: NOT FOUND`);
  }
}
