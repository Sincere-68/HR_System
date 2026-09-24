import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApprovalFlowEditorDrawer } from './ApprovalFlowEditorDrawer';

describe('ApprovalFlowEditorDrawer', () => {
  afterEach(() => cleanup());

  it('uses the exact JOB_TITLE directory rule shape', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ApprovalFlowEditorDrawer open onClose={vi.fn()} onChange={onChange} value={[
      { stepOrder: 1, assigneeKind: 'DIRECTORY', assigneeUserId: null, assigneeRoleId: null, assigneeRule: null },
    ]} options={{ users: [], roles: [], jobTitles: [{ id: 'jt-1', name: 'HRBP', code: 'HRBP' }] }} />);
    const drawer = within(screen.getByRole('dialog', { name: '审批流程节点编辑' }));

    await user.click(drawer.getByRole('combobox', { name: '第 1 节点审批人' }));
    await user.click(await screen.findByText('HRBP'));

    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        stepOrder: 1,
        assigneeKind: 'DIRECTORY',
        assigneeRule: { directory: 'JOB_TITLE', value: 'jt-1' },
      }),
    ]);
  });

  it('edits reusable nodes through props and keeps step order continuous', async () => {
    const onChange = vi.fn();
    render(<ApprovalFlowEditorDrawer open onClose={vi.fn()} onChange={onChange} value={[
      { stepOrder: 3, assigneeKind: 'USER', assigneeUserId: 'u-1', assigneeRoleId: null, assigneeRule: null },
      { stepOrder: 8, assigneeKind: 'ROLE', assigneeUserId: null, assigneeRoleId: 'r-1', assigneeRule: null },
    ]} options={{ users: [{ id: 'u-1', username: 'u1', displayName: '审批人' }], roles: [{ id: 'r-1', name: 'HR', code: 'HR' }], jobTitles: [] }} />);
    const drawer = within(screen.getByRole('dialog', { name: '审批流程节点编辑' }));
    expect(drawer.getAllByText('第 1 节点').length).toBeGreaterThan(0);
    expect(drawer.getAllByText('第 2 节点').length).toBeGreaterThan(0);
    expect(drawer.queryByText('第 3 节点')).not.toBeInTheDocument();
    await userEvent.setup().click(drawer.getByRole('button', { name: '新增节点' }));
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ stepOrder: 1 }), expect.objectContaining({ stepOrder: 2 }), expect.objectContaining({ stepOrder: 3 }),
    ]));
  });
});
