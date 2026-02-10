const { GoogleGenerativeAI } = require("@google/generative-ai");

// Use env key to avoid committing secrets
const API_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_1;

async function testGemini() {
    if (!API_KEY) {
        console.error("❌ Missing GEMINI_API_KEY / GEMINI_API_KEY_1 in environment.");
        process.exit(1);
    }
    console.log("Testing Gemini API Key:", API_KEY.substring(0, 6) + "…");
    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = "Explain how to check bicycle tire pressure in one sentence.";
        console.log("Sending prompt:", prompt);

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        console.log("✅ Success! Response:", text);
    } catch (error) {
        console.error("❌ Error:", error.message);
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", JSON.stringify(error.response.data));
        }
    }
}

testGemini();
