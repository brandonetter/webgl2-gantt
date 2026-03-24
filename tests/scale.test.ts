import { chooseGridStep, chooseLabelTier } from '@gantt/gantt-core';

describe('short-task scale defaults', () => {
  it('uses finer day-level timeline steps across short-task zoom ranges', () => {
    expect(chooseGridStep(80)).toMatchObject({ unit: 'day', count: 1 });
    expect(chooseGridStep(40)).toMatchObject({ unit: 'day', count: 2 });
    expect(chooseGridStep(24)).toMatchObject({ unit: 'day', count: 3 });
    expect(chooseGridStep(14)).toMatchObject({ unit: 'day', count: 7 });
  });

  it('keeps label tiers compact enough for dense 1d-14d schedules', () => {
    expect(chooseLabelTier(0.5)).toEqual({ enabled: true, fontPx: 11, minBarWidth: 48 });
    expect(chooseLabelTier(1.2)).toEqual({ enabled: true, fontPx: 12, minBarWidth: 40 });
    expect(chooseLabelTier(3)).toEqual({ enabled: true, fontPx: 13, minBarWidth: 34 });
    expect(chooseLabelTier(12)).toEqual({ enabled: true, fontPx: 14, minBarWidth: 28 });
  });
});
