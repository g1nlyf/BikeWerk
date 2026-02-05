const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

/**
 * GEMINI BIKE PROCESSOR v2.0
 * Использует внешний промпт и JSON схему
 */
class GeminiBikeProcessor {
  
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey || process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Загружаем промпт и схему один раз
    this.promptTemplate = this.loadPromptTemplate();
    this.schema = this.loadSchema();
  }
  
  /**
   * Загрузить промпт из файла
   */
  loadPromptTemplate() {
    const promptPath = path.join(__dirname, '../prompts/gemini-bike-normalizer-prompt.txt');
    return fs.readFileSync(promptPath, 'utf8');
  }
  
  /**
   * Загрузить JSON схему
   */
  loadSchema() {
    const schemaPath = path.join(__dirname, '../schemas/unified-bike-schema.json');
    const schemaRaw = fs.readFileSync(schemaPath, 'utf8');
    const schemaData = JSON.parse(schemaRaw);
    return schemaData.example;  // Берем example как шаблон
  }
  
  /**
   * ГЛАВНЫЙ МЕТОД: Обработать данные парсера
   */
  async processParsedData(parsedData) {
    const startTime = Date.now();
    
    console.log(`\n🤖 Gemini Processor: Starting AI analysis...`);
    console.log(`   Model: gemini-1.5-flash`);
    console.log(`   Source: ${parsedData.marketplace}`);
    console.log(`   Ad ID: ${parsedData.ad_id}`);
    
    try {
      // Формируем промпт
      const prompt = this.buildPrompt(parsedData);
      
      // Вызываем Gemini
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      // Парсим JSON из ответа
      const unifiedJson = this.extractJSON(text);
      
      const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
      
      console.log(`   ✅ AI processing complete (${processingTime}s)`);
      console.log(`   Confidence: ${unifiedJson.ai_analysis.confidence}`);
      console.log(`   Quality Score: ${unifiedJson.quality_score}`);
      console.log(`   Grade: ${unifiedJson.condition.grade}`);
      
      // Добавляем метаданные обработки
      unifiedJson.ai_analysis.processing_time = parseFloat(processingTime);
      unifiedJson.ai_analysis.processed_at = new Date().toISOString();
      
      return unifiedJson;
      
    } catch (error) {
      console.error(`   ❌ Gemini processing failed: ${error.message}`);
      
      // Fallback: возвращаем базовый unified формат из парсера
      return this.createFallbackUnified(parsedData, error.message);
    }
  }
  
  /**
   * Построить промпт из шаблона
   */
  buildPrompt(parsedData) {
    // Заменяем placeholder в промпте
    let prompt = this.promptTemplate;
    
    // Добавляем схему (только структуру, не весь example)
    const schemaStructure = this.generateSchemaStructure();
    prompt = prompt.replace(
      'Load schema from: `backend/schemas/unified-bike-schema.json`',
      `OUTPUT SCHEMA:\n${schemaStructure}`
    );
    
    // Добавляем входные данные
    prompt += `\n\n# INPUT DATA\n\`\`\`json\n${JSON.stringify(parsedData, null, 2)}\n\`\`\`\n\n`;
    prompt += `Return ONLY the complete Unified JSON. No markdown, no explanations.`;
    
    return prompt;
  }
  
  /**
   * Генерировать структуру схемы (без значений example)
   */
  generateSchemaStructure() {
    const structure = {};
    
    for (const [key, value] of Object.entries(this.schema)) {
      if (typeof value === 'object' && !Array.isArray(value)) {
        structure[key] = this.getObjectKeys(value);
      } else if (Array.isArray(value)) {
        structure[key] = ['...'];
      } else {
        structure[key] = typeof value;
      }
    }
    
    return JSON.stringify(structure, null, 2);
  }
  
  /**
   * Получить ключи объекта (рекурсивно)
   */
  getObjectKeys(obj) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
        result[key] = this.getObjectKeys(value);
      } else {
        result[key] = typeof value;
      }
    }
    return result;
  }
  
  /**
   * Извлечь JSON из ответа Gemini
   */
  extractJSON(text) {
    // Убираем markdown code blocks
    let jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Парсим
    try {
      return JSON.parse(jsonText);
    } catch (e) {
      // Если не получилось - ищем первый { и последний }
      const start = jsonText.indexOf('{');
      const end = jsonText.lastIndexOf('}');
      
      if (start !== -1 && end !== -1) {
        jsonText = jsonText.substring(start, end + 1);
        return JSON.parse(jsonText);
      }
      
      throw new Error('Failed to extract valid JSON from Gemini response');
    }
  }
  
  /**
   * Создать fallback unified JSON если Gemini не сработал
   */
  createFallbackUnified(parsedData, errorMessage) {
    console.log('   ⚠️  Creating fallback unified format from parser data');
    
    return {
      meta: {
        source_platform: parsedData.marketplace,
        source_url: parsedData.listing_url,
        source_ad_id: parsedData.ad_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_checked_at: new Date().toISOString(),
        is_active: true,
        parser_version: '2.2.0',
        platform_trust: {
          reviews_count: parsedData.platform_reviews_count || null,
          source: parsedData.platform_reviews_source || null
        }
      },
      basic_info: {
        name: parsedData.title,
        brand: parsedData.brand,
        model: null,
        year: parsedData.year,
        category: null,
        sub_category: null,
        breadcrumb: parsedData.breadcrumb,
        description: parsedData.description,
        language: 'de'
      },
      pricing: {
        price: parsedData.price?.value,
        original_price: parsedData.old_price?.value || null,
        discount: null,
        currency: parsedData.currency || 'EUR',
        is_negotiable: false,
        buyer_protection: {
          available: !!parsedData.buyer_protection_price,
          price: parsedData.buyer_protection_price?.value || null,
          display: parsedData.buyer_protection_price?.display || null
        },
        fmv: null,
        fmv_confidence: 0,
        market_comparison: null
      },
      specs: {
        frame_size: parsedData.frame_size,
        frame_material: parsedData.frame_material,
        wheel_size: parsedData.wheel_size,
        component_upgrades: this.mapComponents(parsedData.components)
      },
      condition: {
        status: 'used',
        score: 50,
        grade: 'B',
        receipt_available: parsedData.receipt_available === 'Ja'
      },
      seller: {
        name: parsedData.seller_name,
        location: parsedData.seller_location,
        rating_visual: parsedData.seller_rating_visual,
        last_active: parsedData.seller_last_active
      },
      media: {
        main_image: parsedData.photos?.[0] || null,
        gallery: parsedData.photos || []
      },
      ranking: {
        likes: parsedData.likes || 0
      },
      audit: {
        needs_audit: true,
        status: 'pending',
        notes: [`Fallback mode: ${errorMessage}`]
      },
      quality_score: 30,
      completeness: 40,
      ai_analysis: {
        model: 'fallback',
        processed_at: new Date().toISOString(),
        attempts: 1,
        confidence: 0,
        error: errorMessage
      },
      internal: {
        warnings: ['AI processing failed - using fallback'],
        tags: ['fallback_mode', 'needs_review']
      }
    };
  }
  
  /**
   * Маппинг компонентов из парсера
   */
  mapComponents(components) {
    if (!components || typeof components !== 'object') {
      return [];
    }
    
    const result = [];
    
    for (const [key, value] of Object.entries(components)) {
      result.push({
        component: key,
        value: typeof value === 'object' ? value.value : value,
        replaced: typeof value === 'object' ? value.replaced : false,
        badge: (typeof value === 'object' && value.replaced) ? 'Ersetzt' : null
      });
    }
    
    return result;
  }
}

module.exports = GeminiBikeProcessor;
