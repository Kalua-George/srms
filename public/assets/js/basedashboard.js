// public/assets/js/basedashboard.js
// Reusable dashboard bootstrap shared by role-specific dashboard modules.
import { apiFetch, setText } from "../js/api.js";

export function createBaseDashboard(config = {}) {
  const settings = {
    loginPath: "../login.html",
    mePath: "app/auth/me",
    logoutPath: "app/auth/logout",
    logoutSelector: 'a[href="../login.html"]',
    nameTargets: ["teacherName", "teacher-name-2", "teacher-name-display"],
    fallbackName: "User",
    onReady: null,
    ...config,
  };

  function baseApi(pathFromPublicRoot) {
    return `../${String(pathFromPublicRoot || "").replace(/^\//, "")}`;
  }

  async function loadMe() {
    const { res, data } = await apiFetch(baseApi(settings.mePath));

    if (!res.ok || !data?.ok) {
      window.location.href = settings.loginPath;
      return null;
    }

    return data;
  }

  async function logout() {
    try {
      await apiFetch(baseApi(settings.logoutPath), { method: "POST" });
    } finally {
      window.location.href = settings.loginPath;
    }
  }

  function wireLogout() {
    const logoutLink = document.querySelector(settings.logoutSelector);
    if (!logoutLink) return;

    logoutLink.addEventListener("click", async (event) => {
      event.preventDefault();
      await logout();
    });
  }

  function fillUserName(me) {
    const name = me?.user?.name || settings.fallbackName;
    settings.nameTargets.forEach((targetId) => setText(targetId, name));
    return name;
  }

  function persistContext(me) {
    localStorage.setItem("srms_user", JSON.stringify(me?.user || null));
    localStorage.setItem("srms_context", JSON.stringify(me?.context || null));
  }

  async function init() {
    wireLogout();

    const me = await loadMe();
    if (!me) return;

    fillUserName(me);
    persistContext(me);

    if (typeof settings.onReady === "function") {
      await settings.onReady(me, {
        api: baseApi,
        logout,
        fillUserName,
      });
    }
  }

  return {
    init,
    api: baseApi,
    loadMe,
    logout,
    fillUserName,
  };
}