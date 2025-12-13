import { test, expect } from '@playwright/test';

test('chat flow', async ({ page }) => {
  // Mock API
  await page.route('**/v1/episodic', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        json: [
          {
            id: '1',
            role: 'assistant',
            content: 'Hello! How can I help you?',
            timestamp: Date.now() - 10000,
          }
        ]
      });
    } else if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      await route.fulfill({
        json: {
          id: '2',
          ...body,
          timestamp: Date.now(),
        }
      });
    }
  });

  await page.goto('/');

  // Check initial state
  await expect(page.getByText('Hello! How can I help you?')).toBeVisible();

  // Send a message
  const input = page.getByPlaceholder('Type a message...');
  await input.fill('This is a test message');
  await page.getByRole('button', { name: 'Send' }).click();

  // Since we mocked the POST but the GET still returns the old list (unless we update the mock state),
  // the UI might not update if it relies solely on refetching.
  // However, React Query might optimistically update or we might need to update the GET mock.
  // Let's update the GET mock dynamically.
});

test('chat flow with dynamic mock', async ({ page }) => {
  const messages = [
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! How can I help you?',
      timestamp: Date.now() - 10000,
    }
  ];

  await page.route('**/v1/episodic', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: messages });
    } else if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      const newMessage = {
        id: Math.random().toString(),
        ...body,
        timestamp: Date.now(),
      };
      messages.push(newMessage);
      await route.fulfill({ json: newMessage });
    }
  });

  await page.goto('/');
  await expect(page.getByText('Hello! How can I help you?')).toBeVisible();

  await page.getByPlaceholder('Type a message...').fill('My new message');
  await page.getByRole('button', { name: 'Send' }).click();

  // Wait for the new message to appear (it will appear after refetch)
  // We might need to wait for the refetch interval or trigger it.
  // The component invalidates queries on success, so it should refetch immediately.
  await expect(page.getByText('My new message')).toBeVisible();
});
