import { LockOutlined, LogoutOutlined } from '@ant-design/icons';
import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';

export function AccessRestrictedPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <main className="access-restricted-page">
      <Result
        icon={<LockOutlined />}
        title="当前账户暂未开放信息访问"
        subTitle="请使用管理员账户登录，或联系管理员开通相应权限。"
        extra={<Button icon={<LogoutOutlined />} onClick={handleLogout}>退出登录</Button>}
      />
    </main>
  );
}
