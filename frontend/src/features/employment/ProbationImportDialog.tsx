import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Button, Modal, Radio, Space, Table, Typography, Upload } from 'antd';
import type { UploadProps } from 'antd';
import type { ProbationImportResult } from '@hr-demo/shared';
import { useState } from 'react';
import { downloadProbationImportTemplate, importProbationFile } from './api';

interface ProbationImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function ProbationImportDialog({
  open,
  onClose,
  onImported,
}: ProbationImportDialogProps) {
  const [format, setFormat] = useState<'XLSX' | 'CSV'>('XLSX');
  const [downloading, setDownloading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ProbationImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (importing) return;
    setFormat('XLSX');
    setResult(null);
    setError(null);
    onClose();
  };

  const downloadTemplate = async () => {
    setDownloading(true);
    setError(null);
    try {
      await downloadProbationImportTemplate(format);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '下载模板失败');
    } finally {
      setDownloading(false);
    }
  };

  const uploadProps: UploadProps = {
    accept: '.xlsx,.csv',
    showUploadList: false,
    beforeUpload: async (file) => {
      setResult(null);
      const extension = file.name.split('.').pop()?.toLocaleLowerCase();
      if (extension !== 'xlsx' && extension !== 'csv') {
        setError('仅支持 .xlsx 或 .csv 文件');
        return Upload.LIST_IGNORE;
      }
      setImporting(true);
      setError(null);
      try {
        const nextResult = await importProbationFile(file as File);
        setResult(nextResult);
        onImported();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '导入失败');
      } finally {
        setImporting(false);
      }
      return Upload.LIST_IGNORE;
    },
  };

  return (
    <Modal
      title="导入试用记录"
      open={open}
      onCancel={handleClose}
      closable={!importing}
      maskClosable={!importing}
      keyboard={!importing}
      destroyOnHidden
      footer={(
        <Button
          aria-label={result ? '关闭导入对话框' : '取消导入'}
          disabled={importing}
          onClick={handleClose}
        >
          {result ? '关闭' : '取消'}
        </Button>
      )}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Radio.Group
          value={format}
          onChange={(event) => setFormat(event.target.value)}
          options={[
            { value: 'XLSX', label: 'XLSX' },
            { value: 'CSV', label: 'CSV' },
          ]}
        />
        <Space wrap>
          <Button icon={<DownloadOutlined />} loading={downloading} onClick={() => void downloadTemplate()}>
            下载导入模板
          </Button>
          <Upload {...uploadProps}>
            <Button type="primary" icon={<UploadOutlined />} loading={importing}>上传并导入</Button>
          </Upload>
        </Space>
        {error ? <Alert type="error" showIcon message={error} /> : null}
        {result ? (
          <>
            <Typography.Text>
              新增 {result.created} 行，更新 {result.updated} 行，跳过 {result.skipped} 行，失败 {result.failed} 行
            </Typography.Text>
            {result.rows.some(({ action, warnings }) => action === 'FAILED' || warnings?.length) ? (
              <Table
                size="small"
                rowKey="rowNumber"
                pagination={false}
                dataSource={result.rows.filter(({ action, warnings }) => action === 'FAILED' || warnings?.length)}
                columns={[
                  { title: '行号', dataIndex: 'rowNumber', width: 76 },
                  { title: '工号', dataIndex: 'employeeNo', width: 128, render: (value) => value ?? '--' },
                  { title: '错误', dataIndex: 'errors', render: (errors: string[]) => errors.join('；') || '--' },
                  { title: '提示', dataIndex: 'warnings', render: (warnings: string[] | undefined) => warnings?.join('；') ?? '--' },
                ]}
              />
            ) : null}
          </>
        ) : null}
      </Space>
    </Modal>
  );
}
