import axios from "axios";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, ".env") });

const API_KEY = process.env.GEMINI_API_KEY;

async function listModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
  try {
    const response = await axios.get(url);
    console.log("Available Models:");
    response.data.models.forEach((m: any) => {
        if (m.supportedGenerationMethods.includes("generateContent")) {
            console.log(`- ${m.name} (${m.displayName})`);
        }
    });
  } catch (error: any) {
    console.error("Error listing models:", error.response?.data || error.message);
  }
}

listModels();
