import { defineConfig } from 'vite';

// .ehpk として Even App 内から開かれる時もファイルを辿れるよう相対パスで出力する
export default defineConfig({ base: './' });
