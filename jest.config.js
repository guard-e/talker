module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@talker/shared/(.*)$': '<rootDir>/packages/shared/src/$1',
    '^@talker/client/(.*)$': '<rootDir>/packages/client/src/$1',
    '^@talker/server/(.*)$': '<rootDir>/packages/server/src/$1',
  },
};
