import { Router } from 'express';
const RecommendationService = require('../../../services/RecommendationService');
const { DatabaseManager } = require('../../../js/mysql-config');

const router = Router();
const db = new DatabaseManager();
const recommendationService = new RecommendationService(db);

// GET /api/v1/recommendations
router.get('/', async (req, res) => {
    try {
        const userId = 1; // Mock user ID for now
        const recommendations = await recommendationService.getRecommendations(userId);
        res.json({ data: recommendations });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
