import { createBaseDashboard } from "../basedashboard.js";

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

  function showPanel(panelKey) {
    Object.values(panels).forEach((panel) => {
      if (panel) panel.style.display = "none";
    });

    const selectedPanel = panels[panelKey];
    if (selectedPanel) selectedPanel.style.display = "block";
  }

  Object.keys(linkToPanel).forEach((linkId) => {
    const link = document.getElementById(linkId);
    if (!link) return;

    link.addEventListener("click", (event) => {
      event.preventDefault();
      showPanel(linkToPanel[linkId]);
    });
  });

  showPanel("dashboard");
}

const dashboard = createBaseDashboard({
  fallbackName: "HOD",
  nameTargets: ["teacherName", "teacher-name-2"],
  onReady: async () => {
    setupPanelSwitching();
  },
});

document.addEventListener("DOMContentLoaded", () => {
  dashboard.init();
});




