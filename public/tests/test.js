import { createBaseDashboard } from "../assets/js/basedashboard.js";

const resultsEl = document.getElementById("results");
const originalFetch = window.fetch;

function renderResult(name, passed, errorMessage = "") {
  const li = document.createElement("li");
  li.className = passed ? "pass" : "fail";
  li.textContent = passed ? `PASS: ${name}` : `FAIL: ${name} - ${errorMessage}`;
  resultsEl.appendChild(li);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createMockResponse({ ok = true, status = 200, body = null } = {}) {
  return {
    ok,
    status,
    async text() {
      return body === null ? "" : JSON.stringify(body);
    },
  };
}

function setupFixture() {
  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div id="fixture-root">
        <span id="name-1"></span>
        <span id="name-2"></span>
        <a id="logout-link" href="../login.html">Sign out</a>
      </div>
    `
  );
}

function teardownFixture() {
  const fixture = document.getElementById("fixture-root");
  if (fixture) fixture.remove();
  localStorage.removeItem("srms_user");
  localStorage.removeItem("srms_context");
}

async function runTest(name, fn) {
  try {
    teardownFixture();
    setupFixture();
    await fn();
    renderResult(name, true);
  } catch (error) {
    renderResult(name, false, error.message || String(error));
  } finally {
    window.fetch = originalFetch;
    teardownFixture();
  }
}

async function testInitUsesConfigAndPersistsContext() {
  const calls = [];

  window.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return createMockResponse({
      ok: true,
      body: {
        ok: true,
        user: { name: "Alice" },
        context: { role: "teacher", department: "Science" },
      },
    });
  };

  let onReadyCalled = false;
  const dashboard = createBaseDashboard({
    nameTargets: ["name-1", "name-2"],
    fallbackName: "Teacher",
    onReady: async (me, helpers) => {
      onReadyCalled = true;
      assert(me.user.name === "Alice", "onReady should receive authenticated user");
      assert(typeof helpers.api === "function", "helpers.api should be a function");
      assert(typeof helpers.fillUserName === "function", "helpers.fillUserName should be a function");
    },
  });

  await dashboard.init();

  assert(calls.length >= 1, "Expected at least one API call");
  assert(calls[0].url === "../app/auth/me", "init should call the /app/auth/me endpoint");
  assert(document.getElementById("name-1").textContent === "Alice", "First target should contain user name");
  assert(document.getElementById("name-2").textContent === "Alice", "Second target should contain user name");
  assert(onReadyCalled, "onReady callback should be called after successful init");

  const storedUser = JSON.parse(localStorage.getItem("srms_user"));
  const storedContext = JSON.parse(localStorage.getItem("srms_context"));
  assert(storedUser.name === "Alice", "srms_user should be persisted");
  assert(storedContext.department === "Science", "srms_context should be persisted");
}

async function testHelperApiBuildsRelativePath() {
  window.fetch = async () => createMockResponse({ ok: true, body: { ok: true, user: { name: "A" }, context: {} } });

  const dashboard = createBaseDashboard();
  const path = dashboard.api("/app/auth/me");

  assert(path === "../app/auth/me", "api helper should normalize and prefix paths");
}

async function testLogoutHandlerPostsConfiguredPath() {
  const calls = [];
  const responseQueue = [
    createMockResponse({ ok: true, body: { ok: true, user: { name: "Bob" }, context: {} } }),
    createMockResponse({ ok: true, body: { ok: true } }),
  ];

  window.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    const next = responseQueue.shift();
    return next || createMockResponse({ ok: true, body: { ok: true } });
  };

  const dashboard = createBaseDashboard({
    logoutSelector: "#logout-link",
    logoutPath: "app/auth/logout",
    loginPath: window.location.href,
    nameTargets: ["name-1", "name-2"],
  });

  await dashboard.init();
  document.getElementById("logout-link").click();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert(calls.length >= 2, "Expected me + logout API calls");
  assert(calls[1].url === "../app/auth/logout", "Logout should call /app/auth/logout");
  assert((calls[1].options.method || "GET") === "POST", "Logout should use POST method");
}

(async function main() {
  await runTest("init uses config and persists session context", testInitUsesConfigAndPersistsContext);
  await runTest("api helper builds normalized relative paths", testHelperApiBuildsRelativePath);
  await runTest("logout handler posts to configured endpoint", testLogoutHandlerPostsConfiguredPath);
})();
