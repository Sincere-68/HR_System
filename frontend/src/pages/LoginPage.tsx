import { LockOutlined, SafetyCertificateOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';

interface LoginValues {
  username: string;
  password: string;
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (values: LoginValues) => {
    setError('');
    setIsSubmitting(true);
    try {
      await login(values.username, values.password);
      const destination = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(destination ?? '/', { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '登录失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-intro" aria-label="系统说明">
        <div className="login-brand-mark"><TeamOutlined /></div>
        <Typography.Title>人员管理系统</Typography.Title>
        <Typography.Paragraph>
          这是一个可直接运行的人员管理演示。默认不需要安装数据库，所有员工资料都是虚构数据。
        </Typography.Paragraph>
        <div className="security-note">
          <SafetyCertificateOutlined />
          <span>重新启动后端后，演示数据会自动恢复</span>
        </div>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-form-wrap">
          <Typography.Title id="login-title" level={2}>登录系统</Typography.Title>
          <Typography.Paragraph type="secondary">请输入管理员账号和密码后登录</Typography.Paragraph>
          {error ? <Alert className="login-error" type="error" showIcon message={error} /> : null}
          <Form<LoginValues>
            layout="vertical"
            requiredMark={false}
            onFinish={handleSubmit}
          >
            <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input size="large" prefix={<UserOutlined />} autoComplete="username" />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password size="large" prefix={<LockOutlined />} autoComplete="current-password" />
            </Form.Item>
            <Button block size="large" type="primary" htmlType="submit" loading={isSubmitting}>
              登录
            </Button>
          </Form>
        </div>
      </section>
    </main>
  );
}
