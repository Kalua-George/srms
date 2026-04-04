/**
 * Shared Form & API Helper Functions
 * Used across all dashboard roles (Teacher, HOD, Head Teacher)
 */
import { apiFetch } from "./api.js";

function toPublicApiPath(endpoint) {
  const clean = String(endpoint || "").replace(/^\/+/, "");
  // Dashboard pages live in /public/<role>/, so ../ points to /public/
  return `../${clean}`;
}

/**
 * Centralized API call wrapper with error handling
 */
export async function apiCall(method, endpoint, data = null) {
  try {
    const path = toPublicApiPath(endpoint);
    const options = {
      method,
    };

    if (data && (method === "POST" || method === "PUT")) {
      options.body = JSON.stringify(data);
    }

    const { res, data: result, raw } = await apiFetch(path, options);

    if (!res.ok) {
      const bodyHint = raw ? raw.slice(0, 120).replace(/\s+/g, " ") : "";
      throw new Error(
        result?.error ||
          `API Error: ${res.status}${bodyHint ? ` | ${bodyHint}` : ""}`
      );
    }

    if (result === null) {
      throw new Error("Server did not return JSON response.");
    }

    return result;
  } catch (error) {
    console.error(`API Error [${method} ${endpoint}]:`, error);
    throw error;
  }
}

/**
 * Show temporary notification (toast)
 */
export function showNotification(message, type = "success", duration = 3000) {
  const container =
    document.getElementById("notification-container") ||
    createNotificationContainer();

  const toast = document.createElement("div");
  toast.className = `notification notification-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // Animate in
  setTimeout(() => toast.classList.add("show"), 10);

  // Auto remove
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function createNotificationContainer() {
  const container = document.createElement("div");
  container.id = "notification-container";
  container.className = "notification-container";
  document.body.appendChild(container);
  return container;
}

/**
 * Format date to YYYY-MM-DD
 */
export function formatDate(date) {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().split("T")[0];
}

/**
 * Format date to readable format (e.g., "Jan 15, 2026")
 */
export function formatDateReadable(date) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Populate a select element from API endpoint
 */
export async function populateSelect(
  selectId,
  endpoint,
  labelKey = "name",
  valueKey = "id"
) {
  try {
    const select = document.getElementById(selectId);
    if (!select) return;

    const response = await apiCall("GET", endpoint);
    const data = response.data || [];

    select.innerHTML = '<option value="">--Select--</option>';
    data.forEach((item) => {
      const option = document.createElement("option");
      option.value = item[valueKey];
      option.textContent =
        item[labelKey] ??
        item.name ??
        item.title ??
        item.exam_name ??
        `#${item[valueKey] ?? ""}`;
      select.appendChild(option);
    });
  } catch (error) {
    showNotification(
      `Failed to load options: ${error.message}`,
      "error"
    );
  }
}

/**
 * Disable/enable form elements
 */
export function setFormDisabled(formId, disabled) {
  const form = document.getElementById(formId);
  if (!form) return;

  const elements = form.querySelectorAll(
    "input, select, textarea, button"
  );
  elements.forEach((el) => {
    el.disabled = disabled;
  });
}

/**
 * Get form data as object
 */
export function getFormData(formId) {
  const form = document.getElementById(formId);
  if (!form) return {};

  const formData = new FormData(form);
  return Object.fromEntries(formData);
}

/**
 * Create loading indicator
 */
export function showLoading(element) {
  element.innerHTML =
    '<div class="spinner-small"></div><p>Loading...</p>';
}

/**
 * Parse error response from API
 */
export function getErrorMessage(error) {
  if (error.response?.error) return error.response.error;
  if (error.message) return error.message;
  return "An unexpected error occurred";
}

/**
 * Get user from localStorage (set during login)
 */
export function getCurrentUser() {
  const user = localStorage.getItem("srms_user");
  return user ? JSON.parse(user) : null;
}

/**
 * Get context (year/term) from localStorage
 */
export function getContext() {
  const context = localStorage.getItem("srms_context");
  return context ? JSON.parse(context) : null;
}

/**
 * Format grade mark to letter grade
 */
export function getLetterGrade(mark) {
  if (mark >= 80) return "A";
  if (mark >= 70) return "B";
  if (mark >= 60) return "C";
  if (mark >= 50) return "D";
  return "F";
}

/**
 * Capitalize first letter
 */
export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Check if user has specific role
 */
export function hasRole(role) {
  const user = getCurrentUser();
  return user && user.role === role;
}
