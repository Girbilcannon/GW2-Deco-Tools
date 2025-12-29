// Shared utilities: XML loading, downloading, pretty printing, DnD, map suffix

function loadXML(file, callback) {
  const reader = new FileReader();
  reader.onload = e => {
    const parser = new DOMParser();
    callback(parser.parseFromString(e.target.result, "text/xml"));
  };
  reader.readAsText(file);
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type: type || "application/octet-stream" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

/* Pretty-print XML string for human readability */
function prettyPrintXML(xmlString) {
  xmlString = xmlString.trim();
  xmlString = xmlString.replace(/>\s*</g, ">\n<");
  const lines = xmlString.split("\n");
  let indent = 0;
  const formatted = [];

  lines.forEach(line => {
    let trimmed = line.trim();
    if (trimmed.match(/^<\/\w/)) {
      indent = Math.max(indent - 1, 0);
    }
    const padding = "  ".repeat(indent);
    formatted.push(padding + trimmed);

    // Increase indent on opening tags that are not self-closing or comments
    if (
      trimmed.match(/^<[^!?\/][^>]*>$/) &&
      !trimmed.endsWith("/>") &&
      !trimmed.startsWith("<!--")
    ) {
      indent++;
    }
  });

  return formatted.join("\n") + "\n";
}

/* Get clean filename suffix from mapName */
function mapNameToSuffix(mapName) {
  let base = mapName;
  if (mapName === "Hearth's Glow") {
    base = "Hearths Glow"; // remove apostrophe only for filename
  }
  return "_" + base.replace(/\s+/g, "-") + ".xml";
}

/* DRAG & DROP INITIALIZATION */
function setupDropZones() {
  const zones = document.querySelectorAll(".drop-zone");

  zones.forEach(zone => {
    const input = zone.querySelector('input[type="file"]');
    const text = zone.querySelector(".drop-zone-text");

    const resetLabel = () => {
      if (text) text.textContent = input.multiple
        ? "Drop XML(s) here or click to browse"
        : "Drop XML here or click to browse";
    };

    zone.addEventListener("click", () => {
      if (input.disabled) return;
      input.click();
    });

    input.addEventListener("change", () => {
      const files = Array.from(input.files || []);
      if (!files.length) {
        resetLabel();
        return;
      }
      if (files.length === 1) {
        if (text) text.textContent = "Loaded: " + files[0].name;
      } else {
        if (text) text.textContent = "Loaded: " + files.length + " files";
      }
    });

    zone.addEventListener("dragover", e => {
      if (input.disabled) return;
      e.preventDefault();
      zone.classList.add("dragover");
    });

    zone.addEventListener("dragleave", e => {
      if (input.disabled) return;
      e.preventDefault();
      zone.classList.remove("dragover");
    });

    zone.addEventListener("drop", e => {
      if (input.disabled) return;
      e.preventDefault();
      zone.classList.remove("dragover");

      const files = Array.from(e.dataTransfer.files || []);
      if (!files.length) return;

      const xmlFiles = files.filter(f => f.name.toLowerCase().endsWith(".xml"));
      if (!xmlFiles.length) {
        alert("Please drop XML file(s).");
        return;
      }

      const dt = new DataTransfer();
      if (input.multiple) {
        xmlFiles.forEach(f => dt.items.add(f));
      } else {
        dt.items.add(xmlFiles[0]);
      }

      input.files = dt.files;

      // 🔔 IMPORTANT FIX:
      // Programmatically setting input.files does NOT trigger "change"
      // Manually dispatch it so tools (like Deco Counter) detect the XML.
      input.dispatchEvent(new Event("change", { bubbles: true }));

      if (xmlFiles.length === 1 || !input.multiple) {
        if (text) text.textContent = "Loaded: " + xmlFiles[0].name;
      } else {
        if (text) text.textContent = "Loaded: " + xmlFiles.length + " files";
      }
    });

    // Initialize default label
    resetLabel();
  });
}
