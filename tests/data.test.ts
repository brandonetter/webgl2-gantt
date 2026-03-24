import { createSampleScene } from '@gantt/gantt-core';

describe('sample data generation', () => {
  it('biases tasks toward 1d-14d spans while capping long tails at 60d', () => {
    const scene = createSampleScene({ seed: 24, orderCount: 120 });
    const durations = scene.tasks.map((task) => task.end - task.start);
    const shortTasks = durations.filter((duration) => duration >= 1 && duration <= 14);
    const longTasks = durations.filter((duration) => duration > 14);

    expect(durations.length).toBeGreaterThan(0);
    expect(Math.max(...durations)).toBeLessThanOrEqual(60);
    expect(shortTasks.length / durations.length).toBeGreaterThanOrEqual(0.85);
    expect(longTasks.length).toBeGreaterThan(0);
  });
});
