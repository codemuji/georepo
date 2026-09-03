import { describe, it, expect } from 'vitest';
import { LlmExtractionService } from '../../src/services/extraction';
import {
  MineralExplorationAttributes,
  GeotechnicalAttributes,
  RegionalMappingAttributes
} from '../../src/domain/types';

describe('Ticket 05: LLM Structured Entity Extraction Engine', () => {
  const extractor = new LlmExtractionService();
  const lexicon = [
    'Witwatersrand Supergroup',
    'pyrrhotite',
    'chalcopyrite',
    'quartz-pebble conglomerate',
    'potassic alteration',
    'sericitic'
  ];

  it('extracts Mineral Exploration schema from speech transcript', async () => {
    const speech = 'Outcrop of quartz-pebble conglomerate with visible disseminated chalcopyrite and pyrite blebs. Strong sericitic halo. Bedding measured at strike 045 dip 60 SE. Bagged rock chip sample SMP-102.';
    
    const result = await extractor.extractFromSpeech(speech, 'MINERAL_EXPLORATION', lexicon);

    expect(result.status).toBe('EXTRACTED');
    expect(result.confidence).toBeGreaterThanOrEqual(0.70);

    const exp = result.extracted as MineralExplorationAttributes;
    expect(exp.lithology).toContain('conglomerate');
    expect(exp.mineralization?.toLowerCase()).toContain('chalcopyrite');
    expect(exp.alteration?.toLowerCase()).toContain('sericitic');
    expect(exp.sampleId).toBe('SMP-102');
    expect(exp.strike).toBe(45);
    expect(exp.dip).toBe(60);
    expect(exp.dipDirection).toBe('SE');
  });

  it('extracts Geotechnical Engineering schema with RQD and weathering grade', async () => {
    const speech = 'Basaltic andesite bedrock. RQD 78%, joint spacing 0.4m. Weathering Grade II slightly weathered. Core sample GT-CORE-05. Joint plane strike 120 dip 75 SW.';

    const result = await extractor.extractFromSpeech(speech, 'GEOTECHNICAL_ENGINEERING', lexicon);

    expect(result.status).toBe('EXTRACTED');
    expect(result.confidence).toBeGreaterThanOrEqual(0.70);

    const geo = result.extracted as GeotechnicalAttributes;
    expect(geo.lithology).toContain('andesite');
    expect(geo.rqd).toBe('78%');
    expect(geo.jointSpacing).toBe('0.4m');
    expect(geo.weathering).toContain('II');
    expect(geo.sampleId).toBe('GT-CORE-05');
    expect(geo.strike).toBe(120);
    expect(geo.dip).toBe(75);
    expect(geo.dipDirection).toBe('SW');
  });

  it('extracts Regional Mapping schema with formation and contact relationships', async () => {
    const speech = 'Witwatersrand Supergroup Central Rand Group. Quartz-pebble conglomerate exposed at an unconformable depositional contact over basement schist. Bedding strike 015 dip 40 SE, sample REG-101.';

    const result = await extractor.extractFromSpeech(speech, 'REGIONAL_MAPPING', lexicon);

    expect(result.status).toBe('EXTRACTED');
    expect(result.confidence).toBeGreaterThanOrEqual(0.70);

    const reg = result.extracted as RegionalMappingAttributes;
    expect(reg.formation).toContain('Witwatersrand');
    expect(reg.member).toContain('Central Rand');
    expect(reg.lithology).toContain('conglomerate');
    expect(reg.contact?.toLowerCase()).toContain('unconform');
    expect(reg.strike).toBe(15);
    expect(reg.dip).toBe(40);
    expect(reg.sampleId).toBe('REG-101');
  });

  it('flags orientation anomalies and marks status FLAGGED_LOW_CONFIDENCE', async () => {
    // Strike 410 is beyond physical 360 degrees
    const speech = 'Outcrop of quartzite, strike 410 dip 60 SE, sample SMP-99.';

    const result = await extractor.extractFromSpeech(speech, 'MINERAL_EXPLORATION', lexicon);

    expect(result.status).toBe('FLAGGED_LOW_CONFIDENCE');
    expect(result.confidence).toBeLessThan(0.70);
    expect(result.flags.some((f) => f.includes('Orientation anomaly'))).toBe(true);
  });

  it('flags low confidence when vital lithological description is missing', () => {
    const emptyResult = extractor.validateAndScore({}, 'MINERAL_EXPLORATION');

    expect(emptyResult.status).toBe('FLAGGED_LOW_CONFIDENCE');
    expect(emptyResult.confidence).toBeLessThan(0.70);
    expect(emptyResult.flags).toContain('Missing lithology description');
  });
});
