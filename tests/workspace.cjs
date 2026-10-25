const assert = require("node:assert/strict"),
  path = require("node:path"),
  fs = require("node:fs/promises"),
  net = require("node:net");
const { spawn } = require("node:child_process");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
async function port() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const p = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return p;
}
(async () => {
  const p = await port(),
    base = `http://127.0.0.1:${p}`,
    server = spawn(process.env.PYTHON || "python", ["-u", "server.py"], {
      cwd: path.resolve(__dirname, ".."),
      env: {
        ...process.env,
        MYSTERY_PORT: String(p),
        OLLAMA_URL: "http://127.0.0.1:1/api/chat",
      },
      stdio: "ignore",
    });
  let browser;
  try {
    for (let i = 0; i < 100; i++) {
      try {
        const response = await fetch(base);
        await response.arrayBuffer();
        if (response.ok) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const css = await fetch(base + "/design.css");
    const cssType = css.headers.get("content-type");
    await css.text();
    assert.match(cssType, /text\/css/);
    browser = await chromium.launch({
      headless: true,
      ...(process.env.CHROMIUM_PATH
        ? { executablePath: process.env.CHROMIUM_PATH }
        : {}),
    });
    const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      }),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/status", (route) =>
      route.fulfill({ json: { ollama: false } }),
    );
    await page.route("**/api/chat", (route) =>
      route.fulfill({
        json: {
          ok: true,
          answer: '<img src=x onerror="window.modelXss=1"> 角色的一段说法',
        },
      }),
    );
    await page.goto(base);
    await page.locator('[data-action="key"]').click();
    await page.locator('[data-action="footprint"]').click();
    await page.locator("#input").fill("停电时在哪里？");
    await page.locator("#composer button").click();
    await page.waitForFunction(() =>
      document.querySelector("#chat").textContent.includes("角色的一段说法"),
    );
    await page.locator("#view-notebook").click();
    await page.waitForFunction(
      () => document.querySelectorAll(".evidence-item").length === 3,
    );
    await page
      .getByRole("button", { name: "固定到证据板", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "固定到证据板", exact: true })
      .first()
      .click();
    assert.equal(await page.locator(".board-node").count(), 2);
    await page.getByLabel("关联类型").selectOption("存在冲突");
    await page.getByRole("button", { name: "建立关联", exact: true }).click();
    assert.ok(
      (await page.locator(".connection-list").innerText()).includes("存在冲突"),
    );
    await page
      .locator("#notebook-note")
      .fill('<img src=x onerror="window.noteXss=1"> 一条待验证笔记');
    await page.setViewportSize({ width: 768, height: 1000 });
    assert.ok(
      (await page.locator("#notebook-note").inputValue()).includes(
        "待验证笔记",
      ),
    );
    await page.getByRole("button", { name: "添加笔记", exact: true }).click();
    await page
      .getByRole("button", { name: "运行调查助手", exact: true })
      .click();
    await page.waitForFunction(
      () => document.querySelectorAll(".director-tools li.done").length === 4,
    );
    assert.equal(await page.locator(".question-proposal").count(), 2);
    assert.equal(
      await page.evaluate(() => !!window.modelXss || !!window.noteXss),
      false,
    );
    assert.equal(await page.locator(".evidence-item img").count(), 0);
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "导出 JSON", exact: true }).click();
    const file = await downloading;
    const report = JSON.parse(await fs.readFile(await file.path(), "utf8"));
    assert.equal(report.facts.length, 2);
    assert.equal(report.testimony.length, 1);
    assert.equal(report.links.length, 1);
    assert.equal(report.notes.length, 1);
    assert.equal(report.testimony[0].mode, "本地模型");
    await page
      .getByRole("button", { name: "带入对话 →", exact: true })
      .first()
      .click();
    assert.ok(
      (await page.locator("#input").inputValue()).includes("可核对的时间"),
    );
    assert.equal(await page.locator("main.layout").isVisible(), true);
    await page.locator("#view-notebook").click();
    await page.locator('[data-scenario="station"]').click();
    await page.waitForFunction(
      () => document.querySelectorAll(".evidence-item").length === 0,
    );
    assert.equal(
      (await page.locator("#notebook-count").innerText()).trim(),
      "0",
    );
    await page.locator('[data-scenario="mist"]').click();
    await page.waitForFunction(
      () => document.querySelectorAll(".evidence-item").length === 4,
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      assert.equal(
        await page
          .locator(".board-node")
          .first()
          .evaluate((node) => getComputedStyle(node).animationName),
        "none",
      );
    }
    if (process.env.SCREENSHOT_DIR) {
      await fs.mkdir(process.env.SCREENSHOT_DIR, { recursive: true });
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.screenshot({
          path: path.join(
            process.env.SCREENSHOT_DIR,
            `mystery-workspace-${width}.png`,
          ),
          fullPage: true,
        });
      }
    }
    for (const file of ["liufang.html", "ye-pusa.html"]) {
      await page.goto(base + "/" + file);
      await page.locator("#input").fill("我尊重你的选择");
      await page.locator("#composer button").click();
      await page.waitForFunction(() =>
        document.querySelector("#chat").textContent.includes("角色的一段说法"),
      );
      await page.locator("#view-notebook").click();
      assert.equal(await page.locator(".evidence-item").count(), 1);
      await page.getByRole("button", { name: "运行调查助手" }).click();
      await page.waitForFunction(
        () => document.querySelectorAll(".director-tools li.done").length === 4,
      );
      assert.equal(await page.locator(".question-proposal").count(), 1);
    }
    assert.deepEqual(errors, []);
    console.log(
      "Investigation workspace passed: source separation, pin/link/note/export, cross-case isolation, all pages, responsive/reduced motion and XSS.",
    );
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
