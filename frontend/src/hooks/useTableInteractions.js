import { useState } from 'react';

export function useTableInteractions() {
  const [tableViewState, setTableViewState] = useState({});

  const getTableState = (key) =>
    tableViewState[key] ?? { collapsed: false, expanded: false };

  const updateTableState = (key, updater) => {
    setTableViewState((previous) => {
      const current = previous[key] ?? { collapsed: false, expanded: false };
      const next = updater(current);
      return {
        ...previous,
        [key]: next
      };
    });
  };

  const toggleTableCollapse = (key) => {
    updateTableState(key, (state) => {
      const collapsed = !state.collapsed;
      return {
        collapsed,
        expanded: collapsed ? false : state.expanded
      };
    });
  };

  const toggleTableExpand = (key) => {
    updateTableState(key, (state) => {
      const expanded = !state.expanded;
      return {
        expanded,
        collapsed: expanded ? false : state.collapsed
      };
    });
  };

  return {
    getTableState,
    toggleTableCollapse,
    toggleTableExpand,
  };
}