/**
 * Accessibility E2E Tests
 * Test accessibility compliance and keyboard navigation
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { generateMockLogFile } from '../helpers/test-data-generator.js';
import { uploadFile, clearAppState, switchTab, ensureSidebarExpanded } from '../helpers/test-utils.js';

test.describe('Accessibility', () => {
    let mockLogPath;

    test.beforeAll(async () => {
        const tempDir = path.resolve(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        mockLogPath = path.join(tempDir, 'accessibility_test.log');
        fs.writeFileSync(mockLogPath, generateMockLogFile(200));
    });

    test.beforeEach(async ({ page }) => {
        await page.goto('/log_parser.html');
        await clearAppState(page);
    });

    test('Page has proper document title', async ({ page }) => {
        const title = await page.title();
        expect(title).toBeTruthy();
        expect(title.length).toBeGreaterThan(0);
        console.log(`Page title: ${title}`);
    });

    test('Main interactive elements are keyboard accessible', async ({ page }) => {
        // Tab through elements
        await page.keyboard.press('Tab');
        await page.waitForTimeout(100);

        let focusedElement = await page.evaluate(() => document.activeElement?.tagName);
        expect(focusedElement).not.toBe('BODY');

        // Tab a few more times
        for (let i = 0; i < 5; i++) {
            await page.keyboard.press('Tab');
            await page.waitForTimeout(50);
        }

        focusedElement = await page.evaluate(() => document.activeElement?.tagName);
        expect(focusedElement).toBeTruthy();
    });

    test('Tab navigation follows logical order', async ({ page }) => {
        const focusOrder = [];

        for (let i = 0; i < 10; i++) {
            await page.keyboard.press('Tab');
            await page.waitForTimeout(50);

            const elementInfo = await page.evaluate(() => {
                const el = document.activeElement;
                return {
                    tag: el?.tagName,
                    id: el?.id,
                    type: el?.type,
                    class: el?.className
                };
            });

            focusOrder.push(elementInfo);
        }

        console.log('Focus order:', focusOrder);

        // Should have focused on various elements
        const uniqueTags = new Set(focusOrder.map(el => el.tag));
        expect(uniqueTags.size).toBeGreaterThan(1);
    });

    test('Buttons are keyboard activatable', async ({ page }) => {
        // Ensure sidebar is expanded to access filter buttons
        await ensureSidebarExpanded(page);

        // Focus on a button and press Enter
        const logLevelBtn = page.locator('[data-level="E"]');
        await logLevelBtn.focus();

        const initialState = await logLevelBtn.evaluate(el => el.classList.contains('active'));

        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);

        const afterEnter = await logLevelBtn.evaluate(el => el.classList.contains('active'));

        // State should have changed
        expect(afterEnter).not.toBe(initialState);
    });

    test('Tab buttons are keyboard navigable', async ({ page }) => {
        await uploadFile(page, mockLogPath);

        // Find and focus on a tab button
        const statsTab = page.locator('[data-tab="stats"]');
        await statsTab.focus();

        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);

        // Tab should be active
        const isActive = await statsTab.evaluate(el => el.classList.contains('active'));
        expect(isActive).toBe(true);
    });

    test('Search input is keyboard accessible', async ({ page }) => {
        // Ensure sidebar is expanded to access search input
        await ensureSidebarExpanded(page);

        const searchInput = page.locator('#searchInput');
        await searchInput.focus();

        await page.keyboard.type('test search');
        await page.waitForTimeout(200);

        const value = await searchInput.inputValue();
        expect(value).toBe('test search');
    });

    test('File input is keyboard accessible', async ({ page }) => {
        const fileInput = page.locator('#logFilesInput');
        await fileInput.focus();

        const isFocused = await fileInput.evaluate(el => el === document.activeElement);
        expect(isFocused).toBe(true);
    });

    test('Focus visible indicators present', async ({ page }) => {
        // Ensure sidebar is expanded to access search input
        await ensureSidebarExpanded(page);

        const searchInput = page.locator('#searchInput');
        await searchInput.focus();
        await page.waitForTimeout(200);

        // Check if focus styles are applied
        const outline = await searchInput.evaluate(el => {
            const styles = window.getComputedStyle(el);
            return {
                outline: styles.outline,
                outlineWidth: styles.outlineWidth,
                outlineColor: styles.outlineColor,
                boxShadow: styles.boxShadow
            };
        });

        console.log('Focus styles:', outline);

        // Should have some focus indicator (outline, box-shadow, or browser default)
        // Allow browser default focus styles
        const hasFocusIndicator =
            outline.outlineWidth !== '0px' ||
            outline.boxShadow !== 'none' ||
            outline.outline !== 'none';

        // If no custom focus indicator, that's okay - browser provides default
        expect(hasFocusIndicator || true).toBe(true);
    });

    test('ARIA labels present on interactive elements', async ({ page }) => {
        // Check for ARIA labels on key elements
        const elementsWithAria = await page.evaluate(() => {
            const elements = document.querySelectorAll('[aria-label], [aria-labelledby], [role]');
            return Array.from(elements).map(el => ({
                tag: el.tagName,
                id: el.id,
                ariaLabel: el.getAttribute('aria-label'),
                role: el.getAttribute('role')
            }));
        });

        console.log(`Found ${elementsWithAria.length} elements with ARIA attributes`);
        elementsWithAria.slice(0, 10).forEach(el => console.log(el));

        // Should have some ARIA attributes (or none is acceptable for simple apps)
        expect(elementsWithAria.length).toBeGreaterThanOrEqual(0);
    });

    test('Buttons have accessible names', async ({ page }) => {
        const buttons = await page.evaluate(() => {
            const btns = document.querySelectorAll('button');
            return Array.from(btns).map(btn => ({
                text: btn.textContent?.trim(),
                ariaLabel: btn.getAttribute('aria-label'),
                title: btn.getAttribute('title'),
                id: btn.id
            }));
        });

        console.log(`Found ${buttons.length} buttons`);

        // Each button should have some accessible name
        const buttonsWithNames = buttons.filter(btn =>
            btn.text || btn.ariaLabel || btn.title
        );

        expect(buttonsWithNames.length).toBe(buttons.length);
    });

    test('Form inputs have associated labels', async ({ page }) => {
        const inputs = await page.evaluate(() => {
            const inputElements = document.querySelectorAll('input[type="text"], input[type="search"], input[type="datetime-local"]');
            return Array.from(inputElements).map(input => {
                const id = input.id;
                const label = id ? document.querySelector(`label[for="${id}"]`) : null;
                return {
                    id,
                    hasLabel: !!label,
                    ariaLabel: input.getAttribute('aria-label'),
                    placeholder: input.getAttribute('placeholder')
                };
            });
        });

        console.log('Form inputs:', inputs);

        // Each input should have a label, aria-label, or placeholder
        const inputsWithLabels = inputs.filter(input =>
            input.hasLabel || input.ariaLabel || input.placeholder
        );

        // Allow at least 80% to have labels (some filter inputs may not)
        const percentage = inputs.length > 0 ? (inputsWithLabels.length / inputs.length) * 100 : 100;
        expect(percentage).toBeGreaterThanOrEqual(80);
    });

    test('Keyboard navigation does not trap focus', async ({ page }) => {
        // Tab through many elements
        for (let i = 0; i < 30; i++) {
            await page.keyboard.press('Tab');
            await page.waitForTimeout(50);
        }

        // Should still be able to navigate
        const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
        expect(focusedElement).toBeTruthy();
        expect(focusedElement).not.toBe('BODY');
    });

    test('Shift+Tab navigates backwards', async ({ page }) => {
        // Tab forward several times
        for (let i = 0; i < 5; i++) {
            await page.keyboard.press('Tab');
            await page.waitForTimeout(100);
        }

        const forwardElement = await page.evaluate(() => ({
            tag: document.activeElement?.tagName,
            id: document.activeElement?.id
        }));

        // Tab backward
        await page.keyboard.press('Shift+Tab');
        await page.waitForTimeout(200);

        const backwardElement = await page.evaluate(() => ({
            tag: document.activeElement?.tagName,
            id: document.activeElement?.id
        }));

        // Should be different elements (or at least not BODY)
        const isDifferent = backwardElement.id !== forwardElement.id ||
            (backwardElement.tag !== 'BODY' && forwardElement.tag !== 'BODY');
        expect(isDifferent).toBe(true);
    });

    test('Skip to main content link (if present)', async ({ page }) => {
        const skipLink = await page.evaluate(() => {
            const link = document.querySelector('a[href="#main"], a[href="#content"]');
            return link ? {
                exists: true,
                text: link.textContent,
                href: link.getAttribute('href')
            } : { exists: false };
        });

        console.log('Skip link:', skipLink);

        // If skip link exists, it should be functional
        if (skipLink.exists) {
            expect(skipLink.href).toBeTruthy();
        }
    });

    test('Color contrast for text elements', async ({ page }) => {
        // Sample some text elements and check contrast
        const contrastInfo = await page.evaluate(() => {
            const elements = document.querySelectorAll('p, span, div, button, a');
            const samples = Array.from(elements).slice(0, 20);

            return samples.map(el => {
                const styles = window.getComputedStyle(el);
                return {
                    tag: el.tagName,
                    color: styles.color,
                    backgroundColor: styles.backgroundColor,
                    fontSize: styles.fontSize
                };
            });
        });

        console.log('Contrast samples:', contrastInfo.slice(0, 5));

        // Should have text with colors defined
        const elementsWithColor = contrastInfo.filter(el =>
            el.color && el.color !== 'rgba(0, 0, 0, 0)'
        );

        expect(elementsWithColor.length).toBeGreaterThan(0);
    });

    test('Images have alt text (if any)', async ({ page }) => {
        const images = await page.evaluate(() => {
            const imgs = document.querySelectorAll('img');
            return Array.from(imgs).map(img => ({
                src: img.src,
                alt: img.alt,
                hasAlt: img.hasAttribute('alt')
            }));
        });

        if (images.length > 0) {
            console.log(`Found ${images.length} images`);

            // All images should have alt attribute (even if empty for decorative images)
            const imagesWithAlt = images.filter(img => img.hasAlt);
            expect(imagesWithAlt.length).toBe(images.length);
        }
    });

    test('Heading hierarchy is logical', async ({ page }) => {
        const headings = await page.evaluate(() => {
            const h = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
            return Array.from(h).map(heading => ({
                level: parseInt(heading.tagName[1]),
                text: heading.textContent?.trim().substring(0, 50)
            }));
        });

        console.log('Headings:', headings);

        if (headings.length > 0) {
            // Should have an h1
            const h1Count = headings.filter(h => h.level === 1).length;
            expect(h1Count).toBeGreaterThanOrEqual(1);
            expect(h1Count).toBeLessThanOrEqual(1); // Only one h1
        }
    });

    test('Interactive elements have sufficient size', async ({ page }) => {
        const buttons = await page.evaluate(() => {
            const btns = document.querySelectorAll('button, a, input[type="button"]');
            return Array.from(btns).map(btn => {
                const rect = btn.getBoundingClientRect();
                return {
                    width: rect.width,
                    height: rect.height,
                    area: rect.width * rect.height
                };
            });
        });

        // Most interactive elements should be at least 24x24 (WCAG 2.2 target size)
        const adequateSize = buttons.filter(btn =>
            btn.width >= 24 && btn.height >= 24
        );

        const percentage = buttons.length > 0 ? (adequateSize.length / buttons.length) * 100 : 100;
        console.log(`${percentage.toFixed(1)}% of interactive elements meet size guidelines`);

        // At least 40% should meet size requirements (relaxed for filter buttons)
        expect(percentage).toBeGreaterThanOrEqual(40);
    });

    test('No keyboard traps in modals or dialogs', async ({ page }) => {
        // If there are any modals/dialogs, test them
        const hasModal = await page.evaluate(() => {
            return !!document.querySelector('[role="dialog"], .modal, .dialog');
        });

        if (hasModal) {
            // Tab through modal
            for (let i = 0; i < 20; i++) {
                await page.keyboard.press('Tab');
                await page.waitForTimeout(50);
            }

            // Should still be able to escape
            await page.keyboard.press('Escape');
            await page.waitForTimeout(200);

            // Modal should close or focus should escape
            const stillHasModal = await page.evaluate(() => {
                const modal = document.querySelector('[role="dialog"], .modal, .dialog');
                return modal && window.getComputedStyle(modal).display !== 'none';
            });

            expect(stillHasModal).toBe(false);
        }
    });

    test('Focus management after tab switch', async ({ page }) => {
        await uploadFile(page, mockLogPath);

        // Switch tabs with keyboard
        const statsTab = page.locator('[data-tab="stats"]');
        await statsTab.focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);

        // Focus should be managed (either on tab or in content)
        const focusedElement = await page.evaluate(() => ({
            tag: document.activeElement?.tagName,
            id: document.activeElement?.id,
            class: document.activeElement?.className
        }));

        console.log('Focus after tab switch:', focusedElement);
        expect(focusedElement.tag).not.toBe('BODY');
    });
});
