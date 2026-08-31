import { StopOutlined } from '@ant-design/icons';
import { Empty, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link } from 'react-router-dom';

interface BlacklistRemovalRow {
  key: string;
}

const columns: ColumnsType<BlacklistRemovalRow> = [
  { title: '字段一', dataIndex: 'fieldOne', key: 'fieldOne', width: 160 },
  { title: '字段二', dataIndex: 'fieldTwo', key: 'fieldTwo', width: 160 },
  { title: '字段三', dataIndex: 'fieldThree', key: 'fieldThree', width: 180 },
  { title: '字段四', dataIndex: 'fieldFour', key: 'fieldFour', width: 160 },
  { title: '操作', dataIndex: 'actions', key: 'actions', width: 100 },
];

export function BlacklistRemovalPage() {
  return (
    <section className="employee-list-page blacklist-removal-page" aria-labelledby="blacklist-removal-heading">
      <header className="employee-page-heading">
        <div className="employee-title-group blacklist-title-group">
          <span className="employee-title-icon" aria-hidden="true"><StopOutlined /></span>
          <nav className="blacklist-heading-tabs" aria-label="黑名单功能">
            <Link className="blacklist-heading-tab" to="/personnel/blacklist">
              黑名单管理
            </Link>
            <Link className="blacklist-heading-tab is-active" to="/personnel/blacklist-removals">
              <h1 id="blacklist-removal-heading">黑名单移出记录</h1>
            </Link>
          </nav>
        </div>
      </header>

      <div className="employee-table-surface">
        <Table<BlacklistRemovalRow>
          className="employee-table"
          rowKey="key"
          rowSelection={{ columnWidth: 38 }}
          columns={columns}
          dataSource={[]}
          pagination={false}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="这里什么都没有..." /> }}
        />
      </div>
    </section>
  );
}
