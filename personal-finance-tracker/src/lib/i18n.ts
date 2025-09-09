const en = {
  dashboard: 'Dashboard',
  holdings: 'Holdings',
  categories: 'Categories',
  settings: 'Settings'
} as const;

type Dict = typeof en;
type Key = keyof Dict;

export function t(key: Key): string {
  return en[key];
}

