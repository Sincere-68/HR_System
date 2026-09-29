import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApprovalTimeline } from './ApprovalTimeline';

describe('ApprovalTimeline', () => {
  it('sorts nodes by step order and shows decision, comment, and operated time', () => {
    render(<ApprovalTimeline steps={[
      { id: 'step-2', stepOrder: 2, approver: { id: 'u2', displayName: '审批人二' }, decision: 'APPROVED', comment: '同意', operatedAt: '2026-09-23T11:00:00.000Z' },
      { id: 'step-1', stepOrder: 1, approver: { id: 'u1', displayName: '审批人一' }, decision: 'REJECTED', comment: '请补充材料', operatedAt: null },
    ]} />);

    const timeline = screen.getByTestId('approval-timeline');
    const nodes = within(timeline).getAllByTestId('approval-timeline-node');
    expect(nodes[0]).toHaveTextContent('第 1 节点');
    expect(nodes[0]).toHaveTextContent('审批人一');
    expect(nodes[0]).toHaveTextContent('已驳回');
    expect(nodes[0]).toHaveTextContent('请补充材料');
    expect(nodes[0]).toHaveTextContent('未操作');
    expect(nodes[1]).toHaveTextContent('第 2 节点');
    expect(nodes[1]).toHaveTextContent('已通过');
    expect(nodes[1]).toHaveTextContent('同意');
    expect(nodes[1]).toHaveTextContent('2026-09-23');
  });
});
