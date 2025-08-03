import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkRedisHealth } from '../sessionService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testPhase2Prerequisites() {
  console.log('=== Testing Phase 2 Prerequisites ===\n');
  
  let testsPassed = 0;
  let testsTotal = 0;
  let warnings = [];
  
  const runTest = async (testName, testFn) => {
    testsTotal++;
    try {
      console.log(`${testsTotal}. Testing ${testName}...`);
      const result = await testFn();
      if (result && result.warning) {
        warnings.push(result.warning);
        console.log(`   ⚠ ${testName}: ${result.warning}`);
      } else {
        console.log(`   ✓ ${testName} passed`);
      }
      testsPassed++;
    } catch (error) {
      console.error(`   ✗ ${testName} failed:`, error.message);
    }
    console.log('');
  };

  // Test 1: OpenRouter API Key (Required for Section 1)
  await runTest('OpenRouter API Key Configuration', async () => {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY not configured - required for persona enrichment');
    }
    
    if (process.env.OPENROUTER_API_KEY.length < 20) {
      throw new Error('OPENROUTER_API_KEY appears to be invalid (too short)');
    }
    
    console.log(`     ✓ API key configured (${process.env.OPENROUTER_API_KEY.substring(0, 8)}...)`);
  });

  // Test 2: Phase 1 Services (Required)
  await runTest('Phase 1 Services Availability', async () => {
    // Test core services from Phase 1
    const { aiRequest } = await import('../aiService.js');
    const { getSession } = await import('../sessionService.js');
    const { analyzePersona } = await import('../personaService.js');
    const { loadPromptTemplate } = await import('../promptService.js');
    
    if (typeof aiRequest !== 'function') {
      throw new Error('aiService.aiRequest not available');
    }
    
    if (typeof getSession !== 'function') {
      throw new Error('sessionService.getSession not available');
    }
    
    if (typeof analyzePersona !== 'function') {
      throw new Error('personaService.analyzePersona not available');
    }
    
    if (typeof loadPromptTemplate !== 'function') {
      throw new Error('promptService.loadPromptTemplate not available');
    }
    
    console.log('     ✓ All Phase 1 services available');
  });

  // Test 3: Redis/Session Storage (Required)
  await runTest('Session Storage Health', async () => {
    const isHealthy = await checkRedisHealth();
    
    if (!isHealthy && !process.env.REDIS_URL) {
      return { warning: 'Using memory-only session storage (development OK, production needs Redis)' };
    }
    
    if (!isHealthy && process.env.REDIS_URL) {
      throw new Error('Redis configured but not healthy - check REDIS_URL');
    }
    
    console.log('     ✓ Session storage healthy');
  });

  // Test 4: Supabase Configuration (Optional for now)
  await runTest('Supabase Configuration', async () => {
    console.log('     Checking environment variables...');
    console.log(`     SUPABASE_URL: ${process.env.SUPABASE_URL ? 'SET' : 'NOT SET'}`);
    console.log(`     SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET'}`);
    
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { warning: 'Supabase not configured - persona cards will use file storage for now' };
    }
    
    if (!process.env.SUPABASE_URL.includes('supabase.co')) {
      throw new Error('SUPABASE_URL appears invalid - should contain supabase.co');
    }
    
    if (process.env.SUPABASE_SERVICE_ROLE_KEY.length < 50) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY appears invalid - should be longer than 50 characters');
    }
    
    // Test that we can import the Supabase client
    try {
      console.log('     Importing Supabase client...');
      const { supabase, checkSupabaseHealth } = await import('../supabaseClient.js');
      
      if (!supabase) {
        return { warning: 'Supabase client not initialized - check environment variables' };
      }
      
      console.log('     Testing Supabase connectivity...');
      // Test basic connectivity and table existence
      const health = await checkSupabaseHealth();
      console.log(`     Health check result: ${JSON.stringify(health)}`);
      
      if (!health.healthy) {
        if (health.reason.includes('relation "persona_cards" does not exist')) {
          return { warning: 'Supabase connected but persona_cards table missing - run server/migrations/001_create_persona_cards.sql' };
        }
        return { warning: `Supabase connection issue: ${health.reason}` };
      }
      
      console.log('     ✓ Supabase configured and healthy');
      console.log('     ✓ persona_cards table exists');
    } catch (error) {
      console.log(`     Import/connection error: ${error.message}`);
      if (error.message.includes('relation "persona_cards" does not exist')) {
        return { warning: 'Supabase connected but persona_cards table missing - run server/migrations/001_create_persona_cards.sql' };
      }
      return { warning: `Supabase client error: ${error.message}` };
    }
  });

  // Test 5: File System Permissions (Required for templates/storage)
  await runTest('File System Permissions', async () => {
    const fs = await import('fs/promises');
    const testDir = path.join(__dirname, '../temp');
    
    try {
      // Test write permissions
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(path.join(testDir, 'test.json'), '{"test": true}');
      await fs.readFile(path.join(testDir, 'test.json'), 'utf8');
      await fs.unlink(path.join(testDir, 'test.json'));
      await fs.rmdir(testDir);
      
      console.log('     ✓ File system read/write permissions OK');
    } catch (error) {
      throw new Error(`File system permissions issue: ${error.message}`);
    }
  });

  // Test 6: Node.js Version (Required)
  await runTest('Node.js Version', async () => {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
    
    if (majorVersion < 18) {
      throw new Error(`Node.js ${majorVersion} detected, need 18+ for ES modules and modern features`);
    }
    
    console.log(`     ✓ Node.js ${nodeVersion} (compatible)`);
  });

  // Test 7: Required Dependencies
  await runTest('Required Dependencies', async () => {
    const requiredDeps = [
      'zod',      // For schema validation
      'uuid',     // For ID generation
      'js-yaml',  // For template parsing
      'winston'   // For logging
    ];
    
    for (const dep of requiredDeps) {
      try {
        await import(dep);
      } catch (error) {
        throw new Error(`Required dependency '${dep}' not available`);
      }
    }
    
    console.log(`     ✓ All required dependencies available`);
  });

  // Summary
  console.log('=== Phase 2 Prerequisites Summary ===');
  console.log(`Tests passed: ${testsPassed}/${testsTotal}`);
  console.log(`Success rate: ${Math.round((testsPassed / testsTotal) * 100)}%`);
  
  if (warnings.length > 0) {
    console.log('\n⚠ Warnings:');
    warnings.forEach(warning => console.log(`   • ${warning}`));
  }
  
  if (testsPassed === testsTotal) {
    console.log('\n🎉 Ready to begin Phase 2 implementation!');
    console.log('\n✅ Prerequisites Met:');
    console.log('   • OpenRouter API configured');
    console.log('   • Phase 1 services operational');
    console.log('   • Session storage working');
    console.log('   • File system permissions OK');
    console.log('   • All dependencies available');
    
    if (warnings.length === 0) {
      console.log('\n🚀 Full production setup ready!');
    } else {
      console.log('\n💡 Development setup ready (see warnings for production considerations)');
    }
  } else {
    console.log('\n❌ Prerequisites not met. Please resolve the issues above before starting Phase 2.');
  }
  
  process.exit(testsPassed === testsTotal ? 0 : 1);
}

testPhase2Prerequisites().catch(error => {
  console.error('❌ Prerequisites test failed:', error);
  process.exit(1);
});
