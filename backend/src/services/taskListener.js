const cron = require('node-cron');

class TaskListener {
    constructor(db, bot) {
        this.db = db;
        this.bot = bot; // TelegramBot instance
        this.isRunning = false;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('🎧 Task Listener: Started');
        
        // Poll every 5 seconds
        cron.schedule('*/5 * * * * *', async () => {
            await this.processTasks();
        });
    }

    async processTasks() {
        try {
            // Fetch pending tasks
            const tasks = await this.db.query('SELECT * FROM tasks WHERE completed = 0 ORDER BY created_at ASC LIMIT 10');
            
            if (tasks.length > 0) {
                console.log(`🎧 Processing ${tasks.length} tasks...`);
            }

            for (const task of tasks) {
                await this.handleTask(task);
                
                // Mark as completed
                await this.db.query('UPDATE tasks SET completed = 1, completed_at = ? WHERE id = ?', 
                    [new Date().toISOString(), task.id]);
            }
        } catch (error) {
            console.error('Task Listener Error:', error.message);
        }
    }

    async handleTask(task) {
        console.log(`🔧 Handling Task: ${task.title} (ID: ${task.id})`);
        
        switch (task.title) {
            case 'VERIFY_BIKE':
                await this.handleVerifyBike(task);
                break;
            case 'SEND_MESSAGE':
                await this.handleSendMessage(task);
                break;
            default:
                console.warn(`Unknown task type: ${task.title}`);
        }
    }

    async handleVerifyBike(task) {
        // Logic: Notify admin/manager to check the bike
        // In real app: this.bot.sendMessage(adminChatId, ...)
        console.log(`🕵️ VERIFY_BIKE: ${task.description}`);
        // Simulate processing delay
        await new Promise(r => setTimeout(r, 100));
    }

    async handleSendMessage(task) {
        console.log(`📨 SEND_MESSAGE: ${task.description}`);
        // if (this.bot) await this.bot.sendMessage(...)
    }
}

module.exports = { TaskListener };
