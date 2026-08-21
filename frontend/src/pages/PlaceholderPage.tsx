import { AppstoreOutlined, SettingOutlined } from '@ant-design/icons';
import { Button, Empty, Table, type TableColumnsType } from 'antd';
import { useState } from 'react';
import { CheckboxFilterDropdown } from '../components/CheckboxFilterDropdown';

interface PlaceholderPageProps {
  title: string;
}

interface PlaceholderRow {
  key: string;
}

const placeholderColumns: TableColumnsType<PlaceholderRow> = [
  { title: '字段一', dataIndex: 'fieldOne', key: 'fieldOne' },
  { title: '字段二', dataIndex: 'fieldTwo', key: 'fieldTwo' },
  { title: '字段三', dataIndex: 'fieldThree', key: 'fieldThree' },
  { title: '字段四', dataIndex: 'fieldFour', key: 'fieldFour' },
  { title: '字段五', dataIndex: 'fieldFive', key: 'fieldFive' },
  { title: '操作', dataIndex: 'actions', key: 'actions', width: 130 },
];

const placeholderMetrics = ['指标一', '指标二', '指标三', '指标四', '指标五'];
const filterFields = ['筛选字段一', '筛选字段二', '筛选字段三', '筛选字段四'] as const;
const filterOptions = ['选项一', '选项二', '选项三'].map((value) => ({ label: value, value }));

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});

  return (
    <section className="placeholder-list-page" aria-labelledby="placeholder-title">
      <header className="placeholder-page-heading">
        <div className="placeholder-title-group">
          <span className="placeholder-title-icon" aria-hidden="true"><AppstoreOutlined /></span>
          <h1 id="placeholder-title">{title}</h1>
        </div>
        <div className="placeholder-actions" aria-label="待配置操作">
          <Button type="primary">操作占位</Button>
        </div>
      </header>

      <div className="placeholder-overview" aria-label="数据概览占位">
        {placeholderMetrics.map((label, index) => (
          <div className={`placeholder-overview-card${index === 0 ? ' is-emphasized' : ''}`} key={label}>
            <span>{label}</span>
            <strong>--</strong>
          </div>
        ))}
      </div>

      <div className="placeholder-table-surface">
        <div className="placeholder-filter-row" aria-label="待配置筛选条件">
          {filterFields.map((field) => (
            <CheckboxFilterDropdown
              key={field}
              label={field}
              options={filterOptions}
              value={selectedFilters[field] ?? []}
              onChange={(values) => setSelectedFilters((current) => ({ ...current, [field]: values }))}
            />
          ))}
        </div>

        <Table<PlaceholderRow>
          className="placeholder-table"
          columns={placeholderColumns}
          dataSource={[]}
          pagination={false}
          locale={{ emptyText: <Empty description="这里什么都没有..." /> }}
        />
        <Button className="placeholder-column-settings" type="text" aria-label="表格列配置占位" icon={<SettingOutlined />} />
      </div>
    </section>
  );
}
