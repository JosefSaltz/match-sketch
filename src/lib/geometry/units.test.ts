import { describe, it, expect } from 'vitest';
import { toFeet, fromFeet, formatLength } from './units';

describe('units', () => {
	it('converts between yards and feet', () => {
		expect(toFeet(15, 'yd')).toBe(45);
		expect(toFeet(45, 'ft')).toBe(45);
		expect(fromFeet(45, 'yd')).toBe(15);
	});

	it('formats lengths to one decimal, dropping a trailing .0', () => {
		expect(formatLength(45, 'yd')).toBe('15 yd');
		expect(formatLength(7.5, 'yd')).toBe('2.5 yd');
		expect(formatLength(10, 'yd')).toBe('3.3 yd');
		expect(formatLength(12, 'ft')).toBe('12 ft');
		expect(formatLength(0.25, 'ft')).toBe('0.3 ft');
	});
});
