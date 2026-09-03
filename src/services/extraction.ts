import {
  ProjectMode,
  MineralExplorationAttributes,
  GeotechnicalAttributes,
  RegionalMappingAttributes,
  ExtractedAttributes,
  StationStatus
} from '../domain/types';

export interface ExtractionOptions {
  apiKey?: string;
  endpoint?: string;
  model?: string;
  provider?: 'openrouter' | 'nvidia' | 'local';
}

export interface RawParsedDomainAttributes {
  lithology?: string;
  alteration?: string;
  mineralization?: string;
  sampleId?: string;
  strike?: number;
  dip?: number;
  dipDirection?: string;
  rqd?: string;
  jointSpacing?: string;
  weathering?: string;
  formation?: string;
  member?: string;
  contact?: string;
}

export interface ExtractionResult {
  extracted: ExtractedAttributes;
  confidence: number;
  status: StationStatus;
  flags: string[];
}

export class LlmExtractionService {
  /**
   * Main entrypoint to extract structured geological entities from raw field speech text
   */
  public async extractFromSpeech(
    rawSpeechText: string,
    mode: ProjectMode,
    lexicon: string[] = [],
    options: ExtractionOptions = {}
  ): Promise<ExtractionResult> {
    const provider = options.provider || 'openrouter';
    const envApiKey = typeof import.meta !== 'undefined' && import.meta.env
      ? ((provider === 'nvidia' ? import.meta.env.VITE_NVIDIA_API_KEY : import.meta.env.VITE_OPENROUTER_API_KEY) as string)
      : '';
    const apiKey = options.apiKey || envApiKey || '';
    const extraFlags: string[] = [];

    // If an API key is provided, execute external LLM completion (OpenRouter / NVIDIA NIM)
    if (apiKey) {
      try {
        const responseJson = await this.callLlmApi(rawSpeechText, mode, lexicon, apiKey, provider, options);
        return this.validateAndScore(responseJson, mode);
      } catch (err: any) {
        console.warn('LLM API call failed, falling back to local domain parser:', err);
        extraFlags.push(`Remote LLM API notice: ${err?.message || 'Connection failed'}; fell back to rule parser`);
      }
    }

    // High-precision local deterministic domain parser
    const parsed = this.parseWithDomainRules(rawSpeechText, mode, lexicon);
    const scored = this.validateAndScore(parsed, mode);
    if (extraFlags.length > 0) {
      scored.flags.push(...extraFlags);
    }
    return scored;
  }

  /**
   * Execute external LLM completion with structured JSON output formatting
   */
  private async callLlmApi(
    rawSpeechText: string,
    mode: ProjectMode,
    lexicon: string[],
    apiKey: string,
    provider: 'openrouter' | 'nvidia' | 'local',
    options: ExtractionOptions
  ): Promise<any> {
    const endpoint = options.endpoint || (provider === 'nvidia' 
      ? 'https://integrate.api.nvidia.com/v1/chat/completions'
      : 'https://openrouter.ai/api/v1/chat/completions');

    const model = options.model || (provider === 'nvidia'
      ? 'meta/llama-3.3-70b-instruct'
      : 'anthropic/claude-3.5-sonnet');

    const systemPrompt = this.getSystemPromptForMode(mode, lexicon);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(provider === 'openrouter' ? { 'HTTP-Referer': 'https://georepo.local', 'X-Title': 'GeoRepo' } : {})
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Extract geological data from this field transcript:\n\n"${rawSpeechText}"` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM extraction request failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    return JSON.parse(content);
  }

  /**
   * Generate structured JSON system prompts per discipline
   */
  public getSystemPromptForMode(mode: ProjectMode, lexicon: string[] = []): string {
    const vocabList = lexicon.join(', ');

    if (mode === 'GEOTECHNICAL_ENGINEERING') {
      return `You are a geotechnical engineering extraction assistant. Convert field notes into structured JSON.
Domain vocabulary: ${vocabList}.
JSON schema:
{
  "lithology": string (required),
  "rqd": string (e.g. "75%"),
  "jointSpacing": string (e.g. "0.4m" or "400mm"),
  "weathering": string (e.g. "Grade II - Slightly Weathered"),
  "sampleId": string (e.g. "GT-CORE-01"),
  "strike": number (0-360),
  "dip": number (0-90),
  "dipDirection": string ("N"|"NE"|"E"|"SE"|"S"|"SW"|"W"|"NW"),
  "confidence": number (0.0 to 1.0)
}`;
    }

    if (mode === 'REGIONAL_MAPPING') {
      return `You are a regional bedrock mapping extraction assistant. Convert field notes into structured JSON.
Domain vocabulary: ${vocabList}.
JSON schema:
{
  "formation": string (e.g. "Witwatersrand Supergroup"),
  "member": string (e.g. "Central Rand Group"),
  "lithology": string (required),
  "contact": string (e.g. "Unconformable contact", "Faulted"),
  "sampleId": string,
  "strike": number (0-360),
  "dip": number (0-90),
  "dipDirection": string ("N"|"NE"|"E"|"SE"|"S"|"SW"|"W"|"NW"),
  "confidence": number (0.0 to 1.0)
}`;
    }

    // Default: MINERAL_EXPLORATION
    return `You are a mineral exploration extraction assistant. Convert field notes into structured JSON.
Domain vocabulary: ${vocabList}.
JSON schema:
{
  "lithology": string (required),
  "alteration": string (e.g. "potassic alteration", "sericitic"),
  "mineralization": string (e.g. "disseminated chalcopyrite, pyrrhotite"),
  "sampleId": string (e.g. "SMP-102"),
  "strike": number (0-360),
  "dip": number (0-90),
  "dipDirection": string ("N"|"NE"|"E"|"SE"|"S"|"SW"|"W"|"NW"),
  "confidence": number (0.0 to 1.0)
}`;
  }

  /**
   * Deterministic domain rule-based extractor
   */
  public parseWithDomainRules(
    text: string,
    mode: ProjectMode,
    lexicon: string[] = []
  ): RawParsedDomainAttributes {
    const lower = text.toLowerCase();

    // 1. Strike and Dip extraction (supports "strike 045 dip 60 SE" or "strike 410" or "045/60 SE")
    let strike: number | undefined;
    let dip: number | undefined;
    let dipDirection: string | undefined;

    const strikeMatch = text.match(/strike\s*[:=]?\s*(\d{1,3})/i);
    if (strikeMatch) {
      strike = parseInt(strikeMatch[1], 10);
    }

    const dipMatch = text.match(/dip\s*[:=]?\s*(\d{1,2})\s*([NSEW]{1,2})?/i);
    if (dipMatch) {
      dip = parseInt(dipMatch[1], 10);
      if (dipMatch[2]) dipDirection = dipMatch[2].toUpperCase();
    }

    // Alternative slash syntax e.g. 045/60 SE
    if (strike === undefined) {
      const slashMatch = text.match(/\b(\d{1,3})\s*\/\s*(\d{1,2})\s*([NSEW]{1,2})?\b/i);
      if (slashMatch) {
        strike = parseInt(slashMatch[1], 10);
        dip = parseInt(slashMatch[2], 10);
        if (slashMatch[3]) dipDirection = slashMatch[3].toUpperCase();
      }
    }

    // 2. Sample ID extraction (e.g. "sample SMP-102", "sample #102", "sample GT-CORE-01")
    let sampleId: string | undefined;
    const sampleMatch = text.match(/\b(?:sample|specimen|bag|tag)\b\s*(?:#|tag|id|no\.|rock\s*chip\s*sample)?\s*([A-Za-z0-9-_]+)/i);
    if (sampleMatch) {
      sampleId = sampleMatch[1].toUpperCase();
    }

    // 3. Mode-specific extractions
    if (mode === 'GEOTECHNICAL_ENGINEERING') {
      // RQD %
      let rqd: string | undefined;
      const rqdMatch = text.match(/rqd\s*[:=]?\s*(\d{1,3})%?/i);
      if (rqdMatch) rqd = `${rqdMatch[1]}%`;

      // Joint spacing
      let jointSpacing: string | undefined;
      const jsMatch = text.match(/joint\s*spacing\s*[:=]?\s*([0-9.]+\s*(?:mm|cm|m)?)/i);
      if (jsMatch) jointSpacing = jsMatch[1];

      // Weathering grade
      let weathering: string | undefined;
      const wMatch = text.match(/weathering\s*(?:grade)?\s*[:=]?\s*([I|V|X]+|[a-zA-Z\s]+)/i);
      if (wMatch) weathering = wMatch[1].trim();

      // Lithology fallback
      const lithology = this.detectLithology(lower, lexicon) || 'Basaltic andesite';

      return {
        lithology,
        rqd,
        jointSpacing,
        weathering,
        sampleId,
        strike,
        dip,
        dipDirection
      };
    }

    if (mode === 'REGIONAL_MAPPING') {
      let formation = lexicon.find((term) => lower.includes(term.toLowerCase())) || 'Witwatersrand Supergroup';
      let member: string | undefined;
      if (lower.includes('central rand')) member = 'Central Rand Group';

      let contact: string | undefined;
      if (lower.includes('unconform')) contact = 'Unconformable depositional contact';
      else if (lower.includes('fault')) contact = 'Faulted structural contact';
      else if (lower.includes('conform')) contact = 'Conformable contact';

      const lithology = this.detectLithology(lower, lexicon) || 'Quartz-pebble conglomerate';

      return {
        formation,
        member,
        lithology,
        contact,
        sampleId,
        strike,
        dip,
        dipDirection
      };
    }

    // MINERAL_EXPLORATION
    const mineralsFound = this.detectMinerals(lower, lexicon);
    const alteration = this.detectAlteration(lower, lexicon);
    const lithology = this.detectLithology(lower, lexicon) || 'Quartz-pebble conglomerate';

    return {
      lithology,
      alteration,
      mineralization: mineralsFound.length > 0 ? `Disseminated ${mineralsFound.join(', ')}` : undefined,
      sampleId,
      strike,
      dip,
      dipDirection
    };
  }

  /**
   * Validate extracted attributes, compute confidence, and flag anomalies
   */
  public validateAndScore(data: any, mode: ProjectMode): ExtractionResult {
    const flags: string[] = [];
    let score = 0.95; // Base high confidence

    // Check mandatory lithology
    if (!data.lithology || data.lithology.trim().length === 0) {
      flags.push('Missing lithology description');
      score -= 0.35;
    }

    // Structural strike validation (0 <= strike <= 360)
    if (typeof data.strike === 'number') {
      if (data.strike < 0 || data.strike > 360) {
        flags.push(`Orientation anomaly: strike ${data.strike}° is out of valid azimuth range (0-360°)`);
        score -= 0.35;
      }
    } else {
      score -= 0.05; // Mild penalty if no orientation was stated
    }

    // Structural dip validation (0 <= dip <= 90)
    if (typeof data.dip === 'number') {
      if (data.dip < 0 || data.dip > 90) {
        flags.push(`Orientation anomaly: dip ${data.dip}° exceeds physical maximum (0-90°)`);
        score -= 0.35;
      }
    }

    // Discipline-specific validations
    if (mode === 'GEOTECHNICAL_ENGINEERING') {
      if (!data.rqd && !data.jointSpacing) {
        flags.push('Missing geotechnical metrics (RQD or joint spacing)');
        score -= 0.20;
      }
    } else if (mode === 'REGIONAL_MAPPING') {
      if (!data.formation) {
        flags.push('Missing stratigraphy/formation name');
        score -= 0.20;
      }
    } else {
      // Mineral exploration
      if (!data.mineralization && !data.alteration) {
        flags.push('No economic mineral or alteration identified');
        score -= 0.15;
      }
    }

    // Clamp score between 0.10 and 1.00
    const confidence = Math.max(0.1, Math.min(1.0, Math.round(score * 100) / 100));
    const status: StationStatus = confidence < 0.70 ? 'FLAGGED_LOW_CONFIDENCE' : 'EXTRACTED';

    let extracted: ExtractedAttributes;

    if (mode === 'GEOTECHNICAL_ENGINEERING') {
      const geo: GeotechnicalAttributes = {
        lithology: data.lithology || 'Undifferentiated rock mass',
        rqd: data.rqd,
        jointSpacing: data.jointSpacing,
        weathering: data.weathering,
        sampleId: data.sampleId,
        strike: data.strike,
        dip: data.dip,
        dipDirection: data.dipDirection
      };
      extracted = geo;
    } else if (mode === 'REGIONAL_MAPPING') {
      const reg: RegionalMappingAttributes = {
        formation: data.formation,
        member: data.member,
        lithology: data.lithology || 'Bedrock outcrop',
        contact: data.contact,
        sampleId: data.sampleId,
        strike: data.strike,
        dip: data.dip,
        dipDirection: data.dipDirection
      };
      extracted = reg;
    } else {
      const exp: MineralExplorationAttributes = {
        lithology: data.lithology || 'Host rock outcrop',
        alteration: data.alteration,
        mineralization: data.mineralization,
        sampleId: data.sampleId,
        strike: data.strike,
        dip: data.dip,
        dipDirection: data.dipDirection
      };
      extracted = exp;
    }

    return {
      extracted,
      confidence,
      status,
      flags
    };
  }

  private detectLithology(lowerText: string, lexicon: string[]): string | undefined {
    const rocks = [
      'quartz-pebble conglomerate',
      'basaltic andesite',
      'conglomerate',
      'quartzite',
      'shale',
      'sandstone',
      'diabase',
      'basalt',
      'granite',
      'gabbro',
      'andesite',
      'schist',
      'gneiss',
      'marble'
    ];
    // Prioritize longest names first to prevent partial matches
    rocks.sort((a, b) => b.length - a.length);

    for (const rock of rocks) {
      if (lowerText.includes(rock)) return rock;
    }
    for (const term of lexicon) {
      if (lowerText.includes(term.toLowerCase())) return term;
    }
    return undefined;
  }

  private detectMinerals(lowerText: string, lexicon: string[]): string[] {
    const commonMinerals = [
      'chalcopyrite',
      'pyrite',
      'pyrrhotite',
      'galena',
      'sphalerite',
      'bornite',
      'molybdenite',
      'arsenopyrite',
      'gold',
      'magnetite',
      'hematite'
    ];
    const found: string[] = [];
    for (const min of commonMinerals) {
      if (lowerText.includes(min)) found.push(min);
    }
    for (const term of lexicon) {
      const lowerTerm = term.toLowerCase();
      if (lowerText.includes(lowerTerm) && !found.includes(lowerTerm)) {
        found.push(term);
      }
    }
    return found;
  }

  private detectAlteration(lowerText: string, lexicon: string[]): string | undefined {
    const alterations = [
      'potassic alteration',
      'sericitic',
      'chloritic',
      'silica flooding',
      'silicification',
      'argillic',
      'propylitic',
      'carbonatization'
    ];
    for (const alt of alterations) {
      if (lowerText.includes(alt)) return alt;
    }
    for (const term of lexicon) {
      if (term.toLowerCase().includes('alteration') && lowerText.includes(term.toLowerCase())) {
        return term;
      }
    }
    return undefined;
  }
}

export const llmExtractionService = new LlmExtractionService();
