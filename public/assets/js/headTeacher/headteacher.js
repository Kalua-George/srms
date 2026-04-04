import { createBaseDashboard } from "../basedashboard.js";
import { apiCall, showNotification } from "../formHelpers.js";

const state = {
  me: null,
  teachers: [],
  departments: [],
  forms: [],
  classes: [],
  subjects: [],
  exams: [],
  pendingRequests: [],
  approvedRequests: [],
  rejectedRequests: [],
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

function gradeFromScore(score) {
  const s = Number(score);
  if (Number.isNaN(s)) return "-";
  if (s >= 80) return "A";
  if (s >= 70) return "B";
  if (s >= 60) return "C";
  if (s >= 50) return "D";
  return "F";
}

function uniqBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  arr.forEach((item) => {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  });
  return out;
}

function setupPanelSwitching() {
  const panels = {
    dashboard: document.getElementById("dashboard-overview"),
    teachers: document.getElementById("teachers-panel"),
    classes: document.getElementById("classes-panel"),
    subjects: document.getElementById("subjects-panel"),
    exams: document.getElementById("exams-panel"),
    performance: document.getElementById("performance-panel"),
    discipline: document.getElementById("discipline-panel"),
    approval: document.getElementById("allocation-approvals-panel"),
    reports: document.getElementById("reports-panel"),
  };

  const linkToPanel = {
    "dashboard-link": "dashboard",
    "teachers-link": "teachers",
    "classes-link": "classes",
    "subjects-link": "subjects",
    "exams-link": "exams",
    "performance-link": "performance",
    "discipline-link": "discipline",
    "approval-link": "approval",
    "reports-link": "reports",
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

async function loadDashboardOverview() {
  try {
    const res = await apiCall("GET", "/app/head/dashboard");
    const data = res?.data || {};

    setText("count-students", data.counts?.students ?? 0);
    setText("count-teachers", data.counts?.teachers ?? 0);
    setText("count-classes", data.counts?.classes ?? 0);

    await loadRequestBuckets(true);
    setText("count-pending-requests", state.pendingRequests.length);
  } catch (error) {
    showNotification(`Dashboard load failed: ${error.message}`, "error");
  }
}

async function loadDepartmentsAndFormsAndSubjects() {
  try {
    const [departmentsRes, formsRes, subjectsRes] = await Promise.all([
      apiCall("GET", "/app/departments"),
      apiCall("GET", "/app/head/forms"),
      apiCall("GET", "/app/head/subjects"),
    ]);

    state.departments = departmentsRes?.data || [];
    state.forms = formsRes?.data || [];
    state.subjects = subjectsRes?.data || [];

    renderDepartmentOptions();
    renderFormOptions();
    renderStudentFormOptions();
    renderExamSubjectsOptions();
  } catch (error) {
    showNotification(`Reference data load failed: ${error.message}`, "warning");
  }
}

async function loadTeachers() {
  const tbody = document.getElementById("teachers-table-body");
  const empty = document.getElementById("teachers-empty");

  try {
    const res = await apiCall("GET", "/app/head/teachers");
    const rows = res?.data || [];
    state.teachers = rows;

    if (!rows.length) {
      tbody.innerHTML = "";
      empty.style.display = "block";
      renderStudentClassOptions();
      return;
    }

    empty.style.display = "none";
    tbody.innerHTML = rows
      .map(
        (t) => `
      <tr>
        <td>${escapeHtml(`${t.firstname || ""} ${t.lastname || ""}`.trim())}</td>
        <td>${escapeHtml(t.teacher_code || "-")}</td>
        <td>${escapeHtml(t.role || "teacher")}</td>
        <td>${escapeHtml(t.department_name || "-")}</td>
        <td>${escapeHtml(t.contact_no || "-")}</td>
        <td>
          <button class="btn-sm edit-teacher-btn" data-id="${t.id}">Edit</button>
          <button class="btn-sm danger delete-teacher-btn" data-id="${t.id}">Delete</button>
        </td>
      </tr>
    `
      )
      .join("");

    bindTeacherRowActions();
  } catch (error) {
    showNotification(`Teachers load failed: ${error.message}`, "error");
  }
}

async function loadClasses() {
  const tbody = document.getElementById("classes-table-body");
  const empty = document.getElementById("classes-empty");

  try {
    const res = await apiCall("GET", "/app/head/classes");
    const rows = res?.data || [];
    state.classes = rows;

    if (!rows.length) {
      tbody.innerHTML = "";
      empty.style.display = "block";
      return;
    }

    empty.style.display = "none";
    tbody.innerHTML = rows
      .map(
        (c) => `
      <tr>
        <td>${escapeHtml(c.name || `Class ${c.id}`)}</td>
        <td>${escapeHtml(c.form_name || "-")}</td>
        <td>${escapeHtml(c.academic_year_id || "-")}</td>
        <td>${escapeHtml(c.term_id || "-")}</td>
      </tr>
    `
      )
      .join("");

    renderStudentClassOptions();
  } catch (error) {
    showNotification(`Classes load failed: ${error.message}`, "error");
  }
}

async function loadSubjects() {
  const tbody = document.getElementById("subjects-table-body");
  const empty = document.getElementById("subjects-empty");

  try {
    const res = await apiCall("GET", "/app/head/subjects");
    const rows = res?.data || [];
    state.subjects = rows;

    if (!rows.length) {
      tbody.innerHTML = "";
      empty.style.display = "block";
      return;
    }

    empty.style.display = "none";
    tbody.innerHTML = rows
      .map(
        (s) => `
      <tr>
        <td>${s.id}</td>
        <td>${escapeHtml(s.name || "-")}</td>
      </tr>
    `
      )
      .join("");

    renderExamSubjectsOptions();
  } catch (error) {
    showNotification(`Subjects load failed: ${error.message}`, "error");
  }
}

async function loadExams() {
  const tbody = document.getElementById("exams-table-body");
  const empty = document.getElementById("exams-empty");

  try {
    const res = await apiCall("GET", "/app/head/exams");
    const rows = res?.data || [];
    state.exams = rows;

    if (!rows.length) {
      tbody.innerHTML = "";
      empty.style.display = "block";
      return;
    }

    empty.style.display = "none";

    const withSubjects = await Promise.all(
      rows.map(async (e) => {
        try {
          const sr = await apiCall("GET", `/app/head/exams/subjects?exam_id=${e.id}`);
          const list = sr?.data || [];
          return { ...e, subject_count: list.length };
        } catch (_) {
          return { ...e, subject_count: 0 };
        }
      })
    );

    tbody.innerHTML = withSubjects
      .map(
        (e) => `
      <tr>
        <td>${escapeHtml(e.name || `Exam ${e.id}`)}</td>
        <td>${escapeHtml(e.exam_type || "-")}</td>
        <td>${escapeHtml(e.start_date || "-")}</td>
        <td>${escapeHtml(e.end_date || "-")}</td>
        <td>${escapeHtml(e.subject_count)}</td>
      </tr>
    `
      )
      .join("");
  } catch (error) {
    showNotification(`Exams load failed: ${error.message}`, "error");
  }
}

async function loadPerformance() {
  const tbody = document.getElementById("performance-table-body");
  const empty = document.getElementById("performance-empty");

  try {
    const examsRes = await apiCall("GET", "/app/head/exams");
    const exams = examsRes?.data || [];

    if (!exams.length) {
      tbody.innerHTML = "";
      empty.style.display = "block";
      setText("perf-average", "-");
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
      setText("perf-average", "-");
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

    setText("perf-average", `${avg.toFixed(1)}%`);
    setText("perf-pass-rate", `${((passCount / scores.length) * 100).toFixed(1)}%`);
    setText("perf-fail-rate", `${((failCount / scores.length) * 100).toFixed(1)}%`);

    tbody.innerHTML = grades
      .slice(0, 150)
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
  const empty = document.getElementById("discipline-empty");

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
      .slice(0, 200)
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

async function loadRequestBuckets(skipReport = false) {
  try {
    const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
      apiCall("GET", "/app/head/assignment-requests?status=pending"),
      apiCall("GET", "/app/head/assignment-requests?status=approved"),
      apiCall("GET", "/app/head/assignment-requests?status=rejected"),
    ]);

    state.pendingRequests = pendingRes?.data || [];
    state.approvedRequests = approvedRes?.data || [];
    state.rejectedRequests = rejectedRes?.data || [];

    if (!skipReport) {
      renderApprovalTables();
      renderReportCards();
    }
  } catch (error) {
    showNotification(`Request load failed: ${error.message}`, "error");
  }
}

function renderApprovalTables() {
  const pendingBody = document.getElementById("pending-requests-body");
  const pendingEmpty = document.getElementById("pending-empty");
  const decisionsBody = document.getElementById("decisions-body");
  const decisionsEmpty = document.getElementById("decisions-empty");

  if (!state.pendingRequests.length) {
    pendingBody.innerHTML = "";
    pendingEmpty.style.display = "block";
  } else {
    pendingEmpty.style.display = "none";
    pendingBody.innerHTML = state.pendingRequests
      .map(
        (r) => `
      <tr>
        <td>${r.id}</td>
        <td>${escapeHtml(r.created_at || "-")}</td>
        <td>${escapeHtml(`${r.requested_by_firstname || ""} ${r.requested_by_lastname || ""}`.trim())}</td>
        <td>${escapeHtml(`${r.firstname || ""} ${r.lastname || ""}`.trim())}</td>
        <td>${escapeHtml(r.class_name || (r.class_id ? `Class #${r.class_id}` : "-"))}</td>
        <td>${escapeHtml(r.subject_name || (r.subject_id ? `Subject #${r.subject_id}` : "-"))}</td>
        <td>
          <button class="btn-sm approve-btn" data-id="${r.id}">Approve</button>
          <button class="btn-sm danger reject-btn" data-id="${r.id}">Reject</button>
        </td>
      </tr>
    `
      )
      .join("");

    bindApprovalActionButtons();
  }

  const decisions = [...state.approvedRequests.slice(0, 10), ...state.rejectedRequests.slice(0, 10)]
    .sort((a, b) => String(b.approved_at || "").localeCompare(String(a.approved_at || "")));

  if (!decisions.length) {
    decisionsBody.innerHTML = "";
    decisionsEmpty.style.display = "block";
  } else {
    decisionsEmpty.style.display = "none";
    decisionsBody.innerHTML = decisions
      .map(
        (d) => `
      <tr>
        <td>${d.id}</td>
        <td>${escapeHtml(`${d.firstname || ""} ${d.lastname || ""}`.trim())}</td>
        <td>${escapeHtml(d.class_name || (d.class_id ? `Class #${d.class_id}` : "-"))}</td>
        <td>${escapeHtml(d.subject_name || (d.subject_id ? `Subject #${d.subject_id}` : "-"))}</td>
        <td>${escapeHtml(d.status || "-")}</td>
        <td>${escapeHtml(d.decision_note || "-")}</td>
      </tr>
    `
      )
      .join("");
  }

  setText("count-pending-requests", state.pendingRequests.length);
}

function renderReportCards() {
  const approved = state.approvedRequests.length;
  const rejected = state.rejectedRequests.length;
  const pending = state.pendingRequests.length;
  const totalDecided = approved + rejected;
  const rate = totalDecided > 0 ? ((approved / totalDecided) * 100).toFixed(1) : "0.0";

  setText("report-approved", approved);
  setText("report-rejected", rejected);
  setText("report-pending", pending);
  setText("report-approval-rate", `${rate}%`);
}

function openModal(id) {
  document.getElementById(id)?.classList.add("show");
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove("show");
}

function renderDepartmentOptions() {
  const select = document.getElementById("teacher-department");
  if (!select) return;

  select.innerHTML =
    '<option value="">No department</option>' +
    (state.departments || [])
      .map((d) => `<option value="${d.id}">${escapeHtml(d.name || `Department ${d.id}`)}</option>`)
      .join("");
}

function renderFormOptions() {
  const select = document.getElementById("class-form-id");
  if (!select) return;

  select.innerHTML =
    '<option value="">Select form</option>' +
    (state.forms || [])
      .map((f) => `<option value="${f.id}">${escapeHtml(f.name || `Form ${f.id}`)}</option>`)
      .join("");
}

function renderStudentFormOptions() {
  const select = document.getElementById("student-form-id");
  if (!select) return;

  select.innerHTML =
    '<option value="">Select form</option>' +
    (state.forms || [])
      .map((f) => `<option value="${f.id}">${escapeHtml(f.name || `Form ${f.id}`)}</option>`)
      .join("");
}

function renderStudentClassOptions() {
  const select = document.getElementById("student-class-id");
  if (!select) return;

  select.innerHTML =
    '<option value="">Select class</option>' +
    (state.classes || [])
      .map((c) => `<option value="${c.id}">${escapeHtml(c.name || `Class ${c.id}`)}</option>`)
      .join("");
}

function renderExamSubjectsOptions() {
  const select = document.getElementById("exam-subjects");
  if (!select) return;

  select.innerHTML = (state.subjects || [])
    .map((s) => `<option value="${s.id}">${escapeHtml(s.name || `Subject ${s.id}`)}</option>`)
    .join("");
}

function fillTeacherForm(teacher = null) {
  document.getElementById("teacher-id").value = teacher?.id || "";
  document.getElementById("teacher-code").value = teacher?.teacher_code || "";
  document.getElementById("teacher-firstname").value = teacher?.firstname || "";
  document.getElementById("teacher-lastname").value = teacher?.lastname || "";
  document.getElementById("teacher-contact").value = teacher?.contact_no || "";
  document.getElementById("teacher-role").value = teacher?.role || "teacher";
  document.getElementById("teacher-department").value = teacher?.department_id || "";
  setText("teacher-modal-title", teacher ? "Edit Teacher" : "Create Teacher");
}

async function saveTeacher() {
  const id = document.getElementById("teacher-id").value;
  const payload = {
    teacher_code: document.getElementById("teacher-code").value.trim(),
    firstname: document.getElementById("teacher-firstname").value.trim(),
    lastname: document.getElementById("teacher-lastname").value.trim(),
    contact_no: document.getElementById("teacher-contact").value.trim(),
    role: document.getElementById("teacher-role").value,
    department_id: document.getElementById("teacher-department").value || null,
  };

  if (!payload.firstname || !payload.lastname) {
    showNotification("Firstname and lastname are required", "warning");
    return;
  }

  if (id) {
    payload.id = Number(id);
    await apiCall("POST", "/app/head/teachers/update", payload);
    showNotification("Teacher updated", "success");
  } else {
    await apiCall("POST", "/app/head/teachers/create", payload);
    showNotification("Teacher created", "success");
  }

  closeModal("teacher-modal");
  await loadTeachers();
  await loadDashboardOverview();
}

async function deleteTeacher(teacherId) {
  await apiCall("POST", "/app/head/teachers/delete", { id: Number(teacherId) });
  showNotification("Teacher deleted", "success");
  await loadTeachers();
  await loadDashboardOverview();
}

async function createClass() {
  const name = document.getElementById("class-name").value.trim();
  const formId = Number(document.getElementById("class-form-id").value || 0);

  if (!name || !formId) {
    showNotification("Class name and form are required", "warning");
    return;
  }

  await apiCall("POST", "/app/head/classes/create", {
    name,
    form_id: formId,
  });

  showNotification("Class created", "success");
  closeModal("class-modal");
  document.getElementById("class-form").reset();
  await loadClasses();
  await loadDashboardOverview();
}

async function createStudent() {
  const payload = {
    student_code: document.getElementById("student-code").value.trim() || null,
    fname: document.getElementById("student-firstname").value.trim(),
    lname: document.getElementById("student-lastname").value.trim(),
    class_id: Number(document.getElementById("student-class-id").value || 0),
    form_id: Number(document.getElementById("student-form-id").value || 0),
    dob: document.getElementById("student-dob").value || null,
    home: document.getElementById("student-home").value.trim() || null,
    parent_contact: document.getElementById("student-parent-contact").value.trim() || null,
  };

  if (!payload.fname || !payload.lname || !payload.class_id || !payload.form_id) {
    showNotification("Firstname, lastname, class and form are required", "warning");
    return;
  }

  await apiCall("POST", "/app/students/create", payload);
  showNotification("Student created", "success");

  closeModal("student-modal");
  document.getElementById("student-form").reset();
  await loadDashboardOverview();
}

async function createExam() {
  const name = document.getElementById("exam-name").value.trim();
  const examType = document.getElementById("exam-type").value;
  const startDate = document.getElementById("exam-start").value;
  const endDate = document.getElementById("exam-end").value;

  const subjectsSelect = document.getElementById("exam-subjects");
  const subjectIds = Array.from(subjectsSelect.selectedOptions).map((o) => Number(o.value));

  if (!name || !examType || !startDate || !endDate) {
    showNotification("Name, type, start and end dates are required", "warning");
    return;
  }

  await apiCall("POST", "/app/head/exams/create", {
    name,
    exam_type: examType,
    start_date: startDate,
    end_date: endDate,
    subject_ids: subjectIds,
  });

  showNotification("Exam created", "success");
  closeModal("exam-modal");
  document.getElementById("exam-form").reset();
  await loadExams();
}

function bindTeacherRowActions() {
  document.querySelectorAll(".edit-teacher-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);
      const teacher = state.teachers.find((t) => Number(t.id) === id);
      fillTeacherForm(teacher || null);
      openModal("teacher-modal");
    });
  });

  document.querySelectorAll(".delete-teacher-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number(btn.dataset.id);
      if (!id) return;
      if (!window.confirm("Delete this teacher?")) return;
      try {
        await deleteTeacher(id);
      } catch (error) {
        showNotification(`Delete failed: ${error.message}`, "error");
      }
    });
  });
}

function bindApprovalActionButtons() {
  document.querySelectorAll(".approve-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("approval-request-id").value = btn.dataset.id;
      document.getElementById("approval-action").value = "approve";
      setText("approval-title", "Approve Request");
      openModal("approval-modal");
    });
  });

  document.querySelectorAll(".reject-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("approval-request-id").value = btn.dataset.id;
      document.getElementById("approval-action").value = "reject";
      setText("approval-title", "Reject Request");
      openModal("approval-modal");
    });
  });
}

async function submitApprovalAction() {
  const requestId = Number(document.getElementById("approval-request-id").value || 0);
  const action = document.getElementById("approval-action").value;
  const note = document.getElementById("approval-note").value.trim();

  if (!requestId || !action) {
    showNotification("Missing request/action", "warning");
    return;
  }

  const endpoint =
    action === "approve"
      ? "/app/head/assignment-requests/approve"
      : "/app/head/assignment-requests/reject";

  await apiCall("POST", endpoint, {
    request_id: requestId,
    decision_note: note,
  });

  showNotification(`Request ${action}d successfully`, "success");
  closeModal("approval-modal");
  document.getElementById("approval-form").reset();
  await loadRequestBuckets();
  await loadDashboardOverview();
}

function bindGlobalActions() {
  document.getElementById("open-teacher-modal")?.addEventListener("click", () => {
    fillTeacherForm(null);
    openModal("teacher-modal");
  });

  document.getElementById("open-class-modal")?.addEventListener("click", () => {
    openModal("class-modal");
  });

  document.getElementById("open-student-modal")?.addEventListener("click", () => {
    openModal("student-modal");
  });

  document.getElementById("open-exam-modal")?.addEventListener("click", () => {
    openModal("exam-modal");
  });

  document.getElementById("qa-create-teacher")?.addEventListener("click", () => {
    document.getElementById("teachers-link")?.click();
    fillTeacherForm(null);
    openModal("teacher-modal");
  });

  document.getElementById("qa-create-student")?.addEventListener("click", () => {
    document.getElementById("classes-link")?.click();
    openModal("student-modal");
  });

  document.getElementById("qa-create-class")?.addEventListener("click", () => {
    document.getElementById("classes-link")?.click();
    openModal("class-modal");
  });

  document.getElementById("qa-create-exam")?.addEventListener("click", () => {
    document.getElementById("exams-link")?.click();
    openModal("exam-modal");
  });

  document.getElementById("qa-review-requests")?.addEventListener("click", () => {
    document.getElementById("approval-link")?.click();
  });

  document.getElementById("teacher-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await saveTeacher();
    } catch (error) {
      showNotification(`Teacher save failed: ${error.message}`, "error");
    }
  });

  document.getElementById("class-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await createClass();
    } catch (error) {
      showNotification(`Class create failed: ${error.message}`, "error");
    }
  });

  document.getElementById("student-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await createStudent();
    } catch (error) {
      showNotification(`Student create failed: ${error.message}`, "error");
    }
  });

  document.getElementById("student-class-id")?.addEventListener("change", (e) => {
    const classId = Number(e.target.value || 0);
    const match = state.classes.find((c) => Number(c.id) === classId);
    const formSelect = document.getElementById("student-form-id");
    if (match && formSelect) {
      formSelect.value = String(match.form_id || "");
    }
  });

  document.getElementById("exam-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await createExam();
    } catch (error) {
      showNotification(`Exam create failed: ${error.message}`, "error");
    }
  });

  document.getElementById("discipline-filter-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    await loadDiscipline();
  });

  document.getElementById("approval-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await submitApprovalAction();
    } catch (error) {
      showNotification(`Approval action failed: ${error.message}`, "error");
    }
  });

  [
    ["teacher-modal-close", "teacher-modal"],
    ["teacher-cancel", "teacher-modal"],
    ["class-modal-close", "class-modal"],
    ["class-cancel", "class-modal"],
    ["student-modal-close", "student-modal"],
    ["student-cancel", "student-modal"],
    ["exam-modal-close", "exam-modal"],
    ["exam-cancel", "exam-modal"],
    ["approval-modal-close", "approval-modal"],
    ["approval-cancel", "approval-modal"],
  ].forEach(([btnId, modalId]) => {
    document.getElementById(btnId)?.addEventListener("click", () => closeModal(modalId));
  });

  ["teacher-modal", "class-modal", "student-modal", "exam-modal", "approval-modal"].forEach((id) => {
    document.getElementById(id)?.addEventListener("click", (e) => {
      if (e.target.id === id) closeModal(id);
    });
  });
}

async function loadPanelData(panelKey) {
  switch (panelKey) {
    case "dashboard":
      await loadDashboardOverview();
      break;
    case "teachers":
      await loadTeachers();
      break;
    case "classes":
      await loadClasses();
      break;
    case "subjects":
      await loadSubjects();
      break;
    case "exams":
      await loadExams();
      break;
    case "performance":
      await loadPerformance();
      break;
    case "discipline":
      await loadDiscipline();
      break;
    case "approval":
      await loadRequestBuckets();
      break;
    case "reports":
      await loadRequestBuckets();
      break;
    default:
      break;
  }
}

const dashboard = createBaseDashboard({
  fallbackName: "Head Teacher",
  nameTargets: ["teacherName", "teacher-name-2", "teacher-name-display"],
  onReady: async (me) => {
    setupMobileSidebar();
    state.me = me?.user || null;

    const fromInput = document.getElementById("discipline-from");
    const toInput = document.getElementById("discipline-to");
    if (fromInput && toInput) {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      fromInput.value = first.toISOString().split("T")[0];
      toInput.value = now.toISOString().split("T")[0];
    }

    bindGlobalActions();

    await loadDepartmentsAndFormsAndSubjects();
    await Promise.all([
      loadDashboardOverview(),
      loadTeachers(),
      loadClasses(),
      loadSubjects(),
      loadExams(),
      loadRequestBuckets(),
    ]);

    setupPanelSwitching();
  },
});

document.addEventListener("DOMContentLoaded", () => {
  dashboard.init();
});



