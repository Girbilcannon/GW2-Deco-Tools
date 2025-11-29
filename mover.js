function updateMoverMode() {
  const bringZero = document.getElementById("mover-worldzero").checked;
  const startInput = document.getElementById("mover-start");
  const endInput   = document.getElementById("mover-end");
  const safezoneSel = document.getElementById("mover-safezone");

  // All mover labels in their actual DOM order:
  // 0 = Safe Zone
  // 1 = Main Decorations XML
  // 2 = Start Location XML
  // 3 = End Location XML
  const labels = document.querySelectorAll(".mover-label");

  const labelSafe  = labels[0];
  const labelStart = labels[2];
  const labelEnd   = labels[3];

  // Enable/disable Safe Zone dropdown
  safezoneSel.disabled = !bringZero;

  // Fade logic:
  // Safe Zone: fades when NOT in world zero mode
  if (bringZero) {
    labelSafe.classList.remove("disabled");
  } else {
    labelSafe.classList.add("disabled");
  }

  // Start/End labels fade IN world zero mode
  if (bringZero) {
    labelStart.classList.add("disabled");
    labelEnd.classList.add("disabled");
  } else {
    labelStart.classList.remove("disabled");
    labelEnd.classList.remove("disabled");
  }

  // Disable/enable Start/End inputs as before
  const startZone = startInput.closest(".drop-zone");
  const endZone   = endInput.closest(".drop-zone");

  startInput.disabled = bringZero;
  endInput.disabled   = bringZero;

  if (startZone) startZone.classList.toggle("disabled", bringZero);
  if (endZone)   endZone.classList.toggle("disabled", bringZero);
}

function runMover() {
  const mainFile = document.getElementById("mover-main").files[0];
  const bringZero = document.getElementById("mover-worldzero").checked;
  const safezone = document.getElementById("mover-safezone").value;

  const startFile = document.getElementById("mover-start").files[0];
  const endFile   = document.getElementById("mover-end").files[0];

  if (!mainFile) {
    alert("Please select the Main Decorations XML.");
    return;
  }

  // ================================
  // WORLD ZERO MODE
  // ================================
  if (bringZero) {
    loadXML(mainFile, mainXML => {
      const props = mainXML.getElementsByTagName("prop");
      if (!props.length) {
        alert("No <prop> entries found in Main XML.");
        return;
      }

      let sumX = 0, sumY = 0, sumZ = 0, count = 0;

      // Compute average
      for (let p of props) {
        const pos = p.getAttribute("pos");
        if (!pos) continue;

        const parts = pos.split(" ").map(Number);
        if (parts.length !== 3 || parts.some(isNaN)) continue;

        sumX += parts[0];
        sumY += parts[1];
        sumZ += parts[2];
        count++;
      }

      if (!count) {
        alert("Could not compute average position.");
        return;
      }

      const avgX = sumX / count;
      const avgY = sumY / count;
      const avgZ = sumZ / count;

      // SAFE ZONE OFFSETS
      let targetX = 0, targetY = 0, targetZ = 0;

      if (safezone === "guildhall") {
        targetY = -3000;
        targetZ = -4200;
      }

      // Shift everything
      for (let p of props) {
        const pos = p.getAttribute("pos");
        if (!pos) continue;

        const parts = pos.split(" ").map(Number);
        const newPos = [
          parts[0] - avgX + targetX,
          parts[1] - avgY + targetY,
          parts[2] - avgZ + targetZ
        ];

        p.setAttribute("pos", newPos.join(" "));
      }

      // Output
      const serializer = new XMLSerializer();
      let xmlOut = serializer.serializeToString(mainXML);
      xmlOut = prettyPrintXML(xmlOut);

      const outName = mainFile.name.replace(/\.xml$/i, "_ZEROED.xml");
      downloadBlob(xmlOut, outName, "application/xml");
    });

    return;
  }

  // ================================
  // ORIGINAL MOVE MODE
  // ================================
  if (!startFile || !endFile) {
    alert("Please select Start and End XML, or enable World Zero.");
    return;
  }

  loadXML(startFile, startXML => {
    loadXML(endFile, endXML => {
      loadXML(mainFile, mainXML => {

        const start = startXML.getElementsByTagName("prop")[0];
        const end   = endXML.getElementsByTagName("prop")[0];

        if (!start || !end) {
          alert("Start or End XML has no <prop> entry.");
          return;
        }

        const s = start.getAttribute("pos").split(" ").map(Number);
        const d = end.getAttribute("pos").split(" ").map(Number);
        const delta = [d[0]-s[0], d[1]-s[1], d[2]-s[2]];

        const props = mainXML.getElementsByTagName("prop");

        for (let p of props) {
          const pos = p.getAttribute("pos");
          if (!pos) continue;
          const parts = pos.split(" ").map(Number);

          p.setAttribute("pos", [
            parts[0] + delta[0],
            parts[1] + delta[1],
            parts[2] + delta[2]
          ].join(" "));
        }

        const serializer = new XMLSerializer();
        let xmlOut = serializer.serializeToString(mainXML);
        xmlOut = prettyPrintXML(xmlOut);

        const outName = mainFile.name.replace(/\.xml$/i, "_moved.xml");
        downloadBlob(xmlOut, outName, "application/xml");

      });
    });
  });
}
