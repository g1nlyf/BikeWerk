const GeminiProcessor = require('../../src/services/geminiProcessor');

const mockAd = {
  title: "Canyon Strive CF 8.0",
  description: "Top Zustand, но нужно настроить переключатель и скоро обслужить амортизатор."
};

async function testInspector() {
  console.log("=== Тест ИИ-Инспектора ===");
  const report = await GeminiProcessor.generateConditionVerdict(mockAd);
  console.log(JSON.stringify(report, null, 2));
}

testInspector();
// Ожидаемый результат: Grade B или C, упоминание амортизатора в justification.
