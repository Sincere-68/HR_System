import { SwapOutlined } from '@ant-design/icons';
import { Button, Radio, Select } from 'antd';
import { useState } from 'react';

type HandoverMode = 'delegate' | 'retired';

export function HandoverPage() {
  const [mode, setMode] = useState<HandoverMode>('delegate');

  return (
    <section className="handover-page" aria-labelledby="handover-heading">
      <header className="employee-page-heading handover-heading">
        <div className="employee-title-group">
          <span className="employee-title-icon" aria-hidden="true"><SwapOutlined /></span>
          <h1 id="handover-heading">职责转交</h1>
        </div>
      </header>

      <Radio.Group
        className="handover-panel"
        value={mode}
        onChange={(event) => setMode(event.target.value)}
        aria-label="职责转交方式"
      >
        <section className="handover-option">
          <Radio value="delegate">
            <span className="handover-option-title">指定被转交人</span>
          </Radio>
          <p>将所选人员承担的各类职责转交给其他人员</p>
          <div className="handover-recipient-control">
            <Select aria-label="选择接收人" className="handover-recipient-select" placeholder="请选择" options={[]} />
            <Button type="primary">设置接收人</Button>
          </div>
        </section>

        <div className="handover-divider" />

        <section className="handover-option handover-option-secondary">
          <Radio value="retired">
            <span className="handover-option-title">检查离职退休人员</span>
          </Radio>
          <p>若最近三个月内离职或退休的人员仍承担一些职责，可将其转交给其他人员</p>
        </section>
      </Radio.Group>
    </section>
  );
}
