(() => {
  const STORAGE_KEY = "gmailLabeler:v1";
  const LABELS = [
    { id: "none", name: "None", color: "#9aa0a6" },
    { id: "followup", name: "Follow up", color: "#1a73e8" },
    { id: "later", name: "Later", color: "#fbbc04" },
    { id: "important", name: "Important", color: "#d93025" }
  ];

  let labelMap = {};
  let scanScheduled = false;
  let openMenu = null;

  const storageGet = (key) =>
    new Promise((resolve) => chrome.storage.local.get([key], (res) => resolve(res[key])));

  const storageSet = (key, value) =>
    new Promise((resolve) => chrome.storage.local.set({ [key]: value }, () => resolve()));

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const getThreadId = (row) => {
    const direct =
      row.getAttribute("data-legacy-thread-id") ||
      row.getAttribute("data-thread-id") ||
      row.dataset.legacyThreadId ||
      row.dataset.threadId;
    if (direct) return String(direct);

    const link =
      row.querySelector('a[href*="#inbox/"]') ||
      row.querySelector('a[href*="#all/"]') ||
      row.querySelector('a[href*="#label/"]') ||
      row.querySelector('a[href*="#search/"]');
    if (!link) return null;

    const href = link.getAttribute("href") || "";
    const parts = href.split("/");
    const last = parts[parts.length - 1];
    if (!last) return null;
    const cleaned = last.split("?")[0].trim();
    return cleaned ? cleaned : null;
  };

  const getSubjectAnchor = (row) => {
    const bog = row.querySelector("span.bog");
    if (bog) return bog;

    const title = row.querySelector('span[title]:not([class*="gmail-labeler"])');
    if (title) return title;

    return null;
  };

  const getLabel = (threadId) => {
    const id = labelMap[threadId] || "none";
    return LABELS.find((l) => l.id === id) || LABELS[0];
  };

  const upsertLabel = async (threadId, labelId) => {
    if (labelId === "none") {
      delete labelMap[threadId];
    } else {
      labelMap[threadId] = labelId;
    }
    await storageSet(STORAGE_KEY, labelMap);
  };

  const closeMenu = () => {
    if (!openMenu) return;
    openMenu.remove();
    openMenu = null;
    document.removeEventListener("mousedown", onDocMouseDown, true);
    document.removeEventListener("keydown", onDocKeyDown, true);
  };

  const onDocMouseDown = (e) => {
    if (!openMenu) return;
    if (openMenu.contains(e.target)) return;
    closeMenu();
  };

  const onDocKeyDown = (e) => {
    if (e.key === "Escape") closeMenu();
  };

  const openLabelMenu = (pillEl, threadId) => {
    closeMenu();

    const menu = document.createElement("div");
    menu.className = "gmail-labeler-menu";

    const current = getLabel(threadId).id;
    for (const label of LABELS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("data-label-id", label.id);
      btn.setAttribute("data-selected", String(label.id === current));

      const dot = document.createElement("span");
      dot.className = "gmail-labeler-dot";
      dot.style.background = label.color;

      const text = document.createElement("span");
      text.textContent = label.name;

      btn.append(dot, text);
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await upsertLabel(threadId, label.id);
        updatePill(pillEl, threadId);
        closeMenu();
      });

      menu.appendChild(btn);
    }

    document.body.appendChild(menu);
    openMenu = menu;

    const rect = pillEl.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const left = clamp(rect.left, 8, window.innerWidth - menuRect.width - 8);
    const top = clamp(rect.bottom + 6, 8, window.innerHeight - menuRect.height - 8);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    document.addEventListener("mousedown", onDocMouseDown, true);
    document.addEventListener("keydown", onDocKeyDown, true);
  };

  const updatePill = (pillEl, threadId) => {
    const label = getLabel(threadId);
    const dot = pillEl.querySelector(".gmail-labeler-dot");
    const text = pillEl.querySelector(".gmail-labeler-text");
    if (dot) dot.style.background = label.color;
    if (text) text.textContent = label.name;
    pillEl.setAttribute("data-label-id", label.id);
    pillEl.setAttribute("data-thread-id", threadId);
  };

  const ensurePill = (row) => {
    const threadId = getThreadId(row);
    if (!threadId) return;

    const subjectAnchor = getSubjectAnchor(row);
    if (!subjectAnchor) return;

    const existing = row.querySelector(".gmail-labeler-pill");
    if (existing) {
      const existingThreadId = existing.getAttribute("data-thread-id");
      if (existingThreadId === threadId) {
        updatePill(existing, threadId);
        return;
      }
      existing.remove();
    }

    const pill = document.createElement("span");
    pill.className = "gmail-labeler-pill";
    pill.tabIndex = 0;
    pill.setAttribute("role", "button");

    const dot = document.createElement("span");
    dot.className = "gmail-labeler-dot";

    const text = document.createElement("span");
    text.className = "gmail-labeler-text";

    pill.append(dot, text);
    updatePill(pill, threadId);

    const stop = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    pill.addEventListener("mousedown", stop, true);
    pill.addEventListener("click", (e) => {
      stop(e);
      openLabelMenu(pill, threadId);
    });
    pill.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        stop(e);
        openLabelMenu(pill, threadId);
      }
    });

    subjectAnchor.insertAdjacentElement("afterend", pill);
  };

  const getCandidateRows = () => {
    const tableRows = Array.from(document.querySelectorAll('tr.zA, tr[role="row"].zA'));
    if (tableRows.length) return tableRows;

    const roleRows = Array.from(
      document.querySelectorAll('div[role="row"][data-thread-id], div[role="row"][data-legacy-thread-id]')
    );
    return roleRows;
  };

  const scan = () => {
    scanScheduled = false;
    if (document.visibilityState === "hidden") return;
    for (const row of getCandidateRows()) ensurePill(row);
  };

  const scheduleScan = () => {
    if (scanScheduled) return;
    scanScheduled = true;
    requestAnimationFrame(scan);
  };

  const boot = async () => {
    labelMap = (await storageGet(STORAGE_KEY)) || {};
    scheduleScan();

    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.documentElement, { childList: true, subtree: true });

    window.addEventListener("resize", () => closeMenu(), { passive: true });
    window.addEventListener("scroll", () => closeMenu(), { passive: true, capture: true });
    document.addEventListener("visibilitychange", scheduleScan, { passive: true });
  };

  boot().catch(() => {});
})();
