/** @type {import('ts-jest').JestConfigWithTsJest} */
// eslint-disable-next-line no-undef
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageProvider: 'v8',
  testPathIgnorePatterns: ['/node_modules/', '/__rules/', '/.cache/'],
  coveragePathIgnorePatterns: ['/node_modules/', '/.cache/']
};