import { ArrowLeftOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons';
import { PERMISSIONS } from '@hr-demo/shared';
import { Alert, Button, Card, Descriptions, Skeleton, Space, Typography } from 'antd';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../features/auth/auth-context';
import { useEmployee } from '../../features/employees/api';
import { EmploymentStatusTag } from '../../features/employees/status';

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const employee = useEmployee(id);
  const canUpdate = Boolean(user?.permissions.includes(PERMISSIONS.EMPLOYEE_UPDATE));

  if (employee.isLoading) {
    return (
      <section className="detail-loading" aria-label="正在加载员工详情">
        <Skeleton active title paragraph={{ rows: 8 }} />
      </section>
    );
  }

  if (employee.isError || !employee.data) {
    return (
      <Alert
        type="error"
        showIcon
        message="员工详情加载失败"
        description={employee.error?.message ?? '未找到员工'}
        action={<Button size="small" icon={<ReloadOutlined />} onClick={() => employee.refetch()}>重试</Button>}
      />
    );
  }

  const data = employee.data;
  return (
    <section aria-labelledby="employee-detail-heading">
      <div className="page-heading detail-heading">
        <div>
          <Link className="back-link" to="/personnel/employees"><ArrowLeftOutlined /> 返回人员列表</Link>
          <Typography.Title id="employee-detail-heading" level={2}>{data.name}</Typography.Title>
          <Typography.Paragraph type="secondary">工号 {data.employeeNo}</Typography.Paragraph>
        </div>
        {canUpdate ? (
          <Link to={`/personnel/employees/${data.id}/edit`}>
            <Button type="primary" icon={<EditOutlined />}>编辑员工</Button>
          </Link>
        ) : null}
      </div>

      <div className="detail-sections">
        <Card title="基础资料" bordered={false}>
          <Descriptions column={{ xs: 1, sm: 2 }} colon={false} layout="vertical">
            <Descriptions.Item label="工号">{data.employeeNo}</Descriptions.Item>
            <Descriptions.Item label="姓名">{data.name}</Descriptions.Item>
            <Descriptions.Item label="手机号">{data.mobile}</Descriptions.Item>
            <Descriptions.Item label="身份证号">{data.idCardNo}</Descriptions.Item>
          </Descriptions>
          {!user?.permissions.includes(PERMISSIONS.EMPLOYEE_SENSITIVE_READ) ? (
            <Typography.Text type="secondary" className="masking-note">
              当前账号无敏感字段权限，手机号和身份证号已由服务端脱敏。
            </Typography.Text>
          ) : null}
        </Card>

        <div className="detail-grid">
          <Card title="所属部门" bordered={false}>
            <Descriptions column={1} colon={false} layout="vertical">
              <Descriptions.Item label="部门名称">{data.organizationName}</Descriptions.Item>
            </Descriptions>
          </Card>
          <Card title="任职状态" bordered={false}>
            <Descriptions column={1} colon={false} layout="vertical">
              <Descriptions.Item label="当前状态">
                <Space><EmploymentStatusTag status={data.employmentStatus} /></Space>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </div>
      </div>
    </section>
  );
}
