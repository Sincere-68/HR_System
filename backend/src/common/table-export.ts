import ExcelJS from 'exceljs';
import { BadRequestException } from '@nestjs/common';

export interface TableExportField {
  key: string;
  title: string;
}

export interface TableExportFile {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

/** Generates an XLSX or UTF-8 CSV file from page-specific confirmed fields. */
export async function createTableExport(
  rows: object[],
  requestedFields: string[],
  availableFields: readonly TableExportField[],
  format: 'XLSX' | 'CSV',
  filenamePrefix: string,
): Promise<TableExportFile> {
  const fields = requestedFields.map((key) => {
    const field = availableFields.find((candidate) => candidate.key === key);
    if (!field) throw new BadRequestException(`不支持导出字段：${key}`);
    return field;
  });
  const values = rows.map((row) => fields.map(({ key }) => displayValue((row as Record<string, unknown>)[key])));
  const extension = format === 'XLSX' ? 'xlsx' : 'csv';
  const filename = `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.${extension}`;

  if (format === 'CSV') {
    const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const csv = [
      fields.map(({ title }) => quote(title)).join(','),
      ...values.map((row) => row.map(quote).join(',')),
    ].join('\r\n');
    return {
      buffer: Buffer.from(`﻿${csv}`, 'utf8'),
      filename,
      contentType: 'text/csv; charset=utf-8',
    };
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('导出数据');
  worksheet.addRow(fields.map(({ title }) => title));
  values.forEach((row) => worksheet.addRow(row));
  worksheet.getRow(1).font = { bold: true };
  worksheet.columns.forEach((column, index) => {
    column.width = Math.min(36, Math.max(12, fields[index]?.title.length ?? 12));
  });
  return {
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    filename,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}
