import { DownloadOutlined } from '@ant-design/icons';
import { Button, Checkbox, Divider, Modal, Radio, Space, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';

export interface TableExportField<T extends string = string> {
  key: T;
  title: string;
}

interface TableExportDialogProps<T extends string> {
  open: boolean;
  title: string;
  fields: readonly TableExportField<T>[];
  selectedRowIds: string[];
  onClose: () => void;
  onExport: (input: { format: 'XLSX' | 'CSV'; fields: T[]; employeeIds?: string[] }) => Promise<void>;
}

export function TableExportDialog<T extends string>({
  open,
  title,
  fields: definitions,
  selectedRowIds,
  onClose,
  onExport,
}: TableExportDialogProps<T>) {
  const allKeys = useMemo(() => definitions.map(({ key }) => key), [definitions]);
  const [fields, setFields] = useState<T[]>(allKeys);
  const [format, setFormat] = useState<'XLSX' | 'CSV'>('XLSX');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (open) setFields(allKeys);
  }, [allKeys, open]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await onExport({ format, fields, ...(selectedRowIds.length ? { employeeIds: selectedRowIds } : {}) });
      onClose();
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      destroyOnHidden
      footer={(
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" icon={<DownloadOutlined />} disabled={!fields.length} loading={exporting} onClick={handleExport}>导出</Button>
        </Space>
      )}
    >
      <Typography.Paragraph type="secondary">
        {selectedRowIds.length ? `将导出已勾选的 ${selectedRowIds.length} 条记录。` : '当前未勾选记录，将导出当前筛选条件下的全部记录。'}
      </Typography.Paragraph>
      <div className="personnel-export-format">
        <Typography.Text strong>文件格式</Typography.Text>
        <Radio.Group
          value={format}
          onChange={(event) => setFormat(event.target.value)}
          options={[{ value: 'XLSX', label: 'XLSX' }, { value: 'CSV', label: 'CSV' }]}
        />
      </div>
      <Divider />
      <div className="personnel-export-field-heading">
        <Typography.Text strong>导出字段</Typography.Text>
        <Space size={4}>
          <Button type="link" size="small" onClick={() => setFields(allKeys)}>全选</Button>
          <Button type="link" size="small" onClick={() => setFields([])}>清空</Button>
        </Space>
      </div>
      <Checkbox.Group
        className="personnel-export-fields"
        value={fields}
        onChange={(values) => setFields(values as T[])}
        options={definitions.map(({ key, title: fieldTitle }) => ({ value: key, label: fieldTitle }))}
      />
    </Modal>
  );
}
