// Runs before every test file: point the app at the separate test database.
// dotenv does not override variables that are already set, so these win over .env.
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'smart_tourism_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
// Report photos written by the tests go to a throwaway folder, never server/uploads.
process.env.UPLOAD_DIR = require('path').join(require('os').tmpdir(), 'smart-tourism-test-uploads');
