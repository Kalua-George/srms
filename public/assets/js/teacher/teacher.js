import { createBaseDashboard } from "../basedashboard.js";

function setupPanelSwitching() {
  const panels = {
    dashboard: document.getElementById("dashboard"),
    classes: document.getElementById("classes"),
    attendance: document.getElementById("attendance"),
    exams: document.getElementById("content-exams"),
    discipline: document.getElementById("discipline"),
    reports: document.getElementById("reports"),
  };

  const linkToPanel = {
    "dashboard-link": "dashboard",
    "classes-link": "classes",
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
  fallbackName: "Teacher",
  nameTargets: ["teacherName", "teacher-name-2", "teacher-name-display"],
  onReady: async () => {
    setupPanelSwitching();
  },
});

document.addEventListener("DOMContentLoaded", () => {
  dashboard.init();
});

