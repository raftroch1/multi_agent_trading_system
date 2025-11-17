// Simple connection test file
const { alpacaClient } = require('./dist/services/alpaca/alpaca-client');

console.log('🧪 Testing Alpaca Connection...');
alpacaClient.testConnection().then(result => {
  console.log('✅ Alpaca connection test result:', result);
}).catch(error => {
  console.log('❌ Alpaca connection test failed:', error.message);
});