import * as CccTab from './tabs/CccTab.js';

/**
 * Manages the CCC Hover Tooltip
 */
export class TooltipManager {
    /**
     * @param {Function} getCccMessages - Optional callback to retrieve all CCC messages for fallback lookup
     */
    constructor(getCccMessages = () => []) {
        this.getCccMessages = getCccMessages;
        this.cccTooltip = document.createElement('div');
        this.cccTooltip.className = 'ccc-tooltip';
        document.body.appendChild(this.cccTooltip);
    }

    /**
     * Show the tooltip for a given log line
     * @param {Event} event 
     * @param {Object} line 
     * @param {Object} cccMsg 
     */
    showTooltip(event, line, cccMsg) {
        // Fallback: If cccMsg is not passed (from property), try to find it in global array
        if (!cccMsg && line && line.lineNumber) {
            const allMessages = this.getCccMessages();
            cccMsg = allMessages.find(m => m.lineNumber === line.lineNumber);
        }

        if (!cccMsg) {
            this.hideTooltip();
            return;
        }

        // UX Improvement: Prevent double tooltips
        if (event.target) {
            if (event.target.hasAttribute('title')) event.target.removeAttribute('title');
            const lineEl = event.target.closest('.log-line');
            if (lineEl) {
                const titleEls = lineEl.querySelectorAll('[title]');
                titleEls.forEach(el => el.removeAttribute('title'));
            }
        }

        // Decode the payload if not already decoded
        let decoded = cccMsg._decoded;
        if (!decoded) {
            try {
                decoded = CccTab.decodePayload(cccMsg.type, cccMsg.subtype, cccMsg.payload);
                cccMsg._decoded = decoded; // Cache it
            } catch (err) {
                console.error('[Tooltip] Decode failed:', err);
                decoded = { innerMsg: "Error decoding", params: err.message };
            }
        }

        const categoryName = CccTab.CCC_CONSTANTS.MESSAGE_TYPES[cccMsg.type] || `Unknown (0x${cccMsg.type.toString(16).padStart(2, '0').toUpperCase()})`;
        let typeName = `Unknown`;
        if (cccMsg.type === 0x02) typeName = CccTab.CCC_CONSTANTS.UWB_RANGING_MSGS[cccMsg.subtype] || typeName;
        else if (cccMsg.type === 0x03) typeName = CccTab.CCC_CONSTANTS.DK_EVENT_CATEGORIES[cccMsg.subtype] || typeName;
        else if (cccMsg.type === 0x01 && CccTab.CCC_CONSTANTS.SE_MSGS && CccTab.CCC_CONSTANTS.SE_MSGS[cccMsg.subtype]) typeName = CccTab.CCC_CONSTANTS.SE_MSGS[cccMsg.subtype];
        else if (cccMsg.type === 0x05) typeName = CccTab.CCC_CONSTANTS.SUPPLEMENTARY_MSGS[cccMsg.subtype] || typeName;
        else if (cccMsg.type === 0x00 && CccTab.CCC_CONSTANTS.FRAMEWORK_MSGS && CccTab.CCC_CONSTANTS.FRAMEWORK_MSGS[cccMsg.subtype]) typeName = CccTab.CCC_CONSTANTS.FRAMEWORK_MSGS[cccMsg.subtype];

        const innerMessage = decoded.innerMsg || "-";
        const paramsHtml = decoded.params || "No parameters";

        this.cccTooltip.innerHTML = `
            <div class="ccc-tooltip-header">CCC Packet Details</div>
            <div class="ccc-tooltip-row"><span class="ccc-tooltip-label">Category:</span><span class="ccc-tooltip-value">${categoryName}</span></div>
            <div class="ccc-tooltip-row"><span class="ccc-tooltip-label">Type:</span><span class="ccc-tooltip-value">${typeName}</span></div>
            <div class="ccc-tooltip-row"><span class="ccc-tooltip-label">Message:</span><span class="ccc-tooltip-value">${innerMessage}</span></div>
            <div class="ccc-tooltip-row" style="flex-direction: column;">
                <span class="ccc-tooltip-label" style="margin-bottom: 2px;">Parameters:</span>
                <span class="ccc-tooltip-value" style="font-size: 0.85em;">${paramsHtml}</span>
            </div>
        `;

        this.cccTooltip.style.display = 'block';
        this.moveTooltip(event);
    }

    moveTooltip(event) {
        const x = event.clientX + 15;
        const y = event.clientY + 15;

        // Boundary checks
        const rect = this.cccTooltip.getBoundingClientRect();
        let finalX = x;
        let finalY = y;

        if (x + rect.width > window.innerWidth) {
            finalX = event.clientX - rect.width - 10;
        }
        if (y + rect.height > window.innerHeight) {
            finalY = event.clientY - rect.height - 10;
        }

        this.cccTooltip.style.left = `${finalX}px`;
        this.cccTooltip.style.top = `${finalY}px`;
    }

    hideTooltip() {
        this.cccTooltip.style.display = 'none';
    }

    /**
     * Attach listeners to a specific log container
     * @param {HTMLElement} container 
     * @param {Function} getLineAtIndex - (index) => object
     */
    attachTo(container, getLineAtIndex) {
        if (!container) return;

        container.addEventListener('mouseover', (e) => {
            const lineEl = e.target.closest('.log-line');
            if (lineEl) {
                const index = parseInt(lineEl.dataset.lineIndex, 10);
                if (!isNaN(index)) {
                    const line = getLineAtIndex(index);
                    if (line) {
                        this.showTooltip(e, line, line.cccMessage);
                    }
                }
            } else {
                this.hideTooltip();
            }
        });

        container.addEventListener('mousemove', (e) => {
            if (this.cccTooltip.style.display === 'block') {
                this.moveTooltip(e);
            }
        });

        container.addEventListener('mouseout', (e) => {
            if (!e.relatedTarget || !container.contains(e.relatedTarget)) {
                this.hideTooltip();
            }
        });
    }
}
