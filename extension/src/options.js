import { DEFAULT_API_BASE_URL, getApiBaseUrl, setApiBaseUrl } from "./lib/config.js";
import { describeConnection, probeApi } from "./lib/connection.js";

const form = document.getElementById("settings");
const input = document.getElementById("api-base-url");
const status = document.getElementById("status");

input.value = await getApiBaseUrl();

function report(message, kind) {
  status.textContent = message;
  status.className = kind ? `footnote ${kind}` : "footnote";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const saved = await setApiBaseUrl(input.value);

  if (!saved) {
    report("That is not a web address Cielo can reach.", "error");
    return;
  }

  // Show what was actually stored — a typed "cielo.app/library" becomes
  // "https://cielo.app", and the user should see that rather than assume the
  // path was kept.
  input.value = saved;

  // Saving is not the interesting part — whether anything is there is. A
  // wrong address would otherwise stay invisible until the next save failed.
  report(`Saved. Checking ${saved}…`);
  const { tone, message } = describeConnection(await probeApi(saved));
  report(message, tone);
});

document.getElementById("reset").addEventListener("click", async () => {
  await setApiBaseUrl(DEFAULT_API_BASE_URL);
  input.value = DEFAULT_API_BASE_URL;

  report(`Saved. Checking ${DEFAULT_API_BASE_URL}…`);
  const { tone, message } = describeConnection(await probeApi(DEFAULT_API_BASE_URL));
  report(message, tone);
});
