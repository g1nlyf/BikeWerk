class GeminiKeyManager {
    constructor() {
        this.projects = [
            // User Provided Keys (Rotator Set)
            [
                'AIzaSyBwFKlgRwTPpx8Ufss9_aOYm9zikt9SGj0'
            ]
        ];

        this.currentProjectIndex = 0;
        this.keyIndices = new Array(1).fill(0); // Tracks current key index for each project
    }

    getNextKey() {
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
