import { geminiClient } from './geminiClient';

export interface SearchItem {
    title: string;
    price: string;
    oldPrice?: string;
    link: string;
    location: string;
    date: string;
    snippet: string;
}

export interface FilterResult {
    selectedUrls: string[];
    reasons: Record<string, string>;
}

export class SmartFilter {
    
    /**
     * Selects the top 3 best listings from a list of search results.
     * Uses heuristics + LLM Fast Pass.
     */
    async selectTopCandidates(items: SearchItem[]): Promise<FilterResult> {
        console.log(`🔍 SmartFilter: Analyzing ${items.length} items...`);

        // 1. Heuristic Filter (Cheap)
        // Remove obviously bad items (Spare parts, looking for, etc.)
        const candidates = items.filter(item => {
            const t = item.title.toLowerCase();
            // Basic negative keywords
            if (t.includes('suche') || t.includes('defekt') || t.includes('schlachte') || t.includes('rahmen') || t.includes('dämpfer')) {
                 // If price is very low (<300) and it's a frame/part, skip
                 // But 'rahmen' might be a frame kit which is good. 
                 // Let's keep it simple: 'suche' is definitely bad.
                 if (t.includes('suche')) return false;
            }
            
            // Price sanity check (if parseable)
            const price = this.parsePrice(item.price);
            if (price > 0 && price < 200) return false; // Too cheap for a good MTB (likely parts or junk)

            return true;
        });

        console.log(`   -> ${candidates.length} items passed heuristic filter.`);

        if (candidates.length === 0) {
            return { selectedUrls: [], reasons: {} };
        }

        // Limit to top 20 for LLM to save context
        const toAnalyze = candidates.slice(0, 20);
        const budgetMin = 1000;
        const budgetMax = 2500;
        const budgetItems = toAnalyze.filter(i => {
            const p = this.parsePrice(i.price);
            return Number.isFinite(p) && p >= budgetMin && p <= budgetMax;
        });
        const nonBudgetItems = toAnalyze.filter(i => {
            const p = this.parsePrice(i.price);
            return !(Number.isFinite(p) && p >= budgetMin && p <= budgetMax);
        });
        const toAnalyzeBudgetFirst = budgetItems.concat(nonBudgetItems);

        // 2. LLM Fast Pass (Batch Analysis)
        // We send a compact list to the LLM
        const prompt = `
You are an expert bicycle buyer. I will give you a list of bike listings from Kleinanzeigen.
Your goal is to pick the TOP 3 best listings that are likely complete, high-quality mountain bikes (Enduro, Downhill, All-Mountain) suitable for resale or enthusiast use.
Ignore spare parts, children's bikes, city bikes, or obvious junk.
Focus on: Known brands (Santa Cruz, Specialized, YT, Canyon, etc.), good models, reasonable prices.

 Strong preference: pick items priced between €1000 and €2500. Ensure at least 2 of your 3 picks fall in this range, if available.

Listings:
${toAnalyzeBudgetFirst.map((item, i) => `[${i}] ${item.title} | Price: ${item.price} | Loc: ${item.location}`).join('\n')}

Return a JSON object with the indices of the best 3 listings (or fewer if not enough good ones).
Format: { "indices": [0, 5, 2], "reason": "Brief explanation" }
`;

        try {
            const response = await geminiClient.generateContent(prompt);
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(cleanJson);
            
            const selectedIndices = result.indices || [];
            const selectedSet = new Set<number>(selectedIndices);
            const selectedBudgetCount = selectedIndices.filter((i: number) => {
                const p = this.parsePrice(toAnalyzeBudgetFirst[i]?.price || '');
                return Number.isFinite(p) && p >= budgetMin && p <= budgetMax;
            }).length;
            if (selectedIndices.length < 3) {
                for (let i = 0; i < toAnalyzeBudgetFirst.length && selectedIndices.length < 3; i++) {
                    if (!selectedSet.has(i)) {
                        selectedIndices.push(i);
                        selectedSet.add(i);
                    }
                }
            }
            if (selectedBudgetCount < 2) {
                for (let i = 0; i < toAnalyzeBudgetFirst.length && selectedBudgetCount < 2; i++) {
                    const p = this.parsePrice(toAnalyzeBudgetFirst[i]?.price || '');
                    if (Number.isFinite(p) && p >= budgetMin && p <= budgetMax && !selectedSet.has(i)) {
                        selectedIndices.push(i);
                        selectedSet.add(i);
                        const cnt = selectedIndices.filter((k: number) => {
                            const pk = this.parsePrice(toAnalyzeBudgetFirst[k]?.price || '');
                            return Number.isFinite(pk) && pk >= budgetMin && pk <= budgetMax;
                        }).length;
                        if (cnt >= 2) break;
                    }
                }
                while (selectedIndices.length > 3) {
                    selectedIndices.pop();
                }
            }
            const selectedUrls = selectedIndices
                .map((i: number) => toAnalyzeBudgetFirst[i]?.link)
                .filter((link: string | undefined) => !!link);

            console.log(`   -> LLM selected indices: ${selectedIndices.join(', ')}`);
            console.log(`   -> Reason: ${result.reason}`);

            return {
                selectedUrls: selectedUrls,
                reasons: { "llm_selection": result.reason, "budget_policy": ">=2 of 3 in €1000–€2500 if available" }
            };

        } catch (e: any) {
            console.error(`⚠️ SmartFilter LLM failed: ${e.message}`);
            // Fallback: Return top 3 from heuristics
            const fallback = toAnalyzeBudgetFirst.slice(0, 3).map(i => i.link);
            return {
                selectedUrls: fallback,
                reasons: { "error": "LLM failed, used fallback", "budget_policy": "applied in fallback ordering" }
            };
        }
    }

    private parsePrice(priceStr: string): number {
        if (!priceStr) return 0;
        const clean = priceStr.replace(/[^0-9,]/g, '').replace(',', '.');
        return parseFloat(clean) || 0;
    }
}

export const smartFilter = new SmartFilter();
