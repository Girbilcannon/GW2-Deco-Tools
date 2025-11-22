function runMover() {
  const mainFile = document.getElementById("mover-main").files[0];
  const startFile = document.getElementById("mover-start").files[0];
  const endFile = document.getElementById("mover-end").files[0];

  if (!mainFile || !startFile || !endFile) {
    alert("Please select all three XML files.");
    return;
  }

  loadXML(startFile, startXML => {
    loadXML(endFile, endXML => {
      loadXML(mainFile, mainXML => {

        const start = startXML.getElementsByTagName("prop")[0];
        const end = endXML.getElementsByTagName("prop")[0];

        if (!start || !end) {
          alert("Start or End XML has no <prop> entries.");
          return;
        }

        const s = start.getAttribute("pos").split(" ").map(Number);
        const d = end.getAttribute("pos").split(" ").map(Number);
        const delta = [d[0] - s[0], d[1] - s[1], d[2] - s[2]];

        const props = mainXML.getElementsByTagName("prop");

        for (let p of props) {
          const pos = p.getAttribute("pos").split(" ").map(Number);
          const moved = [pos[0] + delta[0], pos[1] + delta[1], pos[2] + delta[2]];
          p.setAttribute("pos", moved.join(" "));
        }

        const serializer = new XMLSerializer();
        let xmlResult = serializer.serializeToString(mainXML);
        xmlResult = prettyPrintXML(xmlResult);

        const outName = mainFile.name.replace(/\.xml$/i, "_moved.xml");
        downloadBlob(xmlResult, outName, "application/xml");
      });
    });
  });
}
