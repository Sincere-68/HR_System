import {
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Drawer, Dropdown, Layout, Menu, Space, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { findNavigationLabel, findOpenMenuKeys, navigationItems } from '../config/navigation';

const { Header, Sider, Content } = Layout;
const BREAKPOINT = 992;

export function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(() => window.innerWidth < BREAKPOINT);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openKeys, setOpenKeys] = useState(() => findOpenMenuKeys(location.pathname));
  const [activePrimaryKey, setActivePrimaryKey] = useState<string>();

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${BREAKPOINT - 1}px)`);
    const update = () => setMobile(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => setDrawerOpen(false), [location.pathname]);
  useEffect(() => {
    setOpenKeys(findOpenMenuKeys(location.pathname));
    setActivePrimaryKey(undefined);
  }, [location.pathname]);

  const menuItems = useMemo(() => navigationItems as MenuProps['items'], []);
  const selectedKey = location.pathname.startsWith('/personnel/employees')
    ? '/personnel/employees'
    : location.pathname.startsWith('/personnel/blacklist-removals')
      ? '/personnel/blacklist'
      : location.pathname;
  const primaryKeys = useMemo(
    () => navigationItems.filter((item) => item.children).map((item) => item.key),
    [],
  );

  const handleOpenChange = (keys: string[]) => {
    const newlyOpened = keys.find((key) => !openKeys.includes(key));
    setOpenKeys(newlyOpened ? [newlyOpened] : []);
    setActivePrimaryKey(newlyOpened);
  };
  const menu = (
    <Menu
      theme="light"
      mode="inline"
      items={menuItems}
      selectedKeys={[activePrimaryKey ?? selectedKey]}
      openKeys={openKeys}
      onOpenChange={handleOpenChange}
      onClick={({ key }) => {
        setActivePrimaryKey(primaryKeys.includes(key) ? key : undefined);
        navigate(key);
      }}
      className={`navigation-menu${activePrimaryKey ? ' has-active-primary' : ''}`}
    />
  );

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
    <Layout className="app-shell">
      <Header className="app-header">
        <Space size="middle">
          {mobile ? (
            <Button
              type="text"
              aria-label="打开导航"
              icon={<MenuUnfoldOutlined />}
              onClick={() => setDrawerOpen(true)}
            />
          ) : null}
          <Typography.Text strong className="header-page-title">
            {findNavigationLabel(selectedKey)}
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
      <Layout className="app-body">
        {!mobile ? (
          <Sider width={202} collapsedWidth={56} collapsed={collapsed} theme="light" className="app-sider">
            <nav aria-label="主导航">{menu}</nav>
            <div className="sidebar-collapse-layer">
              <Button
                type="text"
                aria-label={collapsed ? '展开导航' : '收起导航'}
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed((value) => !value)}
              />
            </div>
          </Sider>
        ) : null}

        <Drawer
          title={<span className="drawer-brand"><TeamOutlined /> 人员管理系统</span>}
          placement="left"
          width={280}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          className="mobile-navigation"
          styles={{ body: { padding: 0, background: '#ffffff' }, header: { background: '#ffffff', color: '#27313d' } }}
        >
          <nav aria-label="移动端主导航">{menu}</nav>
        </Drawer>

        <Layout>
          <Content className="app-content">
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}
