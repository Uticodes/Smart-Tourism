// Runs before every test file: point the app at the separate test database.
// dotenv does not override variables that are already set, so these win over .env.
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'smart_tourism_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
