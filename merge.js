/* ======================================================
   MERGE TOOL (v8.x)
   - Live map type detection
   - Live 2000 deco cap counter (before merge click)
   - Helper-aware guild dropdown (only for guild halls)
   - Merge button gating (mismatch / guild required)
   ====================================================== */

let hasMapMismatch = false;

let mergeHelperHasApi = false;
let mergeBaseType = "UNKNOWN";     // "HOMESTEAD" | "GUILD" | "UNKNOWN"
let mergeSelectedGuildId = null;

/* =========================
   HELPER STATUS
   ========================= */
async function initMergeHelperStatus() {
  try {
    const res = await fetch("http://localhost:61337/status");
    if (!res.ok) throw new Error("status not ok");
    const status = await res.json();
    mergeHelperHasApi = !!status.apiKeyPresent;
  } catch {
    mergeHelperHasApi = false;
  }
}

/* =========================
   GUILD UI HELPERS
   ========================= */
function resetMergeGuildUI() {
  const wrap = document.getElementById("merge-guild-wrap");
  const select = document.getElementById("merge-guild");

  mergeSelectedGuildId = null;

  if (wrap) wrap.hidden = true;
  if (select) {
    select.disabled = true;
    select.innerHTML = `<option value="">Select a guild…</option>`;
  }
}

async function populateMergeGuildDropdown() {
  const wrap = document.getElementById("merge-guild-wrap");
  const select = document.getElementById("merge-guild");
  if (!wrap || !select) return;

  wrap.hidden = false;

  // Disable until loaded
  select.disabled = true;
  select.innerHTML = `<option value="">Populating guild list…</option>`;

  try {
    const res = await fetch("http://localhost:61337/guilds");
    if (!res.ok) throw new Error("guilds not ok");

    const guilds = await res.json();

    select.innerHTML = `<option value="">Select a guild…</option>`;

    guilds.forEach(g => {
      // Helper returns Id/Name/Tag (caps)
      const opt = document.createElement("option");
      opt.value = g.Id;
      opt.textContent = `${g.Name} [${g.Tag}]`;
      select.appendChild(opt);
    });

    select.disabled = false;
  } catch {
    select.innerHTML = `<option value="">Failed to load guilds</option>`;
    select.disabled = true;
  }
}

/* =========================
   BUTTON GATING
   ========================= */
function updateMergeButtonState() {
  const mergeBtn = document.getElementById("runMergeBtn");
  if (!mergeBtn) return;

  // base requirements: both inputs present + no mismatch
  if (hasMapMismatch) {
    mergeBtn.disabled = true;
    mergeBtn.classList.add("disabled");
    return;
  }

  // If base is guild and helper has API: must pick guild
  if (mergeBaseType === "GUILD" && mergeHelperHasApi) {
    const ok = !!mergeSelectedGuildId;
    mergeBtn.disabled = !ok;
    mergeBtn.classList.toggle("disabled", !ok);
    return;
  }

  // Otherwise ok (as long as files exist; we handle that inside detect)
  mergeBtn.disabled = false;
  mergeBtn.classList.remove("disabled");
}

/* =========================
   MAP TYPE PARSING
   ========================= */
function getDecorTypeFromDecorationsNode(decorNode) {
  const t = decorNode?.getAttribute("type");
  if (t === "1") return "GUILD";
  if (t === "0") return "HOMESTEAD";
  return "UNKNOWN";
}

/* =========================
   LIVE DETECTION + REPORT
   ========================= */
function detectMergeMapTypes() {
  const originalInput = document.getElementById("merge-original");
  const addInput = document.getElementById("merge-add");
  const outputEl = document.getElementById("merge-output");
  const mergeBtn = document.getElementById("runMergeBtn");

  hasMapMismatch = false;

  if (!outputEl) return;
  outputEl.style.display = "block";
  outputEl.textContent = "";

  const originalFile = originalInput?.files?.[0] || null;
  const addFiles = Array.from(addInput?.files || []);

  // No base file yet
  if (!originalFile) {
    mergeBaseType = "UNKNOWN";
    resetMergeGuildUI();
    if (mergeBtn) {
      mergeBtn.disabled = true;
      mergeBtn.classList.add("disabled");
    }
    return;
  }

  loadXML(originalFile, originalXML => {
    const origDecor = originalXML.getElementsByTagName("Decorations")[0];
    if (!origDecor) return;

    mergeBaseType = getDecorTypeFromDecorationsNode(origDecor);

    // If base is homestead, never show guild dropdown
    if (mergeBaseType === "HOMESTEAD") {
      resetMergeGuildUI();
    }

    // If base is guild and helper has API, ensure dropdown exists/populated
    if (mergeBaseType === "GUILD") {
      if (mergeHelperHasApi) {
        // Only populate if not already visible/loaded
        const wrap = document.getElementById("merge-guild-wrap");
        const select = document.getElementById("merge-guild");
        const alreadyShown = wrap && !wrap.hidden;
        const hasOptions = select && select.options && select.options.length > 1;

        if (!alreadyShown || !hasOptions) {
          populateMergeGuildDropdown();
        }
      } else {
        // No helper → hide guild UI and allow merge like homestead mode
        resetMergeGuildUI();
      }
    }

    let report = `Base Layout: ${originalFile.name}\n`;
    report += `Map Type: ${mergeBaseType}\n\n`;

    // Count props in base right now
    const basePropsCount = origDecor.getElementsByTagName("prop").length;

    if (!addFiles.length) {
      report += "Waiting for additional XML files…\n\n";
      report += `Total Decorations (prospective): ${basePropsCount} / 2000\n`;

      outputEl.textContent = report;

      if (mergeBtn) {
        mergeBtn.disabled = true;
        mergeBtn.classList.add("disabled");
      }
      return;
    }

    report += "Additional Files:\n";

    let processed = 0;

    // We compute a *prospective merge total*:
    // base props + props from add-files that match base type (since mismatches are skipped)
    let prospectiveTotalProps = basePropsCount;

    addFiles.forEach(file => {
      loadXML(file, addXML => {
        const addDecor = addXML.getElementsByTagName("Decorations")[0];
        const addType = getDecorTypeFromDecorationsNode(addDecor);

        if (addType !== mergeBaseType) {
          hasMapMismatch = true;
          report += `⚠️ ${file.name} → ${addType} (MISMATCH)\n`;
        } else {
          report += `✅ ${file.name} → ${addType}\n`;

          // only count props that would actually be merged
          const addPropsCount = addDecor?.getElementsByTagName("prop").length || 0;
          prospectiveTotalProps += addPropsCount;
        }

        processed++;
        if (processed === addFiles.length) {
          report += "\n";

          // Live 2000 cap block
          report += `Total Decorations (prospective): ${prospectiveTotalProps} / 2000\n`;
          if (prospectiveTotalProps > 2000) {
            report += `⚠️ WARNING: This merge would exceed the 2000 decoration limit.\n`;
            report += `⚠️ You may not be able to place/save this full layout in-game.\n`;
          }

          report += "\n";

          if (hasMapMismatch) {
            report += "❌ Merge disabled — map types do not match.\n";
          } else {
            report += "✅ All map types match — ready to merge.\n";
          }

          outputEl.textContent = report;

          // Button gating (needs to consider guild selection too)
          updateMergeButtonState();

          // If mismatch, always disable button
          if (hasMapMismatch && mergeBtn) {
            mergeBtn.disabled = true;
            mergeBtn.classList.add("disabled");
          }

          // If no mismatch but base is guild+helper, require selection
          if (!hasMapMismatch) {
            updateMergeButtonState();
          }
        }
      });
    });
  });
}

/* =========================
   RUN MERGE
   ========================= */
async function runMerge() {
  if (hasMapMismatch) {
    alert("Merge blocked: map type mismatch.");
    return;
  }

  const originalInput = document.getElementById("merge-original");
  const addInput = document.getElementById("merge-add");
  const outputEl = document.getElementById("merge-output");

  const originalFile = originalInput?.files?.[0] || null;
  const addFiles = Array.from(addInput?.files || []);
  if (!originalFile || !addFiles.length) return;

  // If base is guild + helper has api, require selected guild
  if (mergeBaseType === "GUILD" && mergeHelperHasApi && !mergeSelectedGuildId) {
    alert("Please select a guild first.");
    return;
  }

  loadXML(originalFile, async originalXML => {
    const origDecor = originalXML.getElementsByTagName("Decorations")[0];
    if (!origDecor) return;

    // Collect props/needs across base + matching adds
    const requiredById = {};
    let totalProps = 0;

    function collectProps(xml) {
      const props = xml.getElementsByTagName("prop");
      totalProps += props.length;

      for (let p of props) {
        const id = p.getAttribute("id");
        if (!id) continue;

        let nameRaw = p.getAttribute("name") || "UNKNOWN";
        let name = nameRaw.split(/\r?\n/)[0]
          .replace(/<c[^>]*>/g, "")
          .replace(/<\/c>/g, "")
          .trim();

        if (!requiredById[id]) {
          requiredById[id] = { id, name, need: 0 };
        }
        requiredById[id].need++;
      }
    }

    // base always included
    collectProps(originalXML);

    // merge only matching files; also append them with comments
    const baseType = getDecorTypeFromDecorationsNode(origDecor);
    const acceptedFiles = [];
    const rejectedFiles = [];

    // Load add files sequentially to preserve merge order
    for (const file of addFiles) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolve => {
        loadXML(file, addXML => {
          const addDecor = addXML.getElementsByTagName("Decorations")[0];
          const addType = getDecorTypeFromDecorationsNode(addDecor);

          if (addType !== baseType) {
            rejectedFiles.push({ name: file.name, type: addType });
            resolve();
            return;
          }

          // collect props for missing calc (already done above in your previous approach)
          collectProps(addXML);

          // actually merge props with comment label
          const addProps = addDecor?.getElementsByTagName("prop") || [];
          if (addProps.length) {
            const addBaseName = file.name.replace(/\.xml$/i, "");
            const commentNode = originalXML.createComment(addBaseName);

            origDecor.appendChild(originalXML.createTextNode("\n  "));
            origDecor.appendChild(commentNode);
            origDecor.appendChild(originalXML.createTextNode("\n  "));

            for (let i = 0; i < addProps.length; i++) {
              const importedProp = originalXML.importNode(addProps[i], true);
              origDecor.appendChild(importedProp);
              origDecor.appendChild(originalXML.createTextNode("\n  "));
            }

            acceptedFiles.push(file.name);
          }

          resolve();
        });
      });
    }

    // Start with whatever was already printed by detect()
    let report = (outputEl?.textContent || "").trimEnd() + "\n\n";

    // Always show cap info here too (in case user clicks without re-checking)
    report += `Total Decorations (prospective): ${totalProps} / 2000\n`;
    if (totalProps > 2000) {
      report += `⚠️ WARNING: This merge exceeds the 2000 decoration limit.\n`;
      report += `⚠️ You may not be able to place/save this full layout in-game.\n`;
    }

    // Helper missing calc
    let ownedById = null;

    if (mergeHelperHasApi) {
      try {
        if (baseType === "HOMESTEAD") {
          const res = await fetch("http://localhost:61337/decos/homestead");
          if (res.ok) ownedById = await res.json();
        } else if (baseType === "GUILD" && mergeSelectedGuildId) {
          const ids = Object.keys(requiredById).map(id => parseInt(id, 10));
          const res = await fetch(
            `http://localhost:61337/decos/guild/${mergeSelectedGuildId}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids })
            }
          );
          if (res.ok) ownedById = await res.json();
        }
      } catch {
        ownedById = null;
      }
    }

    if (mergeHelperHasApi && ownedById) {
      const entries = Object.values(requiredById)
        .map(e => {
          const owned = ownedById[e.id] || 0;
          const missing = Math.max(e.need - owned, 0);
          return { ...e, missing };
        })
        .filter(e => e.missing > 0)
        .sort((a, b) => a.name.localeCompare(b.name));

      if (!entries.length) {
        report += "\n✅ All required decorations are already unlocked.\n";
      } else {
        report += "\nMissing Decorations Introduced by Merge:\n\n";

        const maxName = Math.max(...entries.map(e => e.name.length));

        // Per your request: reduce noise → show Missing only
        entries.forEach(e => {
          report += `${e.name.padEnd(maxName)} | Missing: ${String(e.missing).padStart(3)}\n`;
        });
      }
    } else {
      report += "\n[Info] Helper not available — skipping missing decoration check.\n";
    }

    // Mention rejected (should be none if button was enabled, but safe)
    if (rejectedFiles.length) {
      report += "\n⚠️ Skipped Files (Map Type Mismatch):\n";
      rejectedFiles.forEach(r => {
        report += `- ${r.name} (${r.type})\n`;
      });
    }

    if (outputEl) {
      outputEl.style.display = "block";
      outputEl.textContent = report;
    }

    // Download merged xml
    const serializer = new XMLSerializer();
    let mergedXML = serializer.serializeToString(originalXML);
    mergedXML = prettyPrintXML(mergedXML);

    const baseOrig = originalFile.name.replace(/\.xml$/i, "");
    downloadBlob(mergedXML, `${baseOrig}_MERGED.xml`, "application/xml");
  });
}

/* =========================
   INIT / WIRING
   ========================= */
document.addEventListener("DOMContentLoaded", async () => {
  await initMergeHelperStatus();

  const btn = document.getElementById("runMergeBtn");
  if (btn) {
    btn.disabled = true;
    btn.classList.add("disabled");
  }

  // Re-run detection on file changes
  document.getElementById("merge-original")?.addEventListener("change", detectMergeMapTypes);
  document.getElementById("merge-add")?.addEventListener("change", detectMergeMapTypes);

  // Guild selection gate
  document.getElementById("merge-guild")?.addEventListener("change", e => {
    mergeSelectedGuildId = e.target.value || null;
    updateMergeButtonState();
  });

  // First pass (in case inputs already have files from browser restore)
  detectMergeMapTypes();
});
