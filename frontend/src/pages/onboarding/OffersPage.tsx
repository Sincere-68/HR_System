import { SolutionOutlined } from '@ant-design/icons';
import {
  OFFER_LIST_VIEWS,
  type OfferListView,
} from '@hr-demo/shared';
import { Alert, Button, Typography } from 'antd';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOffers } from '../../features/onboarding/api';
import { AcceptedOffersTable } from './offer-views/AcceptedOffersTable';
import { AllOffersTable } from './offer-views/AllOffersTable';
import { OfferViewTable } from './offer-views/OfferViewTable';
import { OnboardedOffersTable } from './offer-views/OnboardedOffersTable';
import { RejectedOffersTable } from './offer-views/RejectedOffersTable';
import { SentOffersTable } from './offer-views/SentOffersTable';
import { offerColumns } from './onboarding-table-configs';

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
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isOfferListView(value: string | null): value is OfferListView {
  return Boolean(value && OFFER_LIST_VIEWS.includes(value as OfferListView));
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
  };

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
      </header>

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
