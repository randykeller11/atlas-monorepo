import Redis from 'ioredis';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Redis client with TLS support for Heroku
let redis = null;
let redisHealthy = false;

// Only initialize Redis if REDIS_URL is provided
if (process.env.REDIS_URL) {
  redis = new Redis(process.env.REDIS_URL, {
    tls: process.env.NODE_ENV === 'production' ? {} : { rejectUnauthorized: false },
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 1, // Reduce retries for faster fallback
    lazyConnect: true,
    connectTimeout: 2000, // 2 second timeout
    commandTimeout: 1000, // 1 second command timeout
  });
} else {
  console.log('⚠ No REDIS_URL configured, using memory-only session storage');
}

const NAMESPACE = process.env.SESSION_NAMESPACE || (process.env.NODE_ENV === 'development' ? 'dev:' : '');
const SESSION_TTL = parseInt(process.env.SESSION_TTL) || (7 * 24 * 60 * 60); // 7 days default

// Fallback in-memory store for development resilience
const memoryStore = new Map();

function createEmptySession() {
  return {
    id: null,
    // Keep your existing conversation state structure
    currentSection: 'introduction',
    sections: {
      interestExploration: 0,
      workStyle: 0,
      technicalAptitude: 0,
      careerValues: 0
    },
    questionTypes: {
      multiple_choice: 0,
      text: 0,
      ranking: 0
    },
    lastQuestionType: null,
    totalQuestions: 0,
    hasOpenEndedInSection: {
      interestExploration: false,
      workStyle: false,
      technicalAptitude: false,
      careerValues: false
    },
    // New fields for Phase 1
    persona: null,
    anchors: [],
    history: [],
    summary: null,
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString()
  };
}

export async function getSession(sessionId) {
  const key = `${NAMESPACE}session:${sessionId}`;
  
  // If no Redis configured, use memory only
  if (!redis) {
    if (!memoryStore.has(sessionId)) {
      const newSession = createEmptySession();
      newSession.id = sessionId;
      memoryStore.set(sessionId, newSession);
      return newSession;
    }
    return memoryStore.get(sessionId);
  }
  
  try {
    const raw = await redis.get(key);
    if (!raw) {
      console.log(`Session miss for ${sessionId}, creating new session`);
      const newSession = createEmptySession();
      newSession.id = sessionId;
      await saveSession(sessionId, newSession);
      return newSession;
    }
    
    const session = JSON.parse(raw);
    session.lastActivity = new Date().toISOString();
    
    // Log session hit with TTL info
    const ttl = await redis.ttl(key);
    console.log(`Session hit for ${sessionId}, TTL: ${ttl}s`);
    
    redisHealthy = true;
    return session;
  } catch (error) {
    console.warn(`Redis error for session ${sessionId}, falling back to memory:`, error.message);
    redisHealthy = false;
    
    // Fallback to memory store
    if (!memoryStore.has(sessionId)) {
      const newSession = createEmptySession();
      newSession.id = sessionId;
      memoryStore.set(sessionId, newSession);
      return newSession;
    }
    
    return memoryStore.get(sessionId);
  }
}

export async function saveSession(sessionId, sessionObj) {
  const key = `${NAMESPACE}session:${sessionId}`;
  
  // Update timestamps
  sessionObj.lastActivity = new Date().toISOString();
  if (!sessionObj.createdAt) {
    sessionObj.createdAt = new Date().toISOString();
  }
  
  const payload = JSON.stringify(sessionObj);
  
  // Always save to memory as backup
  memoryStore.set(sessionId, sessionObj);
  
  // If no Redis configured, only use memory
  if (!redis) {
    console.log(`Session saved to memory for ${sessionId}`);
    return;
  }
  
  try {
    await redis.set(key, payload, 'EX', SESSION_TTL);
    console.log(`Session saved for ${sessionId}, TTL: ${SESSION_TTL}s`);
    redisHealthy = true;
  } catch (error) {
    console.warn(`Redis error saving session ${sessionId}, using memory fallback:`, error.message);
    redisHealthy = false;
    // Memory save already done above
  }
}

export async function deleteSession(sessionId) {
  const key = `${NAMESPACE}session:${sessionId}`;
  
  // Always remove from memory
  memoryStore.delete(sessionId);
  
  // If no Redis configured, we're done
  if (!redis) {
    console.log(`Session deleted from memory for ${sessionId}`);
    return;
  }
  
  try {
    await redis.del(key);
    console.log(`Session deleted for ${sessionId}`);
  } catch (error) {
    console.warn(`Redis error deleting session ${sessionId}:`, error.message);
  }
}

// Health check function
export async function checkRedisHealth() {
  if (!redis) {
    return false; // No Redis configured
  }
  
  try {
    const result = await redis.ping();
    redisHealthy = result === 'PONG';
    return redisHealthy;
  } catch (error) {
    console.error('Redis health check failed:', error.message);
    redisHealthy = false;
    return false;
  }
}

// Get current Redis health status
export function getRedisStatus() {
  return {
    healthy: redisHealthy,
    memoryFallbackActive: !redisHealthy,
    memoryStoreSize: memoryStore.size,
    namespace: NAMESPACE,
    ttl: SESSION_TTL
  };
}

// Get session statistics
export async function getSessionStats(sessionId) {
  const key = `${NAMESPACE}session:${sessionId}`;
  
  try {
    const session = await getSession(sessionId);
    
    const baseStats = {
      sessionId,
      exists: true,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      messageCount: session.history ? session.history.length : 0,
      hasPersona: !!session.persona,
      anchorCount: session.anchors ? session.anchors.length : 0,
      currentSection: session.currentSection,
      totalQuestions: session.totalQuestions,
      hasSummary: !!session.summary,
      inMemory: memoryStore.has(sessionId)
    };
    
    if (!redis) {
      return {
        ...baseStats,
        ttl: -1,
        redisHealthy: false
      };
    }
    
    try {
      const ttl = await redis.ttl(key);
      const exists = await redis.exists(key);
      
      return {
        ...baseStats,
        exists: exists === 1,
        ttl: ttl,
        redisHealthy: redisHealthy
      };
    } catch (error) {
      return {
        ...baseStats,
        ttl: -1,
        redisHealthy: false,
        error: error.message
      };
    }
  } catch (error) {
    return {
      sessionId,
      exists: false,
      error: error.message,
      inMemory: memoryStore.has(sessionId),
      redisHealthy: redisHealthy
    };
  }
}

// Cleanup memory store periodically
export function cleanupMemoryStore() {
  const maxSize = 1000;
  if (memoryStore.size > maxSize) {
    console.log(`Memory store cleanup: ${memoryStore.size} sessions, removing oldest`);
    const entries = Array.from(memoryStore.entries());
    
    // Sort by lastActivity if available, otherwise remove first half
    const toRemove = entries.slice(0, Math.floor(entries.length / 2));
    toRemove.forEach(([sessionId]) => {
      memoryStore.delete(sessionId);
    });
    
    console.log(`Memory store cleanup complete: ${memoryStore.size} sessions remaining`);
  }
}

// Periodic cleanup (run every 30 minutes)
setInterval(cleanupMemoryStore, 30 * 60 * 1000);

// Migration helper to convert existing in-memory sessions
export function migrateMemorySession(sessionId, memoryState) {
  const session = createEmptySession();
  session.id = sessionId;
  
  // Map your existing structure
  if (memoryState) {
    session.currentSection = memoryState.currentSection || 'introduction';
    session.sections = { ...session.sections, ...memoryState.sections };
    session.questionTypes = { ...session.questionTypes, ...memoryState.questionTypes };
    session.lastQuestionType = memoryState.lastQuestionType;
    session.totalQuestions = memoryState.totalQuestions || 0;
    session.hasOpenEndedInSection = { ...session.hasOpenEndedInSection, ...memoryState.hasOpenEndedInSection };
    
    // Preserve any existing Phase 1 fields
    if (memoryState.persona) session.persona = memoryState.persona;
    if (memoryState.anchors) session.anchors = memoryState.anchors;
    if (memoryState.history) session.history = memoryState.history;
    if (memoryState.summary) session.summary = memoryState.summary;
  }
  
  return session;
}

// Redis connection event handlers (only if Redis is configured)
if (redis) {
  redis.on('connect', () => {
    console.log('✓ Redis connected successfully');
    redisHealthy = true;
  });

  redis.on('ready', () => {
    console.log('✓ Redis ready for commands');
    redisHealthy = true;
  });

  redis.on('error', (error) => {
    console.warn('⚠ Redis connection error:', error.message);
    redisHealthy = false;
  });

  redis.on('close', () => {
    console.warn('⚠ Redis connection closed');
    redisHealthy = false;
  });

  redis.on('reconnecting', () => {
    console.log('🔄 Redis reconnecting...');
  });
}

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  if (redis) {
    try {
      await redis.quit();
      console.log('✓ Redis connection closed');
    } catch (error) {
      console.error('Error closing Redis connection:', error.message);
    }
  }
});

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  if (redis) {
    try {
      await redis.quit();
      console.log('✓ Redis connection closed');
    } catch (error) {
      console.error('Error closing Redis connection:', error.message);
    }
  }
  process.exit(0);
});
