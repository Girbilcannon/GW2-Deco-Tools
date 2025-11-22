let counterData = "";

function runCounter() {
  const file = document.getElementById("counter-xml").files[0];
  if (!file) {
    alert("Select an XML.");
    return;
  }

  loadXML(file, xml => {
    const props = xml.getElementsByTagName("prop");
    const map = {};

    for (let p of props) {
      let name = p.getAttribute("name") || "UNKNOWN";
      name = name.replace(/<c[^>]*>/g, "").replace(/<\/c>/g, "");
      map[name] = (map[name] || 0) + 1;
    }

    let out = "";
    const sorted = Object.keys(map).sort();
    sorted.forEach(name => {
      out += `${map[name]} × ${name}\n`;
    });

    counterData = out;
    document.getElementById("counter-output").textContent = out;
    document.getElementById("downloadCounter").style.display = "inline-block";
  });
}

function downloadCounterList() {
  downloadBlob(counterData, "deco_count.txt", "text/plain");
}
