import { llmService } from '../../src/lib/llm';
import { geminiClient } from '../../src/lib/geminiClient';
import { ParsedCandidates } from '../../src/types';

// Mock the Gemini client
jest.mock('../../src/lib/geminiClient', () => ({
    geminiClient: {
        generateContent: jest.fn()
    }
}));

describe('LLM Service', () => {
    it('should parse valid JSON response', async () => {
        const mockResponseText = JSON.stringify({
            data: { brand: "Canyon", price: 2000 },
            confidence: { brand: 0.9 },
            uncertain_fields: [],
            needs_playwright: false,
            reasons: []
        });

        (geminiClient.generateContent as jest.Mock).mockResolvedValue(mockResponseText);

        const result = await llmService.fastPass("<html>", "http://test.com", {} as ParsedCandidates);
        
        expect(result.data.brand).toBe("Canyon");
        expect(result.needs_playwright).toBe(false);
    }, 10000);

    it('should handle invalid JSON gracefully', async () => {
        (geminiClient.generateContent as jest.Mock).mockResolvedValue("Invalid JSON");

        const result = await llmService.fastPass("<html>", "http://test.com", {} as ParsedCandidates);
        
        expect(result.needs_playwright).toBe(true);
        expect(result.reasons).toContain("LLM execution error");
    }, 10000);
});
