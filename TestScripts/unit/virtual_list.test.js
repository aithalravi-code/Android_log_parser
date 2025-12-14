import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderVirtualList } from '../../Production/src/ui/components/VirtualList.js';

describe('VirtualList Component', () => {
    let container, sizer, viewport;
    let mockLines;

    beforeEach(() => {
        // Setup DOM mocks
        document.body.innerHTML = `
            <div id="container" style="height: 500px; overflow-y: auto;">
                <div id="sizer"></div>
                <div id="viewport"></div>
            </div>
        `;
        container = document.getElementById('container');
        sizer = document.getElementById('sizer');
        viewport = document.getElementById('viewport');

        // Mock data
        mockLines = [
            { lineNumber: 1, timestamp: '10:00:00.000', level: 'D', tag: 'TestTag', message: 'Debug message 1', originalText: 'Full Line 1' },
            { lineNumber: 2, timestamp: '10:00:01.000', level: 'I', tag: 'TestTag', message: 'Info message 2', originalText: 'Full Line 2' },
            { isMeta: true, text: '--- Log Start ---', originalText: '--- Log Start ---' },
            { lineNumber: 4, timestamp: '10:00:02.000', level: 'E', tag: 'ErrorTag', message: 'Error! Something went wrong', originalText: 'Full Line 4' },
            { lineNumber: 5, timestamp: '10:00:03.000', level: 'D', tag: 'CCC', message: 'Sending CCC Packet', originalText: 'CCC Line', cccMessage: { type: 1, subtype: 0 } }
        ];

        // Mock clientHeight/scrollTop since JSDOM doesn't handle layout
        Object.defineProperty(container, 'clientHeight', { value: 500 });
        Object.defineProperty(container, 'scrollTop', { value: 0, writable: true });
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should result in empty viewport if no lines provided', () => {
        renderVirtualList(container, sizer, viewport, [], new Set());
        expect(viewport.innerHTML).toBe('');
        expect(sizer.style.height).toBe('0px');
    });

    it('should render visible lines', () => {
        renderVirtualList(container, sizer, viewport, mockLines, new Set());

        // Check if rows are rendered
        const rows = viewport.querySelectorAll('.log-line');
        expect(rows.length).toBe(mockLines.length);

        // Verify content of first line
        const firstRow = rows[0];
        expect(firstRow.textContent).toContain('Debug message 1');
        expect(firstRow.textContent).toContain('TestTag');
        expect(firstRow.querySelector('.log-level-D')).not.toBeNull();
    });

    it('should render meta lines correctly', () => {
        renderVirtualList(container, sizer, viewport, mockLines, new Set());
        const metaRow = viewport.querySelector('.log-line-meta');
        expect(metaRow).not.toBeNull();
        expect(metaRow.textContent).toContain('[-] --- Log Start ---'); // collapsed state indicator default
    });

    it('should add ccc-line class for CCC messages', () => {
        renderVirtualList(container, sizer, viewport, mockLines, new Set());
        const cccRow = viewport.querySelector('.ccc-line');
        expect(cccRow).not.toBeNull();
        expect(cccRow.textContent).toContain('Sending CCC Packet');
    });

    it('should highlight keywords if regex provided', () => {
        const options = {
            keywordRegexes: [/Debug/i]
        };
        renderVirtualList(container, sizer, viewport, mockLines, new Set(), options);

        const firstRow = viewport.querySelector('.log-line[data-line-index="0"]');
        const content = firstRow.innerHTML;
        // Expect <mark> around Debug
        expect(content).toContain('<mark>Debug</mark>');
    });

    it('should highlight live search term', () => {
        const options = {
            liveSearchRegex: /Error/i
        };
        renderVirtualList(container, sizer, viewport, mockLines, new Set(), options);

        const errorRow = viewport.querySelector('.log-line[data-line-index="3"]');
        const content = errorRow.innerHTML;
        expect(content).toContain('<mark class="live-search">Error</mark>');
    });

    it('should handle scrolling (virtualization)', () => {
        // Create enough lines to force scrolling
        const manyLines = [];
        for (let i = 0; i < 1000; i++) {
            manyLines.push({ lineNumber: i + 1, timestamp: '10:00', level: 'D', tag: 'Tag', message: `Line ${i}`, originalText: `Line ${i}` });
        }

        // Render initial view
        renderVirtualList(container, sizer, viewport, manyLines, new Set());
        expect(viewport.children.length).toBeLessThan(1000); // Should only render a subset + buffer

        // Scroll down
        container.scrollTop = 5000; // Scroll way down
        renderVirtualList(container, sizer, viewport, manyLines, new Set());

        // Viewport transform should change
        expect(viewport.style.transform).not.toBe('translateY(0px)');

        // Should render lines around index corresponding to scroll pos
        // 5000px / 20px/line = line 250.
        // It should render around line 250.
    });

});
