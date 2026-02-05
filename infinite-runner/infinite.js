const startedAt = new Date().toISOString();
console.log(`INFINITE SCRIPT STARTED: ${startedAt}`);

setInterval(() => {
  const now = new Date().toISOString();
  console.log(`INFINITE TICK: ${now}`);
}, 5000);
process.stdin.resume();
