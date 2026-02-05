const ScoringService = require('../../src/services/ScoringService');

const testBikes = [
  { id: 'cheap', price: 800, category: 'Road' },
  { id: 'target', price: 1500, category: 'Road' }, // Должен получить буст
  { id: 'expensive', price: 3500, category: 'Road' }
];

console.log("=== Тест приоритета цен ===");
testBikes.forEach(bike => {
  const score = ScoringService.calculate(bike);
  console.log(`Байк ${bike.id} (Цена: ${bike.price}€) -> Score: ${score}`);
});
// Ожидаемый результат: у 'target' score должен быть выше при прочих равных.
