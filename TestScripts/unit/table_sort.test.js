import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeSortable } from '../../Production/src/table-sort.js';

describe('Table Sort Logic', () => {
    const tableId = 'testTable';

    beforeEach(() => {
        // Setup a mock table
        document.body.innerHTML = `
            <table id="${tableId}">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Age</th>
                        <th>Date</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td>Charlie</td><td>30</td><td>2023-01-01</td></tr>
                    <tr><td>Alice</td><td>25</td><td>2023-01-03</td></tr>
                    <tr><td>Bob</td><td>35</td><td>2023-01-02</td></tr>
                </tbody>
            </table>
        `;
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('should initialize sortable headers', () => {
        makeSortable(tableId);
        const headers = document.querySelectorAll(`#${tableId} thead th`);
        headers.forEach(h => {
            expect(h.classList.contains('sortable')).toBe(true);
            expect(h.style.cursor).toBe('pointer');
        });
    });

    it('should sort strings ascending and descending', () => {
        makeSortable(tableId);
        const nameHeader = document.querySelector(`#${tableId} thead th:nth-child(1)`);

        // First click -> Ascending
        nameHeader.click();

        let rows = document.querySelectorAll(`#${tableId} tbody tr`);
        expect(rows[0].children[0].textContent).toBe('Alice');
        expect(rows[1].children[0].textContent).toBe('Bob');
        expect(rows[2].children[0].textContent).toBe('Charlie');
        expect(nameHeader.classList.contains('asc')).toBe(true);

        // Second click -> Descending
        nameHeader.click();
        rows = document.querySelectorAll(`#${tableId} tbody tr`);
        expect(rows[0].children[0].textContent).toBe('Charlie');
        expect(rows[1].children[0].textContent).toBe('Bob');
        expect(rows[2].children[0].textContent).toBe('Alice');
        // check class
        expect(nameHeader.classList.contains('desc')).toBe(true);
    });

    it('should sort numbers correctly', () => {
        makeSortable(tableId);
        const ageHeader = document.querySelector(`#${tableId} thead th:nth-child(2)`);

        // Click to sort ASC
        ageHeader.click();
        let rows = document.querySelectorAll(`#${tableId} tbody tr`);
        expect(rows[0].children[1].textContent).toBe('25'); // Alice
        expect(rows[1].children[1].textContent).toBe('30'); // Charlie
        expect(rows[2].children[1].textContent).toBe('35'); // Bob

        // Click to sort DESC
        ageHeader.click();
        rows = document.querySelectorAll(`#${tableId} tbody tr`);
        expect(rows[0].children[1].textContent).toBe('35');
        expect(rows[1].children[1].textContent).toBe('30');
        expect(rows[2].children[1].textContent).toBe('25');
    });

    it('should sort dates correctly', () => {
        makeSortable(tableId);
        const dateHeader = document.querySelector(`#${tableId} thead th:nth-child(3)`);

        // Click to sort ASC
        dateHeader.click();
        const rows = document.querySelectorAll(`#${tableId} tbody tr`);
        expect(rows[0].children[2].textContent).toBe('2023-01-01');
        expect(rows[1].children[2].textContent).toBe('2023-01-02');
        expect(rows[2].children[2].textContent).toBe('2023-01-03');
    });

    it('should apply default sort if provided', () => {
        // sort by Age (index 1), 'asc'
        makeSortable(tableId, 1, 'asc');

        const rows = document.querySelectorAll(`#${tableId} tbody tr`);
        expect(rows[0].children[1].textContent).toBe('25');
        expect(rows[2].children[1].textContent).toBe('35');
    });

    it('should handle missing table gracefully', () => {
        // Should not throw
        makeSortable('nonExistentTable');
    });
});
