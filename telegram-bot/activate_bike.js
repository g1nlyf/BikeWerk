const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.resolve(__dirname, '../backend/database/eubike.db');
const db = new sqlite3.Database(DB_PATH);

function run() {
    const args = process.argv.slice(2);
    let bikeId = null;
    let count = null;
    for (let i = 0; i < args.length; i += 1) {
        const a = args[i];
        if (a === '--id' || a === '-i') {
            bikeId = Number(args[i + 1]);
            i += 1;
        } else if (a === '--count' || a === '-n') {
            count = Number(args[i + 1]);
            i += 1;
        }
    }

    const activateOne = (id) => new Promise((resolve, reject) => {
        db.run("UPDATE bikes SET is_active = 1, needs_audit = 0 WHERE id = ?", [id], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });

    const printOne = (id) => new Promise((resolve) => {
        db.get("SELECT id, name, is_active, needs_audit, condition_grade FROM bikes WHERE id = ?", [id], (err, row) => {
            if (err) {
                console.error('❌ Select failed:', err);
                resolve();
                return;
            }
            if (!row) {
                console.warn(`⚠️ No bike found with ID ${id}.`);
                resolve();
                return;
            }
            console.log(`✅ ACTIVE: [${row.id}] ${row.name} | active=${row.is_active} | audit=${row.needs_audit} | grade=${row.condition_grade ?? '—'}`);
            resolve();
        });
    });

    const activateLast = () => new Promise((resolve, reject) => {
        db.get("SELECT id FROM bikes ORDER BY id DESC LIMIT 1", async (err, row) => {
            if (err) return reject(err);
            const id = row?.id;
            if (!id) return resolve({ activated: 0, ids: [] });
            try {
                const changes = await activateOne(id);
                resolve({ activated: changes, ids: [id] });
            } catch (e) {
                reject(e);
            }
        });
    });

    const activateLastInactiveN = (n) => new Promise((resolve, reject) => {
        const safeN = Math.max(1, Math.min(200, Number(n) || 10));
        db.all(
            "SELECT id FROM bikes WHERE is_active = 0 ORDER BY id DESC LIMIT ?",
            [safeN],
            (err, rows) => {
                if (err) return reject(err);
                const ids = (rows || []).map((r) => r.id).filter(Boolean);
                if (ids.length === 0) return resolve({ activated: 0, ids: [] });
                db.run(
                    `UPDATE bikes SET is_active = 1, needs_audit = 0 WHERE id IN (${ids.map(() => '?').join(',')})`,
                    ids,
                    function (err2) {
                        if (err2) return reject(err2);
                        resolve({ activated: this.changes, ids });
                    }
                );
            }
        );
    });

    (async () => {
        try {
            console.log('🔧 Activating bikes...');
            let res;
            if (Number.isFinite(bikeId) && bikeId > 0) {
                const changes = await activateOne(bikeId);
                res = { activated: changes, ids: [bikeId] };
            } else if (Number.isFinite(count) && count > 0) {
                res = await activateLastInactiveN(count);
            } else {
                res = await activateLast();
            }

            console.log(`✅ Activated rows: ${res.activated}`);
            for (const id of res.ids) {
                await printOne(id);
            }
        } catch (e) {
            console.error('❌ Activation failed:', e);
            process.exitCode = 1;
        } finally {
            setTimeout(() => db.close(), 500);
        }
    })();
}

run();
