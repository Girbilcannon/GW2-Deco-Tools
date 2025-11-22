let extractXMLDoc = null;
let extractFileName = "";
let extractIndex = null;

function buildGroupIndex(xmlDoc) {
  const deco = xmlDoc.getElementsByTagName("Decorations")[0];
  if (!deco) return null;

  const children = Array.from(deco.childNodes);
  const groupMap = {};
  const groupOrder = [];
  const baseProps = [];
  let currentGroup = null;

  children.forEach(node => {
    if (node.nodeType === Node.COMMENT_NODE) {
      const name = (node.nodeValue || "").trim();
      if (!name) {
        currentGroup = null;
        return;
      }
      currentGroup = name;
      if (!groupMap[name]) {
        groupMap[name] = { comments: [], props: [] };
        groupOrder.push(name);
      }
      groupMap[name].comments.push(node);
    } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "prop") {
      if (currentGroup) {
        if (!groupMap[currentGroup]) {
          groupMap[currentGroup] = { comments: [], props: [] };
          groupOrder.push(currentGroup);
        }
        groupMap[currentGroup].props.push(node);
      } else {
        baseProps.push(node);
      }
    }
  });

  return { deco, groupMap, groupOrder, baseProps };
}

function viewExtractGroups() {
  const file = document.getElementById("extract-xml").files[0];
  if (!file) {
    alert("Select an XML assembled with the Deco Merger tool.");
    return;
  }

  loadXML(file, xml => {
    const index = buildGroupIndex(xml);
    if (!index) {
      alert("No <Decorations> tag found.");
      return;
    }

    const { groupOrder, groupMap } = index;
    if (!groupOrder.length) {
      alert("No deco groups found. This tool only works on XMLs assembled by the Deco Merger tool.");
      return;
    }

    extractXMLDoc   = xml;
    extractFileName = file.name;
    extractIndex    = index;

    const container = document.getElementById("extract-groups");
    let html = "<div><strong>Grouped Decos found:</strong></div>";
    groupOrder.forEach(name => {
      const count = groupMap[name].props.length;
      html += `
        <label style="display:block; margin:4px 0;">
          <input type="checkbox" name="extractGroup" value="${name}">
          ${name} (${count} props)
        </label>`;
    });

    container.innerHTML = html;
  });
}

function extractSelectedGroups() {
  if (!extractXMLDoc || !extractIndex) {
    alert("Please load an XML and click 'View Deco Groups' first.");
    return;
  }

  const checkboxes = Array.from(
    document.querySelectorAll('input[name="extractGroup"]:checked')
  );
  if (!checkboxes.length) {
    alert("Select at least one group to extract.");
    return;
  }

  const selectedNames = checkboxes.map(cb => cb.value);
  const baseName = extractFileName.replace(/\.xml$/i, "");

  /* 1) Build stripped version: remove all selected groups from a clone */
  const strippedDoc  = extractXMLDoc.cloneNode(true);
  const strippedIdx  = buildGroupIndex(strippedDoc);

  selectedNames.forEach(name => {
    const info = strippedIdx.groupMap[name];
    if (!info) return;
    info.comments.forEach(node => node.parentNode && node.parentNode.removeChild(node));
    info.props.forEach(node => node.parentNode && node.parentNode.removeChild(node));
  });

  let strippedXML = new XMLSerializer().serializeToString(strippedDoc);
  strippedXML = prettyPrintXML(strippedXML);
  downloadBlob(strippedXML, baseName + "_stripped.xml", "application/xml");

  /* 2) Correct per-group extraction: each selected group gets its own file */
  selectedNames.forEach(name => {
    const exDoc  = extractXMLDoc.cloneNode(true);
    const deco   = exDoc.getElementsByTagName("Decorations")[0];
    const nodes  = Array.from(deco.childNodes);

    let insideTarget = false;

    nodes.forEach(node => {
      if (node.nodeType === Node.COMMENT_NODE) {
        const groupName = (node.nodeValue || "").trim();
        if (groupName === name) {
          insideTarget = true;
        } else {
          insideTarget = false;
          if (node.parentNode) {
            node.parentNode.removeChild(node);
          }
        }
      } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "prop") {
        if (!insideTarget) {
          if (node.parentNode) {
            node.parentNode.removeChild(node);
          }
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        if (!insideTarget && node.textContent.trim() === "") {
          if (node.parentNode) {
            node.parentNode.removeChild(node);
          }
        }
      }
    });

    let exXML  = new XMLSerializer().serializeToString(exDoc);
    exXML = prettyPrintXML(exXML);
    const outName = name + "_EXTRACTED.xml";
    downloadBlob(exXML, outName, "application/xml");
  });

  alert("Extraction complete!");
}
