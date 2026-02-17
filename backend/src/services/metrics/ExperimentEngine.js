class ExperimentEngine {
    constructor(db, options = {}) {
        this.db = db;
        this.random = typeof options.random === 'function' ? options.random : Math.random;
    }

    hashString(input) {
        let hash = 5381;
        const str = String(input || '');
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
            hash = hash >>> 0;
        }
        return hash;
    }

    parseVariants(raw) {
        if (!raw) {
            return [
                { name: 'control', weight: 50 },
                { name: 'treatment', weight: 50 }
            ];
        }

        try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('invalid');
            return parsed
                .map((item) => ({
                    name: String(item.name || '').trim() || 'variant',
                    weight: Number.isFinite(Number(item.weight)) ? Number(item.weight) : 1
                }))
                .filter((item) => item.weight > 0);
        } catch (_) {
            return [
                { name: 'control', weight: 50 },
                { name: 'treatment', weight: 50 }
            ];
        }
    }

    pickVariant(experimentKey, subjectKey, variants) {
        const total = variants.reduce((sum, v) => sum + Number(v.weight || 0), 0);
        if (total <= 0) return 'control';

        const hash = this.hashString(`${experimentKey}:${subjectKey}`);
        const bucket = hash % total;

        let cursor = 0;
        for (const variant of variants) {
            cursor += Number(variant.weight || 0);
            if (bucket < cursor) return variant.name;
        }

        return variants[variants.length - 1]?.name || 'control';
    }

    pickVariantWeightedRandom(variants = []) {
        const normalized = (Array.isArray(variants) ? variants : [])
            .map((v) => ({
                name: String(v.name || 'variant'),
                weight: Math.max(0, Number(v.weight || 0))
            }))
            .filter((v) => v.weight > 0);

        const total = normalized.reduce((sum, v) => sum + v.weight, 0);
        if (total <= 0) return normalized[0]?.name || 'control';

        const bucket = this.random() * total;
        let cursor = 0;
        for (const variant of normalized) {
            cursor += variant.weight;
            if (bucket <= cursor) return variant.name;
        }
        return normalized[normalized.length - 1]?.name || 'control';
    }

    randomNormal() {
        let u = 0;
        let v = 0;
        while (u === 0) u = this.random();
        while (v === 0) v = this.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    sampleGamma(shape, scale = 1) {
        const k = Number(shape || 0);
        if (!Number.isFinite(k) || k <= 0) return 0;
        if (k < 1) {
            const g = this.sampleGamma(k + 1, scale);
            return g * Math.pow(this.random(), 1 / k);
        }
        const d = k - 1 / 3;
        const c = 1 / Math.sqrt(9 * d);
        while (true) {
            const x = this.randomNormal();
            const v = Math.pow(1 + c * x, 3);
            if (v <= 0) continue;
            const u = this.random();
            if (u < 1 - 0.0331 * Math.pow(x, 4)) return scale * d * v;
            if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return scale * d * v;
        }
    }

    sampleBeta(alpha, beta) {
        const a = Math.max(0.0001, Number(alpha || 0.0001));
        const b = Math.max(0.0001, Number(beta || 0.0001));
        const x = this.sampleGamma(a, 1);
        const y = this.sampleGamma(b, 1);
        if (x <= 0 && y <= 0) return 0.5;
        return x / (x + y);
    }

    normalizeWeightPlan(variants = [], rawByName = {}, minWeight = 5) {
        const names = variants.map((v) => String(v.name || 'variant'));
        if (names.length === 0) return {};

        const scores = names.map((name) => Math.max(0.0001, Number(rawByName[name] || 0)));
        const scoreSum = scores.reduce((s, v) => s + v, 0) || 1;
        const weights = {};
        names.forEach((name, idx) => {
            weights[name] = (scores[idx] / scoreSum) * 100;
        });

        if (names.length > 1) {
            for (const name of names) {
                if (weights[name] < minWeight) {
                    const needed = minWeight - weights[name];
                    weights[name] = minWeight;
                    const donors = names.filter((n) => n !== name).sort((a, b) => weights[b] - weights[a]);
                    for (const donor of donors) {
                        const transferable = Math.max(0, weights[donor] - minWeight);
                        if (transferable <= 0) continue;
                        const take = Math.min(transferable, needed);
                        weights[donor] -= take;
                        const remaining = needed - take;
                        if (remaining <= 0.0001) break;
                    }
                }
            }
        }

        const total = names.reduce((s, n) => s + weights[n], 0) || 1;
        const rounded = {};
        let allocated = 0;
        for (let i = 0; i < names.length; i++) {
            const name = names[i];
            if (i === names.length - 1) {
                rounded[name] = Math.max(0, 100 - allocated);
            } else {
                const value = Math.max(0, Math.round((weights[name] / total) * 100));
                rounded[name] = value;
                allocated += value;
            }
        }
        return rounded;
    }

    applyControlFloor(variants = [], weightByName = {}, controlFloor = 20, minWeight = 5) {
        const names = variants.map((v) => String(v.name || 'variant'));
        if (names.length === 0) return {};
        const controlName = names.includes('control') ? 'control' : names[0];
        const adjusted = { ...weightByName };

        adjusted[controlName] = Math.max(Number(adjusted[controlName] || 0), controlFloor);
        const others = names.filter((n) => n !== controlName);
        let available = 100 - adjusted[controlName];
        if (available < 0) available = 0;

        if (others.length === 0) {
            adjusted[controlName] = 100;
            return adjusted;
        }

        const otherSum = others.reduce((s, n) => s + Math.max(0, Number(adjusted[n] || 0)), 0);
        if (otherSum <= 0) {
            const even = available / others.length;
            for (const name of others) adjusted[name] = even;
        } else {
            for (const name of others) {
                adjusted[name] = (Math.max(0, Number(adjusted[name] || 0)) / otherSum) * available;
            }
        }

        const normalized = this.normalizeWeightPlan(variants, adjusted, minWeight);
        if (Number(normalized[controlName] || 0) < controlFloor) {
            const deficit = controlFloor - Number(normalized[controlName] || 0);
            normalized[controlName] = controlFloor;
            const donors = others.sort((a, b) => Number(normalized[b] || 0) - Number(normalized[a] || 0));
            let remaining = deficit;
            for (const donor of donors) {
                if (remaining <= 0) break;
                const transferable = Math.max(0, Number(normalized[donor] || 0) - minWeight);
                if (transferable <= 0) continue;
                const take = Math.min(transferable, remaining);
                normalized[donor] = Number(normalized[donor] || 0) - take;
                remaining -= take;
            }
        }

        const finalNames = [...names];
        let sum = finalNames.reduce((s, n) => s + Number(normalized[n] || 0), 0);
        if (sum !== 100) {
            normalized[controlName] = Number(normalized[controlName] || 0) + (100 - sum);
            sum = finalNames.reduce((s, n) => s + Number(normalized[n] || 0), 0);
            if (sum !== 100) {
                const anchor = finalNames[finalNames.length - 1];
                normalized[anchor] = Number(normalized[anchor] || 0) + (100 - sum);
            }
        }
        return normalized;
    }

    async computeBanditWeights(experimentKey, variants = [], options = {}) {
        if (!experimentKey || !Array.isArray(variants) || variants.length < 2) {
            return { enabled: false, reason: 'bandit_not_applicable', weightsByVariant: {} };
        }

        const lookbackDays = Math.max(3, Math.min(45, Number(options.lookbackDays || 14)));
        const minObservations = Math.max(20, Number(options.minObservations || 80));
        const minWeight = Math.max(2, Number(options.minWeight || 5));
        const controlFloor = Math.max(20, Math.min(60, Number(options.controlFloor || 22)));
        const sinceIso = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

        const [assignmentRows, goalRows] = await Promise.all([
            this.db.query(
                `SELECT variant, COUNT(*) as cnt
                 FROM ab_assignments
                 WHERE experiment_key = ?
                   AND assigned_at >= ?
                 GROUP BY variant`,
                [experimentKey, sinceIso]
            ),
            this.db.query(
                `SELECT variant, metric_name, SUM(value) as val
                 FROM ab_goal_events
                 WHERE experiment_key = ?
                   AND created_at >= ?
                 GROUP BY variant, metric_name`,
                [experimentKey, sinceIso]
            )
        ]);

        const baseWeights = this.normalizeWeightPlan(
            variants,
            Object.fromEntries(variants.map((v) => [String(v.name || 'variant'), Number(v.weight || 1)])),
            minWeight
        );

        const assignmentByVariant = new Map();
        for (const row of assignmentRows) {
            assignmentByVariant.set(String(row.variant), Number(row.cnt || 0));
        }
        const rewardWeight = {
            order: 1,
            booking_success: 1,
            add_to_cart: 0.25,
            favorite: 0.1
        };
        const rewardByVariant = new Map();
        for (const row of goalRows) {
            const variant = String(row.variant || 'control');
            const metric = String(row.metric_name || '');
            const val = Number(row.val || 0);
            const weight = Number(rewardWeight[metric] || 0);
            rewardByVariant.set(variant, (rewardByVariant.get(variant) || 0) + (val * weight));
        }

        const totalAssignments = [...assignmentByVariant.values()].reduce((s, v) => s + v, 0);
        if (totalAssignments < minObservations) {
            return {
                enabled: true,
                mode: 'thompson_sampling',
                reason: 'warmup_baseline',
                lookbackDays,
                totalAssignments,
                weightsByVariant: this.applyControlFloor(variants, baseWeights, controlFloor, minWeight),
                diagnostics: []
            };
        }

        const rawScores = {};
        const diagnostics = [];
        for (const variant of variants) {
            const name = String(variant.name || 'variant');
            const assignments = Number(assignmentByVariant.get(name) || 0);
            const reward = Math.max(0, Number(rewardByVariant.get(name) || 0));
            const pseudoSuccess = Math.max(0, Math.min(assignments, reward));
            const alpha = 1 + pseudoSuccess;
            const beta = 1 + Math.max(0, assignments - pseudoSuccess);
            const sample = this.sampleBeta(alpha, beta);
            const posteriorMean = alpha / (alpha + beta);
            rawScores[name] = sample;
            diagnostics.push({
                variant: name,
                assignments,
                reward: Math.round(reward * 100) / 100,
                posteriorMean: Math.round(posteriorMean * 10000) / 10000,
                sampledScore: Math.round(sample * 10000) / 10000
            });
        }

        const normalized = this.normalizeWeightPlan(variants, rawScores, minWeight);
        const constrained = this.applyControlFloor(variants, normalized, controlFloor, minWeight);

        return {
            enabled: true,
            mode: 'thompson_sampling',
            lookbackDays,
            totalAssignments,
            weightsByVariant: constrained,
            diagnostics
        };
    }

    async listActiveExperiments() {
        const rows = await this.db.query(
            `SELECT experiment_key, name, variants_json, enabled
             FROM ab_experiments
             WHERE enabled = 1
             ORDER BY experiment_key ASC`
        );

        if (rows.length > 0) {
            return rows.map((row) => ({
                experimentKey: String(row.experiment_key),
                name: row.name || row.experiment_key,
                variants: this.parseVariants(row.variants_json)
            }));
        }

        // Fallback to system settings style toggles.
        const settings = await this.db.query(
            `SELECT key, value
             FROM system_settings
             WHERE key LIKE 'ab_test_%' AND value = '1'`
        );

        return settings.map((row) => {
            const key = String(row.key || '').replace(/^ab_test_/, '');
            return {
                experimentKey: key || 'default',
                name: key || 'default',
                variants: [
                    { name: 'control', weight: 50 },
                    { name: 'treatment', weight: 50 }
                ]
            };
        });
    }

    async getAssignments({ userId = null, sessionId = null } = {}) {
        const subjectKey = userId ? `user:${userId}` : sessionId ? `session:${sessionId}` : null;
        if (!subjectKey) return {};

        const active = await this.listActiveExperiments();
        if (active.length === 0) return {};

        const assignments = {};
        const banditEnabled = String(process.env.ENABLE_EXPERIMENT_BANDIT || '1') === '1';

        for (const experiment of active) {
            const existing = await this.db.query(
                `SELECT variant
                 FROM ab_assignments
                 WHERE experiment_key = ? AND subject_key = ?
                 LIMIT 1`,
                [experiment.experimentKey, subjectKey]
            );

            if (existing[0]?.variant) {
                assignments[experiment.experimentKey] = String(existing[0].variant);
                continue;
            }

            let effectiveVariants = experiment.variants;
            let allocation = null;
            if (banditEnabled) {
                try {
                    allocation = await this.computeBanditWeights(experiment.experimentKey, experiment.variants);
                    if (allocation?.enabled && allocation?.weightsByVariant) {
                        effectiveVariants = experiment.variants.map((v) => ({
                            ...v,
                            weight: Number(allocation.weightsByVariant[String(v.name || 'variant')] || v.weight || 1)
                        }));
                    }
                } catch {
                    allocation = null;
                    effectiveVariants = experiment.variants;
                }
            }

            const variant = allocation?.enabled
                ? this.pickVariantWeightedRandom(effectiveVariants)
                : this.pickVariant(experiment.experimentKey, subjectKey, experiment.variants);
            await this.db.query(
                `INSERT INTO ab_assignments (
                    experiment_key,
                    subject_key,
                    user_id,
                    session_id,
                    variant,
                    assigned_at
                ) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
                [experiment.experimentKey, subjectKey, userId, sessionId, variant]
            );

            assignments[experiment.experimentKey] = variant;
        }

        return assignments;
    }

    async trackGoal({ experimentKey, variant, metricName, bikeId = null, userId = null, sessionId = null, value = 1 }) {
        if (!experimentKey || !metricName) return;
        await this.db.query(
            `INSERT INTO ab_goal_events (
                experiment_key,
                variant,
                metric_name,
                bike_id,
                user_id,
                session_id,
                value,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [experimentKey, variant || 'control', metricName, bikeId, userId, sessionId, Number(value) || 1]
        );
    }
}

module.exports = {
    ExperimentEngine
};
