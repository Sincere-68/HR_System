import { AppstoreOutlined, SettingOutlined } from '@ant-design/icons';
import { Button, Empty, Table, type TableColumnsType } from 'antd';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckboxFilterDropdown } from '../components/CheckboxFilterDropdown';

interface PlaceholderPageProps {
  title: string;
  routePath?: string;
  headingTabs?: string[];
  /**
   * Some navigation entries have no confirmed field contract yet. Keep those
   * pages explicitly empty instead of presenting generic business columns,
   * filters, or actions that could be mistaken for a real API.
   */
  pendingFields?: boolean;
}

interface PlaceholderRow {
  key: string;
}

const placeholderColumns: TableColumnsType<PlaceholderRow> = [
  { title: '字段一', dataIndex: 'fieldOne', key: 'fieldOne', width: 120 },
  { title: '字段二', dataIndex: 'fieldTwo', key: 'fieldTwo', width: 112 },
  { title: '字段三', dataIndex: 'fieldThree', key: 'fieldThree', width: 144 },
  { title: '字段四', dataIndex: 'fieldFour', key: 'fieldFour', width: 96 },
  { title: '字段五', dataIndex: 'fieldFive', key: 'fieldFive', width: 120 },
  { title: '操作', dataIndex: 'actions', key: 'actions', width: 100 },
];

const placeholderMetrics = ['指标一', '指标二', '指标三', '指标四', '指标五'];
const filterFields = ['筛选字段一', '筛选字段二', '筛选字段三', '筛选字段四'] as const;
const filterOptions = ['选项一', '选项二', '选项三'].map((value) => ({ label: value, value }));

export function PlaceholderPage({ title, routePath, headingTabs, pendingFields = false }: PlaceholderPageProps) {
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [searchParams] = useSearchParams();
  const activeHeadingTab = searchParams.get('view') ?? '0';

  return (
    <section className="placeholder-list-page" aria-labelledby="placeholder-title">
      {headingTabs && routePath ? (
        <header className="employee-page-heading placeholder-page-heading">
          <div className="employee-title-group blacklist-title-group">
            <span className="employee-title-icon" aria-hidden="true"><AppstoreOutlined /></span>
            <nav className="blacklist-heading-tabs" aria-label={`${title}功能`}>
              {headingTabs.map((tab, index) => (
                <Link
                  className={`blacklist-heading-tab${activeHeadingTab === String(index) ? ' is-active' : ''}`}
                  key={tab}
                  to={`${routePath}?view=${index}`}
                >
                  {index === 0 ? <h1 id="placeholder-title">{tab}</h1> : tab}
                </Link>
              ))}
            </nav>
          </div>
          {!pendingFields ? (
            <div className="placeholder-actions" aria-label="待配置操作">
              <Button type="primary">操作占位</Button>
            </div>
          ) : null}
        </header>
      ) : (
        <header className="placeholder-page-heading">
          <div className="placeholder-title-group">
            <span className="placeholder-title-icon" aria-hidden="true"><AppstoreOutlined /></span>
            <h1 id="placeholder-title">{title}</h1>
          </div>
          {!pendingFields ? (
            <div className="placeholder-actions" aria-label="待配置操作">
              <Button type="primary">操作占位</Button>
            </div>
          ) : null}
        </header>
      )}

      {pendingFields ? (
        <div className="pending-fields-surface" role="status" aria-labelledby="pending-fields-heading">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={(
              <div className="pending-fields-description">
                <strong id="pending-fields-heading">字段待确认</strong>
                <span>页面字段、关系类型展示方式及主要关系规则确认后再接入数据。</span>
                <span>当前不发起数据请求，不展示推测的业务表头、筛选条件或操作入口。</span>
              </div>
            )}
          />
        </div>
      ) : (
        <>
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
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            columnWidth: 38,
          }}
          pagination={false}
          locale={{ emptyText: <Empty description="这里什么都没有..." /> }}
        />
        <Button className="placeholder-column-settings" type="text" aria-label="表格列配置占位" icon={<SettingOutlined />} />
      </div>
        </>
      )}
    </section>
  );
}
