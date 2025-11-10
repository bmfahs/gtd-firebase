require('dotenv').config({ path: '.env.personal-gtd-ea76d' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GTD_GOOGLE_AI_API_KEY);
    const models = await genAI.getGenerativeModel({ model: '' }).listModels();
    console.log('Available models:');
    for (const model of models) {
      console.log(model.name);
    }
  } catch (error) {
    console.error('Error listing models:', error);
  }
}

listModels();
