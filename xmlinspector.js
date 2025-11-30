/* =============================================================
   XML INSPECTOR — v7.6.7
   Multi-error repair for malformed <prop ... /> + payload
   Raw-text safe repair (no DOM reserialization)
   ============================================================= */

let inspectorOriginalFile = null;
let inspectorNeedsFix = false;
let fixedRawText = null;

// -------------------------------------------------------------
// MAIN INSPECTION
// -------------------------------------------------------------
function runInspector() {
  const file = document.getElementById("inspector-xml").files[0];
  const output = document.getElementById("inspector-output");
  const fixBtn = document.getElementById("inspector-fixbtn");

  output.textContent = "";
  fixBtn.disabled = true;
  fixBtn.classList.add("disabled");
  inspectorNeedsFix = false;
  fixedRawText = null;

  if (!file) {
    alert("Please select an XML file.");
    return;
  }
  inspectorOriginalFile = file;

  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;

    // 1) Try normal validation
    const parse = tryParse(text);
    if (parse.valid) {
      output.textContent = "✔ XML Inspection finished — no errors found.";
      return;
    }

    // 2) Attempt to repair ALL malformed props of the known pattern
    const repair = fixAllMalformedProps(text);

    if (repair.changed) {
      const parse2 = tryParse(repair.text);
      if (parse2.valid) {
        inspectorNeedsFix = true;
        fixedRawText = repair.text;

        const lineInfo = repair.lines.length === 1
          ? `Problem detected at line ${repair.lines[0]}.`
          : `Problems detected at lines ${repair.lines.join(", ")}.`;

        output.textContent =
          "❌ XML contains one or more malformed <prop ... /> tags that incorrectly have children.\n" +
          lineInfo + "\n\n" +
          "These can be safely repaired.\n" +
          "Click FIX NOW to download the corrected XML.";

        fixBtn.disabled = false;
        fixBtn.classList.remove("disabled");
        return;
      }
    }

    // 3) Still invalid or unrepairable
    output.textContent =
      "❌ XML Inspection found formatting errors:\n\n" + parse.error;
  };

  reader.readAsText(file);
}


// -------------------------------------------------------------
// FIX LOGIC: handle MULTIPLE malformed props in one pass
// -------------------------------------------------------------
function fixAllMalformedProps(xmlText) {
  const lines = xmlText.split(/\r?\n/);
  const selfClosingProp = /^(\s*)<\s*prop\b([^>]*?)\/\s*>/i;

  let changed = false;
  let affectedLines = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(selfClosingProp);
    if (!match) continue;

    // For each self-closing prop, look ONLY at the *next meaningful line*
    // and only until we hit another <prop> or a closing </prop>.
    for (let j = i + 1; j < lines.length; j++) {
      const trimmed = lines[j].trim();

      // Hit another prop → sibling, not a child → stop checking this prop
      if (/^<\s*prop\b/i.test(trimmed)) {
        break;
      }

      // Hit closing </prop> → there's no real child under this self-closing one
      if (/^<\s*\/\s*prop\s*>/i.test(trimmed)) {
        break;
      }

      // Skip empty / whitespace lines
      if (trimmed === "") {
        continue;
      }

      // FIRST meaningful line under this prop:
      // If it's payload → malformed prop, fix it.
      if (/^<\s*payload\b/i.test(trimmed)) {
        lines[i] = lines[i].replace(/\/\s*>/, ">");
        if (!affectedLines.includes(i + 1)) {
          affectedLines.push(i + 1);
        }
        changed = true;
      }

      // Regardless of what this line is, we only consider
      // the FIRST meaningful line when deciding for this prop.
      break;
    }
  }

  return {
    changed,
    lines: affectedLines,
    text: lines.join("\n")
  };
}


// -------------------------------------------------------------
// DOMParser VALIDATION ONLY (never used for serializing)
// -------------------------------------------------------------
function tryParse(text) {
  const parser = new DOMParser();
  const dom = parser.parseFromString(text, "application/xml");
  const errors = dom.getElementsByTagName("parsererror");

  if (errors.length > 0) {
    return { valid: false, error: errors[0].textContent.trim() };
  }
  return { valid: true, error: null };
}


// -------------------------------------------------------------
// FIX NOW — RAW TEXT OUTPUT (STRUCTURE-PRESERVING)
// -------------------------------------------------------------
function runInspectorFix() {
  if (!inspectorNeedsFix || !fixedRawText) return;

  const base = inspectorOriginalFile.name.replace(/\.xml$/i, "");
  const outName = base + "_FIXED.xml";

  // Raw write — NO DOM serialization, NO pretty-print
  downloadBlob(fixedRawText, outName, "application/xml");

  document.getElementById("inspector-output").textContent =
    "✔ XML repaired and downloaded.";

  const fixBtn = document.getElementById("inspector-fixbtn");
  fixBtn.disabled = true;
  fixBtn.classList.add("disabled");
}
