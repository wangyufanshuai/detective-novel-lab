import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "chromium-mobile", use: { ...devices["Pixel 7"] } }
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/?runtime=static",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { NEXT_PUBLIC_DEMO_MODE: "static" }
  }
});
