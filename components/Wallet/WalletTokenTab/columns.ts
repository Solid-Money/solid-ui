import { Column } from './types';

// Fixed percentage-based column widths - no JavaScript measurement needed
export const DESKTOP_COLUMNS: Column[] = [
  { key: 'asset', label: 'Asset', width: '35%' },
  { key: 'balance', label: 'Balance', width: '35%' },
  { key: 'price', label: 'Price', width: '30%' },
  // { key: 'action', label: '', width: '15%' },
];
