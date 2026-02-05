class SourceMerger {
    static merge(primary, secondary) {
        // Primary source (e.g. Buycycle) takes precedence for key attributes
        // Secondary source (e.g. Kleinanzeigen) fills gaps
        
        const merged = { ...secondary, ...primary };
        
        // Specific logic: 
        // If primary has year, use it.
        // If primary has quality_score, use it.
        // If primary is trusted source, trust its data more.
        
        // Ensure source reflects origin of the merged record (usually primary)
        merged.source = primary.source;
        merged.original_sources = [primary.source, secondary.source];
        
        return merged;
    }
}

module.exports = SourceMerger;
