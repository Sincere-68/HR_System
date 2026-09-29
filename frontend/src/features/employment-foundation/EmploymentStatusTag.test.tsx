import { EMPLOYMENT_STATUSES } from '@hr-demo/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmploymentStatusTag } from './EmploymentStatusTag';

describe('EmploymentStatusTag', () => {
  it('renders every employment status with visible Chinese text', () => {
    const labels = ['试用', '正式', '待入职', '调出', '待调入', '退休', '离职', '非正式'];

    render(
      <div>
        {EMPLOYMENT_STATUSES.map((status) => <EmploymentStatusTag key={status} status={status} />)}
      </div>,
    );

    for (const label of labels) expect(screen.getByText(label)).toBeInTheDocument();
  });
});
