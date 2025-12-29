// ==========================================
// Interactive Move Tool (Auto Map Swap)
// ==========================================

function getSelectedZAnchor() {
  const checked = document.querySelector('input[name="z-anchor"]:checked');
  return checked ? checked.value : "bottom";
}

function runInteractiveMover() {
  const mainFile = document.getElementById("interactive-xml").files[0];
  const statusEl = document.getElementById("interactive-status");

  if (!mainFile) {
    alert("Please select a Decorations XML.");
    return;
  }

  if (statusEl) statusEl.textContent = "Reading XML…";

  loadXML(mainFile, mainXML => {
    const props = mainXML.getElementsByTagName("prop");

    if (!props.length) {
      alert("No <prop> entries found in XML.");
      return;
    }

    // ------------------------------------------
    // Compute pivot
    //  X/Y = average (UNCHANGED)
    //  Z   = based on anchor selection
    // ------------------------------------------
    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;
    let minZ = Infinity;
    let maxZ = -Infinity;
    let count = 0;

    for (let p of props) {
      const pos = p.getAttribute("pos");
      if (!pos) continue;

      const parts = pos.split(" ").map(Number);
      if (parts.length !== 3 || parts.some(isNaN)) continue;

      sumX += parts[0];
      sumY += parts[1];
      sumZ += parts[2];

      minZ = Math.min(minZ, parts[2]);
      maxZ = Math.max(maxZ, parts[2]);

      count++;
    }

    if (!count) {
      alert("Could not compute layout pivot.");
      return;
    }

    const anchorMode = getSelectedZAnchor();

    let pivotZ;
    switch (anchorMode) {
      case "top":
        pivotZ = minZ;      // lowest numeric = highest physical
        break;
      case "middle":
        pivotZ = sumZ / count;
        break;
      case "bottom":
      default:
        pivotZ = maxZ;      // highest numeric = lowest physical
        break;
    }

    const pivot = {
      x: sumX / count,
      y: sumY / count,
      z: pivotZ
    };

    if (statusEl) statusEl.textContent = "Fetching character position…";

    // ------------------------------------------
    // Fetch Mumble data
    // ------------------------------------------
    fetch("http://127.0.0.1:61337/mumble")
      .then(r => r.json())
      .then(data => {
        if (!data.available) {
          alert("Character position unavailable.");
          return;
        }

        // ------------------------------------------
        // Mumble → Decoration coordinate conversion
        // ------------------------------------------
        const SCALE = 0.025400052;

        const target = {
          x: data.position.x / SCALE,
          y: data.position.z / SCALE,
          z: -data.position.y / SCALE
        };

        const dx = target.x - pivot.x;
        const dy = target.y - pivot.y;
        const dz = target.z - pivot.z;

        // ------------------------------------------
        // Apply move
        // ------------------------------------------
        for (let p of props) {
          const pos = p.getAttribute("pos");
          if (!pos) continue;

          const parts = pos.split(" ").map(Number);

          p.setAttribute(
            "pos",
            [
              parts[0] + dx,
              parts[1] + dy,
              parts[2] + dz
            ].join(" ")
          );
        }

        // ------------------------------------------
        // AUTO MAP SWAP (matches swap.js behavior)
        // ------------------------------------------
        const decorationsNode = mainXML.getElementsByTagName("Decorations")[0];
        const mapInfo = getMapInfoById(String(data.mapId));

        if (decorationsNode && mapInfo) {
          decorationsNode.setAttribute("mapId", mapInfo.mapId);
          decorationsNode.setAttribute("mapName", mapInfo.mapName);
          decorationsNode.setAttribute("type", mapInfo.type);
        }

        // ------------------------------------------
        // Output
        // ------------------------------------------
        const serializer = new XMLSerializer();
        let xmlOut = serializer.serializeToString(mainXML);
        xmlOut = prettyPrintXML(xmlOut);

        const outName = mainFile.name.replace(/\.xml$/i, "_MOVED.xml");
        downloadBlob(xmlOut, outName, "application/xml");

        if (statusEl) statusEl.textContent = "Done ✔";
      })
      .catch(err => {
        console.error(err);
        alert("Failed to contact Deco Tools Helper.");
      });
  });
}

// ==========================================
// Map lookup (EXACTLY like swap.js)
// ==========================================

function getMapInfoById(mapId) {
  const MAPS = {
    "1558": { mapId: "1558", mapName: "Hearth's Glow", type: "0" },
    "1596": { mapId: "1596", mapName: "Comosus Isle", type: "0" },
    "1062": { mapId: "1062", mapName: "Lost Precipice", type: "1" },
    "1101": { mapId: "1101", mapName: "Gilded Hollow", type: "1" },
    "1121": { mapId: "1121", mapName: "Windswept Haven", type: "1" },
    "1158": { mapId: "1158", mapName: "Isle of Reflection", type: "1" }
  };

  return MAPS[mapId] || null;
}

// ------------------------------------------
// DOM Ready – button binding
// ------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("interactive-move-btn");

  if (!btn) {
    console.warn("[InteractiveMover] Button not found");
    return;
  }

  btn.addEventListener("click", () => {
    runInteractiveMover();
  });
});
