import { useEffect, useRef } from 'react';

const FOOTER_CLASS = 'table-viewport-footer';
const SCROLL_CLASS = 'table-viewport-footer-scroll';
const SCROLL_WITH_PAGINATION_CLASS = 'table-viewport-footer-scroll-with-pagination';
const PAGINATION_CLASS = 'table-viewport-footer-pagination';
const SCROLL_HEIGHT = 16;
const PAGINATION_HEIGHT = 52;

function isVisible(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
}

function resolveActiveTable() {
  const tables = [...document.querySelectorAll<HTMLElement>('.ant-table-wrapper')]
    .filter((table) => isVisible(table))
    .filter((table) => table.querySelector('.ant-table-sticky-scroll, .ant-pagination'));

  if (!tables.length) return null;

  return tables.find((table) => {
    const rect = table.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < window.innerHeight;
  }) ?? tables[0];
}

function resetElement(element: HTMLElement) {
  element.classList.remove(SCROLL_CLASS, SCROLL_WITH_PAGINATION_CLASS, PAGINATION_CLASS);
  element.style.removeProperty('left');
  element.style.removeProperty('width');
}

/**
 * Keeps the active table's horizontal scrollbar and pagination in one fixed
 * viewport footer without replacing Ant Design's own pagination behavior.
 */
export function TableViewportFooter() {
  const footerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame: number | undefined;
    let observedTable: HTMLElement | null = null;
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => scheduleSync());

    const sync = () => {
      frame = undefined;

      document.querySelectorAll<HTMLElement>(`.${SCROLL_CLASS}, .${PAGINATION_CLASS}`).forEach(resetElement);

      const table = resolveActiveTable();
      const footer = footerRef.current;
      if (!table || !footer) {
        footer?.classList.remove('is-active');
        resizeObserver?.disconnect();
        observedTable = null;
        return;
      }

      if (observedTable !== table) {
        resizeObserver?.disconnect();
        resizeObserver?.observe(table);
        observedTable = table;
      }

      const scrollBody = table.querySelector<HTMLElement>('.ant-table-body, .ant-table-content') ?? table;
      const rect = scrollBody.getBoundingClientRect();
      const left = Math.max(0, rect.left);
      const width = Math.max(0, Math.min(rect.width, window.innerWidth - left));
      const scroll = table.querySelector<HTMLElement>('.ant-table-sticky-scroll');
      const pagination = table.querySelector<HTMLElement>('.ant-pagination');
      const footerHeight = pagination ? SCROLL_HEIGHT + PAGINATION_HEIGHT : scroll ? SCROLL_HEIGHT : 0;

      footer.classList.toggle('is-active', footerHeight > 0);
      footer.style.left = `${left}px`;
      footer.style.width = `${width}px`;
      footer.style.height = `${footerHeight}px`;

      if (scroll) {
        scroll.classList.add(SCROLL_CLASS);
        scroll.classList.toggle(SCROLL_WITH_PAGINATION_CLASS, Boolean(pagination));
        scroll.style.left = `${left}px`;
        scroll.style.width = `${width}px`;
      }

      if (pagination) {
        pagination.classList.add(PAGINATION_CLASS);
        pagination.style.left = `${left}px`;
        pagination.style.width = `${width}px`;
      }
    };

    const scheduleSync = () => {
      if (frame !== undefined) return;
      frame = window.requestAnimationFrame(sync);
    };

    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', scheduleSync, true);
    window.addEventListener('resize', scheduleSync);
    scheduleSync();

    return () => {
      observer.disconnect();
      resizeObserver?.disconnect();
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scheduleSync, true);
      window.removeEventListener('resize', scheduleSync);
      document.querySelectorAll<HTMLElement>(`.${SCROLL_CLASS}, .${PAGINATION_CLASS}`).forEach(resetElement);
    };
  }, []);

  return <div ref={footerRef} className={FOOTER_CLASS} aria-hidden="true" />;
}
