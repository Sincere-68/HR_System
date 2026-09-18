import { describe, expect, it } from 'vitest';
import { findPerformanceNavigationLabel, getPerformanceNavigationKey } from './performance-navigation';

describe('performance navigation matching', () => {
  it('selects the longest matching navigation route for subpages', () => {
    expect(getPerformanceNavigationKey('/performance/activities/activity-1')).toBe('/performance/activities');
    expect(getPerformanceNavigationKey('/performance/templates/template-1')).toBe('/performance/templates');
    expect(getPerformanceNavigationKey('/performance')).toBe('/performance');
  });

  it('uses the selected navigation item label for detail routes', () => {
    expect(findPerformanceNavigationLabel('/performance/activities/activity-1')).toBe('员工绩效活动');
  });
});
