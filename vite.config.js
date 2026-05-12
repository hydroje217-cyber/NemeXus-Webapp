import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('@supabase')) {
            return 'supabase-vendor';
          }

          if (id.includes('recharts')) {
            return 'charts-vendor';
          }

          if (id.includes('jspdf-autotable')) {
            return 'export-pdf-table';
          }

          if (id.includes('jspdf')) {
            return 'export-pdf';
          }

          if (id.includes('html2canvas')) {
            return 'export-canvas';
          }

          if (id.includes('dompurify')) {
            return 'export-sanitize';
          }

          if (id.includes('jszip')) {
            return 'export-archive';
          }

          return undefined;
        },
      },
    },
  },
});
