import { API_BASE_URL } from "./lib/config.js";
import { hasSessionCookie } from "./lib/has-session-cookie.js";

const root = document.getElementById("root");

async function render() {
  const [{ lastSaveOutcome }, cookies] = await Promise.all([
    chrome.storage.local.get("lastSaveOutcome"),
    chrome.cookies.getAll({ url: API_BASE_URL }),
  ]);

  root.innerHTML = "";
  root.appendChild(
    hasSessionCookie(cookies) ? buildReadyState(lastSaveOutcome) : buildLoginPrompt(),
  );
}

function buildLoginPrompt() {
  const container = document.createElement("div");

  const message = document.createElement("p");
  message.textContent = "Log in to start saving.";

  const link = document.createElement("a");
  link.className = "button";
  link.href = `${API_BASE_URL}/login`;
  link.target = "_blank";
  link.textContent = "Log in";

  container.append(message, link);
  return container;
}

function buildReadyState(lastSaveOutcome) {
  const container = document.createElement("div");

  const message = document.createElement("p");
  message.textContent = 'Right-click any page and choose "Save to Cielo."';
  container.appendChild(message);

  if (lastSaveOutcome) {
    const status = document.createElement("p");
    status.textContent = describeOutcome(lastSaveOutcome);
    container.appendChild(status);
  }

  return container;
}

function describeOutcome(outcome) {
  switch (outcome.status) {
    case "success":
      return outcome.reused ? `Already saved: ${outcome.title}` : `Saved: ${outcome.title}`;
    case "signed_out":
      return "Log in to save this page.";
    case "error":
    default:
      return outcome.message ?? "Something went wrong saving that page.";
  }
}

render();
