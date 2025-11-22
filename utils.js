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
      if (text) text.textContent = "Drop XML here or click to browse";
    };

    zone.addEventListener("click", () => {
      input.click();
    });

    input.addEventListener("change", () => {
      const file = input.files[0];
      if (file) {
        if (text) text.textContent = "Loaded: " + file.name;
      } else {
        resetLabel();
      }
    });

    zone.addEventListener("dragover", e => {
      e.preventDefault();
      zone.classList.add("dragover");
    });

    zone.addEventListener("dragleave", e => {
      e.preventDefault();
      zone.classList.remove("dragover");
    });

    zone.addEventListener("drop", e => {
      e.preventDefault();
      zone.classList.remove("dragover");
      const file = e.dataTransfer.files[0];
      if (!file) return;
      if (!file.name.toLowerCase().endsWith(".xml")) {
        alert("Please drop an XML file.");
        return;
      }
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      if (text) text.textContent = "Loaded: " + file.name;
    });
  });
}
