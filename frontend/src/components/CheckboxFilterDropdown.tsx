import { DownOutlined } from '@ant-design/icons';
import { Button, Checkbox, Dropdown } from 'antd';

export interface CheckboxFilterOption {
  label: string;
  value: string;
}

interface CheckboxFilterDropdownProps {
  label: string;
  options: CheckboxFilterOption[];
  value: string[];
  onChange: (values: string[]) => void;
}

export function CheckboxFilterDropdown({ label, options, value, onChange }: CheckboxFilterDropdownProps) {
  return (
    <Dropdown
      trigger={['click']}
      popupRender={() => (
        <div className="checkbox-filter-menu">
          <Checkbox.Group
            options={options}
            value={value}
            onChange={(values) => onChange(values as string[])}
          />
        </div>
      )}
    >
      <Button className="checkbox-filter-trigger" type="text">
        {label}<DownOutlined />
      </Button>
    </Dropdown>
  );
}
