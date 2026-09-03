import { CloseOutlined, PlusOutlined, SwapOutlined } from '@ant-design/icons';
import { PERMISSIONS } from '@hr-demo/shared';
import { Alert, Button, Result, Skeleton } from 'antd';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/auth-context';
import { useInternConversionOptions } from '../../features/onboarding/api';

const OFFER_LIST_PATH = '/onboarding/offers?view=PENDING_SEND';
const NEW_HIRE_PATH = '/onboarding/offers/new?source=new-hire';

export function OfferCreationPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const allowed = Boolean(user?.permissions.includes(PERMISSIONS.EMPLOYEE_CREATE));
  const internOptions = useInternConversionOptions(allowed);
  const [selectedInternEmployeeId, setSelectedInternEmployeeId] = useState<string>();

  if (!allowed) {
    return (
      <Result
        status="403"
        title="无权执行此操作"
        subTitle="当前角色没有创建 Offer 的权限。"
        extra={<Link to={OFFER_LIST_PATH}><Button type="primary">返回待发 Offer</Button></Link>}
      />
    );
  }

  if (internOptions.isLoading) {
    return <div className="employee-editor-loading"><Skeleton active paragraph={{ rows: 4 }} /></div>;
  }

  if (internOptions.isError || !internOptions.data) {
    return (
      <Alert
        type="error"
        showIcon
        message="无法加载实习生转正人员"
        description={internOptions.error?.message}
      />
    );
  }

  return (
    <section className="employee-editor-page offer-path-page" aria-labelledby="offer-path-heading">
      <header className="employee-editor-header">
        <h1 id="offer-path-heading">Offer创建</h1>
        <Button
          type="text"
          className="employee-editor-close"
          aria-label="关闭Offer创建"
          icon={<CloseOutlined />}
          onClick={() => navigate(OFFER_LIST_PATH)}
        />
      </header>
      <main className="employee-editor-content">
        <p className="offer-path-intro">选择创建路径后进入同一份可直接保存的 Offer 表单。系统不保存 Offer 模板、版本或配置。</p>
        <div className="offer-path-grid">
          <section className="offer-path-card" aria-labelledby="new-hire-offer-path">
            <span className="offer-path-icon" aria-hidden="true"><PlusOutlined /></span>
            <h2 id="new-hire-offer-path">新增人员</h2>
            <p>从空白表单直接创建实习 Offer。人员来源只保存为候选人来源。</p>
            <Button type="primary" onClick={() => navigate(NEW_HIRE_PATH)}>新建Offer</Button>
          </section>
          <section className="offer-path-card" aria-labelledby="intern-conversion-offer-path">
            <span className="offer-path-icon" aria-hidden="true"><SwapOutlined /></span>
            <h2 id="intern-conversion-offer-path">实习生转正</h2>
            <p>选择当前权限范围内的在职实习生，读取资料预填后可修改并直接创建 Offer。</p>
            <label className="offer-path-intern-list" htmlFor="intern-conversion-employee">
              <span>当前实习生</span>
              <select
                id="intern-conversion-employee"
                aria-label="实习生转正员工"
                value={selectedInternEmployeeId ?? ''}
                onChange={(event) => setSelectedInternEmployeeId(event.target.value || undefined)}
              >
                <option value="">请选择当前实习生</option>
                {internOptions.data.map(({ id, name, employeeNo }) => <option key={id} value={id}>{name}（{employeeNo}）</option>)}
              </select>
            </label>
            <Button
              type="primary"
              disabled={!selectedInternEmployeeId}
              onClick={() => navigate(`/onboarding/offers/new?source=intern-conversion&employeeId=${encodeURIComponent(selectedInternEmployeeId!)}`)}
            >
              预填并创建Offer
            </Button>
            {internOptions.data.length === 0 ? <span className="offer-path-empty">当前范围内没有可转正的实习生</span> : null}
          </section>
        </div>
      </main>
      <footer className="employee-editor-footer intern-offer-editor-footer">
        <Button onClick={() => navigate(OFFER_LIST_PATH)}>取消</Button>
      </footer>
    </section>
  );
}
