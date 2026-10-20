const app = require('./app');
const env = require('./config/env');
const { schedulePrivacyJobs } = require('./jobs/privacy');

app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
});

schedulePrivacyJobs();
