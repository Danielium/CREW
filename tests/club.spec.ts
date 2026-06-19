import { test, expect } from '@playwright/test';

test.describe('Club Creation and Joining', () => {
  const founderEmail = `founder_${Date.now()}@crew.app`;
  const memberEmail = `member_${Date.now()}@crew.app`;
  const testPass = 'password123';
  let inviteCode = '';

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
    
    // Click submit
    await page.click('button[type="submit"]');

    // Should redirect to the club page
    await expect(page).toHaveURL(/\/club\/c/); // Club IDs usually start with 'c' or are cuid
    await expect(page.locator('h1')).toContainText('PLAYWRIGHT RUN CLUB');

    // Get the invite code from admin panel
    await page.click('button:has-text("УПРАВЛЕНИЕ")');
    const inviteCodeElement = page.locator('text=КОД ПРИГЛАШЕНИЯ').locator('..').locator('div.text-2xl');
    inviteCode = (await inviteCodeElement.textContent()) || '';
    expect(inviteCode.length).toBeGreaterThan(0);
  });

  test('User can join a club via invite code', async ({ page }) => {
    // Login as member
    await page.goto('/login');
    await page.fill('input[type="email"]', memberEmail);
    await page.fill('input[type="password"]', testPass);
    await page.click('button[type="submit"]');

    // Handle redirect to profile
    await expect(page).toHaveURL(/\/profile/);
    
    // Go to home page
    await page.goto('/');

    // Should be on Home Page in "Клубы" tab because they have no club
    await expect(page.locator('text=Создать клуб')).toBeVisible();

    // Click on the join button (usually a scan or input)
    // Actually the app has a GlobalClubs component with a join modal
    await page.click('button:has-text("Войти по коду")');
    await page.fill('input[placeholder="Введите код..."]', inviteCode);
    await page.click('button:has-text("Присоединиться")');

    // Should now be redirected to the club page or see the club in their feed
    await expect(page.locator('text=PLAYWRIGHT RUN CLUB').first()).toBeVisible({ timeout: 10000 });
  });
});
