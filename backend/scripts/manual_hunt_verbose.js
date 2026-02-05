const { runTestAutocat } = require('../../telegram-bot/test-autocat');

async function runManualHunt() {
    console.log('🚀 STARTING MANUAL VERBOSE HUNT (100 BIKES)...');
    console.log('   Target: Remote Server (Self)');

    const mockBot = {
        sendMessage: async (chatId, text) => {
            if (!text.includes('HTML FETCHED')) {
                console.log(`   [Bot]: ${text}`);
            }
        }
    };

    const failures = [];
    const runStep = async (label, command) => {
        console.log(`   Starting sub-hunt for ${label}...`);
        try {
            await runTestAutocat(mockBot, 'manual_hunt_100', command);
        } catch (error) {
            failures.push({ label, error: error.message });
            console.error(`   ❌ Sub-hunt failed (${label}):`, error.message);
        }
    };

    console.log('   ✅ Hunter Initialized.');

    await runStep('20 MTB Enduro', '20 mtb enduro');
    await runStep('15 MTB DH', '15 mtb dh');
    await runStep('7 MTB Trail', '7 mtb trail');
    await runStep('3 MTB XC', '3 mtb xc');
    await runStep('15 Gravel Allroad', '15 gravel allroad');
    await runStep('7 Gravel Race', '7 gravel race');
    await runStep('3 Gravel Bikepacking', '3 gravel bikepacking');
    await runStep('8 Road Endurance', '8 road endurance');
    await runStep('8 Road Aero', '8 road aero');
    await runStep('3 Road Climbing', '3 road climbing');
    await runStep('1 Road TT', '1 road tt');
    await runStep('8 eMTB Enduro', '8 emtb enduro');
    await runStep('1 Kids Specialized', '1 kids specialized');
    await runStep('1 Kids Early Rider', '1 kids early rider');

    if (failures.length) {
        console.log(`❌ MANUAL HUNT завершен с ошибками: ${failures.length}`);
        failures.forEach((f) => console.log(`   ${f.label}: ${f.error}`));
        process.exit(1);
    }

    console.log('✨ MANUAL HUNT COMPLETE.');
}

runManualHunt();
