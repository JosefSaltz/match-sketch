import { expect, test } from './fixtures';
import { createCanvas, createPlanFromCanvas } from './helpers';

test.describe.configure({ mode: 'parallel' });

for (const name of ['first', 'second']) {
	test(`the ${name} test sees only its own plans`, async ({ page, account }) => {
		await page.goto('/');
		await createCanvas(page, { name: `Bay ${name}`, width: '30', depth: '20', unit: 'Yards' });
		await createPlanFromCanvas(page, `Bay ${name}`);
		await page.goto('/');
		await expect(page.getByText(account.email)).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Unassigned plans' })).toBeVisible();
		await expect(page.locator('section[aria-labelledby="plans-heading"] li')).toHaveCount(1);
	});
}
