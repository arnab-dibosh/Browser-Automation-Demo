/* Northwind & Co. — one-question-per-page onboarding flow */
(() => {
  "use strict";

  const STORAGE_KEY = "northwind-onboarding";
  const SPEED = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 350;

  const screens = Array.from(document.querySelectorAll(".screen"));
  const progressFill = document.getElementById("progress-fill");
  const stepCounter = document.getElementById("step-counter");
  const backBtn = document.getElementById("back-btn");
  const reviewList = document.getElementById("review-list");

  // Human labels for the review screen, keyed by answer name.
  const LABELS = {
    firstName: "First name",
    lastName: "Last name",
    phone: "Phone",
    business: "Business",
    role: "Role",
    companySize: "Company size",
    industry: "Industry",
    goal: "Primary goal",
    referral: "Heard about us",
    challenge: "Biggest challenge",
    email: "Email",
  };

  const answers = {};
  let current = 0;
  let animating = false;

  // Steps counted in the progress UI: everything between welcome and success.
  const counted = screens.filter((s) => !["intro", "outro"].includes(s.dataset.kind));
  const totalSteps = counted.length;

  // Stamp "Question N" eyebrows on question screens.
  counted.forEach((screen, i) => {
    const num = screen.querySelector(".q-number");
    if (num) num.textContent = `Question ${i + 1}`;
  });

  /* ── Navigation ── */

  function updateChrome() {
    const screen = screens[current];
    const stepIndex = counted.indexOf(screen);
    const kind = screen.dataset.kind;

    if (kind === "intro") {
      progressFill.style.width = "0%";
      stepCounter.textContent = "";
    } else if (kind === "outro") {
      progressFill.style.width = "100%";
      stepCounter.textContent = "";
    } else {
      progressFill.style.width = `${Math.round(((stepIndex + 1) / totalSteps) * 100)}%`;
      stepCounter.textContent = `${stepIndex + 1} / ${totalSteps}`;
    }

    backBtn.hidden = kind === "intro" || kind === "outro" || current === 0;
  }

  function focusScreen(screen) {
    const field = screen.querySelector("input, textarea");
    if (field) {
      field.focus();
    } else {
      const chip = screen.querySelector('.chip[aria-checked="true"]') || screen.querySelector(".chip");
      if (chip) chip.focus({ preventScroll: true });
    }
  }

  function goTo(index, { back = false } = {}) {
    if (animating || index === current || index < 0 || index >= screens.length) return;
    const from = screens[current];
    const to = screens[index];
    animating = true;

    from.classList.toggle("going-back", back);
    to.classList.toggle("going-back", back);
    from.classList.add("leaving");

    const swap = () => {
      from.classList.remove("leaving", "going-back");
      from.hidden = true;
      current = index;
      if (to.dataset.kind === "review") renderReview();
      if (to.dataset.kind === "outro") renderSuccess();
      to.hidden = false;
      updateChrome();
      requestAnimationFrame(() => focusScreen(to));
      // Unlock as soon as the new screen is interactive; its entry
      // animation can finish on its own without blocking input.
      animating = false;
    };

    SPEED ? setTimeout(swap, SPEED) : swap();
  }

  /* ── Validation ── */

  const VALIDATORS = {
    phone: (v) => {
      const digits = v.replace(/\D/g, "");
      return digits.length >= 10 && digits.length <= 15
        ? null
        : "That doesn't look like a phone number — please include at least 10 digits.";
    },
    email: (v) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
        ? null
        : "That doesn't look like an email address — check for typos.",
  };

  function showError(screen, message) {
    const errorEl = screen.querySelector(".error-msg");
    const field = screen.querySelector(".field");
    errorEl.textContent = message;
    errorEl.hidden = false;
    if (field) field.classList.add("invalid");
    screen.classList.remove("shake");
    void screen.offsetWidth; // restart the shake animation
    screen.classList.add("shake");
  }

  function clearError(screen) {
    const errorEl = screen.querySelector(".error-msg");
    const field = screen.querySelector(".field");
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = "";
    }
    if (field) field.classList.remove("invalid");
  }

  function validateAndStore(screen) {
    const kind = screen.dataset.kind;

    if (kind === "text" || kind === "textarea") {
      const input = screen.querySelector("input, textarea");
      const value = input.value.trim();

      if (input.required && !value) {
        showError(screen, "Please fill this in — it's required.");
        return false;
      }
      const validate = VALIDATORS[input.name];
      if (value && validate) {
        const message = validate(value);
        if (message) {
          showError(screen, message);
          return false;
        }
      }
      answers[input.name] = value;
    }

    if (kind === "choice") {
      const group = screen.querySelector(".choices");
      const selected = screen.querySelector('.chip[aria-checked="true"]');
      if (!selected) {
        showError(screen, "Pick one to continue.");
        return false;
      }
      answers[group.dataset.name] = selected.dataset.value;
    }

    clearError(screen);
    return true;
  }

  function next() {
    const screen = screens[current];
    if (screen.dataset.kind === "review") return submit();
    if (screen.dataset.kind === "outro") return;
    if (!validateAndStore(screen)) return;
    goTo(current + 1);
  }

  function back() {
    const kind = screens[current].dataset.kind;
    if (kind === "intro" || kind === "outro") return;
    clearError(screens[current]);
    goTo(current - 1, { back: true });
  }

  /* ── Review & submit ── */

  function renderReview() {
    reviewList.innerHTML = "";
    Object.entries(LABELS).forEach(([name, label]) => {
      const row = document.createElement("div");
      row.className = "review-row";
      row.dataset.answer = name;

      const dt = document.createElement("dt");
      dt.textContent = label;

      const dd = document.createElement("dd");
      dd.textContent = answers[name] || "";
      if (!answers[name]) dd.classList.add("empty");

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "edit-btn";
      edit.textContent = "Edit";
      edit.setAttribute("aria-label", `Edit ${label.toLowerCase()}`);
      edit.addEventListener("click", () => {
        const target = screens.findIndex(
          (s) =>
            s.querySelector(`[name="${name}"]`) ||
            s.querySelector(`.choices[data-name="${name}"]`)
        );
        if (target !== -1) goTo(target, { back: true });
      });

      row.append(dt, dd, edit);
      reviewList.append(row);
    });
  }

  function renderSuccess() {
    const headline = document.getElementById("success-headline");
    headline.textContent = answers.firstName
      ? `Welcome aboard, ${answers.firstName}.`
      : "Welcome aboard.";
  }

  function submit() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...answers, submittedAt: new Date().toISOString() })
    );
    goTo(current + 1);
  }

  function restart() {
    Object.keys(answers).forEach((k) => delete answers[k]);
    screens.forEach((s) => {
      s.querySelectorAll("input, textarea").forEach((el) => (el.value = ""));
      s.querySelectorAll(".chip").forEach((el) => el.setAttribute("aria-checked", "false"));
      clearError(s);
    });
    goTo(0, { back: true });
  }

  /* ── Wiring ── */

  document.querySelectorAll('[data-action="next"]').forEach((btn) =>
    btn.addEventListener("click", next)
  );
  document.querySelector('[data-action="submit"]').addEventListener("click", submit);
  document.querySelector('[data-action="restart"]').addEventListener("click", restart);
  backBtn.addEventListener("click", back);

  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const group = chip.closest(".choices");
      group.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-checked", "false"));
      chip.setAttribute("aria-checked", "true");
      clearError(chip.closest(".screen"));
      setTimeout(next, SPEED ? 250 : 0);
    });
  });

  document.addEventListener("keydown", (event) => {
    const screen = screens[current];
    const kind = screen.dataset.kind;

    if (event.key === "Enter") {
      if (kind === "textarea" && event.shiftKey) return; // newline
      if (document.activeElement?.classList.contains("chip")) return; // let the chip's click fire
      if (document.activeElement?.classList.contains("edit-btn")) return;
      if (document.activeElement?.tagName === "BUTTON" && kind === "outro") return;
      event.preventDefault();
      next();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      back();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      next();
      return;
    }

    // Number keys select choices.
    if (kind === "choice" && /^[1-9]$/.test(event.key)) {
      const chips = screen.querySelectorAll(".chip");
      const chip = chips[Number(event.key) - 1];
      if (chip) chip.click();
    }
  });

  // Live-clear errors as the user types.
  document.querySelectorAll("input, textarea").forEach((el) =>
    el.addEventListener("input", () => clearError(el.closest(".screen")))
  );

  updateChrome();
  focusScreen(screens[0]);
})();
