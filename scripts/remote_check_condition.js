const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

const config = {
    host: '45.9.41.232',
    username: 'root',
    password: '&9&%4q6631vI'
};

async function runRemoteCheck() {
    try {
        console.log('🔍 Checking remote DB condition data...');
        await ssh.connect(config);

        const cmd = `
            cd /root/eubike/telegram-bot && 
            node -e "
                const BikesDatabase = require('./bikes-database-node');
                const db = new BikesDatabase();
                db.ensureInitialized().then(async () => {
                    const bike = await db.getQuery('SELECT * FROM bikes ORDER BY id DESC LIMIT 1');
                    console.log('Latest Bike ID:', bike ? bike.id : 'None');
                    if(bike) {
                        console.log('Condition Grade:', bike.condition_grade);
                        console.log('Condition Reason:', bike.condition_reason);
                        console.log('Initial Quality Class:', bike.initial_quality_class);
                        console.log('Condition Report:', bike.condition_report);
                    }
                }).catch(err => console.error(err));
            "
        `;
        
        const result = await ssh.execCommand(cmd);
        console.log(result.stdout);
        console.log(result.stderr);

    } catch (e) {
        console.error('Check failed:', e);
    } finally {
        ssh.dispose();
    }
}

runRemoteCheck();
