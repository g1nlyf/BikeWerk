import { analyzeWithLLM } from './llm-analyzer';
import { geminiClient } from './config/gemini';

// Mock Gemini Client for testing
jest.mock('./config/gemini', () => ({
  geminiClient: {
    getGenerativeModel: jest.fn()
  }
}));

describe('analyzeWithLLM', () => {
  const mockHtml = `
    <html>
      <head>
        <title>Commencal Clash 2021 - 1.800 € - Hersbruck</title>
        <meta property="og:title" content="Commencal Clash Ride 2021 Mountainbike Größe L Sand" />
      </head>
      <body>
        <h1 id="viewad-title">Commencal Clash Ride 2021 Mountainbike Größe L Sand</h1>
        <div class="price">1.800 € VB</div>
        <div class="location">91217 Bayern - Hersbruck</div>
        <div id="viewad-description-text">
            Verkaufe mein Commencal Clash Ride Mountainbike aus 2021 in der Größe L.
            Das Rad hat zeitübliche Gebrauchsspuren.
        </div>
        <ul class="breadcrumbs">
             <li>Fahrräder & Zubehör</li>
             <li>Mountainbikes</li>
        </ul>
        <span id="viewad-ad-id">3252959045</span>
      </body>
    </html>
  `;

  const mockUrl = "https://www.kleinanzeigen.de/s-anzeige/commencal-clash-ride-2021/3252959045";

  const mockLLMResponse = `
=== RAW ANALYSIS ===
Analysis of the page...

=== STRUCTURED LOGS ===
[
  { "field": "brand", "found": true, "value": "Commencal", "evidence": "title", "source": "title", "confidence": 1, "normalization": "none" }
]

=== FINAL JSON ===
\`\`\`json
{
  "originalUrl": "${mockUrl}",
  "brand": "Commencal",
  "model": "Clash Ride",
  "price": 1800,
  "isNegotiable": true,
  "year": 2021,
  "frameSize": "L",
  "location": "91217 Bayern - Hersbruck",
  "category": "Горный",
  "description": "Verkaufe mein Commencal Clash Ride...",
  "sourceAdId": "3252959045",
  "isActive": null
}
\`\`\`
  `;

  it('should correctly parse LLM response and return BikeData', async () => {
    // Setup mock
    const mockGenerateContent = jest.fn().mockResolvedValue({
      response: {
        text: () => mockLLMResponse
      }
    });

    const mockGetGenerativeModel = geminiClient.getGenerativeModel as jest.Mock;
    mockGetGenerativeModel.mockReturnValue({
      generateContent: mockGenerateContent
    });

    // Execute
    const result = await analyzeWithLLM(mockHtml, mockUrl);

    // Verify
    expect(result.finalJson.brand).toBe("Commencal");
    expect(result.finalJson.model).toBe("Clash Ride");
    expect(result.finalJson.price).toBe(1800);
    expect(result.finalJson.isNegotiable).toBe(true);
    expect(result.finalJson.year).toBe(2021);
    expect(result.finalJson.sourceAdId).toBe("3252959045");
    expect(result.finalJson.processedByGemini).toBe(true);
    expect(result.structuredLogs.length).toBeGreaterThan(0);
    
    // Verify prompt contained instructions
    const callArgs = mockGenerateContent.mock.calls[0][0];
    expect(callArgs.contents[0].parts[0].text).toContain("ФИНАЛЬНАЯ JSON-СХЕМА");
  });
});
