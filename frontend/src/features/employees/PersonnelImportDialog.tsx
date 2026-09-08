import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Button, Modal, Radio, Space, Table, Typography, Upload } from 'antd';
import type { UploadProps } from 'antd';
import type { EmployeeImportResult } from '@hr-demo/shared';
import { useState } from 'react';
import { downloadEmployeeImportTemplate, importEmployeesFile } from './api';

interface PersonnelImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function PersonnelImportDialog({ open, onClose, onImported }: PersonnelImportDialogProps) {
  const [format, setFormat] = useState<'XLSX' | 'CSV'>('XLSX');
  const [downloading, setDownloading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<EmployeeImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const downloadTemplate = async () => {
    setDownloading(true);
    try {
      await downloadEmployeeImportTemplate(format);
    } finally {
      setDownloading(false);
    }
  };

  const uploadProps: UploadProps = {
    accept: '.xlsx,.csv',
    showUploadList: false,
    beforeUpload: async (file) => {
      const extension = file.name.split('.').pop()?.toLocaleLowerCase();
      if (extension !== 'xlsx' && extension !== 'csv') {
        setError('仅支持 .xlsx 或 .csv 文件');
        return Upload.LIST_IGNORE;
      }
      setImporting(true);
      setError(null);
      try {
        const nextResult = await importEmployeesFile(file as File);
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
      title="导入人员数据"
      open={open}
      onCancel={onClose}
      destroyOnHidden
      footer={<Button onClick={onClose}>关闭</Button>}
    >
      <Typography.Paragraph type="secondary">
请使用下载模板中的中文业务表头（例如“工号、姓名、部门”）。除完整确认的旧“全部在职”导出列外，系统不猜测外部字段含义；旧导出中的 parent_Birthplace、parent_RegistAddress、parent_HomeAddress 分别导入籍贯详细说明、户籍详细地址、联系详细地址。籍贯地区、户籍所在地地区、联系地址地区请填写完整中文层级（例如“湖北省 / 武汉市 / 洪山区”），不填写数字编号。工号已存在时只更新文件中有值的字段，未填写的字段保持原值。导入不使用页面新增人员或补建任职的必填规则：新工号始终创建主档；当来源能匹配部门并提供用工形式时，会保存任职周期和部门任职，入职日期、雇佣关系及人员状态等缺失字段保留为空或采用已有安全默认值；不满足数据库固有字段要求的任职或独立关系会在结果中提示，但不会阻止同一行其他字段保存。工作地点按输入文本直接保存；职位仅填写确认的职位名称，未匹配只提示；全日制公司和直线经理仅在能唯一匹配已有目录/员工且员工已有任职周期时关联。证件、紧急联系人和教育经历均按文件中已提供的字段保存，其他字段可以为空；无有效经理、部门等关联对象时只提示该关联字段。累计工龄（年）按导入基数保存，之后新增的工作履历按日期继续累加。
      </Typography.Paragraph>
      <Space direction="vertical" size={16}>
        <Radio.Group
          value={format}
          onChange={(event) => setFormat(event.target.value)}
          options={[
            { value: 'XLSX', label: 'XLSX' },
            { value: 'CSV', label: 'CSV' },
          ]}
        />
        <Button icon={<DownloadOutlined />} loading={downloading} onClick={downloadTemplate}>下载导入模板</Button>
        <Upload {...uploadProps}>
          <Button icon={<UploadOutlined />} loading={importing}>上传并导入</Button>
        </Upload>
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
                  { title: '行号', dataIndex: 'rowNumber', width: 80 },
                  { title: '工号', dataIndex: 'employeeNo', width: 150, render: (value) => value ?? '--' },
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
