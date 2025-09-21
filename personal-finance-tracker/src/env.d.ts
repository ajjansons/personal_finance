/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_STORAGE_PROVIDER?: 'local' | 'cloud';
  readonly VITE_TWELVE_DATA_KEY?: string;
  readonly VITE_COINGECKO_API_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
