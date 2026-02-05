module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^../config/(.*)$': '<rootDir>/../config/$1'
  },
  testMatch: ['**/*.test.ts']
};
