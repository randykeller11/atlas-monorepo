export default {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.js'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  moduleNameMapping: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transform: {},
  testMatch: [
    '**/tests/**/*.test.js',
    '**/server/**/*.test.js'
  ],
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/node_modules/**',
    '!server/tests/**',
    '!server/prisma/**'
  ],
  setupFilesAfterEnv: ['<rootDir>/server/tests/setup.js']
};
