import { createBaseDashboard } from "../basedashboard.js";
import {
  apiCall,
  showNotification,
  formatDateReadable,
  getLetterGrade,
  populateSelect,
} from "../formHelpers.js";
import {
  setupAttendanceModal,
  setupGradeEntryModal,
  setupDisciplineModal,
} from "../modals.js";

/**
 * Teacher Dashboard - Main Controller
 */

// Track current selection for inline attendance/grades
let currentState = {
  selectedClassId: null,
  selectedExamId: null,
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

/**
 * Setup Panel Switching (Sidebar Navigation)
 */
function setupPanelSwitching() {
  const panels = {
    dashboard: document.getElementById("dashboard"),
    classes: document.getElementById("classes"),
    grades: document.getElementById("grades"),
    attendance: document.getElementById("attendance"),
    exams: document.getElementById("exams"),
    discipline: document.getElementById("discipline"),
    reports: document.getElementById("reports"),
  };

  const linkToPanel = {
    "dashboard-link": "dashboard",
    "classes-link": "classes",
    "grades-link": "grades",
    "attendance-link": "attendance",
    "exams-link": "exams",
    "discipline-link": "discipline",
    "reports-link": "reports",
  };

  function showPanel(panelKey) {
    Object.values(panels).forEach((panel) => {
      if (panel) panel.style.display = "none";
    });

    const selectedPanel = panels[panelKey];
    if (selectedPanel) {
      selectedPanel.style.display = "block";
      // Trigger data loading when panel opens
      loadPanelData(panelKey);
    }
  }

  Object.keys(linkToPanel).forEach((linkId) => {
    const link = document.getElementById(linkId);
    if (!link) return;

    link.addEventListener("click", (event) => {
      event.preventDefault();

      // Update active state
      document.querySelectorAll(".nav-link").forEach((l) => l.classList.remove("active"));
      link.classList.add("active");

      showPanel(linkToPanel[linkId]);
    });
  });

  showPanel("dashboard");
}

/**
 * Load Dashboard Stats
 */
async function loadDashboardStats() {
  try {
    const response = await apiCall("GET", "/app/students");
    const students = response.data || [];

    // Count unique classes
    const classes = new Set(students.map((s) => s.class_id));
    document.getElementById("count-classes").textContent = classes.size;
    document.getElementById("count-students").textContent = students.length;
    document.getElementById("count-tasks").textContent = "0";
  } catch (error) {
    showNotification(
      `Error loading dashboard stats: ${error.message}`,
      "error"
    );
    console.error(error);
  }
}

/**
 * Load My Classes Section
 */
async function loadMyClasses() {
  const tbody = document.getElementById("classes-table-body");
  const table = document.getElementById("classes-table");
  const loading = document.getElementById("classes-loading");
  const noClasses = document.getElementById("no-classes");

  try {
    loading.style.display = "block";
    table.style.display = "none";
    noClasses.style.display = "none";

    const response = await apiCall("GET", "/app/students");
    const students = response.data || [];

    // Group by class
    const classesById = {};
    students.forEach((student) => {
      if (!classesById[student.class_id]) {
        classesById[student.class_id] = {
          id: student.class_id,
          name: student.class_name || `Class ${student.class_id}`,
          students: [],
        };
      }
      classesById[student.class_id].students.push(student);
    });

    const classes = Object.values(classesById);

    if (classes.length === 0) {
      noClasses.style.display = "block";
      loading.style.display = "none";
      return;
    }

    tbody.innerHTML = "";
    classes.forEach((cls) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${cls.name}</strong></td>
        <td>${cls.students.length}</td>
        <td>${cls.students[0]?.form_name || "N/A"}</td>
        <td><button class="btn-sm btn-secondary">View Roster</button></td>
      `;
      tbody.appendChild(row);
    });

    table.style.display = "table";
    loading.style.display = "none";
  } catch (error) {
    showNotification(`Error loading classes: ${error.message}`, "error");
    loading.style.display = "none";
  }
}

/**
 * Load Student Grades Section
 */
async function loadStudentGrades() {
  const tbody = document.getElementById("grades-table-body");
  const table = document.getElementById("grades-table");
  const loading = document.getElementById("grades-loading");
  const noGrades = document.getElementById("no-grades");
  const filter = document.getElementById("grades-class-filter");

  try {
    loading.style.display = "block";
    table.style.display = "none";
    noGrades.style.display = "none";

    const response = await apiCall("GET", "/app/students/grades");
    const grades = response.data || [];

    if (grades.length === 0) {
      noGrades.style.display = "block";
      loading.style.display = "none";
      return;
    }

    // Populate filter
    const classes = [...new Set(grades.map((g) => ({ id: g.class_id, name: g.class_name })))];
    filter.innerHTML = '<option value="">--All Classes--</option>';
    classes.forEach((cls) => {
      const option = document.createElement("option");
      option.value = cls.id;
      option.textContent = cls.name;
      filter.appendChild(option);
    });

    // Render grades table
    tbody.innerHTML = "";
    grades.forEach((grade) => {
      const row = document.createElement("tr");
      const letterGrade = getLetterGrade(grade.mark);
      row.innerHTML = `
        <td>${grade.student_firstname} ${grade.student_lastname}</td>
        <td>${grade.class_name}</td>
        <td>${grade.subject_name}</td>
        <td>${grade.mark}</td>
        <td><span class="grade-badge grade-${letterGrade}">${letterGrade}</span></td>
      `;
      tbody.appendChild(row);
    });

    table.style.display = "table";
    loading.style.display = "none";
  } catch (error) {
    showNotification(
      `Error loading grades: ${error.message}`,
      "error"
    );
    loading.style.display = "none";
  }
}

/**
 * Load Attendance Section
 */
async function loadAttendanceSection() {
  const classSelect = document.getElementById("attendance-class-select");
  await populateSelect(
    "attendance-class-select",
    "/app/students",
    "class_name",
    "class_id"
  );
  await populateSelect(
    "modal-attendance-class",
    "/app/students",
    "class_name",
    "class_id"
  );

  // Load from filter form
  document.getElementById("attendance-quick-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    currentState.selectedClassId = classSelect.value;
    const date = document.getElementById("attendance-date-select").value;

    if (!currentState.selectedClassId || !date) {
      showNotification("Please select class and date", "warning");
      return;
    }

    // Load students for register
    await loadStudentsForAttendanceRegister(currentState.selectedClassId, date);
  });

  // Wire inline attendance submission
  document.getElementById("btn-attendance-submit")?.addEventListener("click", async () => {
    await submitInlineAttendance();
  });

  document.getElementById("btn-attendance-cancel")?.addEventListener("click", () => {
    document.getElementById("attendance-register").style.display = "none";
    document.getElementById("attendance-quick-form").reset();
  });
}

/**
 * Load students for inline attendance register
 */
async function loadStudentsForAttendanceRegister(classId, date) {
  try {
    const response = await apiCall("GET", `/app/students?class_id=${classId}`);
    const students = response.data || [];

    const container = document.getElementById("attendance-students-list");
    container.innerHTML = "";

    students.forEach((student) => {
      const label = document.createElement("label");
      label.className = "checkbox-label";
      label.innerHTML = `
        <input type="checkbox" name="present_students" value="${student.id}" class="attendance-check" />
        <span>${student.firstname} ${student.lastname}</span>
      `;
      container.appendChild(label);
    });

    document.getElementById("attendance-register").style.display = "block";
  } catch (error) {
    showNotification(
      `Error loading students: ${error.message}`,
      "error"
    );
  }
}

/**
 * Submit inline attendance
 */
async function submitInlineAttendance() {
  try {
    const classId = currentState.selectedClassId;
    const date = document.getElementById("attendance-date-select").value;
    const checkboxes = document.querySelectorAll(".attendance-check");

    if (!classId || !date || checkboxes.length === 0) {
      showNotification("Missing required data", "warning");
      return;
    }

    let successCount = 0;
    for (const checkbox of checkboxes) {
      const studentId = parseInt(checkbox.value);
      const isPresent = checkbox.checked;

      try {
        await apiCall("POST", "/app/attendance", {
          student_id: studentId,
          class_id: parseInt(classId),
          attendance_date: date,
          status: isPresent ? "present" : "absent",
        });
        successCount++;
      } catch (err) {
        console.error("Failed to mark attendance:", err);
      }
    }

    showNotification(`Attendance marked for ${successCount} students!`, "success");
    document.getElementById("attendance-register").style.display = "none";
    document.getElementById("attendance-quick-form").reset();
  } catch (error) {
    showNotification(`Error: ${error.message}`, "error");
  }
}

/**
 * Load Exam Center Section
 */
async function loadExamCenter() {
  await populateSelect("exam-class-select", "/app/students", "class_name", "class_id");
  await populateSelect("modal-grade-exam", "/app/exams", "title", "id");

  document.getElementById("exams-filter-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const classId = document.getElementById("exam-class-select").value;
    const subjectId = document.getElementById("exam-subject-select").value;

    if (!classId || !subjectId) {
      showNotification("Please select class and subject", "warning");
      return;
    }

    await loadExamsForClassAndSubject(classId, subjectId);
  });
}

/**
 * Load exams list
 */
async function loadExamsForClassAndSubject(classId, subjectId) {
  try {
    const response = await apiCall("GET", "/app/exams");
    const exams = (response.data || []).filter(
      (e) => e.class_id === parseInt(classId) && e.subject_id === parseInt(subjectId)
    );

    const container = document.getElementById("exams-list-items");
    container.innerHTML = "";

    if (exams.length === 0) {
      container.innerHTML = '<p class="text-warning">No exams found for this class/subject</p>';
      document.getElementById("exams-list").style.display = "block";
      return;
    }

    exams.forEach((exam) => {
      const card = document.createElement("div");
      card.className = "exam-card";
      card.innerHTML = `
        <h5>${exam.title}</h5>
        <p>Date: ${formatDateReadable(exam.created_at)}</p>
        <button class="btn-sm btn-primary" onclick="window.showModal('grade-entry-modal')">
          Enter Grades
        </button>
      `;
      container.appendChild(card);
    });

    document.getElementById("exams-list").style.display = "block";
  } catch (error) {
    showNotification(`Error loading exams: ${error.message}`, "error");
  }
}

/**
 * Load Discipline Section
 */
async function loadDisciplineSection() {
  // Populate discipline student select
  await populateSelect(
    "modal-discipline-student",
    "/app/students",
    "firstname",
    "id"
  );

  // Load discipline records
  await loadDisciplineRecords();
}

/**
 * Load discipline records table
 */
async function loadDisciplineRecords() {
  const tbody = document.getElementById("discipline-table-body");
  const table = document.getElementById("discipline-table");
  const loading = document.getElementById("discipline-loading");
  const noRecords = document.getElementById("no-discipline-records");

  try {
    loading.style.display = "block";
    table.style.display = "none";
    noRecords.style.display = "none";

    const response = await apiCall("GET", "/app/discipline/list");
    const records = response.data || [];

    if (records.length === 0) {
      noRecords.style.display = "block";
      loading.style.display = "none";
      return;
    }

    tbody.innerHTML = "";
    records.forEach((record) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${record.student_firstname} ${record.student_lastname}</td>
        <td>${record.class_name}</td>
        <td><span class="badge badge-warning">${record.incident_type}</span></td>
        <td>${formatDateReadable(record.created_at)}</td>
        <td>${record.description || "N/A"}</td>
      `;
      tbody.appendChild(row);
    });

    table.style.display = "table";
    loading.style.display = "none";
  } catch (error) {
    showNotification(
      `Error loading discipline records: ${error.message}`,
      "error"
    );
    loading.style.display = "none";
  }
}

/**
 * Load Panel Data based on current section
 */
async function loadPanelData(panelKey) {
  switch (panelKey) {
    case "dashboard":
      await loadDashboardStats();
      break;
    case "classes":
      await loadMyClasses();
      break;
    case "grades":
      await loadStudentGrades();
      break;
    case "attendance":
      await loadAttendanceSection();
      break;
    case "exams":
      await loadExamCenter();
      break;
    case "discipline":
      await loadDisciplineSection();
      break;
  }
}

/**
 * Initialize Dashboard
 */
const dashboard = createBaseDashboard({
  fallbackName: "Teacher",
  nameTargets: ["teacherName", "teacher-name-display"],
  onReady: async () => {
    setupMobileSidebar();
    setupPanelSwitching();
    setupAttendanceModal(() => loadDisciplineRecords());
    setupGradeEntryModal(() => loadStudentGrades());
    setupDisciplineModal(() => loadDisciplineRecords());

    // Load initial dashboard data
    await loadDashboardStats();
  },
});

document.addEventListener("DOMContentLoaded", () => {
  dashboard.init();
});

