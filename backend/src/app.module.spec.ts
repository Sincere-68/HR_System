import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { EmploymentApprovalFlowManagementModule } from './employment-approvals/employment-approval-flow-management.module';
import { EmploymentConversionsModule } from './employment-conversions/employment-conversions.module';
import { PartTimeRecordsModule } from './part-time-records/part-time-records.module';
import { AppModule } from './app.module';

describe('AppModule', () => {
  it('registers the employment approval flow, conversions, and part-time modules', () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule);

    expect(imports).toEqual(
      expect.arrayContaining([
        EmploymentApprovalFlowManagementModule,
        EmploymentConversionsModule,
        PartTimeRecordsModule,
      ]),
    );
  });
});
