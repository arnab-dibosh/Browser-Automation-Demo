/* Headed "ghost movie" test run — watch the browser drive itself. */
const { chromium } = require("@playwright/test");

const visible = (page, q) => page.waitForSelector(`section[data-question="${q}"]:not([hidden])`, { timeout: 8000 });
const results = [];
const check = (name, ok, extra = "") => {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!ok) process.exitCode = 1;
};

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 250 });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const type = (sel, text) => page.locator(sel).pressSequentially(text, { delay: 60 });
  const pause = (ms) => page.waitForTimeout(ms);

  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await pause(1200);

  // ── Welcome ──
  await visible(page, "welcome");
  check("welcome screen renders", await page.isVisible("text=Let’s get you set up."));
  await page.click('section[data-question="welcome"] .btn-primary');

  // ── First name: try to sneak past empty, then fill ──
  await visible(page, "first-name");
  await page.keyboard.press("Enter"); // deliberately submit empty
  const err1 = await page.waitForSelector('section[data-question="first-name"] .error-msg:not([hidden])');
  check("empty required field shows error", (await err1.textContent()).includes("required"));
  await pause(900);
  await type("#first-name", "Ava");
  await page.keyboard.press("Enter");

  // ── Last name ──
  await visible(page, "last-name");
  await type("#last-name", "Stone");
  await page.keyboard.press("Enter");

  // ── Phone: garbage first, then a real number ──
  await visible(page, "phone");
  await type("#phone", "not a phone");
  await page.keyboard.press("Enter");
  const err2 = await page.waitForSelector('section[data-question="phone"] .error-msg:not([hidden])');
  check("phone rejects non-numeric input", (await err2.textContent()).includes("10 digits"));
  await pause(900);
  await page.fill("#phone", "");
  await type("#phone", "(555) 123-4567");
  await page.keyboard.press("Enter");

  // ── Business ──
  await visible(page, "business");
  await type("#business", "Stone Roasters");
  await page.keyboard.press("Enter");

  // ── Back navigation: go back, confirm value survived, come forward ──
  await visible(page, "role");
  await page.click("#back-btn");
  await visible(page, "business");
  check("back navigation preserves business name", (await page.inputValue("#business")) === "Stone Roasters");
  await pause(700);
  await page.keyboard.press("Enter");

  // ── Choice questions: mouse click, then number keys ──
  await visible(page, "role");
  await page.click('.chip:has-text("Founder / Owner")');
  await visible(page, "company-size");
  await page.keyboard.press("3"); // 11–50 via number key
  await visible(page, "industry");
  await page.click('.chip:has-text("Retail")');
  await visible(page, "goal");
  await page.click('.chip:has-text("Grow revenue")');
  await visible(page, "referral");
  await page.click('.chip:has-text("Word of mouth")');

  // ── Challenge: Shift+Enter must make a newline, not advance ──
  await visible(page, "challenge");
  await type("#challenge", "Scaling wholesale accounts");
  await page.keyboard.press("Shift+Enter");
  await type("#challenge", "without losing our regulars.");
  check("Shift+Enter stays on the textarea screen", await page.isVisible('section[data-question="challenge"]:not([hidden])'));
  check("Shift+Enter inserted a newline", (await page.inputValue("#challenge")).includes("\n"));
  await page.keyboard.press("Enter");

  // ── Email: invalid, then valid ──
  await visible(page, "email");
  await type("#email", "ava@nope");
  await page.keyboard.press("Enter");
  const err3 = await page.waitForSelector('section[data-question="email"] .error-msg:not([hidden])');
  check("email rejects invalid format", (await err3.textContent()).includes("email"));
  await pause(900);
  await page.fill("#email", "");
  await type("#email", "ava@stoneroasters.com");
  await page.keyboard.press("Enter");

  // ── Review: verify every answer, exercise an Edit round-trip ──
  await visible(page, "review");
  await pause(1500);
  const reviewText = await page.textContent("#review-list");
  for (const val of ["Ava", "Stone", "(555) 123-4567", "Stone Roasters", "Founder / Owner", "11–50", "Retail & e-commerce", "Grow revenue", "Word of mouth", "Scaling wholesale accounts", "ava@stoneroasters.com"]) {
    check(`review shows "${val}"`, reviewText.includes(val));
  }
  check("progress counter reads 12 / 12", (await page.textContent("#step-counter")).trim() === "12 / 12");

  await page.click('.review-row[data-answer="phone"] .edit-btn');
  await visible(page, "phone");
  check("Edit jumps to the phone question with value intact", (await page.inputValue("#phone")) === "(555) 123-4567");
  await pause(700);
  for (let i = 0; i < 9; i++) { await page.keyboard.press("ArrowDown"); await pause(600); }
  await visible(page, "review");

  // ── Submit ──
  await pause(800);
  await page.click('[data-action="submit"]');
  await visible(page, "success");
  check("success headline is personalized", (await page.textContent("#success-headline")).includes("Welcome aboard, Ava"));
  const stored = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), "northwind-onboarding"));
  check("submission persisted to localStorage", stored?.firstName === "Ava" && stored?.email === "ava@stoneroasters.com" && !!stored?.submittedAt);

  // ── Start over should wipe everything ──
  await pause(2000);
  await page.click('[data-action="restart"]');
  await visible(page, "welcome");
  await page.keyboard.press("Enter");
  await visible(page, "first-name");
  check("Start over clears previous answers", (await page.inputValue("#first-name")) === "");

  await pause(2500);
  console.log(results.join("\n"));
  await browser.close();
})().catch((e) => { console.error("SCRIPT ERROR:", e.message); process.exit(1); });
