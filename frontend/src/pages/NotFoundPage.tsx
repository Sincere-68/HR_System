import { Button, Result } from 'antd';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <Result
      status="404"
      title="页面不存在"
      subTitle="请通过左侧导航进入已配置页面。"
      extra={<Link to="/personnel/employees"><Button type="primary">返回人员列表</Button></Link>}
    />
  );
}
