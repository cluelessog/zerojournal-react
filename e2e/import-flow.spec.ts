import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TRADEBOOK_FILE = path.join(__dirname, 'fixtures', 'tradebook-UK4551-EQ.xlsx');
const PNL_FILE = path.join(__dirname, 'fixtures', 'pnl-UK4551.xlsx');

test.describe('Import Flow', () => {
  test('navigates to /import when no data is loaded', async ({ page }) => {
    await page.goto('/');
    // App redirects to /import when isLoaded is false
    await expect(page).toHaveURL('/import');
  });

  test('shows both file upload zones on the import page', async ({ page }) => {
    await page.goto('/import');

    await expect(page.getByRole('button', { name: 'Upload Tradebook' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload P&L Statement' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Parse Files' })).toBeDisabled();
  });

  test('enables Parse Files button after both files are selected', async ({ page }) => {
    await page.goto('/import');

    const tradebookInput = page.locator('input[type="file"]').first();
    const pnlInput = page.locator('input[type="file"]').nth(1);

    await tradebookInput.setInputFiles(TRADEBOOK_FILE);
    await pnlInput.setInputFiles(PNL_FILE);

    await expect(page.getByRole('button', { name: 'Parse Files' })).toBeEnabled();
  });

  test('should import files and display dashboard with metric cards', async ({ page }) => {
    await page.goto('/import');

    // Select both files via the hidden file inputs
    const tradebookInput = page.locator('input[type="file"]').first();
    const pnlInput = page.locator('input[type="file"]').nth(1);

    await tradebookInput.setInputFiles(TRADEBOOK_FILE);
    await pnlInput.setInputFiles(PNL_FILE);

    // Both drop zones should show the selected file names
    await expect(page.getByText('tradebook-UK4551-EQ.xlsx')).toBeVisible();
    await expect(page.getByText('pnl-UK4551.xlsx')).toBeVisible();

    // Trigger parsing
    await page.getByRole('button', { name: 'Parse Files' }).click();

    // Wait for parse to complete: "Confirm Import" button appears in the preview section
    await expect(page.getByRole('button', { name: 'Confirm Import' })).toBeVisible({
      timeout: 30_000,
    });

    // Confirm the import
    await page.getByRole('button', { name: 'Confirm Import' }).click();

    // Should navigate to dashboard
    await expect(page).toHaveURL('/', { timeout: 15_000 });

    // Verify metric cards are rendered — wait for the first card to ensure
    // IndexedDB hydration and store update have completed
    await expect(page.getByText('Total P&L')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Win Rate')).toBeVisible();
    await expect(page.getByText('Best Trade')).toBeVisible();
    await expect(page.getByText('Worst Trade')).toBeVisible();
    await expect(page.getByText('Trade Count')).toBeVisible({ timeout: 10_000 });
  });

  test('shows import preview with trade summary after parsing', async ({ page }) => {
    await page.goto('/import');

    const tradebookInput = page.locator('input[type="file"]').first();
    const pnlInput = page.locator('input[type="file"]').nth(1);

    await tradebookInput.setInputFiles(TRADEBOOK_FILE);
    await pnlInput.setInputFiles(PNL_FILE);

    await page.getByRole('button', { name: 'Parse Files' }).click();

    // Wait for preview section heading to appear
    await expect(page.getByText('Step 2 — Review & confirm')).toBeVisible({ timeout: 30_000 });

    // Tradebook and P&L summary cards appear in the preview section
    await expect(page.getByRole('heading', { name: 'Tradebook' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'P&L Statement' })).toBeVisible();
    // Summary rows visible in the main content area (scoped to avoid nav link collision)
    await expect(page.getByRole('main').getByText('Trades', { exact: true })).toBeVisible();
    await expect(page.getByRole('main').getByText('Symbols', { exact: true })).toBeVisible();
  });

  test('can cancel import from preview and return to idle state', async ({ page }) => {
    await page.goto('/import');

    const tradebookInput = page.locator('input[type="file"]').first();
    const pnlInput = page.locator('input[type="file"]').nth(1);

    await tradebookInput.setInputFiles(TRADEBOOK_FILE);
    await pnlInput.setInputFiles(PNL_FILE);

    await page.getByRole('button', { name: 'Parse Files' }).click();

    await expect(page.getByRole('button', { name: 'Confirm Import' })).toBeVisible({
      timeout: 30_000,
    });

    // Cancel — should return to idle (Parse Files button reappears)
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('button', { name: 'Parse Files' })).toBeVisible();
    // Preview section should be gone
    await expect(page.getByText('Step 2 — Review & confirm')).not.toBeVisible();
  });
});
