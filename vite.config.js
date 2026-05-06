import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages のリポジトリ名に合わせて変更してください
  // 例: リポジトリ名が "family-tree" なら '/family-tree/'
  base: '/flamily_tree2/',
});
