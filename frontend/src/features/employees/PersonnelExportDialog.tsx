import { DownloadOutlined } from '@ant-design/icons';
import {
  Button,
  Checkbox,
  Divider,
  Modal,
  Radio,
  Space,
  Typography,
} from 'antd';
import {
  PERSONNEL_FIELDS,
  type EmployeeListQuery,
  type PersonnelTransferFieldKey,
  type PersonnelTransferFormat,
} from '@hr-demo/shared';
import { useEffect, useMemo, useState } from 'react';
import { downloadEmployeeExport } from './api';

const exportableFields = PERSONNEL_FIELDS;

interface PersonnelExportDialogProps {
  open: boolean;
  selectedEmployeeIds: string[];
  query: Pick<EmployeeListQuery, 'name' | 'organizationId' | 'status' | 'employmentRelationship'>;
  onClose: () => void;
}

export function PersonnelExportDialog({
  open,
  selectedEmployeeIds,
  query,
  onClose,
}: PersonnelExportDialogProps) {
  const [fields, setFields] = useState<PersonnelTransferFieldKey[]>(
    exportableFields.map(({ key }) => key),
  );
  const [format, setFormat] = useState<PersonnelTransferFormat>('XLSX');
  const [exporting, setExporting] = useState(false);
  const allFieldKeys = useMemo(() => exportableFields.map(({ key }) => key), []);

  useEffect(() => {
    if (open) setFields(allFieldKeys);
  }, [allFieldKeys, open]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadEmployeeExport({
        format,
        fields,
        ...(selectedEmployeeIds.length > 0 ? { employeeIds: selectedEmployeeIds } : { query }),
      });
      onClose();
    } finally {
      setExporting(false);
    }
  };

  const exportingSelected = selectedEmployeeIds.length > 0;
  return (
    <Modal
      title="导出人员数据"
      open={open}
      onCancel={onClose}
      destroyOnHidden
      footer={(
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            disabled={fields.length === 0}
            loading={exporting}
            onClick={handleExport}
          >
            导出
          </Button>
        </Space>
      )}
    >
      <Typography.Paragraph type="secondary">
        {exportingSelected
          ? `将导出已勾选的 ${selectedEmployeeIds.length} 名人員。`
          : '当前未勾选人员，将导出当前筛选条件下的全部人员。'}
      </Typography.Paragraph>
      <div className="personnel-export-format">
        <Typography.Text strong>文件格式</Typography.Text>
        <Radio.Group
          value={format}
          onChange={(event) => setFormat(event.target.value)}
          options={[
            { value: 'XLSX', label: 'XLSX' },
            { value: 'CSV', label: 'CSV' },
          ]}
        />
      </div>
      <Divider />
      <div className="personnel-export-field-heading">
        <Typography.Text strong>导出字段</Typography.Text>
        <Space size={4}>
          <Button type="link" size="small" onClick={() => setFields(allFieldKeys)}>全选</Button>
          <Button type="link" size="small" onClick={() => setFields([])}>清空</Button>
        </Space>
      </div>
      <Checkbox.Group
        className="personnel-export-fields"
        value={fields}
        onChange={(values) => setFields(values as PersonnelTransferFieldKey[])}
        options={exportableFields.map(({ key, title }) => ({ value: key, label: title }))}
      />
    </Modal>
  );
}
