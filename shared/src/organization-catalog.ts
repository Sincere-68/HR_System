export interface OrganizationCatalogEntry {
  code: string;
  name: string;
  parentCode: string | null;
  sortOrder: number;
}

/**
 * The fictional four-level organization tree used by the local demo and seed.
 * The former "组织架构" heading and legacy demo departments are deliberately
 * not represented as organization nodes.
 */
export const ORGANIZATION_CATALOG = [
  { code: 'COMPANY_SHANGHAI_YIXIN', name: '上海宜信电子商务有限公司', parentCode: null, sortOrder: 1 },
  { code: 'CEO_CHEN_RUI', name: 'CEO陈锐', parentCode: 'COMPANY_SHANGHAI_YIXIN', sortOrder: 1 },
  { code: 'CHAIRMAN_CHEN_GANG', name: '董事长陈钢', parentCode: 'COMPANY_SHANGHAI_YIXIN', sortOrder: 2 },

  { code: 'CEO_SECOND_DEPARTMENT', name: '二部', parentCode: 'CEO_CHEN_RUI', sortOrder: 1 },
  { code: 'CEO_SECOND_TMALL_SUPERMARKET', name: '二部天猫超市组', parentCode: 'CEO_SECOND_DEPARTMENT', sortOrder: 1 },
  { code: 'CEO_SECOND_TMALL_RETAIL', name: '二部天猫零售组', parentCode: 'CEO_SECOND_DEPARTMENT', sortOrder: 2 },
  { code: 'CEO_SECOND_CONTENT', name: '二部内容组', parentCode: 'CEO_SECOND_DEPARTMENT', sortOrder: 3 },
  { code: 'CEO_FOURTH_DEPARTMENT', name: '四部', parentCode: 'CEO_CHEN_RUI', sortOrder: 2 },
  { code: 'CEO_FOURTH_SALES', name: '四部销售业务组', parentCode: 'CEO_FOURTH_DEPARTMENT', sortOrder: 1 },
  { code: 'CEO_FOURTH_TP', name: '四部TP业务组', parentCode: 'CEO_FOURTH_DEPARTMENT', sortOrder: 2 },
  { code: 'CEO_VISUAL_CREATIVE', name: '视觉创意部', parentCode: 'CEO_CHEN_RUI', sortOrder: 3 },
  { code: 'CEO_STORAGE', name: '储运部', parentCode: 'CEO_CHEN_RUI', sortOrder: 4 },
  { code: 'CEO_BRAND', name: '品牌部', parentCode: 'CEO_CHEN_RUI', sortOrder: 5 },
  { code: 'CEO_BRAND_OPERATIONS', name: '品牌运营组', parentCode: 'CEO_BRAND', sortOrder: 1 },
  { code: 'CEO_BRAND_DATA_ANALYSIS', name: '数据分析组', parentCode: 'CEO_BRAND', sortOrder: 2 },
  { code: 'CEO_BRAND_PRODUCT_DESIGN', name: '产品设计组', parentCode: 'CEO_BRAND', sortOrder: 3 },
  { code: 'CEO_BRAND_ORDER', name: '秩序组', parentCode: 'CEO_BRAND', sortOrder: 4 },
  { code: 'CEO_FIRST_DEPARTMENT', name: '一部', parentCode: 'CEO_CHEN_RUI', sortOrder: 6 },
  { code: 'CEO_FIRST_BAIJIU', name: '白酒组', parentCode: 'CEO_FIRST_DEPARTMENT', sortOrder: 1 },
  { code: 'CEO_FIRST_WINE', name: '葡萄酒洋酒组', parentCode: 'CEO_FIRST_DEPARTMENT', sortOrder: 2 },
  { code: 'CEO_FIRST_MARKETING_USERS', name: '营销用户组', parentCode: 'CEO_FIRST_DEPARTMENT', sortOrder: 3 },
  { code: 'CEO_PROMOTION', name: '推广部', parentCode: 'CEO_CHEN_RUI', sortOrder: 7 },
  { code: 'CEO_PROMOTION_TMALL', name: '推广天猫组', parentCode: 'CEO_PROMOTION', sortOrder: 1 },
  { code: 'CEO_PROMOTION_JD', name: '推广京东组', parentCode: 'CEO_PROMOTION', sortOrder: 2 },
  { code: 'CEO_HR_ADMIN_HR_TEAM', name: '人力行政部人力团队', parentCode: 'CEO_CHEN_RUI', sortOrder: 8 },
  { code: 'CEO_HR_ADMIN_ADMIN_TEAM', name: '人力行政部行政团队', parentCode: 'CEO_CHEN_RUI', sortOrder: 9 },

  { code: 'CHAIRMAN_THIRD_CROSS_BORDER', name: '三部跨境业务组', parentCode: 'CHAIRMAN_CHEN_GANG', sortOrder: 1 },
  { code: 'CHAIRMAN_FIFTH_DEPARTMENT', name: '五部', parentCode: 'CHAIRMAN_CHEN_GANG', sortOrder: 2 },
  { code: 'CHAIRMAN_SUPPLY_CHAIN', name: '供应链部', parentCode: 'CHAIRMAN_CHEN_GANG', sortOrder: 3 },
  { code: 'CHAIRMAN_SUPPLY_CHAIN_WAREHOUSE', name: '供应链部库控组', parentCode: 'CHAIRMAN_SUPPLY_CHAIN', sortOrder: 1 },
  { code: 'CHAIRMAN_SUPPLY_CHAIN_PROCUREMENT', name: '供应链部采购组', parentCode: 'CHAIRMAN_SUPPLY_CHAIN', sortOrder: 2 },
  { code: 'CHAIRMAN_SUPPLY_CHAIN_DOCUMENT', name: '供应链部制单组', parentCode: 'CHAIRMAN_SUPPLY_CHAIN', sortOrder: 3 },
  { code: 'CHAIRMAN_FINANCE', name: '财务部', parentCode: 'CHAIRMAN_CHEN_GANG', sortOrder: 4 },
  { code: 'CHAIRMAN_CUSTOMER_SERVICE', name: '客服部', parentCode: 'CHAIRMAN_CHEN_GANG', sortOrder: 5 },
  { code: 'CHAIRMAN_IT_TECHNOLOGY', name: '信息技术中心技术团队', parentCode: 'CHAIRMAN_CHEN_GANG', sortOrder: 6 },
  { code: 'CHAIRMAN_IT_PRODUCT', name: '信息技术中心产品团队', parentCode: 'CHAIRMAN_CHEN_GANG', sortOrder: 7 },
  { code: 'CHAIRMAN_SMART_HARDWARE', name: '智能硬件出海业务部', parentCode: 'CHAIRMAN_CHEN_GANG', sortOrder: 8 },
  { code: 'CHAIRMAN_SMART_HARDWARE_AUSTRALIA', name: '智能硬件澳洲业务部', parentCode: 'CHAIRMAN_SMART_HARDWARE', sortOrder: 1 },
  { code: 'CHAIRMAN_SMART_HARDWARE_OPERATIONS', name: '智能硬件运营部', parentCode: 'CHAIRMAN_SMART_HARDWARE', sortOrder: 2 },
  { code: 'CHAIRMAN_SMART_HARDWARE_TECHNOLOGY', name: '智能硬件技术部', parentCode: 'CHAIRMAN_SMART_HARDWARE', sortOrder: 3 },
  { code: 'CHAIRMAN_YUNTUO_CHENGDU', name: '云拓智洁成都', parentCode: 'CHAIRMAN_CHEN_GANG', sortOrder: 9 },
  { code: 'CHAIRMAN_YUNTUO_EAST_CHINA', name: '云拓智洁华东', parentCode: 'CHAIRMAN_CHEN_GANG', sortOrder: 10 },
  { code: 'CHAIRMAN_YUNTUO_BEIJING', name: '云拓智洁北京', parentCode: 'CHAIRMAN_CHEN_GANG', sortOrder: 11 },
  { code: 'CHAIRMAN_IT_SHANGHAI_XINSHU', name: '信息技术中心上海心术', parentCode: 'CHAIRMAN_CHEN_GANG', sortOrder: 12 },
] as const satisfies readonly OrganizationCatalogEntry[];
