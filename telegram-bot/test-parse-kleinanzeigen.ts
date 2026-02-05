import axios from "axios";
import { analyzeWithLLM } from "./llm-analyzer";
import { BikeData, LLMAnalysisResult } from "./types/parser";

// --- Helpers ---
function logSection(title: string, data: any) {
  console.log(`\n=== ${title} ===`);
  if (typeof data === 'string') {
    console.log(data);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

// --- Core Functions ---

async function fetchHtml(url: string): Promise<string> {
  const startTime = Date.now();
  console.log(`[fetchHtml] Requesting: ${url}`);
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 20000 // 20 seconds
    });
    
    const duration = Date.now() - startTime;
    console.log(`[fetchHtml] Success. Size: ${response.data.length} chars. Duration: ${duration}ms`);
    return response.data;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[fetchHtml] Error after ${duration}ms: ${error.message}`);
    if (error.response) {
      console.error(`[fetchHtml] Status: ${error.response.status}`);
    }
    throw error;
  }
}

// --- Main ---

async function run() {
  const targetUrl = "https://www.kleinanzeigen.de/s-anzeige/commencal-clash-ride-2021-mountainbike-groesse-l-sand/3252959045-217-6364";
  
  console.log("Starting extraction script...");
  
  try {
    // 1. Fetch HTML
    const html = await fetchHtml(targetUrl);
    
    // 2. Analyze with Gemini using the new modular function
    // Note: screenshotBase64 and extractedCandidates are optional and omitted here for the basic test
    const analysisResult: LLMAnalysisResult = await analyzeWithLLM(html, targetUrl);
    
    // 3. Output Logs
    logSection("RAW LLM LOGS", analysisResult.rawLLMOutput);
    
    logSection("STRUCTURED LOGS", analysisResult.structuredLogs);
    
    logSection("FINAL JSON", analysisResult.finalJson);
    
  } catch (error: any) {
    logSection("ERROR", {
      message: error.message,
      stack: error.stack
    });
  }
}

// Execute
run();
