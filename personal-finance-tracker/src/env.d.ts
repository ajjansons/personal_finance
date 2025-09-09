/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_STORAGE_PROVIDER?: 'local' | 'cloud';
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

