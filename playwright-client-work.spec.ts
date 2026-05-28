import { test, expect } from '@playwright/test';

test('EPAM Services Client Work page is visible', async ({ page }) => {
  await page.goto('https://www.epam.com/');

  await page.goto('https://www.epam.com/services/client-work');

  await expect(page.getByText('Client Work', { exact: true })).toBeVisible();
});
