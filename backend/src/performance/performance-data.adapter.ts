import type { PerformanceIndicatorDefinition } from '@hr-demo/shared';

export const PERFORMANCE_DATA_ADAPTER = 'PERFORMANCE_DATA_ADAPTER';

export interface PerformanceMetricData {
  indicatorId: string;
  targetValue: number;
  actualValue: number;
  weight: number;
  fields?: Record<string, number>;
}

export interface PerformanceDataAdapter {
  getMetrics(input: {
    employeeId: string;
    periodStart: Date;
    periodEnd: Date;
    indicators: PerformanceIndicatorDefinition[];
  }): Promise<PerformanceMetricData[]>;
}

/** Replace this adapter with the business data source integration. */
export class MockPerformanceDataAdapter implements PerformanceDataAdapter {
  async getMetrics(input: { employeeId?: string; periodStart?: Date; periodEnd?: Date; indicators: PerformanceIndicatorDefinition[] }): Promise<PerformanceMetricData[]> {
    return input.indicators.map((indicator) => ({
      indicatorId: indicator.id,
      targetValue: 0,
      actualValue: 0,
      weight: indicator.weight,
      fields: {},
    }));
  }
}
