import { test, expect } from '@playwright/test';

test('memory page displays identity and episodic', async ({ page }) => {
  // Mock API
  await page.route('**/v1/identity?key=user', async (route) => {
    await route.fulfill({
      json: {
        key: 'user',
        value: { name: 'Test User' },
        timestamp: Date.now(),
      }
    });
  });

  await page.route('**/v1/episodic', async (route) => {
    await route.fulfill({
      json: [
        {
          id: '123',
          role: 'user',
          content: 'Test memory content',
          timestamp: Date.now(),
        }
      ]
    });
  });

  await page.goto('/memory');

  // Check Identity
  await expect(page.getByText('Identity Store')).toBeVisible();
  await expect(page.getByText('"name": "Test User"')).toBeVisible();

  // Check Episodic
  await expect(page.getByText('Recent Episodic Memory')).toBeVisible();
  await expect(page.getByText('Test memory content')).toBeVisible();
  await expect(page.getByText('user', { exact: true })).toBeVisible();
});
