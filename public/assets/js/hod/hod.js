import "../basedashboard.js";


const  departmentsPanel = document.getElementById('departments=teacher-panel');
const examsPanel = document.getElementById('exams-management-panel');
const performancePanel = document.getElementById('dept-performance-panel');
const disciplinePanel = document.getElementById('discipline-panel');
const classListPanel = document.getElementById('class-list');
const  attendancePanel = document.getElementById('attendance-panel');
const reportsPanel = document.getElementById('reports-panel');
const dashboardPanel = document.getElementById('dashboard-content');

// this is etting the side panels

const dashboardLink = document.getElementById('dashboard-content');
const classListLink = document.getElementById('class-list-link');
const attendanceLink = document.getElementById('attendance-panel-link');
const deptTeachersLink = document.getElementById('dept-teachers-panel-link');
const examManagementLink = document.getElementById('exam-management-panel-link');
const deptPerformanceLink = document.getElementById('dept-performance-panel-link');
const disciplineLink = document.getElementById('discipline-panel-link');
const reportsLink = document.getElementById('reports-panel-link');

dashboardLink.addEventListener('click', () => {
  showPanel(dashboardPanel);
});

classListLink.addEventListener('click', () => {
  showPanel(classListPanel);
});

attendanceLink.addEventListener('click', () => {
  showPanel(attendancePanel);
});

deptTeachersLink.addEventListener('click', () => {
  showPanel(departmentsPanel);
});

examManagementLink.addEventListener('click', () => {
  showPanel(examsPanel);
});

deptPerformanceLink.addEventListener('click', () => {
  showPanel(performancePanel);
});

disciplineLink.addEventListener('click', () => {
  showPanel(disciplinePanel);
});

reportsLink.addEventListener('click', () => {
  showPanel(reportsPanel);
});

function showPanel(panel) {
  // Hide all panels
  const panels = [dashboardPanel, classListPanel, attendancePanel, departmentsPanel, examsPanel, performancePanel, disciplinePanel, reportsPanel];
  panels.forEach(p => p.style.display = 'none');



  // Show the selected panel
  panel.style.display = 'block';
}   

//............. ending of the shuffling  of modals and panels......................



// core functions of the hod dashboard, like loading user info, handling logout, etc. can be similar to teacher.js, but with different API endpoints and rendering logic as needed.




