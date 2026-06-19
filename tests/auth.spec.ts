import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  const testEmail = `testuser_${Date.now()}@crew.app`;
  const testPass = 'password123';

  test.beforeAll(async ({ request }) => {
    // Seed a user using the registration API
    const res = await request.post('/api/auth/register', {
      data: {
        email: testEmail,
        password: testPass,
        name: 'Test Playwright User'
      }
    });
    const body = await res.json();
    console.log('Registration response:', res.status(), body);
    expect(res.ok()).toBeTruthy();
  });

  test('should login with existing credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPass);
    await page.click('button[type="submit"]');

    // Should redirect to Profile
    await expect(page).toHaveURL(/\/profile/);
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[type="email"]', 'wrong@crew.app');
    await page.fill('input[type="password"]', 'wrongpass');
    await page.click('button[type="submit"]');

    await expect(page.locator('text=Неверный email или пароль')).toBeVisible();
  });
});
