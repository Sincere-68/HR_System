import { MinusSquareOutlined, PlusSquareOutlined, SearchOutlined } from '@ant-design/icons';
import { Input, TreeSelect, type TreeSelectProps } from 'antd';
import type { DataNode } from 'rc-tree-select/lib/interface';
import { useMemo, useState } from 'react';

export interface OrganizationTreeEntry {
  id: string;
  name: string;
  parentId?: string | null;
}

export interface OrganizationTreeNode extends DataNode {
  key: string;
  value: string;
  title: string;
  children?: OrganizationTreeNode[];
  selectable?: boolean;
}

type OrganizationTreeSelectProps = Omit<
  TreeSelectProps<string, OrganizationTreeNode>,
  | 'filterTreeNode'
  | 'onSearch'
  | 'popupRender'
  | 'showSearch'
  | 'treeData'
  | 'treeDefaultExpandedKeys'
  | 'treeExpandedKeys'
  | 'onTreeExpand'
> & {
  organizations: OrganizationTreeEntry[];
};

function createOrganizationNode(
  organization: OrganizationTreeEntry,
  childrenByParentId: Map<string, OrganizationTreeEntry[]>,
  lineage: ReadonlySet<string>,
): OrganizationTreeNode {
  const nextLineage = new Set(lineage);
  nextLineage.add(organization.id);
  const children = (childrenByParentId.get(organization.id) ?? [])
    .filter((child) => !nextLineage.has(child.id))
    .map((child) => createOrganizationNode(child, childrenByParentId, nextLineage));

  return {
    key: organization.id,
    value: organization.id,
    title: organization.name,
    ...(children.length > 0 ? { children } : {}),
  };
}

/** Converts the flat organization API response into a selectable hierarchy. */
export function buildOrganizationTreeData(organizations: OrganizationTreeEntry[]): OrganizationTreeNode[] {
  const organizationIds = new Set(organizations.map(({ id }) => id));
  const childrenByParentId = new Map<string, OrganizationTreeEntry[]>();
  const roots: OrganizationTreeEntry[] = [];

  organizations.forEach((organization) => {
    if (!organization.parentId || !organizationIds.has(organization.parentId) || organization.parentId === organization.id) {
      roots.push(organization);
      return;
    }
    const children = childrenByParentId.get(organization.parentId) ?? [];
    children.push(organization);
    childrenByParentId.set(organization.parentId, children);
  });

  const treeRoots = roots.map((organization) => createOrganizationNode(organization, childrenByParentId, new Set()));
  const includedIds = new Set<string>();
  const collectIds = (nodes: OrganizationTreeNode[]) => {
    nodes.forEach((node) => {
      includedIds.add(node.value);
      if (node.children) collectIds(node.children);
    });
  };
  collectIds(treeRoots);

  // Bad historical parent links must not hide a department from the picker.
  organizations.forEach((organization) => {
    if (!includedIds.has(organization.id)) {
      const orphanTree = createOrganizationNode(organization, childrenByParentId, new Set());
      treeRoots.push(orphanTree);
      collectIds([orphanTree]);
    }
  });

  return treeRoots;
}

function filterTreeNodes(nodes: OrganizationTreeNode[], keyword: string): OrganizationTreeNode[] {
  const normalizedKeyword = keyword.trim().toLocaleLowerCase();
  if (!normalizedKeyword) return nodes;

  return nodes.flatMap((node) => {
    const children = node.children ? filterTreeNodes(node.children, normalizedKeyword) : [];
    const matches = node.title.toLocaleLowerCase().includes(normalizedKeyword);
    if (!matches && children.length === 0) return [];
    return [{ ...node, ...(children.length > 0 ? { children } : {}) }];
  });
}

function getExpandedKeys(nodes: OrganizationTreeNode[]) {
  const keys: string[] = [];
  const visit = (currentNodes: OrganizationTreeNode[]) => {
    currentNodes.forEach((node) => {
      if (node.children?.length) {
        keys.push(node.key);
        visit(node.children);
      }
    });
  };
  visit(nodes);
  return keys;
}

export function OrganizationTreeSelect({
  organizations,
  popupClassName,
  onOpenChange,
  ...props
}: OrganizationTreeSelectProps) {
  const [searchValue, setSearchValue] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const treeData = useMemo(() => buildOrganizationTreeData(organizations), [organizations]);
  const visibleTreeData = useMemo(
    () => filterTreeNodes(treeData, searchValue),
    [treeData, searchValue],
  );
  const visibleExpandedKeys = searchValue ? getExpandedKeys(visibleTreeData) : expandedKeys;

  return (
    <TreeSelect<string, OrganizationTreeNode>
      {...props}
      className={`organization-tree-select${props.className ? ` ${props.className}` : ''}`}
      classNames={{
        ...props.classNames,
        popup: {
          ...props.classNames?.popup,
          root: `organization-tree-select-popup${popupClassName ? ` ${popupClassName}` : ''}`,
        },
      }}
      listHeight={480}
      virtual={false}
      treeData={visibleTreeData}
      treeExpandedKeys={visibleExpandedKeys}
      treeLine={false}
      treeIcon={false}
      switcherIcon={(nodeProps: { expanded?: boolean }) => (
        nodeProps.expanded ? <MinusSquareOutlined /> : <PlusSquareOutlined />
      )}
      onTreeExpand={(keys) => setExpandedKeys(keys.map(String))}
      onOpenChange={(open) => {
        if (!open) setSearchValue('');
        onOpenChange?.(open);
      }}
      popupRender={(menu) => (
        <div className="organization-tree-popup-content">
          <Input
            aria-label="搜索部门"
            className="organization-tree-search"
            prefix={<SearchOutlined />}
            placeholder="搜索"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
          />
          {menu}
        </div>
      )}
    />
  );
}
