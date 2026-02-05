/**
 * PipelineLogger.js
 * Детальное логирование каждого этапа обработки байка
 */

const fs = require('fs');
const path = require('path');

class PipelineLogger {
    constructor(bikeId = 'unknown') {
        this.bikeId = bikeId;
        this.logs = [];
        this.startTime = Date.now();
        this.logDir = path.join(__dirname, '../../logs/pipeline');
        
        // Создаём папку для логов
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    /**
     * Логирует этап обработки
     */
    log(stage, status, data = {}) {
        const timestamp = Date.now() - this.startTime;
        const entry = {
            stage,
            status, // 'start', 'success', 'error', 'warning'
            timestamp,
            data
        };

        this.logs.push(entry);

        // Console output с цветами
        const emoji = {
            start: '▶️',
            success: '✅',
            error: '❌',
            warning: '⚠️'
        }[status] || '📝';

        console.log(`${emoji} [${stage}] ${status.toUpperCase()} (${timestamp}ms)`);
        
        // Если есть важные данные - показываем
        if (data.message) {
            console.log(`   💬 ${data.message}`);
        }
        if (data.error) {
            console.log(`   🐛 ${data.error}`);
        }
    }

    /**
     * Сохраняет детальные данные этапа в файл
     */
    saveStageData(stage, data, extension = 'json') {
        const filename = `${this.bikeId}_${stage}.${extension}`;
        const filepath = path.join(this.logDir, filename);

        try {
            const content = extension === 'json' 
                ? JSON.stringify(data, null, 2)
                : data;

            fs.writeFileSync(filepath, content, 'utf8');
            console.log(`   💾 Saved: ${filename}`);
        } catch (error) {
            console.error(`   ❌ Failed to save ${filename}: ${error.message}`);
        }
    }

    /**
     * Финальный отчет
     */
    summary() {
        const totalTime = Date.now() - this.startTime;
        const errors = this.logs.filter(l => l.status === 'error').length;
        const warnings = this.logs.filter(l => l.status === 'warning').length;

        console.log(`\n📊 PIPELINE SUMMARY (${this.bikeId})`);
        console.log(`   ⏱️  Total time: ${totalTime}ms`);
        console.log(`   ✅ Success stages: ${this.logs.filter(l => l.status === 'success').length}`);
        console.log(`   ⚠️  Warnings: ${warnings}`);
        console.log(`   ❌ Errors: ${errors}`);

        // Сохраняем полный лог
        const summaryFile = path.join(this.logDir, `${this.bikeId}_summary.json`);
        fs.writeFileSync(summaryFile, JSON.stringify({
            bikeId: this.bikeId,
            totalTime,
            stages: this.logs,
            summary: { errors, warnings }
        }, null, 2));

        console.log(`   💾 Full log: ${summaryFile}\n`);

        return { errors, warnings };
    }
}

module.exports = PipelineLogger;
