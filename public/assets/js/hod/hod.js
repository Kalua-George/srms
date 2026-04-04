import { createBaseDashboard } from "../basedashboard.js";
import { apiCall, showNotification } from "../formHelpers.js";

let hodState = {
  me: null,
  departmentId: null,
  departmentName: "Department",
  teachers: [],
  classOptions: [],
  subjectOptions: [],
  assignmentRequests: [],
};

function setupMobileSidebar() {
  const toggleButton = document.getElementById("menu-toggle");
  const sidebar = document.getElementById("side_bar");
  const backdrop = document.getElementById("sidebar-backdrop");
  const mobileBreakpoint = 980;

  if (!toggleButton || !sidebar || !backdrop) return;

  const closeSidebar = () => {
    document.body.classList.remove("mobile-menu-open");
    toggleButton.setAttribute("aria-expanded", "false");
  };

  const openSidebar = () => {
    document.body.classList.add("mobile-menu-open");
    toggleButton.setAttribute("aria-expanded", "true");
  };

  toggleButton.addEventListener("click", () => {
    if (document.body.classList.contains("mobile-menu-open")) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  backdrop.addEventListener("click", closeSidebar);

  document.querySelectorAll("#side_bar .nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= mobileBreakpoint) closeSidebar();
    });
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > mobileBreakpoint) closeSidebar();
  });
}

function gradeFromScore(score) {
  const s = Number(score);
  if (Number.isNaN(s)) return "-";
  if (s >= 80) return "A";
  if (s >= 70) return "B";
  if (s >= 60) return "C";
  if (s >= 50) return "D";
  return "F";
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function escapeHtml(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function uniqBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  arr.forEach((item) => {
    const k = keyFn(item);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(item);
    }
  });
  return out;
}

function setupPanelSwitching() {
  const panels = {
    dashboard: document.getElementById("dashboard-content"),
    classes: document.getElementById("class-list"),
    attendance: document.getElementById("attendance-panel"),
    teachers: document.getElementById("dept-teachers-panel"),
    exams: document.getElementById("exam-management-panel"),
    performance: document.getElementById("dept-performance-panel"),
    discipline: document.getElementById("discipline-panel"),
    reports: document.getElementById("reports-panel"),
  };

  const linkToPanel = {
    "dashboard-link": "dashboard",
    "class-list-link": "classes",
    "attendance-panel-link": "attendance",
    "dept-teachers-panel-link": "teachers",
    "exam-management-panel-link": "exams",
    "dept-performance-panel-link": "performance",
    "discipline-panel-link": "discipline",
    "reports-panel-link": "reports",
  };

  async function showPanel(panelKey) {
    Object.values(panels).forEach((panel) => {
      if (panel) panel.style.display = "none";
    });

    const selectedPanel = panels[panelKey];
    if (selectedPanel) selectedPanel.style.display = "block";

    document.querySelectorAll(".nav-link").forEach((l) => l.classList.remove("active"));
    const activeLink = Object.keys(linkToPanel).find((id) => linkToPanel[id] === panelKey);
    if (activeLink) document.getElementById(activeLink)?.classList.add("active");

    await loadPanelData(panelKey);
  }

  Object.keys(linkToPanel).forEach((linkId) => {
    const link = document.getElementById(linkId);
    if (!link) return;

    link.addEventListener("click", async (event) => {
      event.preventDefault();
      await showPanel(linkToPanel[linkId]);
    });
  });

  showPanel("dashboard");
}

async function loadDashboard() {
  try {
    const res = await apiCall("GET", "/app/hod/dashboard");
    const data = res?.data || {};

    hodState.departmentId = data.department_id || null;
    hodState.departmentName = data.department_name || "Department";
    hodState.teachers = data.teachers || [];

    setText("departmentName", hodState.departmentName);
    setText("dept-label", hodState.departmentName);

    setText("stat-teachers-total", data.summary?.teachers_total ?? 0);
    setText("stat-teachers-classes", data.summary?.teachers_with_classes ?? 0);
    setText("stat-teachers-subjects", data.summary?.teachers_with_subjects ?? 0);

    await loadAssignmentRequests(true);
    setText(
      "stat-pending-requests",
      (hodState.assignmentRequests || []).filter((r) => r.status === "pending").length
    );
  } catch (error) {
    showNotification(`Dashboard load failed: ${error.message}`, "error");
  }
}

async function loadDepartmentTeachers() {
  const tbody = document.getElementById("dept-teachers-table");
  const empty = document.getElementById("no-teachers");

  try {
    const res = await apiCall("GET", "/app/hod/teachers");
    const rows = res?.data || [];
    hodState.teachers = rows;

    if (!rows.length) {
      tbody.innerHTML = "";
      empty.style.display = "block";
      return;
    }

    empty.style.display = "none";
    tbody.innerHTML = rows
      .map(
        (t) => `
      <tr>
        <td>${escapeHtml(`${t.firstname || ""} ${t.lastname || ""}`.trim())}</td>
        <td>${escapeHtml(t.role || "teacher")}</td>
        <td>${escapeHtml(t.teacher_code || "-")}</td>
        <td>
          <button class="btn-primary btn-sm request-assignment-btn" data-teacher-id="${t.id}" data-teacher-name="${escapeHtml(`${t.firstname || ""} ${t.lastname || ""}`.trim())}">Request Assignment</button>
        </td>
      </tr>
    `
      )
      .join("");

    bindTeacherActions();
  } catch (error) {
    showNotification(`Failed to load teachers: ${error.message}`, "error");
  }
}

async function loadMyClasses() {
  const tbody = document.getElementById("my-classes-table");
  const empty = document.getElementById("no-my-classes");
  const me = hodState.me;
  if (!me?.id) return;

  try {
    const res = await apiCall("GET", `/app/hod/teacher-classes?teacher_id=${me.id}`);
    const rows = res?.data || [];

    if (!rows.length) {
      tbody.innerHTML = "";
      empty.style.display = "block";
      return;
    }

    empty.style.display = "none";
    tbody.innerHTML = rows
      .map(
        (r) => `
      <tr>
        <td>${escapeHtml(r.name || `Class ${r.id}`)}</td>
        <td>${escapeHtml(r.form_id || "-")}</td>
      </tr>
    `
      )
      .join("");
  } catch (error) {
    showNotification(`Failed to load personal classes: ${error.message}`, "error");
  }
}

async function loadClassAndSubjectOptions() {
  try {
    const classesRes = await apiCall("GET", "/app/hod/classes");
    const classOptions = (classesRes?.data || [])
      .map((c) => ({
        id: Number(c.id),
        name: c.name || `Class ${c.id}`,
      }))
      .filter((c) => c.id > 0);

    hodState.classOptions = classOptions;

    const classSelect = document.getElementById("assign-class-id");
    const attendanceClassSelect = document.getElementById("attendance-class-select");

    const classOptionsHtml =
      '<option value="">Select class</option>' +
      classOptions.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");

    if (classSelect) classSelect.innerHTML = classOptionsHtml;
    if (attendanceClassSelect) attendanceClassSelect.innerHTML = classOptionsHtml;

    if (!classOptions.length) {
      showNotification("No classes found in the database", "warning");
    }

    const subjectsRes = await apiCall("GET", "/app/hod/department-subjects");
    const subjectOptions = uniqBy(
      (subjectsRes?.data || [])
        .map((s) => ({ id: Number(s.id), name: s.name || `Subject ${s.id}` }))
        .filter((s) => s.id > 0),
      (s) => s.id
    );

    hodState.subjectOptions = subjectOptions;
    const subjectSelect = document.getElementById("assign-subject-id");
    if (subjectSelect) {
      subjectSelect.innerHTML =
        '<option value="">Select subject</option>' +
        subjectOptions.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
    }

    if (!subjectOptions.length) {
      showNotification("No subjects configured for your department", "warning");
    }
  } catch (error) {
    showNotification(`Failed loading class/subject options: ${error.message}`, "warning");
  }
}

async function loadExamManagement() {
  const tbody = document.getElementById("exam-table-body");
  const empty = document.getElementById("no-exams");

  try {
    const typeFilter = document.getElementById("exam-type-filter")?.value || "";
    const res = await apiCall("GET", "/app/exams");
    let rows = res?.data || [];

    if (typeFilter) {
      rows = rows.filter((e) => String(e.exam_type || "").toLowerCase() === typeFilter.toLowerCase());
    }

    if (!rows.length) {
      tbody.innerHTML = "";
      empty.style.display = "block";
      return;
    }

    empty.style.display = "none";
    tbody.innerHTML = rows
      .map(
        (e) => `
      <tr>
        <td>${escapeHtml(e.name || e.title || `Exam ${e.id}`)}</td>
        <td>${escapeHtml(e.exam_type || "-")}</td>
        <td>${escapeHtml((e.start_date || "-") + " to " + (e.end_date || "-"))}</td>
        <td>${escapeHtml(String(e.subject_count || e.subjects_count || "-"))}</td>
      </tr>
    `
      )
      .join("");
  } catch (error) {
    showNotification(`Failed to load exams: ${error.message}`, "error");
  }
}

async function loadPerformance() {
  const tbody = document.getElementById("performance-table-body");
  const empty = document.getElementById("no-performance");

  try {
    const examsRes = await apiCall("GET", "/app/exams");
    const exams = examsRes?.data || [];

    if (!exams.length) {
      tbody.innerHTML = "";
      empty.style.display = "block";
      setText("perf-avg", "-");
      setText("perf-pass-rate", "-");
      setText("perf-fail-rate", "-");
      return;
    }

    const latestExam = exams[0];
    const gradesRes = await apiCall("GET", `/app/exams/grades?exam_id=${latestExam.id}`);
    const grades = gradesRes?.data || [];

    if (!grades.length) {
      tbody.innerHTML = "";
      empty.style.display = "block";
      setText("perf-avg", "-");
      setText("perf-pass-rate", "-");
      setText("perf-fail-rate", "-");
      return;
    }

    empty.style.display = "none";

    const scores = grades.map((g) => Number(g.score || 0));
    const total = scores.reduce((a, b) => a + b, 0);
    const avg = total / Math.max(scores.length, 1);
    const passCount = scores.filter((s) => s >= 50).length;
    const failCount = scores.filter((s) => s < 50).length;

    setText("perf-avg", `${avg.toFixed(1)}%`);
    setText("perf-pass-rate", `${((passCount / scores.length) * 100).toFixed(1)}%`);
    setText("perf-fail-rate", `${((failCount / scores.length) * 100).toFixed(1)}%`);

    tbody.innerHTML = grades
      .slice(0, 120)
      .map(
        (g) => `
      <tr>
        <td>${escapeHtml(`${g.fname || ""} ${g.lname || ""}`.trim())}</td>
        <td>${escapeHtml(g.subject_name || "-")}</td>
        <td>${escapeHtml(g.score ?? "-")}</td>
        <td>${escapeHtml(gradeFromScore(g.score))}</td>
      </tr>
    `
      )
      .join("");
  } catch (error) {
    showNotification(`Performance load failed: ${error.message}`, "warning");
  }
}

async function loadDiscipline() {
  const tbody = document.getElementById("discipline-table-body");
  const empty = document.getElementById("no-discipline");

  try {
    const from = document.getElementById("discipline-from")?.value || "";
    const to = document.getElementById("discipline-to")?.value || "";

    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);

    const path = qs.toString() ? `/app/discipline/list?${qs.toString()}` : "/app/discipline/list";
    const res = await apiCall("GET", path);
    const rows = res?.data || [];

    if (!rows.length) {
      tbody.innerHTML = "";
      empty.style.display = "block";
      return;
    }

    empty.style.display = "none";
    tbody.innerHTML = rows
      .slice(0, 150)
      .map(
        (r) => `
      <tr>
        <td>${escapeHtml(`${r.fname || ""} ${r.lname || ""}`.trim())}</td>
        <td>${escapeHtml(r.type_name || "-")}</td>
        <td>${escapeHtml(r.incident_date || "-")}</td>
        <td>${escapeHtml(`${r.reporter_firstname || ""} ${r.reporter_lastname || ""}`.trim())}</td>
        <td>${escapeHtml(r.description || "-")}</td>
      </tr>
    `
      )
      .join("");
  } catch (error) {
    showNotification(`Discipline load failed: ${error.message}`, "error");
  }
}

async function loadAttendanceOverview() {
  const tbody = document.getElementById("attendance-table-body");
  const empty = document.getElementById("no-attendance");

  try {
    const classId = document.getElementById("attendance-class-select")?.value;
    const date = document.getElementById("attendance-date-select")?.value;

    if (!classId || !date) {
      tbody.innerHTML = "";
      empty.style.display = "block";
      return;
    }

    const res = await apiCall("GET", `/app/attendance/class?class_id=${classId}&date=${date}`);
    const rows = res?.data || [];

    if (!rows.length) {
      tbody.innerHTML = "";
      empty.style.display = "block";
      return;
    }

    empty.style.display = "none";
    tbody.innerHTML = rows
      .map(
        (r) => `
      <tr>
        <td>${escapeHtml(`${r.fname || ""} ${r.lname || ""}`.trim())}</td>
        <td>${escapeHtml(r.status || "-")}</td>
        <td>${escapeHtml(r.attendance_date || "-")}</td>
      </tr>
    `
      )
      .join("");
  } catch (error) {
    showNotification(`Attendance load failed: ${error.message}`, "warning");
  }
}

async function loadAssignmentRequests(skipRender = false) {
  try {
    const res = await apiCall("GET", "/app/hod/assignment-requests");
    hodState.assignmentRequests = res?.data || [];

    if (skipRender) return;

    const tbody = document.getElementById("requests-table-body");
    const empty = document.getElementById("no-requests");

    if (!hodState.assignmentRequests.length) {
      tbody.innerHTML = "";
      empty.style.display = "block";
      return;
    }

    empty.style.display = "none";
    tbody.innerHTML = hodState.assignmentRequests
      .map(
        (r) => `
      <tr>
        <td>${r.id}</td>
        <td>${escapeHtml(`${r.firstname || ""} ${r.lastname || ""}`.trim())}</td>
        <td>${escapeHtml(r.assignment_type || "-")}</td>
        <td>${escapeHtml(r.target_id || "-")}</td>
        <td>${escapeHtml(r.status || "-")}</td>
        <td>${escapeHtml(r.decision_note || "-")}</td>
      </tr>
    `
      )
      .join("");
  } catch (error) {
    if (!skipRender) showNotification(`Requests load failed: ${error.message}`, "warning");
  }
}

function openAssignmentModal(teacherId, teacherName) {
  const modal = document.getElementById("assignment-modal");
  document.getElementById("assign-teacher-id").value = teacherId;
  document.getElementById("assign-teacher-name").value = teacherName;
  modal.classList.add("show");
}

function closeAssignmentModal() {
  document.getElementById("assignment-modal")?.classList.remove("show");
}

async function submitAssignmentRequest() {
  const teacherId = Number(document.getElementById("assign-teacher-id")?.value || 0);
  const classId = Number(document.getElementById("assign-class-id")?.value || 0);
  const subjectId = Number(document.getElementById("assign-subject-id")?.value || 0);

  if (!teacherId) {
    showNotification("Missing teacher selection", "warning");
    return;
  }

  if (!classId) {
    showNotification("Select class", "warning");
    return;
  }

  if (!subjectId) {
    showNotification("Select subject", "warning");
    return;
  }

  await apiCall("POST", "/app/hod/assign-both", {
    teacher_id: teacherId,
    class_id: classId,
    subject_id: subjectId,
  });
  showNotification("Class and subject assignment requests submitted", "success");

  closeAssignmentModal();
  await loadAssignmentRequests();
  setText(
    "stat-pending-requests",
    (hodState.assignmentRequests || []).filter((r) => r.status === "pending").length
  );
}

function bindTeacherActions() {
  document.querySelectorAll(".request-assignment-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      openAssignmentModal(btn.dataset.teacherId, btn.dataset.teacherName);
    });
  });
}

function bindStaticActions() {
  document.getElementById("assignment-modal-close")?.addEventListener("click", closeAssignmentModal);
  document.getElementById("assignment-cancel")?.addEventListener("click", closeAssignmentModal);
  document.getElementById("assignment-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "assignment-modal") closeAssignmentModal();
  });

  document.getElementById("assignment-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await submitAssignmentRequest();
    } catch (error) {
      showNotification(`Request failed: ${error.message}`, "error");
    }
  });

  document.getElementById("exam-filter-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await loadExamManagement();
  });

  document.getElementById("discipline-filter-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await loadDiscipline();
  });

  document.getElementById("attendance-view-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await loadAttendanceOverview();
  });

  document.getElementById("qa-open-exam")?.addEventListener("click", () => {
    document.getElementById("exam-management-panel-link")?.click();
  });

  document.getElementById("qa-open-assignment")?.addEventListener("click", async () => {
    if (!hodState.teachers.length) await loadDepartmentTeachers();
    if (!hodState.teachers.length) {
      showNotification("No teachers available", "warning");
      return;
    }
    const t = hodState.teachers[0];
    openAssignmentModal(t.id, `${t.firstname || ""} ${t.lastname || ""}`.trim());
  });

  document.getElementById("qa-open-reports")?.addEventListener("click", () => {
    document.getElementById("reports-panel-link")?.click();
  });
}

async function loadPanelData(panelKey) {
  switch (panelKey) {
    case "dashboard":
      await loadDashboard();
      break;
    case "teachers":
      await loadDepartmentTeachers();
      break;
    case "classes":
      await loadMyClasses();
      break;
    case "attendance":
      await loadAttendanceOverview();
      break;
    case "exams":
      await loadExamManagement();
      break;
    case "performance":
      await loadPerformance();
      break;
    case "discipline":
      await loadDiscipline();
      break;
    case "reports":
      await loadAssignmentRequests();
      break;
    default:
      break;
  }
}

const dashboard = createBaseDashboard({
  fallbackName: "HOD",
  nameTargets: ["teacherName", "teacher-name-2"],
  onReady: async (me) => {
    setupMobileSidebar();
    hodState.me = me?.user || null;

    const dateInput = document.getElementById("attendance-date-select");
    if (dateInput) dateInput.valueAsDate = new Date();

    const fromInput = document.getElementById("discipline-from");
    const toInput = document.getElementById("discipline-to");
    if (fromInput && toInput) {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      fromInput.value = first.toISOString().split("T")[0];
      toInput.value = now.toISOString().split("T")[0];
    }

    await loadDashboard();
    await loadDepartmentTeachers();
    await loadClassAndSubjectOptions();

    bindStaticActions();
    setupPanelSwitching();
  },
});

document.addEventListener("DOMContentLoaded", () => {
  dashboard.init();
});
