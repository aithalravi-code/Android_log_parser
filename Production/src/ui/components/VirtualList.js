import { escapeHtml } from '../../utils/html.js';
import { getColorForPid } from '../colors.js';

const LINE_HEIGHT = 20;
const BUFFER_LINES = 50;

/**
 * Renders a virtualized list of log lines.
 * 
 * @param {HTMLElement} container - The scroll container.
 * @param {HTMLElement} sizer - The element determining total scroll height.
 * @param {HTMLElement} viewport - The element containing visible items.
 * @param {Array} lines - The log lines to render.
 * @param {Set} activeCollapseSet - Set of collapsed lines (originalText).
 * @param {Object} options - Configuration options.
 * @param {Array<RegExp>} [options.keywordRegexes] - Regexes for highlighting keywords.
 * @param {RegExp} [options.liveSearchRegex] - Regex for live search highlighting.
 * @param {Object} [options.selectedLine] - The currently selected/anchor line object.
 */
export function renderVirtualList(container, sizer, viewport, lines, activeCollapseSet, options = {}) {
    if (!container || !sizer || !viewport || !lines) return;

    const { keywordRegexes, liveSearchRegex, selectedLine } = options;

    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;

    // Set the total height of the scrollable area
    sizer.style.height = `${lines.length * LINE_HEIGHT}px`;

    // Calculate the range of lines to render
    let startIndex = Math.floor(scrollTop / LINE_HEIGHT) - BUFFER_LINES;
    startIndex = Math.max(0, startIndex); // Don't go below 0
    let endIndex = Math.ceil((scrollTop + containerHeight) / LINE_HEIGHT) + BUFFER_LINES;
    endIndex = Math.min(lines.length, endIndex); // Don't go past the end

    // Create the HTML for the visible lines
    let visibleHtml = '';

    for (let i = startIndex; i < endIndex; i++) {
        const line = lines[i];
        if (!line) continue; // Safety check

        let lineContent;
        let lineClass = 'log-line';

        if (line.isMeta) {
            lineClass += ' log-line-meta';
            const indicator = activeCollapseSet.has(line.originalText) ? '[+] ' : '[-] ';
            lineContent = indicator + escapeHtml(line.text);
        } else {
            // --- New Android Studio Style Rendering ---
            const levelHtml = `<span class="log-level-box log-level-${line.level}">${line.level}</span>`;
            // Color by TID instead of PID
            const pidColor = getColorForPid(line.tid || line.pid);

            let messageText = escapeHtml(line.message || line.originalText);
            let tagText = escapeHtml(line.tag || '');

            // Apply keyword highlighting to tag and message
            if (keywordRegexes) {
                keywordRegexes.forEach(regex => {
                    messageText = messageText.replace(regex, (match) => `<mark>${match}</mark>`);
                    tagText = tagText.replace(regex, (match) => `<mark>${match}</mark>`);
                });
            }
            if (liveSearchRegex) {
                messageText = messageText.replace(liveSearchRegex, (match) => `<mark class="live-search">${match}</mark>`);
                tagText = tagText.replace(liveSearchRegex, (match) => `<mark class="live-search">${match}</mark>`);
            }

            lineContent = `<div class="log-line-content">
                    <span class="log-meta copy-cell" data-log-text="${line.timestamp || (line.date + ' ' + line.time)}">${line.timestamp || (line.date + ' ' + line.time)}</span>
                    <span class="log-pid-tid copy-cell" data-log-text="${line.pid || ''}${line.tid ? '-' + line.tid : ''}${line.uid ? ' ' + line.uid : ''}" style="color: ${pidColor};">
                        <span class="copy-cell" data-log-text="${line.pid || ''}" style="font-weight: bold;">${line.pid || ''}</span>
                        ${line.tid ? '<span class="copy-cell" data-log-text="' + line.tid + '" style="opacity: 0.8; font-size: 0.9em;">-' + line.tid + '</span>' : ''}
                        ${line.uid ? '<span class="copy-cell" data-log-text="' + line.uid + '" style="opacity: 0.6; font-size: 0.8em; margin-left: 2px;"> ' + line.uid + '</span>' : ''}
                    </span>
                    ${levelHtml}
                    <span class="log-tag copy-cell" data-log-text="${escapeHtml(line.tag || '')}" title="${escapeHtml(line.tag || '')}">${tagText}</span>
                    <span class="log-message copy-cell" data-log-text="${escapeHtml(line.message || line.originalText)}" title="${escapeHtml(line.message || line.originalText)}">${messageText}</span>
                </div>`;
        }
        const copyButtonHtml = line.isMeta ? '' : `<button class="copy-log-btn" data-log-text="${escapeHtml(line.originalText || line.text)}">📋</button>`;
        if (selectedLine === line) {
            lineClass += ' selected selected-anchor'; // Add standard selected class
        }

        let lineNumberHtml = '';
        if (!line.isMeta && line.lineNumber) {
            lineNumberHtml = `<span class="line-number">${line.lineNumber}</span>`;
        }
        visibleHtml += `<div class="${lineClass}" data-line-index="${i}">${lineNumberHtml}${lineContent}${copyButtonHtml}</div>`;
    }

    viewport.innerHTML = visibleHtml;
    viewport.style.transform = `translateY(${startIndex * LINE_HEIGHT}px)`;
}
