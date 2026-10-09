import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1, timeout: 30000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4174', viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Kolkata',
    launchOptions: process.env.FINERA_CHROMIUM_PATH ? { executablePath: process.env.FINERA_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] } : {},
  },
  webServer: { command: 'npm run preview -- --port 4174 --strictPort', url: 'http://127.0.0.1:4174', reuseExistingServer: !process.env.CI },
})
