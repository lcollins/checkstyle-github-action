module.exports = {
  clearMocks: true,
  moduleFileExtensions: ['js', 'ts'],
  moduleNameMapper: {
    '^@actions/core$': '<rootDir>/__mocks__/@actions/core.js',
    '^@actions/github$': '<rootDir>/__mocks__/@actions/github.js',
    '^@actions/glob$': '<rootDir>/__mocks__/@actions/glob.js'
  },
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  testRunner: 'jest-circus/runner',
  transform: {
    '^.+\\.ts$': ['ts-jest', {diagnostics: false}]
  },
  verbose: true
}