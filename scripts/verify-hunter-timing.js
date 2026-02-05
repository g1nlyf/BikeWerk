
function getModeForTime(utcHour, utcDay) {
    // Mocking the logic from autonomous-hunter.js
    // MSK = UTC + 3
    const mskHours = (utcHour + 3) % 24;
    
    // We need to handle day shift. If UTC+3 crosses midnight, day changes.
    // Day: 0=Sun, 6=Sat
    let mskDay = utcDay;
    if (utcHour + 3 >= 24) {
        mskDay = (utcDay + 1) % 7;
    }

    const isWeekend = (mskDay === 0 || mskDay === 6);
    // Prime Time: 18:00 - 22:00 MSK
    const isPrimeHours = (mskHours >= 18 && mskHours < 22);
    // Night: 01:00 - 07:00 MSK
    const isNightHours = (mskHours >= 1 && mskHours < 7);

    if (isNightHours) return 'NIGHT (Economy)';
    if (isPrimeHours || isWeekend) return 'BERSERK (Prime Time)';
    return 'STANDARD';
}

function runTest() {
    console.log('🧪 Verifying Hunter Timing Logic...\n');
    
    const tests = [
        { name: 'Prime Time (MSK 19:00, Mon)', utcHour: 16, utcDay: 1, expected: 'BERSERK (Prime Time)' },
        { name: 'Prime Time (MSK 21:59, Mon)', utcHour: 18, utcDay: 1, expected: 'BERSERK (Prime Time)' }, // 18+3 = 21
        { name: 'Night Mode (MSK 02:00, Mon)', utcHour: 23, utcDay: 0, expected: 'NIGHT (Economy)' }, // Sun 23:00 UTC -> Mon 02:00 MSK
        { name: 'Night Mode (MSK 06:00, Mon)', utcHour: 3, utcDay: 1, expected: 'NIGHT (Economy)' }, // Mon 03:00 UTC -> Mon 06:00 MSK
        { name: 'Standard Mode (MSK 12:00, Mon)', utcHour: 9, utcDay: 1, expected: 'STANDARD' },
        { name: 'Weekend (MSK 12:00, Sat)', utcHour: 9, utcDay: 6, expected: 'BERSERK (Prime Time)' },
        { name: 'Weekend Night (MSK 03:00, Sat)', utcHour: 0, utcDay: 6, expected: 'NIGHT (Economy)' } // Priority Check: Night > Weekend
    ];

    let passed = 0;
    for (const t of tests) {
        const result = getModeForTime(t.utcHour, t.utcDay);
        const success = result === t.expected;
        if (success) passed++;
        console.log(`[${success ? '✅' : '❌'}] ${t.name}: Expected ${t.expected}, Got ${result}`);
        if (!success) console.log(`    DEBUG: UTC=${t.utcHour}, MSK=${(t.utcHour+3)%24}, Weekend=${t.utcDay===6||t.utcDay===0}`);
    }

    console.log(`\nResult: ${passed}/${tests.length} passed.`);
    if (passed === tests.length) {
        console.log('🚀 Logic Verified. Ready for Deploy.');
    } else {
        console.error('⚠️ Logic Check Failed.');
        process.exit(1);
    }
}

runTest();
