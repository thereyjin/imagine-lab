import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
const t0 = Date.now();
await page.locator('.doodle-start').click();
// 抓 react 末三帧时段（1.5s 动画的 75%~100% ≈ t 2.9~3.6 从点击起算 + 前置 0.5s 收缩/think 1.65s：react 约 2.15~3.65s）
for (const [t, name] of [[3.1,'r-f9'],[3.35,'r-f10'],[3.55,'r-f11'],[5.9,'peace-f0']]) {
  while ((Date.now()-t0)/1000 < t) { await page.waitForTimeout(10); }
  await page.locator('.character').screenshot({ path: `q-${name}.png` });
}
await browser.close();
