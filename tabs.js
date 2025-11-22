function setupTabs() {
  const tabs = document.querySelectorAll(".tab");
  const panes = document.querySelectorAll(".tool-pane");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      panes.forEach(p => p.classList.remove("active"));

      tab.classList.add("active");
      const targetId = tab.dataset.target;
      const pane = document.getElementById(targetId);
      if (pane) pane.classList.add("active");
    });
  });

  // link-like elements that switch tab
  const tabLinks = document.querySelectorAll("[data-switch-tab]");
  tabLinks.forEach(el => {
    el.addEventListener("click", () => {
      const targetId = el.getAttribute("data-switch-tab");
      if (!targetId) return;

      tabs.forEach(t => t.classList.remove("active"));
      panes.forEach(p => p.classList.remove("active"));

      const targetTab = document.querySelector(`.tab[data-target="${targetId}"]`);
      const targetPane = document.getElementById(targetId);
      if (targetTab) targetTab.classList.add("active");
      if (targetPane) targetPane.classList.add("active");
    });
  });
}

function setupThemeToggle() {
  const toggle = document.getElementById("themeToggle");
  const footer = document.getElementById("footerText");

  if (!toggle || !footer) return;

  toggle.addEventListener("click", () => {
    document.body.classList.toggle("light");
    const isLight = document.body.classList.contains("light");

    toggle.textContent = isLight ? "☀️ Leyline Mode" : "🌙 Inquest Mode";

    footer.textContent = isLight
      ? "GW2 Deco Tools • by Pew! • Powered by Ley Infused Energy"
      : "GW2 Deco Tools • by Pew! • Powered by The Inquest";
  });
}

function attachToolHandlers() {
  const moverBtn = document.getElementById("runMoverBtn");
  if (moverBtn && typeof runMover === "function") {
    moverBtn.addEventListener("click", runMover);
  }

  const counterBtn = document.getElementById("runCounterBtn");
  if (counterBtn && typeof runCounter === "function") {
    counterBtn.addEventListener("click", runCounter);
  }

  const downloadCounterBtn = document.getElementById("downloadCounter");
  if (downloadCounterBtn && typeof downloadCounterList === "function") {
    downloadCounterBtn.addEventListener("click", downloadCounterList);
  }

  const swapBtn = document.getElementById("runSwapBtn");
  if (swapBtn && typeof runSwap === "function") {
    swapBtn.addEventListener("click", runSwap);
  }

  const mergeBtn = document.getElementById("runMergeBtn");
  if (mergeBtn && typeof runMerge === "function") {
    mergeBtn.addEventListener("click", runMerge);
  }

  const viewGroupsBtn = document.getElementById("viewExtractGroupsBtn");
  if (viewGroupsBtn && typeof viewExtractGroups === "function") {
    viewGroupsBtn.addEventListener("click", viewExtractGroups);
  }

  const extractBtn = document.getElementById("extractSelectedGroupsBtn");
  if (extractBtn && typeof extractSelectedGroups === "function") {
    extractBtn.addEventListener("click", extractSelectedGroups);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupThemeToggle();
  setupDropZones();
  attachToolHandlers();
});
