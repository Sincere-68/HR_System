export interface EmployingCompanyCatalogEntry {
  code: string;
  name: string;
  sortOrder: number;
}

/** Legal entities eligible to be selected as a full-time employing company. */
export const EMPLOYING_COMPANY_CATALOG: readonly EmployingCompanyCatalogEntry[] = [
  { code: 'COMPANY_001', name: '北京严真网络技术有限公司', sortOrder: 1 },
  { code: 'COMPANY_002', name: '北京商路同达广告有限公司', sortOrder: 2 },
  { code: 'COMPANY_003', name: '北京宜信科创技术有限公司', sortOrder: 3 },
  { code: 'COMPANY_004', name: '上海宜信商智人工智能科技有限公司北京分公司', sortOrder: 4 },
  { code: 'COMPANY_005', name: '上海张裕宜信数字科技有限公司北京分公司', sortOrder: 5 },
  { code: 'COMPANY_006', name: '上海宜信电子商务有限公司', sortOrder: 6 },
  { code: 'COMPANY_007', name: '上海宜信商智人工智能科技有限公司', sortOrder: 7 },
  { code: 'COMPANY_008', name: '天津宜信电子商务有限公司', sortOrder: 8 },
  { code: 'COMPANY_009', name: '北京宜信科创技术有限公司杭州分公司', sortOrder: 9 },
  { code: 'COMPANY_010', name: '北京宜信科创技术有限公司固安分公司', sortOrder: 10 },
  { code: 'COMPANY_011', name: '北京宜信科创技术有限公司杭州分公司-南京', sortOrder: 11 },
  { code: 'COMPANY_012', name: '北京宜信科创技术有限公司杭州分公司-广州', sortOrder: 12 },
  { code: 'COMPANY_013', name: '北京宜信智能科技有限公司', sortOrder: 13 },
  { code: 'COMPANY_014', name: '上海宜信鲜汇电子商务有限公司', sortOrder: 14 },
  { code: 'COMPANY_015', name: '兴良汇（北京）贸易发展有限公司', sortOrder: 15 },
  { code: 'COMPANY_016', name: '天津宜信鲜汇电子商务有限公司', sortOrder: 16 },
  { code: 'COMPANY_017', name: '天津宜信智能科技有限公司北京分公司', sortOrder: 17 },
  { code: 'COMPANY_018', name: '上海宜信名汇电子商务有限公司', sortOrder: 18 },
  { code: 'COMPANY_019', name: '北京商路同达广告有限公司南京分公司', sortOrder: 19 },
  { code: 'COMPANY_020', name: '北京宜信科创技术有限公司杭州分公司-深圳', sortOrder: 20 },
  { code: 'COMPANY_021', name: '上海张裕宜信数字科技有限公司', sortOrder: 21 },
  { code: 'COMPANY_022', name: 'ADVINSYS PTY LIMITED', sortOrder: 22 },
  { code: 'COMPANY_023', name: '宜信电商有限公司', sortOrder: 23 },
  { code: 'COMPANY_024', name: '上海宜信商智人工智能科技有限公司深圳分公司', sortOrder: 24 },
  { code: 'COMPANY_025', name: '上海心术通识科技有限公司', sortOrder: 25 },
  { code: 'COMPANY_026', name: '上海心术通识科技有限公司北京分公司', sortOrder: 26 },
  { code: 'COMPANY_027', name: '上海心术通识科技有限公司杭州分公司', sortOrder: 27 },
];
