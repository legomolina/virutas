import { cutOptimizerDefaults } from './cut-optimizer-defaults.calc';

describe('cutOptimizerDefaults', () => {
  it('is a 3 mm Kerf, no Trim and a 300 mm minimum Offcut length under Metric', () => {
    expect(cutOptimizerDefaults('metric')).toEqual({
      kerfMillimetres: 3,
      trimMillimetres: 0,
      minimumOffcutLengthMillimetres: 300,
    });
  });

  it('is a 1/8" Kerf, no Trim and a 12" minimum Offcut length under Imperial', () => {
    expect(cutOptimizerDefaults('imperial')).toEqual({
      kerfMillimetres: 3.175,
      trimMillimetres: 0,
      minimumOffcutLengthMillimetres: 304.8,
    });
  });
});
