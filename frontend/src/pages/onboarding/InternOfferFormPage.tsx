import { CloseOutlined } from '@ant-design/icons';
import { PERMISSIONS, type CreateInternOfferInput } from '@hr-demo/shared';
import { Alert, App, Button, Result, Skeleton } from 'antd';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../features/auth/auth-context';
import {
  useCreateInternOffer,
  useInternConversionOfferPrefill,
  useInternOfferFormOptions,
} from '../../features/onboarding/api';
import { InternOfferForm } from '../../features/onboarding/InternOfferForm';

const FORM_ID = 'intern-offer-form';
const OFFER_LIST_PATH = '/onboarding/offers?view=PENDING_SEND';

type OfferCreationSource = 'new-hire' | 'intern-conversion';

function offerCreationSource(value: string | null): OfferCreationSource {
  return value === 'intern-conversion' ? 'intern-conversion' : 'new-hire';
}

export function InternOfferFormPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { message } = App.useApp();
  const allowed = Boolean(user?.permissions.includes(PERMISSIONS.EMPLOYEE_CREATE));
  const source = offerCreationSource(searchParams.get('source'));
  const employeeId = source === 'intern-conversion' ? searchParams.get('employeeId') ?? undefined : undefined;
  const formOptions = useInternOfferFormOptions(allowed);
  const conversionPrefill = useInternConversionOfferPrefill(employeeId, allowed && source === 'intern-conversion');
  const createInternOffer = useCreateInternOffer();

  if (!allowed) {
    return (
      <Result
        status="403"
        title="无权执行此操作"
        subTitle="当前角色没有新增实习 Offer 的权限。"
        extra={<Link to={OFFER_LIST_PATH}><Button type="primary">返回待发 Offer</Button></Link>}
      />
    );
  }

  if (source === 'intern-conversion' && !employeeId) {
    return (
      <Result
        status="warning"
        title="请先选择实习生"
        subTitle="实习生转正 Offer 需要从 Offer 创建入口选择当前实习生。"
        extra={<Link to="/onboarding/offers/templates"><Button type="primary">返回创建入口</Button></Link>}
      />
    );
  }

  if (formOptions.isLoading || conversionPrefill.isLoading) {
    return <div className="employee-editor-loading"><Skeleton active paragraph={{ rows: 10 }} /></div>;
  }

  if (formOptions.isError || !formOptions.data) {
    return (
      <Alert
        type="error"
        showIcon
        message="无法加载新建实习 Offer 信息"
        description={formOptions.error?.message}
      />
    );
  }

  if (conversionPrefill.isError) {
    return (
      <Alert
        type="error"
        showIcon
        message="无法读取实习生转正预填信息"
        description={conversionPrefill.error.message}
      />
    );
  }

  const handleSubmit = async (input: CreateInternOfferInput) => {
    try {
      await createInternOffer.mutateAsync(input);
      message.success(source === 'intern-conversion' ? '实习生转正 Offer 已保存' : '实习 Offer 已保存');
      navigate(OFFER_LIST_PATH, { replace: true });
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : '保存失败');
    }
  };

  const title = source === 'intern-conversion' ? '实习生转正Offer' : '新建实习Offer';
  return (
    <section className="employee-editor-page intern-offer-editor-page" aria-labelledby="intern-offer-form-heading">
      <header className="employee-editor-header">
        <h1 id="intern-offer-form-heading">{title}</h1>
        <Button
          type="text"
          className="employee-editor-close"
          aria-label={`关闭${title}`}
          icon={<CloseOutlined />}
          onClick={() => navigate(OFFER_LIST_PATH)}
        />
      </header>
      <main className="employee-editor-content">
        {source === 'intern-conversion' ? <Alert className="intern-offer-prefill-note" type="info" showIcon message="已从当前实习生资料预填，可修改所有字段后直接保存 Offer。" /> : null}
        {createInternOffer.isError ? (
          <Alert
            className="employee-editor-error"
            type="error"
            showIcon
            message="保存失败"
            description={createInternOffer.error.message}
          />
        ) : null}
        <InternOfferForm
          key={employeeId ?? 'new-hire'}
          formId={FORM_ID}
          formOptions={formOptions.data}
          conversionPrefill={conversionPrefill.data}
          onSubmit={handleSubmit}
        />
      </main>
      <footer className="employee-editor-footer intern-offer-editor-footer">
        <Button onClick={() => navigate(OFFER_LIST_PATH)}>取消</Button>
        <Button type="primary" htmlType="submit" form={FORM_ID} loading={createInternOffer.isPending}>保存</Button>
      </footer>
    </section>
  );
}
