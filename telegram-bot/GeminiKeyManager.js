class GeminiKeyManager {
    constructor() {
        this.projects = this._parseProjectsFromEnv();
        if (this.projects.length === 0) {
            this.projects = [];
            console.warn('⚠️ GEMINI_API_KEYS / GEMINI_API_KEY not configured for GeminiKeyManager.');
        }

        this.currentProjectIndex = 0;
        this.keyIndices = new Array(this.projects.length).fill(0); // Tracks current key index for each project
    }

    _parseProjectsFromEnv() {
        const projects = [];
        const addProject = (keys) => {
            const cleaned = (keys || []).map(k => (k || '').trim()).filter(Boolean);
            if (cleaned.length > 0) projects.push(cleaned);
        };

        const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_KEYS || '';
        if (raw) {
            const groups = raw.split('|').map(g => g.trim()).filter(Boolean);
            for (const group of groups) {
                addProject(group.split(/[,;]+/));
            }
        }

        const numbered = [];
        for (let i = 1; i <= 10; i++) {
            const key = process.env[`GEMINI_API_KEY_${i}`];
            if (key) numbered.push(key);
        }
        if (numbered.length > 0) addProject(numbered);

        if (process.env.GEMINI_API_KEY) {
            addProject([process.env.GEMINI_API_KEY]);
        }

        return projects;
    }

    getNextKey() {
        if (this.projects.length === 0) {
            throw new Error('GEMINI_API_KEYS / GEMINI_API_KEY is not configured');
        }
        // Round-robin projects
        const projectId = this.currentProjectIndex;
        const projectKeys = this.projects[projectId];
        
        // Round-robin keys within project
        const keyIndex = this.keyIndices[projectId];
        const key = projectKeys[keyIndex];
        const label = `Proj${projectId + 1}-Key${keyIndex + 1}`;

        // Advance key index for this project
        this.keyIndices[projectId] = (this.keyIndices[projectId] + 1) % projectKeys.length;

        // Advance project index
        this.currentProjectIndex = (this.currentProjectIndex + 1) % this.projects.length;

        return { key, label };
    }

    // Helper to get total key count
    getTotalKeys() {
        return this.projects.reduce((acc, proj) => acc + proj.length, 0);
    }

    getAllKeys() {
        return this.projects.flat();
    }
}

module.exports = GeminiKeyManager;
