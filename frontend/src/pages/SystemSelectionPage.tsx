import {
  AppstoreOutlined,
  ArrowRightOutlined,
  BarChartOutlined,
  LogoutOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Avatar, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';

export function SystemSelectionPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const userMenu: MenuProps['items'] = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => {
        logout();
        navigate('/login', { replace: true });
      },
    },
  ];

  return (
    <main className="system-selection-page">
      <header className="system-selection-header">
        <div className="system-selection-brand">
          <span className="system-selection-brand-mark" aria-hidden="true"><AppstoreOutlined /></span>
          <span>人力资源系统</span>
        </div>
        <Dropdown menu={{ items: userMenu }} placement="bottomRight" trigger={['click']}>
          <button className="system-selection-user" type="button" aria-label="打开账号菜单">
            <Avatar size={30}>{user?.displayName.slice(0, 1)}</Avatar>
            <span>{user?.displayName}</span>
          </button>
        </Dropdown>
      </header>

      <section className="system-selection-content" aria-labelledby="system-selection-title">
        <div className="system-selection-heading">
          <span className="system-selection-eyebrow">工作区</span>
          <h1 id="system-selection-title">选择要进入的系统</h1>
        </div>
        <nav className="system-choice-grid" aria-label="系统选择">
          <Link className="system-choice-card personnel-system-choice" to="/personnel/employees">
            <span className="system-choice-icon" aria-hidden="true"><TeamOutlined /></span>
            <span className="system-choice-label">人员管理</span>
            <ArrowRightOutlined className="system-choice-arrow" aria-hidden="true" />
          </Link>
          <Link className="system-choice-card performance-system-choice" to="/performance">
            <span className="system-choice-icon" aria-hidden="true"><BarChartOutlined /></span>
            <span className="system-choice-label">绩效系统</span>
            <ArrowRightOutlined className="system-choice-arrow" aria-hidden="true" />
          </Link>
        </nav>
      </section>
    </main>
  );
}
