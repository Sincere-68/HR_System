import { useEffect } from 'react';

const HANDLE_CLASS = 'table-column-resize-handle';
const RESIZABLE_HEADER_CLASS = 'table-column-resizable';
const RESIZING_BODY_CLASS = 'table-column-resizing';
const MIN_COLUMN_WIDTH = 72;

interface ActiveResize {
  header: HTMLTableCellElement;
  initialPointerX: number;
  initialWidth: number;
  storageKey: string;
}

function isResizableHeader(header: HTMLTableCellElement) {
  return header.colSpan <= 1
    && !header.classList.contains('ant-table-selection-column')
    && !header.classList.contains('ant-table-row-expand-icon-cell');
}

function getStorageKey(header: HTMLTableCellElement) {
  const table = header.closest('table');
  const headers = [...(table?.querySelectorAll<HTMLTableCellElement>('thead > tr:last-child > th') ?? [])];
  const signature = headers.map((item) => item.textContent?.replace(/\s+/g, ' ').trim() || '_').join('|');
  return `hr-demo:table-width:${window.location.pathname}:${signature}:${header.cellIndex}`;
}

function applyColumnWidth(header: HTMLTableCellElement, width: number) {
  const table = header.closest('table');
  const container = table?.closest('.ant-table-container') ?? table;
  if (!container) return;

  const columnIndex = header.cellIndex;
  const widthValue = `${Math.round(width)}px`;
  header.style.width = widthValue;
  header.style.minWidth = widthValue;

  container.querySelectorAll<HTMLTableElement>('table').forEach((relatedTable) => {
    const column = relatedTable.querySelectorAll<HTMLTableColElement>('colgroup > col').item(columnIndex);
    if (!column) return;
    column.style.width = widthValue;
    column.style.minWidth = widthValue;
  });
}

function readStoredWidth(storageKey: string) {
  try {
    const width = Number(window.localStorage.getItem(storageKey));
    return Number.isFinite(width) && width >= MIN_COLUMN_WIDTH ? width : undefined;
  } catch {
    return undefined;
  }
}

function storeWidth(storageKey: string, width: number) {
  try {
    window.localStorage.setItem(storageKey, String(Math.round(width)));
  } catch {
    // Local storage may be disabled; resizing still works for the current page.
  }
}

function addResizeHandles() {
  document.querySelectorAll<HTMLTableCellElement>('.ant-table-wrapper .ant-table-thead > tr > th').forEach((header) => {
    if (!isResizableHeader(header)) return;
    header.classList.add(RESIZABLE_HEADER_CLASS);

    if (![...header.children].some((child) => child.classList.contains(HANDLE_CLASS))) {
      const handle = document.createElement('span');
      handle.className = HANDLE_CLASS;
      handle.setAttribute('aria-hidden', 'true');
      handle.title = '拖动调整列宽';
      header.append(handle);
    }

    const storageKey = getStorageKey(header);
    const storedWidth = readStoredWidth(storageKey);
    if (storedWidth && header.style.width !== `${Math.round(storedWidth)}px`) {
      applyColumnWidth(header, storedWidth);
    }
  });
}

/** Adds a consistent drag-to-resize affordance to every Ant Design data table. */
export function TableColumnResizer() {
  useEffect(() => {
    let activeResize: ActiveResize | undefined;

    // rc-table renders its synced scrollbar after the body. Promote it to a
    // viewport bar so wide tables remain horizontally usable while their
    // rows continue below the current screen.
    const positionStickyScrollbars = () => {
      document.querySelectorAll<HTMLElement>('.ant-table-sticky-scroll').forEach((bar) => {
        const wrapper = bar.closest<HTMLElement>('.ant-table-wrapper');
        const body = wrapper?.querySelector<HTMLElement>('.ant-table-body, .ant-table-content');
        if (!body) return;

        const rect = body.getBoundingClientRect();
        const left = Math.max(0, rect.left);
        const width = Math.max(0, Math.min(rect.width, window.innerWidth - left));
        bar.style.position = 'fixed';
        bar.style.left = `${left}px`;
        bar.style.width = `${width}px`;
        bar.style.bottom = '0px';
        bar.style.zIndex = '20';
      });
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !(event.target instanceof Element)) return;
      const handle = event.target.closest<HTMLElement>(`.${HANDLE_CLASS}`);
      const header = handle?.parentElement;
      if (!handle || !(header instanceof HTMLTableCellElement)) return;

      event.preventDefault();
      event.stopPropagation();
      activeResize = {
        header,
        initialPointerX: event.clientX,
        initialWidth: Math.max(header.getBoundingClientRect().width, MIN_COLUMN_WIDTH),
        storageKey: getStorageKey(header),
      };
      document.body.classList.add(RESIZING_BODY_CLASS);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!activeResize) return;
      const width = Math.max(
        MIN_COLUMN_WIDTH,
        activeResize.initialWidth + event.clientX - activeResize.initialPointerX,
      );
      applyColumnWidth(activeResize.header, width);
    };

    const onPointerUp = () => {
      if (!activeResize) return;
      storeWidth(activeResize.storageKey, activeResize.header.getBoundingClientRect().width);
      activeResize = undefined;
      document.body.classList.remove(RESIZING_BODY_CLASS);
    };

    const onHandleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(`.${HANDLE_CLASS}`)) return;
      event.preventDefault();
      event.stopPropagation();
    };

    addResizeHandles();
    const observer = new MutationObserver(() => {
      addResizeHandles();
      positionStickyScrollbars();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    positionStickyScrollbars();
    window.addEventListener('scroll', positionStickyScrollbars, true);
    window.addEventListener('resize', positionStickyScrollbars);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('click', onHandleClick, true);

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', positionStickyScrollbars, true);
      window.removeEventListener('resize', positionStickyScrollbars);
      document.body.classList.remove(RESIZING_BODY_CLASS);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('click', onHandleClick, true);
    };
  }, []);

  return null;
}
