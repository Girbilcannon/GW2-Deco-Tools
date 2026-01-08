// ==========================================
// Map Swap Tool (Beta) - 2026v1
// - Pre-check report (warnings + no-counterpart + missing list)
// - Optional helper integration:
//    * decoration DB (name -> homesteadId / guildUpgradeId)
//    * ownership counts (homestead or guild storage)
// - Swap updates <Decorations> tag AND remaps <prop id=""> by <prop name="">
//
// FIXES INCLUDED IN THIS REPRINT:
// ✅ Guild dropdown appears when swapping TO a guild hall (before Pre-Check)
// ✅ Guild dropdown does NOT reset itself on selection
// ✅ Guild list populates only when needed (and only once per session)
// ✅ Print List + Swap Maps buttons wired and working
// ✅ Missing section formatting: "Name — Missing: X" (no IDs, no need/owned)
// ==========================================

const HELPER_BASE = "http://localhost:61337";

// Map definitions (authoritative IDs)
const MAPS = {
  hearth:    { mapId: "1558", mapName: "Hearth's Glow",       type: "0" }, // homestead
  comosus:   { mapId: "1596", mapName: "Comosus Isle",        type: "0" }, // homestead
  lost:      { mapId: "1124", mapName: "Lost Precipice",      type: "1" }, // guild hall
  gilded:    { mapId: "1121", mapName: "Gilded Hollow",       type: "1" }, // guild hall
  windswept: { mapId: "1232", mapName: "Windswept Haven",     type: "1" }, // guild hall
  isle:      { mapId: "1462", mapName: "Isle of Reflection",  type: "1" }  // guild hall
};

// ---------------------------
// State
// ---------------------------
let swapReportText = "";
let dbByName = null;        // Map<stringLower, {name, homesteadId, guildUpgradeId}>
let helperRunning = false;
let helperHasDb = false;
let helperApiKeyPresent = false;

let cachedGuilds = null;    // [{id,name,tag}] or [{Id,Name,Tag}]
let lastPrecheckContext = null; // computed during precheck

// ---------------------------
// DOM helpers
// ---------------------------
const $ = (id) => document.getElementById(id);

function setSwapOutput(text) {
  swapReportText = text || "";
  const out = $("swap-output");
  if (out) out.textContent = swapReportText;
}

function appendSwapOutput(line) {
  swapReportText = (swapReportText ? swapReportText + "\n" : "") + line;
  const out = $("swap-output");
  if (out) out.textContent = swapReportText;
}

// ---------------------------
// Formatting helpers
// ---------------------------
function padL(s, n) { s = String(s); return s.length >= n ? s : s + " ".repeat(n - s.length); }
function padR(s, n) { s = String(s); return s.length >= n ? s : " ".repeat(n - s.length) + s; }

// Strip GW2 formatting / flavor (same style as other tools)
function cleanDecoName(name) {
  if (!name) return "";
  let s = String(name);

  // remove color tags like <c=@something>...</c>
  s = s.replace(/<c=[^>]*>/gi, "").replace(/<\/c>/gi, "");

  // remove newlines/flavor chunks
  s = s.split(/\r?\n/)[0];

  // collapse whitespace
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

function mapNameToSuffix(mapName) {
  return "_" + mapName
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function safeFilenameBase(fileName) {
  return fileName.replace(/\.xml$/i, "");
}

// ---------------------------
// Selection helpers
// ---------------------------
function getSelectedTargetMapKey() {
  const r = document.querySelector('input[name="swapMapChoice"]:checked');
  return r ? r.value : "hearth";
}

function getSelectedTargetMap() {
  return MAPS[getSelectedTargetMapKey()] || MAPS.hearth;
}

function isTargetGuildHall() {
  return getSelectedTargetMap().type === "1";
}

function getIncludeMissingChecked() {
  const cb = $("swap-include-missing");
  return !!(cb && cb.checked);
}

// IMPORTANT: placeholder in your UI uses "" (merge.js style), not "none"
function getSelectedGuildId() {
  const sel = $("swap-guild");
  if (!sel) return null;
  const v = sel.value;
  if (!v) return null;
  return v;
}

// ---------------------------
// Networking helper
// ---------------------------
async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.json();
}

// ---------------------------
// Helper status + DB
// ---------------------------
async function initSwapHelper() {
  helperRunning = false;
  helperHasDb = false;
  helperApiKeyPresent = false;
  dbByName = null;

  // status
  try {
    const status = await fetchJson(`${HELPER_BASE}/status`);
    helperRunning = !!status.running;
    helperApiKeyPresent = !!status.apiKeyPresent;
  } catch {
    helperRunning = false;
  }

  // DB
  if (!helperRunning) return;

  try {
    // Prefer lite if present, fallback to full
    let data;
    try {
      data = await fetchJson(`${HELPER_BASE}/decorations-lite`);
    } catch {
      data = await fetchJson(`${HELPER_BASE}/decorations`);
    }

    // Accept either:
    // - array
    // - { decorations: [...] }
    // - { Decorations: [...] }
    let list = null;
    if (Array.isArray(data)) list = data;
    else if (data && Array.isArray(data.decorations)) list = data.decorations;
    else if (data && Array.isArray(data.Decorations)) list = data.Decorations;

    if (list && list.length) {
      const map = new Map();
      for (const e of list) {
        const n = cleanDecoName(e.name || e.Name);
        if (!n) continue;

        const homesteadId = (e.homesteadId ?? e.HomesteadId ?? null);
        const guildUpgradeId = (e.guildUpgradeId ?? e.GuildUpgradeId ?? null);

        map.set(n.toLowerCase(), {
          name: n,
          homesteadId: (homesteadId === null ? null : Number(homesteadId)),
          guildUpgradeId: (guildUpgradeId === null ? null : Number(guildUpgradeId))
        });
      }

      dbByName = map;
      helperHasDb = true;
    }
  } catch {
    helperHasDb = false;
    dbByName = null;
  }
}

function ensureDbReadyOrWarn() {
  if (!helperRunning) {
    alert("Deco Tools Helper is not detected. This Map Swap needs the Helper database.");
    return false;
  }
  if (!helperHasDb || !dbByName) {
    alert("Helper decoration database not ready yet. Try opening http://localhost:61337/decorations to confirm it loads, then try again.");
    return false;
  }
  return true;
}

// ---------------------------
// Guild dropdown helpers (merge.js behavior)
// ---------------------------
async function loadGuildListIfNeeded() {
  if (!helperRunning || !helperApiKeyPresent) return null;
  if (cachedGuilds) return cachedGuilds;

  try {
    const guilds = await fetchJson(`${HELPER_BASE}/guilds`);
    cachedGuilds = Array.isArray(guilds) ? guilds : [];
    return cachedGuilds;
  } catch {
    return null;
  }
}

async function populateSwapGuildDropdownIfNeeded() {
  const wrap = $("swap-guild-wrap");
  const sel = $("swap-guild");
  if (!wrap || !sel) return;

  // show container
  wrap.hidden = false;

  // If already populated (more than 1 option), don't repopulate (prevents reset)
  const hasOptions = sel.options && sel.options.length > 1;
  if (hasOptions) {
    sel.disabled = false;
    return;
  }

  sel.disabled = true;
  sel.innerHTML = `<option value="">Populating guild list…</option>`;
  sel.value = "";

  const guilds = await loadGuildListIfNeeded();

  sel.innerHTML = `<option value="">Select a guild…</option>`;

  (guilds || []).forEach(g => {
    const id = g.Id ?? g.id ?? "";
    const name = g.Name ?? g.name ?? "Unknown Guild";
    const tag = g.Tag ?? g.tag ?? "";

    const opt = document.createElement("option");
    opt.value = String(id); // force string so selection is reliable
    opt.textContent = tag ? `${name} [${tag}]` : name;
    sel.appendChild(opt);
  });

  sel.disabled = false;
}

// Guild UI rule used by THIS tool now:
// If TARGET is guild hall AND helper+apikey exists -> show dropdown BEFORE pre-check
async function updateGuildUIForTarget() {
  const wrap = $("swap-guild-wrap");
  const sel = $("swap-guild");
  if (!wrap || !sel) return;

  if (isTargetGuildHall() && helperRunning && helperApiKeyPresent) {
    await populateSwapGuildDropdownIfNeeded();
    wrap.hidden = false;
  } else {
    wrap.hidden = true;
  }
}

// ---------------------------
// XML type detection (from loaded file)
// ---------------------------
function detectXmlType(mainXML) {
  const decorationsNode = mainXML.getElementsByTagName("Decorations")[0];
  if (!decorationsNode) return null;

  const t = decorationsNode.getAttribute("type");
  if (t === "0") return "0"; // homestead
  if (t === "1") return "1"; // guild hall

  const mid = decorationsNode.getAttribute("mapId");
  if (mid) {
    const m = Object.values(MAPS).find(x => x.mapId === mid);
    if (m) return m.type;
  }
  return null;
}

// ---------------------------
// Core analysis helpers
// ---------------------------
function collectProps(mainXML) {
  return Array.from(mainXML.getElementsByTagName("prop") || []);
}

function getPropName(prop) {
  const n = prop.getAttribute("name");
  return cleanDecoName(n);
}

function buildNeedCountsByTargetId(props, toType) {
  // returns { needById: Map<number, number>, propTargets: Array<{prop, name, targetId}>, noCounterpart: Array<string> }
  const needById = new Map();
  const propTargets = [];
  const noCounterpart = [];

  for (const p of props) {
    const name = getPropName(p);
    if (!name) continue;

    const entry = dbByName ? dbByName.get(name.toLowerCase()) : null;
    const targetId = entry
      ? (toType === "0" ? entry.homesteadId : entry.guildUpgradeId)
      : null;

    propTargets.push({ prop: p, name, targetId });

    if (targetId == null) {
      noCounterpart.push(name);
      continue;
    }

    needById.set(targetId, (needById.get(targetId) || 0) + 1);
  }

  // unique sorted
  const uniqueNo = Array.from(new Set(noCounterpart)).sort((a, b) => a.localeCompare(b));
  return { needById, propTargets, noCounterpart: uniqueNo };
}

async function fetchOwnedCountsForTargetIds(toType, guildId, ids) {
  const ownedById = new Map();

  if (!helperRunning || !helperApiKeyPresent) return ownedById;
  if (!ids.length) return ownedById;

  if (toType === "0") {
    const data = await fetchJson(`${HELPER_BASE}/decos/homestead`);
    for (const id of ids) {
      ownedById.set(id, Number(data[String(id)] || 0));
    }
    return ownedById;
  }

  // toType === "1" (guild hall)
  if (!guildId) return ownedById;

  const data = await fetchJson(`${HELPER_BASE}/decos/guild/${guildId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids })
  });

  for (const id of ids) {
    ownedById.set(id, Number(data[String(id)] || 0));
  }

  return ownedById;
}

function buildMissingList(needById, ownedById) {
  // returns array of { id, need, owned, missing }
  const missing = [];
  for (const [id, need] of needById.entries()) {
    const owned = ownedById.get(id) || 0;
    if (owned < need) {
      missing.push({ id, need, owned, missing: need - owned });
    }
  }
  return missing.sort((a, b) => b.missing - a.missing);
}

function idsToNamesForReport(missingEntries, toType) {
  if (!dbByName) {
    return missingEntries.map(m => ({ ...m, name: `ID ${m.id}` }));
  }

  const reverse = new Map(); // id -> name
  for (const v of dbByName.values()) {
    const id = (toType === "0") ? v.homesteadId : v.guildUpgradeId;
    if (id != null && !reverse.has(id)) reverse.set(id, v.name);
  }

  return missingEntries.map(m => ({
    ...m,
    name: reverse.get(m.id) || `ID ${m.id}`
  }));
}

// Exclude missing by “using up” owned counts:
// keep up to owned count worth of props for each targetId; remove extras.
function computeKeepMask(propTargets, ownedById, includeMissing) {
  const keep = new Map();

  // Always exclude null counterpart
  for (const it of propTargets) {
    keep.set(it.prop, it.targetId != null);
  }

  if (includeMissing) return keep;

  // If we can't evaluate owned, don't try to exclude
  if (!ownedById || ownedById.size === 0) return keep;

  const used = new Map(); // targetId -> kept so far

  for (const it of propTargets) {
    if (it.targetId == null) continue;

    const id = it.targetId;
    const owned = ownedById.get(id) || 0;
    const u = used.get(id) || 0;

    if (u < owned) {
      keep.set(it.prop, true);
      used.set(id, u + 1);
    } else {
      keep.set(it.prop, false);
    }
  }

  return keep;
}

// ---------------------------
// UI actions
// ---------------------------
async function runSwapPrecheck() {
  const file = $("swap-xml")?.files?.[0];
  if (!file) {
    alert("Please select a Decorations XML.");
    return;
  }

  if (!ensureDbReadyOrWarn()) return;

  // If target is guild hall and helper+API is present, require guild selection for accurate counts
  if (isTargetGuildHall() && helperRunning && helperApiKeyPresent && !getSelectedGuildId()) {
    alert("Please select a guild before running Pre-Check.");
    return;
  }

  setSwapOutput("Pre-check running…");

  loadXML(file, async (mainXML) => {
    try {
      const fromType = detectXmlType(mainXML);   // "0" or "1" or null
      const toMap = getSelectedTargetMap();
      const toType = toMap.type;

      const props = collectProps(mainXML);
      if (!props.length) {
        alert("No <prop> entries found.");
        setSwapOutput("");
        return;
      }

      const includeMissing = getIncludeMissingChecked();
      const guildId = getSelectedGuildId();

      // Build target IDs by name (DB)
      const { needById, propTargets, noCounterpart } = buildNeedCountsByTargetId(props, toType);
      const targetIds = Array.from(needById.keys());

      // Fetch ownership counts if possible
      let ownedById = new Map();

      let canCount = helperRunning && helperApiKeyPresent;

      // If swapping TO guild hall, counts require selected guild
      if (toType === "1" && !guildId) canCount = false;

      if (canCount) {
        ownedById = await fetchOwnedCountsForTargetIds(toType, guildId, targetIds);
      }

      const missingRaw = buildMissingList(needById, ownedById);
      const missingNamed = idsToNamesForReport(missingRaw, toType);

      // Store context for Swap button
      lastPrecheckContext = {
        fileName: file.name,
        fromType,
        toMap,
        toType,
        propsCount: props.length,
        needById,
        ownedById,
        noCounterpart,
        missingNamed,
        includeMissing,
        guildId
      };

      // ---------------------------
      // Build report text (KEEP FULL INFO)
      // ---------------------------
      let out = "";
      out += "MAP SWAP (BETA) — PRE-CHECK\n";
      out += "========================================\n";

      const fromLabel = (fromType === "1") ? "Guild Hall" : "Homestead";
      const toLabel = (toType === "1") ? "Guild Hall" : "Homestead";

      out += `Loaded XML: ${file.name}\n`;
      out += `Props found: ${props.length}\n`;
      out += `From: ${fromLabel}\n`;
      out += `To:   ${toLabel} → ${toMap.mapName}\n\n`;

      if (fromType === "0" && toType === "1") {
        out += "⚠ WARNING:\n";
        out += "Switching Homestead → Guild Hall can risk local-area deco caps.\n";
        out += "Some items may fail to load or drop out depending on placement and limits.\n\n";
      }

      // No counterpart section
      if (noCounterpart.length) {
        out += `The following decos will not be included, as there is no ${toLabel} counter-part:\n`;
        out += "----------------------------------------\n";
        for (const n of noCounterpart) out += `• ${n}\n`;
        out += "\n";
      } else {
        out += `All props have a valid ${toLabel} counter-part.\n\n`;
      }

      // Missing ownership section (FORMAT FIX HERE)
      if (!helperRunning) {
        out += "Helper not detected — ownership counts could not be verified.\n";
      } else if (!helperApiKeyPresent) {
        out += "Helper has no API key — ownership counts could not be verified.\n";
      } else if (toType === "1" && !guildId) {
        out += "Guild selection required — ownership counts could not be verified.\n";
      } else {
        if (missingNamed.length) {
          out += `You do not have the following Decos. Your map swap will ${includeMissing ? "INCLUDE" : "EXCLUDE"} them:\n`;
          out += "----------------------------------------\n";

          // Name on left, Missing count on right
          const nameCol = 52;
          for (const m of missingNamed) {
            const nm = m.name || "Unknown";
            const miss = Number(m.missing || 0);
            out += `• ${padL(nm, nameCol)}  Missing: ${miss}\n`;
          }
          out += "\n";
        } else {
          out += "Ownership check: All required decorations are available.\n\n";
        }
      }

      // Final note about checkbox
      out += "Options:\n";
      out += `• Include Missing Decorations: ${includeMissing ? "YES" : "NO"}\n`;

      setSwapOutput(out);
    } catch (err) {
      console.error(err);
      alert("Pre-check failed. See console for details.");
      setSwapOutput("");
    }
  });
}

function runSwapPrintList() {
  const text = swapReportText || "";
  if (!text.trim()) {
    alert("Nothing to print yet. Run Pre-Check first.");
    return;
  }
  downloadBlob(text, "MapSwap_PreCheck.txt", "text/plain");
}

async function runSwapMaps() {
  const file = $("swap-xml")?.files?.[0];
  if (!file) {
    alert("Please select a Decorations XML.");
    return;
  }

  if (!ensureDbReadyOrWarn()) return;

  if (!lastPrecheckContext || lastPrecheckContext.fileName !== file.name) {
    alert("Please run Pre-Check first (it builds the swap plan).");
    return;
  }

  const ctx = lastPrecheckContext;
  const includeMissing = getIncludeMissingChecked();
  const toMap = getSelectedTargetMap();
  const guildId = getSelectedGuildId();

  // If user changed map/checkbox since precheck, re-run precheck
  if (ctx.toMap.mapId !== toMap.mapId || ctx.includeMissing !== includeMissing) {
    alert("Map/checkbox changed since Pre-Check. Run Pre-Check again.");
    return;
  }

  // If swapping TO guild hall and excluding missing, require guild + owned data
  if (ctx.toType === "1" && !includeMissing) {
    if (!guildId) {
      alert("Select a guild (or enable Include Missing Decorations) before swapping.");
      return;
    }
    const hasOwnedData = ctx.ownedById && ctx.ownedById.size > 0;
    if (!hasOwnedData) {
      alert("Cannot exclude missing decorations because ownership counts are unavailable. Enable Include Missing Decorations OR run Pre-Check with Helper/API/guild selected.");
      return;
    }
  }

  setSwapOutput("Swapping…");

  loadXML(file, async (mainXML) => {
    try {
      const props = collectProps(mainXML);
      const decorationsNode = mainXML.getElementsByTagName("Decorations")[0];

      if (!decorationsNode || !props.length) {
        alert("Invalid XML (missing Decorations or props).");
        return;
      }

      const toType = ctx.toType;

      // Rebuild targets from live XML (safer)
      const { propTargets } = buildNeedCountsByTargetId(props, toType);

      // Decide which props to keep
      const keepMask = computeKeepMask(propTargets, ctx.ownedById, includeMissing);

      // Apply removals + id remap
      let removedNoCounterpart = 0;
      let removedMissing = 0;
      let updatedIds = 0;

      for (const it of propTargets) {
        const keep = keepMask.get(it.prop);

        if (!keep) {
          // remove prop
          it.prop.parentNode.removeChild(it.prop);

          if (it.targetId == null) removedNoCounterpart++;
          else removedMissing++;
          continue;
        }

        // remap id to target id
        if (it.targetId != null) {
          it.prop.setAttribute("id", String(it.targetId));
          updatedIds++;
        }
      }

      // Update <Decorations> tag
      const toMapNow = ctx.toMap;
      decorationsNode.setAttribute("mapId", toMapNow.mapId);
      decorationsNode.setAttribute("mapName", toMapNow.mapName);
      decorationsNode.setAttribute("type", toMapNow.type);

      // Output report additions
      appendSwapOutput("\nSWAP EXECUTED\n----------------------------------------");
      appendSwapOutput(`Target map: ${toMapNow.mapName}`);
      appendSwapOutput(`Updated IDs: ${updatedIds}`);
      appendSwapOutput(`Removed (no counterpart): ${removedNoCounterpart}`);
      appendSwapOutput(`Removed (missing ownership): ${removedMissing}`);
      appendSwapOutput(`Include Missing Decorations: ${includeMissing ? "YES" : "NO"}`);

      // Serialize and download
      const serializer = new XMLSerializer();
      let xmlOut = serializer.serializeToString(mainXML);
      xmlOut = prettyPrintXML(xmlOut);

      const base = safeFilenameBase(file.name);
      const suffix = mapNameToSuffix(toMapNow.mapName);
      const outName = `${base}${suffix}.xml`;

      downloadBlob(xmlOut, outName, "application/xml");
      appendSwapOutput("\nDone ✔");
    } catch (err) {
      console.error(err);
      alert("Swap failed. See console for details.");
    }
  });
}

// ---------------------------
// DOM Ready
// ---------------------------
document.addEventListener("DOMContentLoaded", async () => {
  await initSwapHelper();

  // Bind buttons (these IDs must match your HTML)
  const preBtn = $("swap-precheck-btn");
  const printBtn = $("swap-print-btn");
  const swapBtn = $("runSwapBtn"); // keep same ID so tabs.js doesn't need changes

  if (preBtn) preBtn.addEventListener("click", runSwapPrecheck);
  if (printBtn) printBtn.addEventListener("click", runSwapPrintList);
  if (swapBtn) swapBtn.addEventListener("click", runSwapMaps);

  // If user changes file/map/options, invalidate precheck context
  const fileInput = $("swap-xml");
  const cb = $("swap-include-missing");
  const guildSel = $("swap-guild");

  if (fileInput) fileInput.addEventListener("change", async () => {
    lastPrecheckContext = null;
    setSwapOutput("");
  });

  document.querySelectorAll('input[name="swapMapChoice"]').forEach(r => {
    r.addEventListener("change", async () => {
      lastPrecheckContext = null;
      setSwapOutput("");
      await updateGuildUIForTarget();
    });
  });

  if (cb) cb.addEventListener("change", () => {
    lastPrecheckContext = null;
    // keep output visible, but require re-precheck for swap correctness
  });

  if (guildSel) guildSel.addEventListener("change", () => {
    lastPrecheckContext = null;
    // do NOT repopulate here (prevents selection reset)
  });

  // Initial: show guild dropdown if target is a guild hall (and helper+API exist)
  await updateGuildUIForTarget();
});
