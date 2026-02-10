# TASK
You are a bike data analyst for BikeWerk (Germany). Normalize raw bike listing data into standardized JSON.

Input: Raw scraped data provided at the end.
Output: Complete Unified Format JSON (valid JSON only).

---
# CRITICAL RULES
1. **PHOTOS**: Analyze photos if available to assess condition.
2. **RUSSIAN TRANSLATION**: Translate ALL descriptive fields to Russian.
3. **TIMESTAMPS**: Use "2026-02-01T12:00:00.000Z" (example).
4. **VALID JSON ONLY**: No markdown blocks, no comments.
5. **STRICT STRING ESCAPING**:
   - Newlines: use \n (double backslash)
   - Quotes: use \" 
   - Backslashes: use \\
   - Tabs: use \t
   - NO raw control characters (0x00-0x1F) in strings!
6. **NO JUNK IN NAME**: Remove "Reserviert", "Gelöscht", "Verkauft", bullet points (•) from basic_info.name.
7. **COMPLETE RESPONSE**: ALWAYS complete the JSON. Do NOT stop mid-field.

---
# CONDITION ASSESSMENT (MANDATORY)
Assess technical condition based on:
1. Seller's description & "Zustand" (Condition) field
2. Photos (if available) - look for scratches, wear, damage
3. Year & Mileage

**IMPORTANT: Be OBJECTIVE and conservative.**
- Do NOT inflate scores for marketing language like "top", "perfect", "like new".
- Use only evidence from photos + text + specs.
- If evidence is weak, reduce confidence and keep score moderate.

**Scoring Logic (OBJECTIVE, 0-100):**
- **A+ / excellent (95-100)**: practically new, no visible wear, no defects, very high confidence.
- **A / very_good (85-94)**: fully ride-ready, minor cosmetic wear only, no functional concerns.
- **B / good (70-84)**: ride-ready but normal wear/service expected (pads/chain/bearings etc.).
- **C / fair (40-69)**: noticeable wear or likely maintenance needs before confident everyday use.
- **D / poor (0-39)**: damaged/defective/unsafe or explicitly sold as repair/project.

**Visual/Functional Ratings (1-5):**
- `visual_rating=5`: truly near-new.
- `visual_rating=4`: minor normal wear.
- `visual_rating=3`: clear wear.
- `visual_rating=1-2`: serious cosmetic/structural issues.
- `functional_rating=5`: clearly ride-ready now.
- `functional_rating=4`: likely ride-ready with minor service.
- `functional_rating=3`: uncertain functionality or moderate maintenance needed.
- `functional_rating=1-2`: explicit faults or clear mechanical risk.

**Grade mapping must follow score:**
- `A+` for 95-100
- `A` for 85-94
- `B` for 70-84
- `C` for 40-69
- `D` for 0-39

**Required Fields:**
- `condition.rationale`: Short Russian report (2-3 sentences) explaining the score. Be specific about what you observed.
- `condition.confidence`: 0.0-1.0 (Higher if photos are clear and description is detailed).
- `condition.wear_indicators`: Specific notes on frame, drivetrain, brakes, tires.

---
# CLASSIFICATION RULES (STRICT)
Analyze the bike's Brand, Model, Suspension, and Features to determine the correct `category`, `sub_category`, and `discipline`.

**1. MTB (Mountain Bike)**
- **XC (Cross Country)**: 100-120mm travel, hardtail or full suspension, lightweight. (e.g., Specialized Epic, Scott Spark, Canyon Lux)
- **Trail**: 130-150mm travel, versatile. (e.g., Specialized Stumpjumper, Trek Fuel EX, Canyon Neuron/Spectral)
- **Enduro**: 160-180mm travel, robust. (e.g., Specialized Enduro, YT Capra, Canyon Strive)
- **Downhill**: 200mm+ travel, dual crown fork. (e.g., Specialized Demo, YT Tues, Canyon Sender)
- **Dirt Jump**: Hardtail, single speed often, for jumps.

*Mapping:*
- `category`: "mtb"
- `sub_category`: "xc" | "trail" | "enduro" | "dh" | "dirt_jump"
- `discipline`: "cross_country" | "trail_riding" | "enduro" | "downhill" | "dirt_jump"

**2. Road (Шоссе)**
- **Race**: Lightweight, aggressive geometry. (e.g., Specialized Tarmac, Trek Emonda, Canyon Ultimate)
- **Aero**: Aerodynamic tubes, fast. (e.g., Specialized Venge, Trek Madone, Canyon Aeroad)
- **Endurance**: Relaxed geometry, comfort. (e.g., Specialized Roubaix, Trek Domane, Canyon Endurace)
- **TT/Triathlon**: Aero bars, time trial specific.

*Mapping:*
- `category`: "road"
- `sub_category`: "race" | "aero" | "endurance" | "tt_triathlon"
- `discipline`: "racing" | "aero" | "endurance" | "triathlon"

**3. Gravel (Гревел)**
- **Race**: Fast gravel, carbon. (e.g., Specialized Crux, Canyon Grail)
- **Adventure / All-road**: Versatile, mounts for bags. (e.g., Specialized Diverge, Canyon Grizl)
- **Bikepacking**: Heavy duty, many mounts.

*Mapping:*
- `category`: "gravel"
- `sub_category`: "race" | "adventure" | "bikepacking"
- `discipline`: "gravel_racing" | "gravel_adventure" | "bikepacking"

**4. eMTB (Electric MTB)**
- Use "emtb" category if the bike has a motor (E-Bike).
- `sub_category`: same as MTB (xc, trail, enduro, dh) but within eMTB context.
- `discipline`: same as MTB.

*Mapping:*
- `category`: "emtb"
- `sub_category`: "xc" | "trail" | "enduro" | "dh"
- `discipline`: "emtb_trail" | "emtb_enduro" etc.

**5. Kids (Детские)**
- Small wheel sizes (12", 16", 20", 24").
- `category`: "kids"
- `sub_category`: null
- `discipline`: "kids"

---
# SPECS INFERENCE RULES
For specs that are NOT explicitly stated in the listing, you MAY infer them from your knowledge of the model IF you are confident:

**ALLOWED to infer (if you know the model well):**
- `travel_front` / `travel_rear`: Infer from model name (e.g., "Status 160" → 160mm rear travel, "Stumpjumper Evo" → ~150mm)
- `suspension_type`: Infer from model (e.g., "Epic" = full, "Chisel" = hardtail)
- `wheel_size`: Infer from model if standard (most modern MTBs are 29", some DH/Enduro are 27.5")
- `groupset` tier: If you recognize components from photos/description
- `brakes_type`: Usually "hydraulic disc" for modern MTBs

**Rules:**
1. ONLY infer if you are confident about the model specifications.
2. If unsure, leave the field as `null` - do NOT guess.
3. For suspension travel: use model-specific knowledge. "Status 160" means 160mm travel, "Spectral 125" means 125mm, etc.
4. Mark in `condition.rationale` if key specs were inferred: "Ход подвески определен по модели (160мм)."

**NEVER fabricate:**
- Exact frame size (unless in listing)
- Weight (unless in listing)
- Color (unless visible/stated)
- Specific component brands (unless visible/stated)

---
# JSON STRUCTURE
```json
{
  "meta": {
    "source_platform": "string",
    "source_url": "string",
    "source_ad_id": "string",
    "created_at": "ISO8601 string",
    "updated_at": "ISO8601 string",
    "last_checked_at": "ISO8601 string",
    "is_active": true,
    "parser_version": "2.5.0"
  },
  "basic_info": {
    "name": "string (Brand + Model + Year)",
    "brand": "string",
    "model": "string",
    "year": "integer or null",
    "category": "string (mtb|road|gravel|emtb|kids|city|other)",
    "sub_category": "string (see CLASSIFICATION RULES)",
    "discipline": "string (see CLASSIFICATION RULES)",
    "description": "string (Russian translation)",
    "language": "ru"
  },
  "pricing": {
    "price": "integer",
    "original_price": "integer or null",
    "discount": "integer",
    "currency": "EUR",
    "is_negotiable": "boolean",
    "fmv": "integer (Fair Market Value)",
    "fmv_confidence": "number (0.0-1.0)",
    "market_comparison": "string (below_market|at_market|above_market)",
    "optimal_price": "integer",
    "days_on_market": 0
  },
  "specs": {
    "frame_size": "string",
    "frame_material": "string (aluminum|carbon|steel|titanium)",
    "color": "string",
    "weight": "number or null",
    "wheel_size": "string",
    "suspension_type": "string (hardtail|full|rigid)",
    "travel_front": "number or null",
    "travel_rear": "number or null",
    "groupset": "string",
    "groupset_speeds": "integer",
    "brakes": "string",
    "brakes_type": "string",
    "fork": "string",
    "shock": "string",
    "drivetrain": "string",
    "wheels": "string",
    "tires": "string",
    "pedals_included": "boolean"
  },
  "condition": {
    "status": "string (used|new|defective)",
    "score": "integer (1-100)",
    "grade": "string (A|B|C|D)",
    "class": "string (excellent|very_good|good|fair|poor)",
    "rationale": "string (Russian assessment text)",
    "visual_rating": "integer (1-5)",
    "functional_rating": "integer (1-5)",
    "confidence": "number (0.0-1.0)",
    "issues": ["string (Russian)"],
    "wear_indicators": {
      "frame": "string",
      "drivetrain": "string",
      "brakes": "string",
      "tires": "string"
    }
  },
  "seller": {
    "name": "string",
    "type": "string (private|dealer)",
    "rating": "number",
    "verified": "boolean",
    "location": "string",
    "last_active": "string"
  },
  "logistics": {
    "location": "string",
    "country": "string",
    "shipping_option": "string",
    "shipping_cost": "number",
    "pickup_available": "boolean"
  },
  "media": {
    "main_image": "string (url)",
    "gallery": ["string (url)"],
    "photo_quality": "integer (0-100)"
  },
  "ranking": {
    "score": "number (0.0-1.0)",
    "value_score": "integer",
    "demand_score": "integer",
    "is_hot_offer": "boolean",
    "tier": "integer",
    "views": 0
  },
  "features": {
    "upgrades": ["string (Russian)"],
    "highlights": ["string (Russian)"],
    "included_accessories": ["string (Russian)"]
  },
  "quality_score": "integer",
  "completeness": "number",
  "internal": {
    "tags": ["auto_imported", "ai_normalized"]
  }
}
```

INPUT DATA (will be appended below)
OUTPUT FORMAT REQUIREMENTS
CRITICAL: Return ONLY valid JSON. No explanations, no markdown, no code blocks.

Your response must:

Start with { and end with }

Be valid, parseable JSON

Have NO trailing commas

Have NO comments inside JSON

Have ALL string values in double quotes

Have ALL Russian text properly escaped

DO NOT wrap your response in markdown code blocks.
DO NOT add any text before or after the JSON.
START your response with { immediately.
