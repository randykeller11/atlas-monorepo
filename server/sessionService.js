import Redis from 'ioredis';

// Initialize Redis client with TLS support for Heroku
const redis = new Redis(process.env.REDIS_URL, {
  tls: process.env.NODE_ENV === 'production' ? {} : { rejectUnauthorized: false },
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
});

const NAMESPACE = process.env.SESSION_NAMESPACE || (process.env.NODE_ENV === 'development' ? 'dev:' : '');

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
    
    return session;
  } catch (error) {
    console.warn(`Redis error for session ${sessionId}, falling back to memory:`, error.message);
    
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
  const payload = JSON.stringify(sessionObj);
  const ttlSeconds = parseInt(process.env.SESSION_TTL) || (7 * 24 * 60 * 60); // 7 days default
  
  try {
    await redis.set(key, payload, 'EX', ttlSeconds);
    console.log(`Session saved for ${sessionId}, TTL: ${ttlSeconds}s`);
  } catch (error) {
    console.warn(`Redis error saving session ${sessionId}, using memory fallback:`, error.message);
    memoryStore.set(sessionId, sessionObj);
  }
}

export async function deleteSession(sessionId) {
  const key = `${NAMESPACE}session:${sessionId}`;
  
  try {
    await redis.del(key);
    console.log(`Session deleted for ${sessionId}`);
  } catch (error) {
    console.warn(`Redis error deleting session ${sessionId}:`, error.message);
  }
  
  // Also remove from memory fallback
  memoryStore.delete(sessionId);
}

// Health check function
export async function checkRedisHealth() {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('Redis health check failed:', error.message);
    return false;
  }
}

// Migration helper to convert existing in-memory sessions
export function migrateMemorySession(sessionId, memoryState) {
  const session = createEmptySession();
  session.id = sessionId;
  
  // Map your existing structure
  if (memoryState) {
    session.currentSection = memoryState.currentSection;
    session.sections = { ...memoryState.sections };
    session.questionTypes = { ...memoryState.questionTypes };
    session.lastQuestionType = memoryState.lastQuestionType;
    session.totalQuestions = memoryState.totalQuestions;
    session.hasOpenEndedInSection = { ...memoryState.hasOpenEndedInSection };
  }
  
  return session;
}
