import { ExportOutlined, FileTextOutlined, PlusOutlined, SolutionOutlined } from '@ant-design/icons';
import { type OfferListView } from '@hr-demo/shared';
import { Alert, Button, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { TableExportDialog } from '../../features/employees/TableExportDialog';
import { Link, useSearchParams } from 'react-router-dom';
import { downloadOnboardingExport, useOffers } from '../../features/onboarding/api';
import { AcceptedOffersTable, acceptedOfferColumns } from './offer-views/AcceptedOffersTable';
import { AllOffersTable, allOfferColumns } from './offer-views/AllOffersTable';
import { OfferViewTable } from './offer-views/OfferViewTable';
import { OnboardedOffersTable, onboardedOfferColumns } from './offer-views/OnboardedOffersTable';
import { RejectedOffersTable, rejectedOfferColumns } from './offer-views/RejectedOffersTable';
import { SentOffersTable, sentOfferColumns } from './offer-views/SentOffersTable';
import { offerColumns } from './onboarding-table-configs';
import { fieldsFromColumns } from './export-fields';

const offerViewCards: Array<{ view: OfferListView; label: string; countKey: 'pendingSend' | 'sent' | 'accepted' | 'rejected' | 'onboarded' | 'all' }> = [
  { view: 'PENDING_SEND', label: '待发Offer', countKey: 'pendingSend' },
  { view: 'SENT', label: '已发Offer', countKey: 'sent' },
  { view: 'ACCEPTED', label: '已接受Offer', countKey: 'accepted' },
  { view: 'REJECTED', label: '已拒绝Offer', countKey: 'rejected' },
  { view: 'ONBOARDED', label: '已入职Offer', countKey: 'onboarded' },
  { view: 'ALL', label: '全部Offer', countKey: 'all' },
];

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 100 ? parsed : fallback;
}

function isOfferListView(value: string | null): value is OfferListView {
  return value === 'PENDING_SEND'
    || value === 'SENT'
    || value === 'ACCEPTED'
    || value === 'REJECTED'
    || value === 'ONBOARDED'
    || value === 'ALL';
}

export function OffersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const view: OfferListView = isOfferListView(requestedView)
    ? requestedView
    : 'PENDING_SEND';
  const query = useMemo(() => ({
    view,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams, view]);
  const offers = useOffers(query);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedOfferIds, setSelectedOfferIds] = useState<string[]>([]);

  const patchSearch = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next);
  };

  const handlePageChange = (page: number, pageSize: number) => {
    patchSearch({ page, pageSize });
  };

  const tableProps = {
    query: offers,
    page: query.page,
    pageSize: query.pageSize,
    onPageChange: handlePageChange,
    onSelectedRowIdsChange: setSelectedOfferIds,
  };
  const exportColumns = view === 'SENT' ? sentOfferColumns
    : view === 'ACCEPTED' ? acceptedOfferColumns
      : view === 'REJECTED' ? rejectedOfferColumns
        : view === 'ONBOARDED' ? onboardedOfferColumns
          : view === 'ALL' ? allOfferColumns
            : offerColumns;
  const exportFields = fieldsFromColumns(exportColumns);

  const currentTable = (() => {
    switch (view) {
      case 'SENT':
        return <SentOffersTable {...tableProps} />;
      case 'ACCEPTED':
        return <AcceptedOffersTable {...tableProps} />;
      case 'REJECTED':
        return <RejectedOffersTable {...tableProps} />;
      case 'ONBOARDED':
        return <OnboardedOffersTable {...tableProps} />;
      case 'ALL':
        return <AllOffersTable {...tableProps} />;
      case 'PENDING_SEND':
        return (
          <OfferViewTable
            {...tableProps}
            columns={offerColumns}
            emptyText="暂无Offer记录"
            scrollX={1_310}
          />
        );
    }
  })();

  return (
    <section className="onboarding-list-page offers-page" aria-labelledby="offers-heading">
      <header className="onboarding-page-heading">
        <div className="employee-title-group">
          <span className="employee-title-icon" aria-hidden="true"><SolutionOutlined /></span>
          <Typography.Title id="offers-heading" level={1}>Offer管理</Typography.Title>
        </div>
        <div className="onboarding-page-actions">
          <Button icon={<ExportOutlined />} onClick={() => setExportOpen(true)}>导出</Button>
          {view === 'PENDING_SEND' ? (
            <>
              <Link to="/onboarding/offers/templates"><Button type="primary" icon={<FileTextOutlined />}>创建Offer</Button></Link>
              <Link to="/onboarding/offers/new?source=new-hire"><Button type="primary" icon={<PlusOutlined />}>新建实习Offer</Button></Link>
            </>
          ) : null}
        </div>
      </header>

      <TableExportDialog
        open={exportOpen}
        title="导出Offer"
        fields={exportFields}
        selectedRowIds={selectedOfferIds}
        onClose={() => setExportOpen(false)}
        onExport={(input) => downloadOnboardingExport('offers', { ...input, query }, 'Offer管理导出')}
      />

      <div className="offer-overview" aria-label="Offer阶段">
        {offerViewCards.map((card) => (
          <button
            className={`offer-overview-card${view === card.view ? ' is-active' : ''}`}
            key={card.view}
            type="button"
            aria-pressed={view === card.view}
            onClick={() => patchSearch({ view: card.view, page: 1 })}
          >
            <span>{card.label}</span>
            <strong>{offers.data?.meta.viewCounts[card.countKey] ?? '--'}</strong>
          </button>
        ))}
      </div>

      {offers.isError ? (
        <Alert
          className="onboarding-content-alert"
          type="error"
          showIcon
          message="Offer管理加载失败"
          description={offers.error.message}
          action={<Button size="small" onClick={() => offers.refetch()}>重试</Button>}
        />
      ) : null}

      {currentTable}
    </section>
  );
}
