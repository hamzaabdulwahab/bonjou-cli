import { chromium } from "playwright";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

const PORT = 5173;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const SCREENSHOT_DIR = path.join(
  process.env.HOME || "",
  ".gemini/antigravity-cli/brain/f37a6734-e661-4580-a66b-5dffc1505b0a/scratch/responsive_tests"
);

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: "Mobile_iPhone_14_Portrait", width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  { name: "Mobile_Pixel_7_Portrait", width: 412, height: 915, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true },
  { name: "Mobile_iPhone_14_Landscape", width: 844, height: 390, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  { name: "Tablet_iPad_Portrait", width: 820, height: 1180, deviceScaleFactor: 2, isMobile: false, hasTouch: true },
  { name: "Tablet_iPad_Landscape", width: 1180, height: 820, deviceScaleFactor: 2, isMobile: false, hasTouch: true },
  { name: "Laptop_1280x800", width: 1280, height: 800, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  { name: "Desktop_1920x1080", width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
];

async function startServer() {
  const vite = spawn("npx", ["vite", "--port", String(PORT), "--host", "127.0.0.1"], {
    cwd: path.resolve("website"),
    stdio: "pipe",
    shell: true,
  });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(), 3000);
    vite.stdout.on("data", (data) => {
      const str = data.toString();
      if (str.includes("ready in") || str.includes("Local:")) {
        clearTimeout(timer);
        resolve();
      }
    });
    vite.stderr.on("data", (data) => console.log(data.toString()));
  });

  return vite;
}

async function runTests() {
  console.log("🚀 Starting Vite dev server...");
  const server = await startServer();

  console.log("🌐 Launching Playwright Chromium browser...");
  const browser = await chromium.launch({ headless: true });

  const testResults = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n📱 Testing Viewport: ${vp.name} (${vp.width}x${vp.height})...`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.deviceScaleFactor,
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
    });

    const page = await context.newPage();

    // 1. Landing Page Test
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    const landingOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    const landingScreenshot = path.join(SCREENSHOT_DIR, `landing_${vp.name}.png`);
    await page.screenshot({ path: landingScreenshot, fullPage: true });

    // 2. Web App Workspace Test
    await page.goto(`${BASE_URL}/app`, { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.setItem("bonjou.name", "TestUser"));
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    const appOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });

    const appScreenshot = path.join(SCREENSHOT_DIR, `app_${vp.name}.png`);
    await page.screenshot({ path: appScreenshot, fullPage: false });

    // Test Command Palette modal
    const railBtn = await page.$('.rail-cmd');
    if (railBtn && await railBtn.isVisible()) {
      await railBtn.click();
    } else {
      await page.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
    }
    await page.waitForTimeout(400);

    const paletteVisible = await page.isVisible(".palette-container");
    const paletteScreenshot = path.join(SCREENSHOT_DIR, `palette_${vp.name}.png`);
    await page.screenshot({ path: paletteScreenshot, fullPage: false });

    // Click outside backdrop to dismiss palette
    await page.mouse.click(5, 5);
    await page.waitForTimeout(400);

    const paletteClosed = !(await page.isVisible(".palette-container"));

    const result = {
      viewport: vp.name,
      width: vp.width,
      height: vp.height,
      landingOverflow: landingOverflow ? "FAIL (Horizontal Overflow)" : "PASS (No Overflow)",
      appOverflow: appOverflow ? "FAIL (Horizontal Overflow)" : "PASS (No Overflow)",
      paletteOpensAndCloses: paletteVisible && paletteClosed ? "PASS" : "FAIL",
    };

    testResults.push(result);
    await context.close();
  }

  await browser.close();
  server.kill("SIGTERM");

  console.log("\n=======================================================");
  console.log("📊 PLAYWRIGHT RESPONSIVENESS TEST MATRIX RESULTS");
  console.log("=======================================================\n");
  console.table(testResults);
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
