// public/assets/js/teacher/teacher.js
import { apiFetch, setText, qs } from "../api.js";

function baseApi(pathFromPublicRoot) {
  // This page is /public/teacher/dashboard.html
  // API endpoints are /public/app/...
  // So use ../app/... relative paths
  return `../${pathFromPublicRoot.replace(/^\//, "")}`;
}

async function loadMe() {
  const { res, data } = await apiFetch(baseApi("app/auth/me"));

  if (!res.ok || !data?.ok) {
    // Session missing/expired → back to login
    window.location.href = "../login.html";
    return null;
  }
  return data;
}

function wireLogout() {
  // Your current HTML uses a link. We'll hijack it and do POST.
  const logoutLink = document.querySelector('a[href="../login.html"]');
  if (!logoutLink) return;

  logoutLink.addEventListener("click", async (e) => {
    e.preventDefault();

    try {
      await apiFetch(baseApi("app/auth/logout"), { method: "POST" });
    } finally {
      window.location.href = "../login.html";
    }
  });
}

function fillTeacherName(me) {
  const name = me?.user?.name || "Teacher";

  // Your HTML uses teacherName and teacher-name-2
  setText("teacherName", name);
  setText("teacher-name-2", name);
}

async function init() {
  wireLogout();

  const me = await loadMe();
  if (!me) return;

  fillTeacherName(me);

  // Optional: you can also store it for quick access elsewhere
  localStorage.setItem("srms_user", JSON.stringify(me.user || null));
  localStorage.setItem("srms_context", JSON.stringify(me.context || null));

  // Later: load classes, exams, timetable, etc.
  // For now we just prove auth + rendering works.
}

document.addEventListener("DOMContentLoaded", init);