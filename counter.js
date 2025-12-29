let counterData = "";
let currentDecoType = "homestead"; // "homestead" | "guild"
let selectedGuildId = null;
let helperHasApi = false;

/* ======================================================
   HELPER STATUS
   ====================================================== */
async function initHelperStatus() {
  try {
    const res = await fetch("http://localhost:61337/status");
    if (!res.ok) return;

    const status = await res.json();
    helperHasApi = !!status.apiKeyPresent;
  } catch {
    helperHasApi = false;
  }
}

/* ======================================================
   XML TYPE DETECTION
   ====================================================== */
function getDecorationType(xml) {
  const root = xml.documentElement;
  if (!root || root.tagName !== "Decorations") return "homestead";
  return root.getAttribute("type") === "1" ? "guild" : "homestead";
}

/* ======================================================
   EXTRACT CONTEXT INFO FROM XML
   ====================================================== */
function getXmlContextInfo(xml, fileName) {
  const root = xml.documentElement;

  const locationName =
    root.getAttribute("mapName") ||
    root.getAttribute("name") ||
    "Unknown Location";

  const typeLabel =
    root.getAttribute("type") === "1"
      ? "Guild Hall"
      : "Homestead";

  return {
    header: `${typeLabel}: ${locationName}\nXML File: ${fileName}`,
  };
}

/* ======================================================
   GUILD UI RESET
   ====================================================== */
function resetCounterGuildUI() {
  const wrap = document.getElementById("counter-guild-wrap");
  const select = document.getElementById("counter-guild");
  const btn = document.getElementById("runCounterBtn");

  selectedGuildId = null;

  if (wrap) wrap.hidden = true;
  if (select) {
    select.disabled = true;
    select.innerHTML = `<option value="">Select a guild…</option>`;
  }
  if (btn) {
    btn.disabled = false;
    btn.classList.remove("disabled");
  }
}

/* ======================================================
   POPULATE GUILD DROPDOWN
   ====================================================== */
async function populateGuildDropdown() {
  const select = document.getElementById("counter-guild");
  const btn = document.getElementById("runCounterBtn");
  if (!select) return;

  btn.disabled = true;
  btn.classList.add("disabled");

  select.disabled = true;
  select.innerHTML = `<option value="">Populating guild list…</option>`;

  try {
    const res = await fetch("http://localhost:61337/guilds");
    if (!res.ok) throw new Error();

    const guilds = await res.json();
    select.innerHTML = `<option value="">Select a guild…</option>`;

    guilds.forEach(g => {
      const opt = document.createElement("option");
      opt.value = g.Id;
      opt.textContent = `${g.Name} [${g.Tag}]`;
      select.appendChild(opt);
    });

    select.disabled = false;
  } catch {
    select.innerHTML = `<option value="">Failed to load guilds</option>`;
  }
}

/* ======================================================
   APPLY MODE BASED ON XML + HELPER
   ====================================================== */
function applyCounterMode(decoType) {
  currentDecoType = decoType;

  if (decoType === "homestead") {
    resetCounterGuildUI();
    return;
  }

  if (helperHasApi) {
    document.getElementById("counter-guild-wrap").hidden = false;
    populateGuildDropdown();
  } else {
    resetCounterGuildUI();
  }
}

/* ======================================================
   XML INPUT WATCHER
   ====================================================== */
function initCounterXmlWatcher() {
  const input = document.getElementById("counter-xml");
  if (!input) return setTimeout(initCounterXmlWatcher, 100);

  if (input._attached) return;
  input._attached = true;

  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;

    loadXML(file, xml => {
      applyCounterMode(getDecorationType(xml));
    });
  });
}

/* ======================================================
   RUN COUNTER
   ====================================================== */
async function runCounter() {
  const input = document.getElementById("counter-xml");
  const file = input.files[0];
  if (!file) {
    alert("Select an XML.");
    return;
  }

  if (currentDecoType === "guild" && helperHasApi && !selectedGuildId) {
    alert("Please select a guild first.");
    return;
  }

  loadXML(file, async xml => {
    /* -----------------------------
       CONTEXT HEADER
       ----------------------------- */
    const context = getXmlContextInfo(xml, file.name);

    /* -----------------------------
       BUILD REQUIRED MAP
       ----------------------------- */
    const props = xml.getElementsByTagName("prop");
    const requiredById = {};

    for (let p of props) {
      const id = p.getAttribute("id");
      if (!id) continue;

      let name = p.getAttribute("name") || "UNKNOWN";
      name = name.split(/\r?\n/)[0];
      name = name.replace(/<c[^>]*>/g, "").replace(/<\/c>/g, "").trim();

      if (!requiredById[id]) {
        requiredById[id] = { id, name, need: 0 };
      }
      requiredById[id].need++;
    }

    /* -----------------------------
       FETCH OWNED COUNTS
       ----------------------------- */
    let ownedById = null;
    let infoNote = "";

    try {
      if (helperHasApi) {
        if (currentDecoType === "guild") {
          const ids = Object.keys(requiredById).map(id => parseInt(id, 10));

          const res = await fetch(
            `http://localhost:61337/decos/guild/${selectedGuildId}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids })
            }
          );

          if (res.ok) {
            ownedById = await res.json();
          }
        } else {
          const res = await fetch(
            "http://localhost:61337/decos/homestead"
          );

          if (res.ok) {
            ownedById = await res.json();
          }
        }
      } else {
        infoNote = "Helper not running — showing required counts only.";
      }
    } catch {
      infoNote = "Helper not running — showing required counts only.";
    }

    /* -----------------------------
       OUTPUT
       ----------------------------- */
    const entries = Object.values(requiredById);
    const maxNameLength = Math.max(...entries.map(e => e.name.length));
    let out = "";

    // Header block
    out += `${context.header}\n`;
    out += `${"-".repeat(context.header.length)}\n\n`;

    entries
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(e => {
        const paddedName = e.name.padEnd(maxNameLength, " ");
        const need = e.need;

        if (!ownedById) {
          out += `${paddedName}  | Need: ${String(need).padStart(3)}\n`;
          return;
        }

        const owned = ownedById[e.id] || 0;
        const missing = Math.max(need - owned, 0);

        out += `${paddedName}  | Need: ${String(need).padStart(
          3
        )} | Missing: ${String(missing).padStart(3)}\n`;
      });

    if (infoNote) out += `\n[Info] ${infoNote}\n`;

    counterData = out;
    document.getElementById("counter-output").textContent = out;
    document.getElementById("downloadCounter").style.display = "inline-block";
  });
}

/* ======================================================
   INIT
   ====================================================== */
initHelperStatus();
initCounterXmlWatcher();

document.getElementById("counter-guild")?.addEventListener("change", e => {
  selectedGuildId = e.target.value || null;
  const btn = document.getElementById("runCounterBtn");

  if (helperHasApi && currentDecoType === "guild") {
    btn.disabled = !selectedGuildId;
    btn.classList.toggle("disabled", !selectedGuildId);
  }
});

/* ======================================================
   DOWNLOAD
   ====================================================== */
function downloadCounterList() {
  downloadBlob(counterData, "deco_count.txt", "text/plain");
}
