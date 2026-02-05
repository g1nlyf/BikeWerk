import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars from root of telegram-bot
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_KEY = process.env.GEMINI_API_KEY;

export const geminiClient = {
  getGenerativeModel: ({ model }: { model: string }) => {
    return {
      generateContent: async (prompt: string | any) => {
        if (!API_KEY) {
            console.warn("⚠️ Warning: GEMINI_API_KEY is not set in .env");
        }
        
        // Handle prompt structure
        // If it's a string, wrap it. If it's an object (parts), use it.
        // The user prompt in main file sends: "HTML ... URL ... Instruction"
        // We'll assume the caller constructs the prompt text or parts.
        
        let contents = [];
        if (typeof prompt === 'string') {
             contents = [{ parts: [{ text: prompt }] }];
        } else if (Array.isArray(prompt)) {
             contents = prompt; // Assume it's already [{parts: [...]}] or similar
        } else if (prompt.contents) {
             contents = prompt.contents;
        } else {
             // Fallback for object with parts
             contents = [{ parts: [{ text: JSON.stringify(prompt) }] }];
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
        
        const makeRequest = async (retries = 5, delay = 10000): Promise<any> => {
            try {
                const response = await axios.post(url, {
                    contents,
                    // generationConfig: {
                    //     response_mime_type: "application/json"
                    // }
                }, {
                    timeout: 60000
                });
                return response;
            } catch (error: any) {
                if (error.response && error.response.status === 429 && retries > 0) {
                    // Extract wait time from error message if possible, otherwise use exponential backoff
                    let waitTime = delay;
                    const msg = error.response.data?.error?.message || "";
                    const match = msg.match(/retry in ([\d\.]+)s/);
                    if (match) {
                        waitTime = Math.ceil(parseFloat(match[1]) * 1000) + 2000; // Add 2s buffer
                    }

                    console.warn(`⚠️ Quota exceeded. Retrying in ${waitTime/1000}s... (${retries} retries left)`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    return makeRequest(retries - 1, delay * 2);
                }
                throw error;
            }
        };

        try {
            const response = await makeRequest();
            
            return {
                response: {
                    text: () => {
                        const candidates = response.data.candidates;
                        if (candidates && candidates.length > 0) {
                            return candidates[0].content.parts.map((p: any) => p.text).join('');
                        }
                        return '';
                    },
                    candidates: response.data.candidates
                }
            };
        } catch (error: any) {
             // Log error but throw it so main script catches it
             console.error("Gemini API Error details:", error.response?.data || error.message);
             throw error;
        }
      }
    };
  }
};
