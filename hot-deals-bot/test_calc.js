const fs = require('fs');
const CashflowCalculator = require('./services/CashflowCalculator');

const price = 1690;
const result = CashflowCalculator.calculate(price);

let output = '--- Breakdown ---\n';
output += `Initial Price: €${price}\n`;
output += '--- Components ---\n';

// Replicating logic for breakdown display (Refined Rules)
const deliveryCost = 170;
let serviceFee = 300; // Simplified for 1690
const insuranceFees = (price * 0.025) + 40;
const cargoInsurance = 0;

const subtotal = price + deliveryCost + serviceFee + insuranceFees + cargoInsurance;
const commission = subtotal * 0.07;
const totalEur = subtotal + commission;

output += `1. Delivery: €${deliveryCost}\n`;
output += `2. Service Fee: €${serviceFee}\n`;
output += `3. Insurance (2.5% + 40): €${insuranceFees}\n`;
output += `4. Cargo Insurance: €${cargoInsurance}\n`;
output += `--- Subtotal: €${subtotal} ---\n`;
output += `5. Payment Commission (7%): €${commission.toFixed(2)}\n`;
output += `--- Final EUR: €${totalEur.toFixed(2)} ---\n`;
output += `--- Final RUB (Rate 96): ${result.totalRub} ---\n`;

fs.writeFileSync('output.txt', output);
console.log('Results written to output.txt');
