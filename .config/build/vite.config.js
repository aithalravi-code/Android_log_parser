import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

export default defineConfig({
    root: path.resolve(projectRoot, 'Production/src'),

    build: {
        outDir: path.resolve(projectRoot, 'Production/dist'),
        emptyOutDir: true,
        rollupOptions: {
            output: {
                manualChunks: undefined
            },
            input: path.resolve(projectRoot, 'Production/src/log_parser.html')
        }
    },

    plugins: [viteSingleFile()],

    server: {
        port: 5173,
        strictPort: true,
        host: true
    },

    resolve: {
        alias: {
            '@': path.resolve(projectRoot, 'Production/src')
        }
    }
});
