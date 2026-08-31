import { ArrowLeftOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons';
import { PERMISSIONS } from '@hr-demo/shared';
import {
  educationLevelLabels,
  employmentRelationshipLabels,
  employeeLevelLabels,
  ethnicityLabels,
  householdTypeLabels,
  institutionTypeLabels,
  maritalStatusLabels,
  personnelCategoryLabels,
  personnelPositionLabels,
  personnelSourceLabels,
  politicalStatusLabels,
  workArrangementLabels,
} from '../../config/personnel-fields';
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
  const label = (value: string | number | null | undefined, labels?: Record<string, string>) => {
    if (value === null || value === undefined || value === '') return '--';
    return labels?.[String(value)] ?? String(value);
  };
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
            <Descriptions.Item label="企业邮箱">{label(data.workEmail)}</Descriptions.Item>
            <Descriptions.Item label="个人邮箱">{label(data.personalEmail)}</Descriptions.Item>
            <Descriptions.Item label="手机号">{label(data.mobile)}</Descriptions.Item>
            <Descriptions.Item label="性别">{label(data.gender)}</Descriptions.Item>
            <Descriptions.Item label="出生日期">{label(data.birthDate)}</Descriptions.Item>
            <Descriptions.Item label="年龄">{label(data.age)}</Descriptions.Item>
            <Descriptions.Item label="民族">{label(data.ethnicity, ethnicityLabels)}</Descriptions.Item>
            <Descriptions.Item label="婚姻状况">{label(data.maritalStatus, maritalStatusLabels)}</Descriptions.Item>
            <Descriptions.Item label="政治面貌">{label(data.politicalStatus, politicalStatusLabels)}</Descriptions.Item>
            <Descriptions.Item label="籍贯">{label(data.nativePlace)}</Descriptions.Item>
            <Descriptions.Item label="户口类别">{label(data.householdType, householdTypeLabels)}</Descriptions.Item>
            <Descriptions.Item label="证件类型">{label(data.documentType, { NATIONAL_ID: '居民身份证', PASSPORT: '护照', HK_MACAO_PERMIT: '港澳通行证', TAIWAN_PERMIT: '台湾通行证', RESIDENCE_PERMIT: '居住证', OTHER: '其他证件' })}</Descriptions.Item>
            <Descriptions.Item label="证件号码">{label(data.documentNumber)}</Descriptions.Item>
            <Descriptions.Item label="证件截止日期">{label(data.documentExpiryDate)}</Descriptions.Item>
            <Descriptions.Item label="户籍所在地">{label(data.householdAddress)}</Descriptions.Item>
            <Descriptions.Item label="联系地址">{label(data.residentialAddress)}</Descriptions.Item>
          </Descriptions>
        </Card>

        <div className="detail-grid">
          <Card title="任职信息" bordered={false}>
            <Descriptions column={{ xs: 1, sm: 2 }} colon={false} layout="vertical">
              <Descriptions.Item label="部门">{label(data.organizationName)}</Descriptions.Item>
              <Descriptions.Item label="入职日期">{label(data.entryDate)}</Descriptions.Item>
              <Descriptions.Item label="职位">{label(data.positionName)}</Descriptions.Item>
              <Descriptions.Item label="职级">{label(data.jobLevel)}</Descriptions.Item>
              <Descriptions.Item label="人员定位">{label(data.personnelPosition, personnelPositionLabels)}</Descriptions.Item>
              <Descriptions.Item label="员工层级">{label(data.employeeLevel, employeeLevelLabels)}</Descriptions.Item>
              <Descriptions.Item label="人员类别">{label(data.personnelCategory, personnelCategoryLabels)}</Descriptions.Item>
              <Descriptions.Item label="人员来源">{label(data.personnelSource, personnelSourceLabels)}</Descriptions.Item>
              <Descriptions.Item label="雇佣关系">{label(data.employmentRelationship, employmentRelationshipLabels)}</Descriptions.Item>
              <Descriptions.Item label="用工形式">{label(data.workArrangement, workArrangementLabels)}</Descriptions.Item>
              <Descriptions.Item label="全日制公司">{label(data.fullTimeCompany)}</Descriptions.Item>
              <Descriptions.Item label="工作地点">{label(data.workplaceName)}</Descriptions.Item>
              <Descriptions.Item label="直线经理">{label(data.managerName)}</Descriptions.Item>
              <Descriptions.Item label="直线经理邮箱">{label(data.managerEmail)}</Descriptions.Item>
              <Descriptions.Item label="累计工龄（年）">{label(data.totalWorkYears)}</Descriptions.Item>
              <Descriptions.Item label="累计司龄（年）">{label(data.totalServiceYears)}</Descriptions.Item>
            </Descriptions>
          </Card>
          <Card title="其他资料" bordered={false}>
            <Descriptions column={{ xs: 1, sm: 2 }} colon={false} layout="vertical">
              <Descriptions.Item label="当前状态"><Space><EmploymentStatusTag status={data.employmentStatus} /></Space></Descriptions.Item>
              <Descriptions.Item label="紧急联系人">{label(data.emergencyContactName)}</Descriptions.Item>
              <Descriptions.Item label="与本人关系">{label(data.emergencyContactRelationship)}</Descriptions.Item>
              <Descriptions.Item label="紧急联系人电话">{label(data.emergencyContactMobile)}</Descriptions.Item>
              <Descriptions.Item label="银行">{label(data.bankName)}</Descriptions.Item>
              <Descriptions.Item label="开户行支行">{label(data.bankBranchName)}</Descriptions.Item>
              <Descriptions.Item label="银行账号">{label(data.bankAccountNumber)}</Descriptions.Item>
              <Descriptions.Item label="毕业学校名称">{label(data.graduationSchoolName)}</Descriptions.Item>
              <Descriptions.Item label="院校类型">{label(data.institutionType, institutionTypeLabels)}</Descriptions.Item>
              <Descriptions.Item label="最高学历">{label(data.highestEducation, educationLevelLabels)}</Descriptions.Item>
              <Descriptions.Item label="毕业时间">{label(data.graduationDate)}</Descriptions.Item>
              <Descriptions.Item label="专业">{label(data.major)}</Descriptions.Item>
            </Descriptions>
          </Card>
        </div>
      </div>
    </section>
  );
}
