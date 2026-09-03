import { App as AntApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { TableColumnResizer } from '../components/TableColumnResizer';
import { AppRouter } from './router';

export function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#05aaaf',
          colorInfo: '#05aaaf',
          colorLink: '#04969b',
          colorBgLayout: '#f5f8f8',
          colorText: '#243742',
          colorTextSecondary: '#71808a',
          borderRadius: 6,
          borderRadiusLG: 10,
          fontFamily: '"Noto Sans SC", "Microsoft YaHei UI", "Microsoft YaHei", system-ui, sans-serif',
        },
        components: {
          Layout: { siderBg: '#ffffff', headerBg: '#ffffff' },
          Menu: {
            itemBorderRadius: 7,
            itemHeight: 40,
            itemMarginInline: 0,
            itemMarginBlock: 0,
            itemSelectedBg: '#05aaaf',
            itemSelectedColor: '#ffffff',
            itemColor: '#3e454b',
            itemHoverBg: '#f0fbfb',
            itemHoverColor: '#24313d',
            subMenuItemBg: '#ffffff',
          },
          Button: { controlHeight: 36 },
          Input: { controlHeight: 36 },
          Select: { controlHeight: 36 },
          Table: { headerBg: '#f6f8fa', headerColor: '#465966' },
          Card: { headerFontSize: 16 },
        },
      }}
    >
      <AntApp>
        <TableColumnResizer />
        <AppRouter />
      </AntApp>
    </ConfigProvider>
  );
}
