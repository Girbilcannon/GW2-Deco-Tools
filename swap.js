function runSwap() {
  const file = document.getElementById("swap-xml").files[0];
  if (!file) {
    alert("Select an XML.");
    return;
  }

  loadXML(file, xml => {
    const deco = xml.getElementsByTagName("Decorations")[0];
    if (!deco) {
      alert("No <Decorations> tag found.");
      return;
    }

    const choice = document.querySelector('input[name="mapChoice"]:checked').value;

    const mapDefs = {
      hearth:   { id: "1558", name: "Hearth's Glow",      type: "0" },
      comosus:  { id: "1596", name: "Comosus Isle",       type: "0" },
      lost:     { id: "1124", name: "Lost Precipice",     type: "1" },
      gilded:   { id: "1121", name: "Gilded Hollow",      type: "1" },
      windswept:{ id: "1232", name: "Windswept Haven",    type: "1" },
      isle:     { id: "1462", name: "Isle of Reflection", type: "1" }
    };

    const def = mapDefs[choice];
    if (!def) {
      alert("Unknown map selection.");
      return;
    }

    deco.setAttribute("mapId", def.id);
    deco.setAttribute("mapName", def.name);
    deco.setAttribute("type", def.type);

    const serializer = new XMLSerializer();
    let xmlResult = serializer.serializeToString(xml);
    xmlResult = prettyPrintXML(xmlResult);

    const suffix = mapNameToSuffix(def.name);
    const baseName = file.name.replace(/\.xml$/i, "");
    const outName = baseName + suffix;

    downloadBlob(xmlResult, outName, "application/xml");
  });
}
