/**
 * Reusable Modal Components & Handlers
 * Used across Teacher, HOD, and Head Teacher dashboards
 */

import {
  apiCall,
  showNotification,
  getFormData,
  setFormDisabled,
} from "./formHelpers.js";

/**
 * Show generic modal
 */
export function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = "flex";
    setTimeout(() => modal.classList.add("show"), 10);
  }
}

/**
 * Close generic modal
 */
export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("show");
    setTimeout(() => {
      modal.style.display = "none";
    }, 300);
  }
}

/**
 * Setup modal backdrop closing (click outside to close)
 */
export function setupModalBackdropClosing(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal(modalId);
    }
  });

  const closeBtn = modal.querySelector(".modal-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => closeModal(modalId));
  }
}

/**
 * Load students for a specific class
 */
async function loadStudentsForClass(classId, containerSelector) {
  try {
    if (!classId) {
      document.querySelector(containerSelector).innerHTML =
        '<p class="text-warning">Please select a class first</p>';
      return [];
    }

    const response = await apiCall("GET", `/app/students?class_id=${classId}`);
    const students = response.data || [];

    const container = document.querySelector(containerSelector);
    if (!container) return students;

    container.innerHTML = "";
    students.forEach((student) => {
      const label = document.createElement("label");
      label.className = "checkbox-label";
      label.innerHTML = `
        <input type="checkbox" name="present_students" value="${student.id}" />
        <span>${student.firstname} ${student.lastname}</span>
      `;
      container.appendChild(label);
    });

    return students;
  } catch (error) {
    showNotification(
      `Error loading students: ${error.message}`,
      "error"
    );
    return [];
  }
}

/**
 * Setup Attendance Modal Handler
 */
export function setupAttendanceModal(onSuccess) {
  const modalId = "attendance-modal";
  const modal = document.getElementById(modalId);
  if (!modal) return;

  const classSelect = modal.querySelector('[name="class_id"]');
  const dateInput = modal.querySelector('[name="attendance_date"]');
  const studentsContainer = modal.querySelector(".students-checklist");
  const form = modal.querySelector("form");

  // Load students when class is selected
  if (classSelect) {
    classSelect.addEventListener("change", async (e) => {
      if (e.target.value) {
        await loadStudentsForClass(
          e.target.value,
          ".students-checklist"
        );
      } else {
        studentsContainer.innerHTML =
          '<p class="text-warning">Please select a class</p>';
      }
    });
  }

  // Set today's date as default
  if (dateInput) {
    dateInput.valueAsDate = new Date();
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const classId = classSelect?.value;
      const date = dateInput?.value;

      if (!classId || !date) {
        showNotification(
          "Please select class and date",
          "warning"
        );
        return;
      }

      try {
        const checkboxes = form.querySelectorAll(
          'input[type="checkbox"][name="present_students"]'
        );

        if (checkboxes.length === 0) {
          showNotification("No students found", "warning");
          return;
        }

        setFormDisabled(form.id || "attendance-form", true);

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
            console.error(
              `Failed to mark attendance for student ${studentId}:`,
              err
            );
          }
        }

        showNotification(
          `Attendance marked for ${successCount} students!`,
          "success"
        );
        form.reset();
        closeModal(modalId);

        if (typeof onSuccess === "function") onSuccess();
      } catch (error) {
        showNotification(`Error: ${error.message}`, "error");
      } finally {
        setFormDisabled(form.id || "attendance-form", false);
      }
    });
  }

  setupModalBackdropClosing(modalId);
}

/**
 * Setup Grade Entry Modal Handler
 */
export function setupGradeEntryModal(onSuccess) {
  const modalId = "grade-entry-modal";
  const modal = document.getElementById(modalId);
  if (!modal) return;

  const examSelect = modal.querySelector('[name="exam_id"]');
  const studentsContainer = modal.querySelector(".grade-entry-table");
  const form = modal.querySelector("form");
  let currentExamSubjects = [];

  function renderSubjectSelector(subjects) {
    const existing = modal.querySelector("#modal-grade-subject-wrap");
    if (existing) existing.remove();

    const wrap = document.createElement("div");
    wrap.id = "modal-grade-subject-wrap";
    wrap.className = "form-group";

    let options = '<option value="">--Select Subject--</option>';
    subjects.forEach((s) => {
      options += `<option value="${s.id}">${s.name || `Subject ${s.id}`}</option>`;
    });

    wrap.innerHTML = `
      <label for="modal-grade-subject">Select Subject: <span class="required">*</span></label>
      <select id="modal-grade-subject" class="form-control" required>
        ${options}
      </select>
    `;

    examSelect?.closest(".form-group")?.insertAdjacentElement("afterend", wrap);

    if (subjects.length === 1) {
      const subjectSelect = wrap.querySelector("#modal-grade-subject");
      if (subjectSelect) subjectSelect.value = String(subjects[0].id);
    }
  }

  function renderStudentGradeTable(students) {
    if (!students.length) {
      studentsContainer.innerHTML = '<p class="text-warning">No students found for grade entry</p>';
      return;
    }

    let html =
      '<table class="grade-table"><thead><tr><th>Student</th><th>Score</th></tr></thead><tbody>';
    students.forEach((student) => {
      const first = student.firstname || student.fname || "";
      const last = student.lastname || student.lname || "";
      html += `
        <tr>
          <td>${first} ${last}</td>
          <td><input type="number" min="0" max="100" data-student-id="${student.id}" placeholder="0-100" /></td>
        </tr>
      `;
    });
    html += "</tbody></table>";

    studentsContainer.innerHTML = html;
  }

  // Load students/grades when exam is selected
  if (examSelect) {
    examSelect.addEventListener("change", async (e) => {
      if (!e.target.value) {
        studentsContainer.innerHTML =
          '<p class="text-warning">Please select an exam</p>';
        currentExamSubjects = [];
        const existing = modal.querySelector("#modal-grade-subject-wrap");
        if (existing) existing.remove();
        return;
      }

      try {
        const examId = Number(e.target.value);
        const [subjectsRes, studentsRes] = await Promise.all([
          apiCall("GET", `/app/exams/subjects?exam_id=${examId}`),
          apiCall("GET", "/app/students"),
        ]);

        currentExamSubjects = subjectsRes?.data || [];
        if (!currentExamSubjects.length) {
          studentsContainer.innerHTML =
            '<p class="text-warning">No subjects linked to this exam</p>';
          const existing = modal.querySelector("#modal-grade-subject-wrap");
          if (existing) existing.remove();
          return;
        }

        renderSubjectSelector(currentExamSubjects);

        const students = studentsRes?.data || [];
        renderStudentGradeTable(students);
      } catch (error) {
        showNotification(
          `Error loading exam: ${error.message}`,
          "error"
        );
      }
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const examId = examSelect?.value;
      const subjectSelect = modal.querySelector("#modal-grade-subject");
      const subjectId = Number(subjectSelect?.value || 0);
      const gradeInputs = form.querySelectorAll(
        "input[data-student-id]"
      );

      if (!examId || !subjectId || gradeInputs.length === 0) {
        showNotification(
          "Please select exam, subject, and ensure students are loaded",
          "warning"
        );
        return;
      }

      try {
        setFormDisabled(form.id || "grade-entry-form", true);

        let successCount = 0;
        for (const input of gradeInputs) {
          const studentId = input.dataset.studentId;
          const score = parseFloat(input.value);

          if (score >= 0) {
            try {
              await apiCall("POST", "/app/exams/enter-grade", {
                exam_id: parseInt(examId),
                student_id: parseInt(studentId),
                subject_id: subjectId,
                score: score,
              });
              successCount++;
            } catch (err) {
              console.error(
                `Failed to save grade for student ${studentId}:`,
                err
              );
            }
          }
        }

        showNotification(
          `Grades saved for ${successCount} students!`,
          "success"
        );
        form.reset();
        closeModal(modalId);

        if (typeof onSuccess === "function") onSuccess();
      } catch (error) {
        showNotification(`Error: ${error.message}`, "error");
      } finally {
        setFormDisabled(form.id || "grade-entry-form", false);
      }
    });
  }

  setupModalBackdropClosing(modalId);
}

/**
 * Setup Discipline Incident Modal Handler
 */
export function setupDisciplineModal(onSuccess) {
  const modalId = "discipline-modal";
  const modal = document.getElementById(modalId);
  if (!modal) return;

  const studentSelect = modal.querySelector('[name="student_id"]');
  const form = modal.querySelector("form");

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      try {
        const formData = getFormData(form.id || "discipline-form");

        if (
          !formData.student_id ||
          !formData.incident_type
        ) {
          showNotification(
            "Please fill all required fields",
            "warning"
          );
          return;
        }

        setFormDisabled(form.id || "discipline-form", true);

        await apiCall("POST", "/app/discipline/create", {
          student_id: parseInt(formData.student_id),
          incident_type: formData.incident_type,
          description: formData.description || "",
        });

        showNotification(
          "Discipline record created successfully!",
          "success"
        );
        form.reset();
        closeModal(modalId);

        if (typeof onSuccess === "function") onSuccess();
      } catch (error) {
        showNotification(`Error: ${error.message}`, "error");
      } finally {
        setFormDisabled(form.id || "discipline-form", false);
      }
    });
  }

  setupModalBackdropClosing(modalId);
}

/**
 * Expose globally for HTML onclick handlers
 */
window.showModal = showModal;
window.closeModal = closeModal;
