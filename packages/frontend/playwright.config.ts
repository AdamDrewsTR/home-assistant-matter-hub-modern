import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  use: { baseURL: "http://127.0.0.1:5181", screenshot: "only-on-failure" },
  projects: [
    { name: "webkit", use: { ...devices["iPhone 13"] } },
    { name: "chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "vite --host 127.0.0.1 --port 5181 --strictPort",
    url: "http://127.0.0.1:5181",
  },
});
