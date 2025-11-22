function runMerge() {
  const originalFile = document.getElementById("merge-original").files[0];
  const addFile = document.getElementById("merge-add").files[0];

  if (!originalFile || !addFile) {
    alert("Please select both the Original and Add Decos XML files.");
    return;
  }

  loadXML(originalFile, originalXML => {
    loadXML(addFile, addXML => {
      const origDecor = originalXML.getElementsByTagName("Decorations")[0];
      if (!origDecor) {
        alert("No <Decorations> tag found in Original XML.");
        return;
      }

      const addDecor = addXML.getElementsByTagName("Decorations")[0];
      if (!addDecor) {
        alert("No <Decorations> tag found in Add Decos XML.");
        return;
      }

      const addProps = addDecor.getElementsByTagName("prop");
      if (!addProps.length) {
        alert("No <prop> entries found in Add Decos XML.");
        return;
      }

      // Comment based on second file name (no .xml)
      const addBaseName = addFile.name.replace(/\.xml$/i, "");
      const commentNode = originalXML.createComment(addBaseName);

      // Insert newline + comment + newline for readability
      origDecor.appendChild(originalXML.createTextNode("\n  "));
      origDecor.appendChild(commentNode);
      origDecor.appendChild(originalXML.createTextNode("\n  "));

      // Append merged props after comment
      for (let i = 0; i < addProps.length; i++) {
        const importedProp = originalXML.importNode(addProps[i], true);
        origDecor.appendChild(importedProp);
        origDecor.appendChild(originalXML.createTextNode("\n  "));
      }

      const serializer = new XMLSerializer();
      let mergedXML = serializer.serializeToString(originalXML);
      mergedXML = prettyPrintXML(mergedXML);

      const baseOrig = originalFile.name.replace(/\.xml$/i, "");
      const outName  = `${baseOrig}_MERGE_${addBaseName}.xml`;

      downloadBlob(mergedXML, outName, "application/xml");
    });
  });
}
