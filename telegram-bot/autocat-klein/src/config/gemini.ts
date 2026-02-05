// Re-export the main gemini client from the parent project
// This allows using the shared client instance
const geminiModule = require('../../../../config/gemini');
export const geminiClient = geminiModule.geminiClient;
