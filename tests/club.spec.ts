import { test, expect } from '@playwright/test';

test.describe('Club Creation and Joining', () => {
  const founderEmail = `founder_${Date.now()}@crew.app`;
  const memberEmail = `member_${Date.now()}@crew.app`;
  const testPass = 'password123';

  test.beforeAll(async ({ request }) => {
    // Seed a founder and a member
    await request.post('/api/auth/register', { data: { email: founderEmail, password: testPass, name: 'Founder' } });
    await request.post('/api/auth/register', { data: { email: memberEmail, password: testPass, name: 'Member' } });
  });

  test('User can create a club', async ({ page }) => {
    // Login as founder
    await page.goto('/login');
    await page.fill('input[type="email"]', founderEmail);
    await page.fill('input[type="password"]', testPass);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/profile/);

    // Go to create club
    await page.goto('/club/create');

    // Fill out the club creation form
    await page.fill('input[placeholder="GHOST RUNNERS"]', 'Playwright Run Club');
    await page.fill('textarea[placeholder="Мы бегаем по ночам и не смотрим на темп."]', 'A club for E2E testing.');

    // Club defaults to OPEN join type, so no extra config needed for the join test below.
    // Click submit
    await page.click('button[type="submit"]');

    // Should redirect to the club page
    await expect(page).toHaveURL(/\/club\/c/); // Club IDs usually start with 'c' or are cuid
    await expect(page.locator('h1')).toContainText('PLAYWRIGHT RUN CLUB');
  });

  test('User can join an open club from the club list', async ({ page }) => {
    // Login as member
    await page.goto('/login');
    await page.fill('input[type="email"]', memberEmail);
    await page.fill('input[type="password"]', testPass);
    await page.click('button[type="submit"]');

    // Handle redirect to profile
    await expect(page).toHaveURL(/\/profile/);

    // Go to club list and find the club created above
    await page.goto('/club');
    await page.click('text=PLAYWRIGHT RUN CLUB');
    await expect(page).toHaveURL(/\/club\/c/);

    // OPEN clubs join immediately via the CTA button
    await page.click('button:has-text("Вступить")');

    // Should now show the user as a member (join CTA disappears)
    await expect(page.locator('text=PLAYWRIGHT RUN CLUB').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Вступить")')).not.toBeVisible();
  });
});
