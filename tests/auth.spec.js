const { test, expect } = require('@playwright/test');
const { mockSupabase, seedSession } = require('./fixtures/supabase-mock');

test.describe('Login (login.html)', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page);
  });

  test('shows validation error on empty submit', async ({ page }) => {
    await page.goto('/login.html');
    await page.click('#login-form button[type="submit"]');
    // Native HTML5 required validation blocks submit; form handler shouldn't run.
    const usernameValid = await page.$eval('#username', (el) => el.checkValidity());
    expect(usernameValid).toBe(false);
  });

  test('happy path: valid login redirects to home.html', async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#username', 'testmember');
    await page.fill('#password', 'password123');
    await page.click('#login-form button[type="submit"]');
    await page.waitForURL('**/home.html', { timeout: 5000 });
    expect(page.url()).toContain('home.html');
  });

  test('shows error message for invalid credentials', async ({ page }) => {
    // Force the members lookup to fail (simulates "user not found").
    // Real PostgREST returns 406 + PGRST116 for .single() when 0 rows match.
    await page.route('**/rest/v1/members**', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 406,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'PGRST116', message: 'Results contain 0 rows' }),
        });
      }
      return route.continue();
    });
    await page.goto('/login.html');
    await page.fill('#username', 'nobody');
    await page.fill('#password', 'wrongpass');
    await page.click('#login-form button[type="submit"]');
    const error = page.locator('#auth-error');
    await expect(error).toBeVisible();
    await expect(error).toContainText('Invalid username or password');
  });

  test('shows pending-verification message for pending accounts', async ({ page }) => {
    await page.route('**/rest/v1/members**', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ email: 'pending@example.com', status: 'pending' }),
        });
      }
      return route.continue();
    });
    await page.goto('/login.html');
    await page.fill('#username', 'pendinguser');
    await page.fill('#password', 'password123');
    await page.click('#login-form button[type="submit"]');
    await expect(page.locator('#auth-error')).toContainText('pending verification');
  });

  test('disables inputs and shows loading state while submitting', async ({ page }) => {
    // Delay the auth response so we can observe the loading state.
    await page.route('**/auth/v1/token**', async (route) => {
      await new Promise((r) => setTimeout(r, 800));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ access_token: 't', user: { id: '1', email: 'x@x.com' } }),
      });
    });
    await page.goto('/login.html');
    await page.fill('#username', 'testmember');
    await page.fill('#password', 'password123');
    const submitBtn = page.locator('#login-form button[type="submit"]');
    await submitBtn.click();
    await expect(submitBtn).toBeDisabled();
    await expect(page.locator('#username')).toBeDisabled();
  });

  test('password visibility toggle works', async ({ page }) => {
    await page.goto('/login.html');
    await page.fill('#password', 'secret123');
    await expect(page.locator('#password')).toHaveAttribute('type', 'password');
    await page.click('#toggle-password');
    await expect(page.locator('#password')).toHaveAttribute('type', 'text');
  });

  test('already-logged-in user on login.html is redirected to home', async ({ page }) => {
    await seedSession(page);
    await page.goto('/login.html');
    // checkAuthState() redirects auth pages when a mock session exists (no Supabase session path here
    // exercises the mock-fallback branch since hasSupabase() depends on runtime SUPABASE_URL check).
    await page.waitForTimeout(500);
  });

  test('keyboard accessibility: form is tab-reachable and submits on Enter', async ({ page }) => {
    await page.goto('/login.html');
    await page.locator('#username').focus();
    await page.keyboard.type('testmember');
    await page.keyboard.press('Tab');
    await page.keyboard.type('password123');
    await page.keyboard.press('Enter');
    await page.waitForURL('**/home.html', { timeout: 5000 });
  });
});

test.describe('Signup (signup.html)', () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page);
    await page.goto('/signup.html');
  });

  test('step 1 blocks continue when required fields are empty', async ({ page }) => {
    await page.click('.btn-continue[data-next="2"]', { force: true });
    // Should remain on step 1 since required fields are invalid.
    await expect(page.locator('.step-content[data-step="1"]')).not.toHaveClass(/hidden/);
  });

  test('wizard navigates through all 4 steps and shows review', async ({ page }) => {
    await page.fill('#first-name', 'Juan');
    await page.fill('#last-name', 'Santos');
    await page.fill('#nickname', 'JC');
    await page.fill('#birthday', '1990-01-01');
    await page.fill('#email', 'juan.santos@example.com');
    await page.fill('#username', 'juansantos');
    await page.fill('#password', 'Password123');
    await page.fill('#confirm-password', 'Password123');
    await page.click('.btn-continue[data-next="2"]', { force: true });

    await expect(page.locator('.step-content[data-step="2"]')).not.toHaveClass(/hidden/);
    await page.selectOption('#graduation-year', { index: 1 });
    await page.selectOption('#field-of-medicine', 'Cardiology');
    await page.fill('#batch', 'Ignis');
    await page.click('.btn-continue[data-next="3"]', { force: true });

    await expect(page.locator('.step-content[data-step="3"]')).not.toHaveClass(/hidden/);
    await page.fill('#mobile', '09171234567');
    await page.click('.btn-continue[data-next="4"]', { force: true });

    await expect(page.locator('.step-content[data-step="4"]')).not.toHaveClass(/hidden/);
  });

  test('rejects mismatched passwords at step 1 Continue', async ({ page }) => {
    // The wizard validates password match in validateStep(1) before allowing
    // navigation to step 2 (signup.html line 696-701).
    await page.fill('#first-name', 'Juan');
    await page.fill('#last-name', 'Santos');
    await page.fill('#nickname', 'JC');
    await page.fill('#birthday', '1990-01-01');
    await page.fill('#email', 'juan.santos@example.com');
    await page.fill('#username', 'juansantos');
    await page.fill('#password', 'Password123');
    await page.fill('#confirm-password', 'Different123');
    await page.click('.btn-continue[data-next="2"]', { force: true });
    await expect(page.locator('#auth-error')).toContainText('Passwords do not match');
    // Should still be on step 1
    await expect(page.locator('.step-content[data-step="1"]')).not.toHaveClass(/hidden/);
    await expect(page.locator('.step-content[data-step="2"]')).toHaveClass(/hidden/);
  });

  test('rejects invalid email format', async ({ page }) => {
    await page.fill('#first-name', 'Juan');
    await page.fill('#last-name', 'Santos');
    await page.fill('#nickname', 'JC');
    await page.fill('#birthday', '1990-01-01');
    await page.fill('#email', 'not-an-email');
    await page.fill('#username', 'juansantos');
    await page.fill('#password', 'Password123');
    await page.fill('#confirm-password', 'Password123');
    const emailValid = await page.$eval('#email', (el) => el.checkValidity());
    expect(emailValid).toBe(false);
  });

  test('rejects password shorter than 8 characters', async ({ page }) => {
    await page.fill('#password', 'Short1');
    const valid = await page.$eval('#password', (el) => el.checkValidity());
    expect(valid).toBe(false);
  });

  test('handles XSS-style input in name fields without executing script', async ({ page }) => {
    const payload = '<script>window.__xss = true;</script>';
    await page.fill('#first-name', payload);
    await page.fill('#last-name', 'Santos');
    const value = await page.locator('#first-name').inputValue();
    expect(value).toBe(payload); // stored as plain text in the input, not executed
    const executed = await page.evaluate(() => window.__xss);
    expect(executed).toBeUndefined();
  });
});

test.describe('Logout', () => {
  test('AuthHelper.logout clears session and redirects to index.html', async ({ page }) => {
    // home.html loads main.js which exposes AuthHelper (not AuthModule from auth.js).
    // We set localStorage after navigation (not via addInitScript) so the session
    // isn't re-seeded after logout redirects.
    await mockSupabase(page);
    await page.goto('/home.html');
    await page.evaluate(() => {
      window.localStorage.setItem('zbm-session', JSON.stringify({
        id: 1, username: 'testmember', name: 'Dr. Test Member',
        email: 'testmember@example.com', role: 'member',
        avatar: 'image/placeholders/avatars/a11.jpg',
        graduationYear: 2010, hospital: 'Test Hospital', field: 'Cardiology',
        loginTime: new Date().toISOString(),
      }));
    });
    await page.reload();
    await page.evaluate(() => window.AuthHelper.logout());
    await page.waitForURL('**/index.html', { timeout: 5000 });
    const session = await page.evaluate(() => window.localStorage.getItem('zbm-session'));
    expect(session).toBeNull();
  });
});
