import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
    root: 'src',
    base: './',
    build: {
        outDir: '../dist',
        emptyOutDir: true
    },
    plugins: [viteSingleFile()],
    worker: {
        format: 'es'
    }
});
