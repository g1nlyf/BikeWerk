const AdminService = require('../../src/services/AdminService');

async function testProfit() {
  console.log("=== Тест Симулятора прибыли ===");
  const stats = await AdminService.getFinanceSummary({ commission: 0.10, logistics: 150 });
  console.log(`Потенциальная прибыль: ${stats.expectedProfit}€`);
  console.log(`Стоимость лида (Cost per Lead): ${stats.costPerLead}$`);
}
testProfit();
