const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

/**
 * GEMINI BIKE PROCESSOR v2.1 - ИСПРАВЛЕННЫЙ
 * Использует внешний промпт и JSON схему
 * Добавлена retry логика и улучшенный парсинг JSON
 */
class GeminiBikeProcessorV2 {
  
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey || process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.2,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    });
    
    // Загружаем промпт и схему один раз
    this.promptTemplate = this.loadPromptTemplate();
    this.schemaExample = this.loadSchemaExample();
    
    console.log('✅ Gemini Processor v2.1 initialized');
    console.log(`   Model: gemini-2.5-flash`);
    console.log(`   Prompt loaded: ${this.promptTemplate.length} chars`);
    console.log(`   Schema loaded: ${JSON.stringify(this.schemaExample).length} chars`);
  }
  
  /**
   * Загрузить промпт из файла
   */
  loadPromptTemplate() {
    const promptPath = path.join(__dirname, '../prompts/gemini-bike-normalizer-prompt.txt');
    
    if (!fs.existsSync(promptPath)) {
      throw new Error(`Prompt file not found: ${promptPath}`);
    }
    
    return fs.readFileSync(promptPath, 'utf8');
  }
  
  /**
   * Загрузить JSON схему
   */
  loadSchemaExample() {
    const schemaPath = path.join(__dirname, '../schemas/unified-bike-schema.json');
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}`);
    }
    
    const schemaRaw = fs.readFileSync(schemaPath, 'utf8');
    const schemaData = JSON.parse(schemaRaw);
    
    // Берем example как шаблон
    return schemaData.example || schemaData;
  }
  
  /**
   * ГЛАВНЫЙ МЕТОД: Обработать данные парсера (с retry логикой)
   */
  async processParsedData(parsedData, maxRetries = 3) {
    const startTime = Date.now();
    
    console.log(`\n🤖 Gemini Processor v2.1: Starting AI analysis...`);
    console.log(`   Source: ${parsedData.marketplace}`);
    console.log(`   Ad ID: ${parsedData.ad_id}`);
    console.log(`   Title: ${parsedData.title}`);
    
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Формируем промпт
        const prompt = this.buildPrompt(parsedData);
        
        console.log(`   📤 Sending to Gemini (attempt ${attempt}/${maxRetries}, ${prompt.length} chars)...`);
        
        // Вызываем Gemini
        const result = await this.model.generateContent(prompt);
        const response = result.response;
        const text = response.text();
        
        console.log(`   📥 Response received (${text.length} chars)`);
        
        // Парсим JSON из ответа
        const unifiedJson = this.extractJSON(text);
        
        const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
        
        console.log(`   ✅ AI processing complete (${processingTime}s)`);
        console.log(`   📊 Results:`);
        console.log(`      - Brand: ${unifiedJson.basic_info.brand}`);
        console.log(`      - Model: ${unifiedJson.basic_info.model}`);
        console.log(`      - Category: ${unifiedJson.basic_info.category}`);
        console.log(`      - Sub-category: ${unifiedJson.basic_info.sub_category}`);
        console.log(`      - Condition Score: ${unifiedJson.condition.score}`);
        console.log(`      - Grade: ${unifiedJson.condition.grade}`);
        console.log(`      - FMV: €${unifiedJson.pricing.fmv}`);
        console.log(`      - Quality Score: ${unifiedJson.quality_score}`);
        console.log(`      - Completeness: ${unifiedJson.completeness.toFixed(1)}%`);
        console.log(`      - AI Confidence: ${unifiedJson.ai_analysis.confidence.toFixed(2)}`);
        
        // Добавляем метаданные обработки
        unifiedJson.ai_analysis.processing_time = parseFloat(processingTime);
        unifiedJson.ai_analysis.processed_at = new Date().toISOString();
        unifiedJson.ai_analysis.attempts = attempt;
        
        return unifiedJson;
        
      } catch (error) {
        lastError = error;
        console.error(`   ❌ Attempt ${attempt}/${maxRetries} failed: ${error.message}`);
        
        if (attempt < maxRetries) {
          console.log(`   🔄 Retrying in 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    console.error(`   ❌ All ${maxRetries} attempts failed. Using fallback.`);
    
    // Fallback: возвращаем базовый unified формат из парсера
    return this.createFallbackUnified(parsedData, lastError.message);
  }
  
  /**
   * Построить промпт из шаблона - УПРОЩЕННАЯ ВЕРСИЯ
   */
  buildPrompt(parsedData) {
    // Вместо полного промпта используем сокращенную версию
    let prompt = `You are a bike data normalizer. Convert parser output to Unified JSON format.

INPUT (Parser data):
${JSON.stringify(parsedData, null, 2)}

OUTPUT REQUIREMENTS:
- Return ONLY valid JSON
- Start with { and end with }
- NO markdown, NO code blocks, NO explanations
- Translate description/issues/highlights to Russian
- Keep brands/models/specs in original (SRAM GX, FOX, etc.)
- Calculate FMV (Fair Market Value) based on year, condition, components
- Assign grade: A (80-100), B (50-79), C (0-49)
- Classify category (mtb/road/gravel/city/ebike) and sub_category (xc/trail/enduro/downhill)

REQUIRED JSON STRUCTURE:
${JSON.stringify(this.schemaExample, null, 2)}

Return the complete JSON now. Start immediately with {:`;
    
    return prompt;
  }
  
  /**
   * Извлечь JSON из ответа Gemini - УЛУЧШЕННАЯ ВЕРСИЯ
   */
  extractJSON(text) {
    // Убираем markdown code blocks
    let jsonText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .replace(/`/g, '')
      .trim();
    
    // Парсим
    try {
      return JSON.parse(jsonText);
    } catch (e) {
      console.log(`   ⚠️  JSON parse failed: ${e.message}`);
      console.log(`   🔍 Trying to extract valid JSON...`);
      
      // Если не получилось - ищем первый { и последний }
      const start = jsonText.indexOf('{');
      const end = jsonText.lastIndexOf('}');
      
      if (start !== -1 && end !== -1 && end > start) {
        jsonText = jsonText.substring(start, end + 1);
        
        try {
          return JSON.parse(jsonText);
        } catch (e2) {
          console.log(`   ⚠️  Still failed. Trying to fix common issues...`);
          
          // Пытаемся исправить частые ошибки
          jsonText = jsonText
            .replace(/,\s*}/g, '}')  // Удаляем trailing commas перед }
            .replace(/,\s*]/g, ']')  // Удаляем trailing commas перед ]
            .replace(/\n/g, ' ')     // Удаляем переносы строк
            .replace(/\t/g, ' ')     // Удаляем табы
            .replace(/\s+/g, ' ');   // Множественные пробелы → один
          
          try {
            return JSON.parse(jsonText);
          } catch (e3) {
            // Логируем проблемный JSON для дебага
            console.log(`   ❌ Failed to parse JSON. First 500 chars:`);
            console.log(jsonText.substring(0, 500));
            console.log(`   Last 200 chars:`);
            console.log(jsonText.substring(jsonText.length - 200));
            throw new Error(`Failed to extract valid JSON from Gemini response: ${e3.message}`);
          }
        }
      }
      
      throw new Error(`Failed to find JSON structure in response`);
    }
  }
  
  /**
   * Создать fallback unified JSON если Gemini не сработал
   */
  createFallbackUnified(parsedData, errorMessage) {
    console.log('   ⚠️  Creating fallback unified format from parser data');
    
    const now = new Date().toISOString();
    
    return {
      meta: {
        source_platform: parsedData.marketplace,
        source_url: parsedData.listing_url,
        source_ad_id: parsedData.ad_id,
        created_at: now,
        updated_at: now,
        last_checked_at: now,
        is_active: true,
        parser_version: '2.2.0',
        platform_trust: {
          reviews_count: parsedData.platform_reviews_count || null,
          source: parsedData.platform_reviews_source || null,
          rating: null
        }
      },
      basic_info: {
        name: parsedData.title,
        brand: parsedData.brand || 'Unknown',
        model: null,
        year: parsedData.year,
        category: 'unknown',
        sub_category: 'unknown',
        breadcrumb: parsedData.breadcrumb,
        description: parsedData.description,
        language: 'de'
      },
      pricing: {
        price: parsedData.price?.value,
        original_price: parsedData.old_price?.value || null,
        discount: parsedData.old_price?.value ? (parsedData.old_price.value - parsedData.price.value) : null,
        currency: parsedData.currency || 'EUR',
        is_negotiable: false,
        buyer_protection: {
          available: !!parsedData.buyer_protection_price,
          price: parsedData.buyer_protection_price?.value || null,
          display: parsedData.buyer_protection_price?.display || null
        },
        fmv: null,
        fmv_confidence: 0,
        market_comparison: null,
        optimal_price: null,
        price_history: [],
        days_on_market: 0
      },
      specs: {
        frame_size: parsedData.frame_size,
        frame_material: parsedData.frame_material,
        color: parsedData.color,
        weight: null,
        wheel_size: parsedData.wheel_size,
        suspension_type: parsedData.suspension_type,
        travel_front: null,
        travel_rear: null,
        groupset: parsedData.drivetrain,
        groupset_speeds: null,
        shifting_type: parsedData.shifting_type,
        brakes: parsedData.brake_type,
        brakes_type: null,
        rotor_front: null,
        rotor_rear: null,
        fork: null,
        shock: null,
        drivetrain: parsedData.drivetrain,
        cassette: null,
        chain: null,
        crankset: null,
        wheels: null,
        tires_front: null,
        tires_rear: null,
        handlebars: null,
        handlebars_width: null,
        stem: null,
        stem_length: null,
        saddle: null,
        seatpost: null,
        seatpost_travel: null,
        pedals: null,
        pedals_included: null,
        component_upgrades: this.mapComponents(parsedData.components),
        geometry: {}
      },
      condition: {
        status: 'used',
        score: 50,
        grade: 'B',
        visual_rating: 3,
        functional_rating: 3,
        receipt_available: parsedData.receipt_available === 'Ja',
        issues: [],
        maintenance_needed: [],
        wear_indicators: {},
        crash_history: false,
        frame_damage: false
      },
      inspection: {
        completed: false,
        date: null,
        inspector: null,
        checklist: {},
        checklist_completed: 0,
        checklist_total: 28,
        notes: ['Fallback mode - AI processing failed']
      },
      seller: {
        name: parsedData.seller_name,
        type: 'private',
        rating: parsedData.seller_rating,
        rating_visual: parsedData.seller_rating_visual,
        last_active: parsedData.seller_last_active,
        reviews_count: null,
        member_since: null,
        badges: [],
        verified: false,
        professional: false,
        trust_score: 50
      },
      logistics: {
        location: parsedData.seller_location,
        country: 'DE',
        zip_code: null,
        coordinates: { lat: null, lon: null },
        shipping_option: 'pickup_or_shipping',
        shipping_cost: null,
        shipping_provider: null,
        shipping_days: null,
        shipping_insured: null,
        shipping_tracked: null,
        international: false,
        pickup_available: true,
        ready_to_ship: true
      },
      media: {
        main_image: parsedData.photos?.[0] || null,
        gallery: parsedData.photos || [],
        video_url: null,
        photo_quality: parsedData.photos?.length ? Math.min(70 + parsedData.photos.length * 3, 100) : 0,
        photo_coverage: {}
      },
      ranking: {
        score: 0.5,
        value_score: 50,
        demand_score: 50,
        urgency_score: 50,
        likes: parsedData.likes || 0,
        is_hot_offer: false,
        is_super_deal: false,
        is_high_demand: false,
        badges: [],
        tier: 3,
        views: 0,
        publish_date: now.split('T')[0]
      },
      audit: {
        needs_audit: true,
        status: 'pending',
        notes: [`Fallback mode: ${errorMessage}`],
        approved: false,
        flagged: false,
        manager_assigned: null
      },
      features: {
        upgrades: [],
        highlights: [],
        included_accessories: [],
        special_notes: null
      },
      quality_score: 30,
      completeness: 40,
      ai_analysis: {
        model: 'fallback',
        processed_at: now,
        processing_time: 0,
        attempts: 3,
        confidence: 0,
        extracted_from: 'parser_only',
        inferred_fields: [],
        corrections: [],
        error: errorMessage
      },
      market_data: {
        market_value: null,
        comparable_listings: 0,
        average_price: null,
        price_percentile: null,
        days_to_sell_estimate: null,
        demand_level: 'unknown',
        market_trend: 'unknown'
      },
      internal: {
        database_id: null,
        version: 1,
        deactivated_at: null,
        deactivation_reason: null,
        processing_errors: [errorMessage],
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
        badge: (typeof value === 'object' && value.replaced) ? 'Ersetzt' : null,
        original: null
      });
    }
    
    return result;
  }
}

module.exports = GeminiBikeProcessorV2;
