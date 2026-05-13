// DnDucks Phase 1 frontend behavior. Data is intentionally local-only until a backend is added.
const STORAGE_KEYS = {
  notes: "dnducks.notes",
  characters: "dnducks.characters",
  items: "dnducks.items",
  events: "dnducks.events",
  hiddenWidgets: "dnducks.hiddenWidgets",
};

const demoData = {
  notes: [
    {
      id: "demo-note-1",
      title: "The river spirit remembers the bargain",
      category: "Consequence",
      content:
        "If the party ignores the spirit, ferry crossings become dangerous and the marsh clans blame the city council.",
      createdAt: "Demo",
    },
  ],
  characters: [
    {
      id: "demo-character-1",
      name: "Mira Voss",
      role: "Smuggler Queen",
      faction: "The Gilded Fang",
      notes: "Controls the safest Blackfen routes and knows who moved the Ember Sigil.",
      createdAt: "Demo",
    },
  ],
  items: [
    {
      id: "demo-item-1",
      name: "Moonlit Dagger",
      type: "Magic Item",
      description: "A silvered blade that glows near drowned gates and forgotten oaths.",
      createdAt: "Demo",
    },
  ],
  events: [
    {
      id: "demo-event-1",
      title: "Session 12: The Sunken Gate",
      date: "Tonight",
      description: "Blackfen Marsh route, broken bridge ambush, and first reveal of the oath gate.",
      createdAt: "Demo",
    },
  ],
};

function getStoredCollection(key) {
  const raw = localStorage.getItem(STORAGE_KEYS[key]);
  if (!raw) return demoData[key] ? [...demoData[key]] : [];
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Could not parse ${key} from localStorage`, error);
    return [];
  }
}

function saveCollection(key, collection) {
  localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(collection));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function getHiddenWidgets() {
  const raw = localStorage.getItem(STORAGE_KEYS.hiddenWidgets);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn("Could not parse hidden widgets from localStorage", error);
    return [];
  }
}

function saveHiddenWidgets(ids) {
  localStorage.setItem(STORAGE_KEYS.hiddenWidgets, JSON.stringify(ids));
}

function slugifyWidgetId(value) {
  return String(value || "widget")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "widget";
}

function imageToDataUrl(fileInput) {
  const file = fileInput?.files?.[0];
  if (!file) return Promise.resolve("");
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("Widget images must be image files."));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(new Error("Could not read the selected image.")));
    reader.readAsDataURL(file);
  });
}

function widgetImageMarkup(entry, label) {
  const alt = escapeHtml(label ? `${label} image` : "Widget image");
  if (entry.imageDataUrl) {
    return `<div class="widget-media"><img src="${escapeHtml(entry.imageDataUrl)}" alt="${alt}" loading="lazy" /></div>`;
  }

  return `
    <div class="widget-media widget-media-empty" aria-label="No image uploaded yet">
      <span aria-hidden="true">＋</span>
      <small>Image slot</small>
    </div>`;
}

function widgetDescriptionMarkup(value) {
  const text = String(value || "").trim();
  return text ? `<p class="widget-description">${escapeHtml(text)}</p>` : "";
}

function widgetTagsMarkup(tags) {
  return `<div class="tag-row widget-tags">${tags.filter(Boolean).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>`;
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readableDate() {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date());
}

function textForSearch(values) {
  return values.filter(Boolean).join(" ").toLowerCase();
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadedAt(value) {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function isPreviewableImage(material) {
  return String(material.mimeType || "").startsWith("image/");
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(payload?.error || "Request failed.");
  }
  return payload;
}

function cardVisualLabel(value) {
  return escapeHtml(
    String(value || "DM")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase()
  );
}

function initMobileNavigation() {
  const toggle = document.querySelector(".mobile-menu-toggle");
  const nav = document.querySelector(".topnav");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

function initCommandInterface() {
  const search = document.getElementById("global-search");
  const filterToggle = document.getElementById("filter-toggle");
  const filterPanel = document.getElementById("filter-panel");
  const statusButtons = document.querySelectorAll("[data-status-filter]");
  let activeStatus = "all";

  function applyFilters() {
    const query = search ? search.value.trim().toLowerCase() : "";
    document.querySelectorAll("[data-searchable]").forEach((card) => {
      const cardStatus = card.dataset.status || "active";
      const matchesStatus = activeStatus === "all" || cardStatus === activeStatus;
      const matchesQuery = !query || (card.dataset.searchable || "").includes(query);
      card.classList.toggle("is-filtered-out", !matchesStatus || !matchesQuery);
    });
  }

  if (search) search.addEventListener("input", applyFilters);
  document.addEventListener("dashboard:rendered", applyFilters);

  statusButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeStatus = button.dataset.statusFilter || "all";
      statusButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      applyFilters();
    });
  });

  if (filterToggle && filterPanel) {
    filterToggle.addEventListener("click", () => {
      const isHidden = filterPanel.hasAttribute("hidden");
      filterPanel.toggleAttribute("hidden", !isHidden);
      filterToggle.setAttribute("aria-expanded", String(isHidden));
    });
  }

  document.querySelectorAll(".category-pill").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".category-pill").forEach((item) => item.classList.remove("is-active"));
      link.classList.add("is-active");
    });
  });
}

function renderCollection({ key, listId, emptyText, template }) {
  const list = document.getElementById(listId);
  if (!list) return;

  const collection = getStoredCollection(key);
  if (!collection.length) {
    list.innerHTML = `<div class="empty-state">${emptyText}</div>`;
    return;
  }

  list.innerHTML = collection.map((entry) => template(entry)).join("");

  list.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextCollection = getStoredCollection(key).filter((entry) => entry.id !== button.dataset.deleteId);
      saveCollection(key, nextCollection);
      renderDashboard();
    });
  });
}

function renderDashboard() {
  renderCollection({
    key: "notes",
    listId: "notes-list",
    emptyText: "No saved notes yet. Add one above to begin your campaign wiki.",
    template: (note) => {
      const searchable = textForSearch([note.title, note.category, note.content, note.createdAt, "note campaign wiki"]);
      return `
        <article class="content-card entry-card widget-card" data-searchable="${escapeHtml(searchable)}" data-status="active">
          ${widgetImageMarkup(note, note.title)}
          <div class="card-kicker"><span class="status-badge status-active">${escapeHtml(note.category)}</span><span>Note</span></div>
          <h3>${escapeHtml(note.title)}</h3>
          ${widgetDescriptionMarkup(note.content)}
          ${widgetTagsMarkup([note.createdAt, "Backlinks soon", "The Ashen Crown"])}
          <div class="entry-actions">
            <button class="btn btn-danger" type="button" data-delete-id="${escapeHtml(note.id)}">Delete note</button>
          </div>
        </article>`;
    },
  });

  renderCollection({
    key: "characters",
    listId: "characters-list",
    emptyText: "No saved characters yet. Add an NPC, ally, villain, or faction contact.",
    template: (character) => {
      const searchable = textForSearch([character.name, character.role, character.faction, character.notes, "npc character"]);
      return `
        <article class="content-card entry-card widget-card" data-searchable="${escapeHtml(searchable)}" data-status="hidden">
          ${widgetImageMarkup(character, character.name)}
          <div class="card-kicker"><span class="status-badge status-hidden">DM-only</span><span>${escapeHtml(character.role)}</span></div>
          <h3>${escapeHtml(character.name)}</h3>
          ${widgetDescriptionMarkup(character.notes)}
          ${widgetTagsMarkup([`Faction: ${character.faction || "Unaligned"}`, character.createdAt, "NPC"])}
          <div class="entry-actions">
            <button class="btn btn-danger" type="button" data-delete-id="${escapeHtml(character.id)}">Delete NPC</button>
          </div>
        </article>`;
    },
  });

  renderCollection({
    key: "items",
    listId: "items-list",
    emptyText: "No saved homebrew yet. Add a weapon, spell, monster, rule, or magic item.",
    template: (item) => {
      const status = item.type === "Monster" ? "prepared" : "active";
      const statusLabel = item.type === "Monster" ? "Prepared" : "Active";
      const searchable = textForSearch([item.name, item.type, item.description, "item homebrew monster loot"]);
      return `
        <article class="content-card entry-card widget-card" data-searchable="${escapeHtml(searchable)}" data-status="${status}">
          ${widgetImageMarkup(item, item.name)}
          <div class="card-kicker"><span class="status-badge ${status === "prepared" ? "status-prepared" : "status-active"}">${statusLabel}</span><span>${escapeHtml(item.type)}</span></div>
          <h3>${escapeHtml(item.name)}</h3>
          ${widgetDescriptionMarkup(item.description)}
          ${widgetTagsMarkup([item.createdAt, "Loot & rules", "The Ashen Crown"])}
          <div class="entry-actions">
            <button class="btn btn-danger" type="button" data-delete-id="${escapeHtml(item.id)}">Delete item</button>
          </div>
        </article>`;
    },
  });

  renderCollection({
    key: "events",
    listId: "events-list",
    emptyText: "No saved calendar events yet. Add an in-world date to keep pressure on the party.",
    template: (event) => {
      const searchable = textForSearch([event.title, event.date, event.description, "session calendar event"]);
      return `
        <article class="content-card entry-card widget-card" data-searchable="${escapeHtml(searchable)}" data-status="prepared">
          ${widgetImageMarkup(event, event.title)}
          <div class="card-kicker"><span class="status-badge status-prepared">Prepared</span><span>${escapeHtml(event.date)}</span></div>
          <h3>${escapeHtml(event.title)}</h3>
          ${widgetDescriptionMarkup(event.description)}
          ${widgetTagsMarkup([event.createdAt, "Session timeline", "Calendar"])}
          <div class="entry-actions">
            <button class="btn btn-danger" type="button" data-delete-id="${escapeHtml(event.id)}">Delete event</button>
          </div>
        </article>`;
    },
  });

  updateSummaryCards();
  document.dispatchEvent(new Event("dashboard:rendered"));
}

function updateSummaryCards() {
  const notes = getStoredCollection("notes");
  const characters = getStoredCollection("characters");
  const events = getStoredCollection("events");

  const noteTitle = document.getElementById("recent-note-title");
  const noteSummary = document.getElementById("recent-note-summary");
  const eventTitle = document.getElementById("next-event-title");
  const eventSummary = document.getElementById("next-event-summary");
  const statNotes = document.getElementById("stat-notes");
  const statCharacters = document.getElementById("stat-characters");

  if (notes[0] && noteTitle && noteSummary) {
    noteTitle.textContent = notes[0].title;
    noteSummary.textContent = notes[0].content.slice(0, 120);
  }
  if (events[0] && eventTitle && eventSummary) {
    eventTitle.textContent = events[0].title;
    eventSummary.textContent = `${events[0].date}: ${events[0].description.slice(0, 95)}`;
  }
  if (statNotes) statNotes.textContent = notes.length;
  if (statCharacters) statCharacters.textContent = characters.length;
}

function wireForm(formId, key, buildEntry) {
  const form = document.getElementById(formId);
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    try {
      const collection = getStoredCollection(key);
      collection.unshift(await buildEntry());
      saveCollection(key, collection);
      form.reset();
      renderDashboard();
    } catch (error) {
      alert(error.message);
    }
  });
}

function initDashboardForms() {
  wireForm("note-form", "notes", async () => ({
    id: createId("note"),
    title: document.getElementById("note-title").value.trim(),
    category: document.getElementById("note-category").value,
    content: document.getElementById("note-content").value.trim(),
    imageDataUrl: await imageToDataUrl(document.getElementById("note-image")),
    createdAt: readableDate(),
  }));

  wireForm("character-form", "characters", async () => ({
    id: createId("character"),
    name: document.getElementById("character-name").value.trim(),
    role: document.getElementById("character-role").value.trim(),
    faction: document.getElementById("character-faction").value.trim(),
    notes: document.getElementById("character-notes").value.trim(),
    imageDataUrl: await imageToDataUrl(document.getElementById("character-image")),
    createdAt: readableDate(),
  }));

  wireForm("item-form", "items", async () => ({
    id: createId("item"),
    name: document.getElementById("item-name").value.trim(),
    type: document.getElementById("item-type").value,
    description: document.getElementById("item-description").value.trim(),
    imageDataUrl: await imageToDataUrl(document.getElementById("item-image")),
    createdAt: readableDate(),
  }));

  wireForm("event-form", "events", async () => ({
    id: createId("event"),
    title: document.getElementById("event-title").value.trim(),
    date: document.getElementById("event-date").value.trim(),
    description: document.getElementById("event-description").value.trim(),
    imageDataUrl: await imageToDataUrl(document.getElementById("event-image")),
    createdAt: readableDate(),
  }));
}

async function loadMaterials() {
  const list = document.getElementById("materials-list");
  const count = document.getElementById("material-count");
  if (!list) return;

  try {
    const materials = await fetchJson("/api/materials");
    if (count) count.textContent = `${materials.length} saved material${materials.length === 1 ? "" : "s"}`;
    if (!materials.length) {
      list.innerHTML = `<div class="empty-state">No uploaded materials yet. Upload a map, NPC portrait, PDF handout, or campaign note to persist it locally.</div>`;
      return;
    }

    list.innerHTML = materials.map((material) => {
      const searchable = textForSearch([material.title, material.originalFilename, material.category, material.description, material.tags?.join(" "), "material file map handout"]);
      const preview = isPreviewableImage(material)
        ? `<a class="material-preview" href="${escapeHtml(material.downloadUrl)}" target="_blank" rel="noopener"><img src="${escapeHtml(material.downloadUrl)}" alt="Preview of ${escapeHtml(material.title || material.originalFilename)}" loading="lazy" /></a>`
        : `<a class="material-preview material-preview-file" href="${escapeHtml(material.downloadUrl)}" target="_blank" rel="noopener"><span>${escapeHtml((material.originalFilename || "file").split(".").pop().toUpperCase())}</span></a>`;
      return `
        <article class="content-card entry-card material-card" data-searchable="${escapeHtml(searchable)}" data-status="active">
          ${preview}
          <div class="card-kicker"><span class="status-badge status-active">${escapeHtml(material.category || "other")}</span><span>${escapeHtml(material.mimeType)}</span></div>
          <h3>${escapeHtml(material.title || material.originalFilename)}</h3>
          ${widgetDescriptionMarkup(material.description)}
          ${widgetTagsMarkup([formatBytes(material.fileSize), formatUploadedAt(material.uploadedAt), ...(material.tags || [])])}
          <div class="entry-actions">
            <a class="btn btn-secondary" href="${escapeHtml(material.downloadUrl)}" target="_blank" rel="noopener">Open / Download</a>
            <button class="btn btn-danger" type="button" data-delete-material="${escapeHtml(material.id)}">Delete file</button>
          </div>
        </article>`;
    }).join("");

    list.querySelectorAll("[data-delete-material]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!confirm("Delete this material and remove the stored file from disk?")) return;
        try {
          await fetchJson(`/api/materials/${button.dataset.deleteMaterial}`, { method: "DELETE" });
          await loadMaterials();
        } catch (error) {
          alert(error.message);
        }
      });
    });
    document.dispatchEvent(new Event("dashboard:rendered"));
  } catch (error) {
    list.innerHTML = `<div class="empty-state">Materials API unavailable. Start the local backend with <code>npm start</code> to upload and view persistent files.</div>`;
    if (count) count.textContent = "Backend offline";
  }
}

function initMaterials() {
  const form = document.getElementById("material-form");
  const fileInput = document.getElementById("material-file");
  const status = document.getElementById("material-status");
  if (!form || !fileInput) return;

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (status) status.textContent = file ? `Ready to upload ${file.name} (${formatBytes(file.size)}).` : "";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const formData = new FormData(form);
    if (status) {
      status.textContent = "Uploading material...";
      status.classList.remove("error");
    }
    try {
      const material = await fetchJson("/api/materials/upload", { method: "POST", body: formData });
      form.reset();
      if (status) status.textContent = `Uploaded ${material.originalFilename}.`;
      await loadMaterials();
    } catch (error) {
      if (status) {
        status.textContent = error.message;
        status.classList.add("error");
      }
    }
  });

  loadMaterials();
}

function initAiPlaceholder() {
  const form = document.getElementById("ai-form");
  const question = document.getElementById("ai-question");
  const response = document.getElementById("ai-response");
  if (!form || !question || !response) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const asked = question.value.trim();
    if (!asked) return;

    response.innerHTML = `
      <h3>Potential linked consequences</h3>
      <p><strong>Mock analysis:</strong> Based on your prompt, a future AI pass would retrieve related notes, NPCs, factions, items, maps, and calendar events before answering.</p>
      <ul class="compact-list">
        <li>An opposing faction may exploit the power vacuum.</li>
        <li>Allies of the harmed figure could demand restitution or revenge.</li>
        <li>A calendar event might move forward as enemies act before the party can rest.</li>
        <li>Relevant notes should be linked to NPCs, locations, and unresolved quests.</li>
      </ul>
      <p class="muted">Question received: "${escapeHtml(asked)}"</p>
    `;
  });
}

function initRemovableStaticWidgets() {
  const hiddenWidgets = new Set(getHiddenWidgets());

  document.querySelectorAll(".content-card").forEach((card, index) => {
    if (card.querySelector("[data-delete-id], [data-delete-material], [data-delete-widget]")) return;

    const title = card.querySelector("h2, h3")?.textContent || card.dataset.searchable || `static-${index}`;
    const widgetId = card.dataset.widgetId || `static-${slugifyWidgetId(title)}-${index}`;
    card.dataset.widgetId = widgetId;

    if (hiddenWidgets.has(widgetId)) {
      card.remove();
      return;
    }

    const actions = card.querySelector(".entry-actions") || document.createElement("div");
    actions.classList.add("entry-actions", "static-widget-actions");

    const button = document.createElement("button");
    button.className = "btn btn-danger";
    button.type = "button";
    button.dataset.deleteWidget = widgetId;
    button.textContent = "Delete widget";
    button.addEventListener("click", () => {
      const nextHiddenWidgets = new Set(getHiddenWidgets());
      nextHiddenWidgets.add(widgetId);
      saveHiddenWidgets([...nextHiddenWidgets]);
      card.remove();
      document.dispatchEvent(new Event("dashboard:rendered"));
    });

    actions.append(button);
    if (!actions.parentElement) card.append(actions);
  });
}

function initContactForm() {
  const form = document.getElementById("contact-form");
  const status = document.getElementById("contact-message-status");
  if (!form || !status) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    status.classList.remove("error");

    const name = document.getElementById("contact-name").value.trim();
    const email = document.getElementById("contact-email").value.trim();
    const subject = document.getElementById("contact-subject").value.trim();
    const message = document.getElementById("contact-message").value.trim();
    const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!name || !email || !subject || !message) {
      status.textContent = "Please fill out every field before sending.";
      status.classList.add("error");
      return;
    }
    if (!emailLooksValid) {
      status.textContent = "Please enter a valid email address.";
      status.classList.add("error");
      return;
    }

    status.textContent = "Success! This Phase 1 prototype validated your message locally. A backend will send it later.";
    form.reset();
  });
}

initMobileNavigation();
initCommandInterface();
initDashboardForms();
initMaterials();
initAiPlaceholder();
initContactForm();
renderDashboard();
initRemovableStaticWidgets();

/*
Backend roadmap summary:
Phase 2: add user accounts with React/Next.js, Node/Express or API routes, PostgreSQL/Supabase, and managed auth.
Phase 3: add database tables for users, campaigns, sessions, notes, characters, locations, factions, quests, items, maps, calendar_events, files, document_links, and ai_suggestions.
Phase 4: add local backend-managed uploads for draft persistence, then Supabase Storage, Firebase Storage, AWS S3, or Cloudinary for production.
Phase 5: add a markdown/rich text editor, autosave, tags, search, and backlinks.
Phase 6: add AI with embeddings, vector search, RAG, contradiction detection, summaries, and user-controlled context access.
Phase 7: add uploaded maps, pins, linked annotations, and saved map state.
Phase 8: add collaboration roles for Dungeon Masters, Players, and Viewers.
*/
