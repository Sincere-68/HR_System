import {
  AppstoreOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Drawer, Dropdown, Layout, Menu, Space, Tooltip, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { findPerformanceNavigationLabel, performanceNavigationItems } from '../config/performance-navigation';
import { useAuth } from '../features/auth/auth-context';

const { Header, Sider, Content } = Layout;
const BREAKPOINT = 992;

export function PerformanceLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(() => window.innerWidth < BREAKPOINT);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuItems = useMemo(() => performanceNavigationItems as MenuProps['items'], []);

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${BREAKPOINT - 1}px)`);
    const update = () => setMobile(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => setDrawerOpen(false), [location.pathname]);

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

  const menu = (
    <Menu
      theme="light"
      mode="inline"
      items={menuItems}
      selectedKeys={[location.pathname]}
      onClick={({ key }) => navigate(key)}
      className="performance-navigation-menu"
    />
  );

  return (
    <Layout className="performance-shell">
      <Header className="performance-header">
        <Space size="middle">
          {mobile ? (
            <Button
              type="text"
              aria-label="打开绩效导航"
              icon={<MenuUnfoldOutlined />}
              onClick={() => setDrawerOpen(true)}
            />
          ) : null}
          <Tooltip title="切换系统">
            <Button
              type="text"
              aria-label="切换系统"
              icon={<AppstoreOutlined />}
              onClick={() => navigate('/', { replace: true })}
            />
          </Tooltip>
          <Typography.Text strong className="header-page-title">
            {findPerformanceNavigationLabel(location.pathname)}
          </Typography.Text>
        </Space>
        <Dropdown menu={{ items: userMenu }} placement="bottomRight" trigger={['click']}>
          <button className="user-trigger" type="button" aria-label="打开账号菜单">
            <Avatar size={28}>{user?.displayName.slice(0, 1)}</Avatar>
            <span className="user-details">
              <strong>{user?.displayName}</strong>
              <small>{user?.roleName}</small>
            </span>
          </button>
        </Dropdown>
      </Header>
      <Layout className="performance-body">
        {!mobile ? (
          <Sider width={202} collapsedWidth={56} collapsed={collapsed} theme="light" className="performance-sider">
            <nav aria-label="绩效系统导航">{menu}</nav>
            <div className="performance-sidebar-collapse">
              <Button
                type="text"
                aria-label={collapsed ? '展开绩效导航' : '收起绩效导航'}
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed((value) => !value)}
              />
            </div>
          </Sider>
        ) : null}

        <Drawer
          title="绩效系统"
          placement="left"
          width={280}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          className="performance-mobile-navigation"
          styles={{ body: { padding: 0, background: '#ffffff' } }}
        >
          <nav aria-label="移动端绩效系统导航">{menu}</nav>
        </Drawer>

        <Layout>
          <Content className="performance-content">
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}
