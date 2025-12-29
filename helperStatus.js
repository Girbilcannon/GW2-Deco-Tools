const HELPER_RELEASE_URL =
  "https://github.com/Girbilcannon/DecoToolsHelper/releases";

async function checkHelperStatus() {
  const dot = document.getElementById("helper-dot");
  const text = document.getElementById("helper-text");

  // Default: helper NOT running
  dot.className = "helper-dot red";
  text.innerHTML =
    `Helper not running — <a href="${HELPER_RELEASE_URL}" target="_blank">CLICK HERE to download</a>`;

  let status;
  let mumble;

  // Try status endpoint (proves helper is running)
  try {
    const statusRes = await fetch("http://localhost:61337/status");
    if (!statusRes.ok) throw new Error();
    status = await statusRes.json();
  } catch {
    return; // Stay red with download link
  }

  // Helper is running → check Mumble
  try {
    const mumbleRes = await fetch("http://localhost:61337/mumble");
    mumble = await mumbleRes.json();
  } catch {
    mumble = { available: false };
  }

  if (mumble.available) {
    dot.className = "helper-dot green";
    text.textContent = "Helper running (API + Game)";
  } else {
    dot.className = "helper-dot yellow";
    text.textContent = "Helper running (API Only)";
  }
}

document.addEventListener("DOMContentLoaded", checkHelperStatus);
