// DnDucks Phase 1 frontend behavior. Data is intentionally local-only until a backend is added.
const STORAGE_KEYS = {
  notes: "dnducks.notes",
  characters: "dnducks.characters",
  items: "dnducks.items",
  events: "dnducks.events",
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
      name: "Baron Velk",
      role: "Disgraced noble",
      faction: "Iron Egrets",
      notes: "Lost public power after the party revealed his pact, but still controls smugglers.",
      createdAt: "Demo",
    },
  ],
  items: [
    {
      id: "demo-item-1",
      name: "Ruby Key of Emberfen",
      type: "Magic Item",
      description: "Warm near sealed shrines. It may unlock an oath, not a door.",
      createdAt: "Demo",
    },
  ],
  events: [
    {
      id: "demo-event-1",
      title: "Treaty Moon Council",
      date: "12th Bloomwane, 1492 DR",
      description: "Marsh clans vote on whether to protect the city after the baron scandal.",
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

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readableDate() {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date());
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

function renderCollection({ key, listId, emptyText, template }) {
  const list = document.getElementById(listId);
  if (!list) return;

  const collection = getStoredCollection(key);
  if (!collection.length) {
    list.innerHTML = `<div class="empty-state">${emptyText}</div>`;
    return;
  }

  list.innerHTML = collection
    .map((entry) => template(entry))
    .join("");

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
    template: (note) => `
      <article class="card entry-card">
        <p class="eyebrow">${escapeHtml(note.category)}</p>
        <h3>${escapeHtml(note.title)}</h3>
        <div class="entry-meta"><span class="tag">${escapeHtml(note.createdAt)}</span><span class="tag">Future backlinks</span></div>
        <p>${escapeHtml(note.content)}</p>
        <button class="btn btn-danger" type="button" data-delete-id="${escapeHtml(note.id)}">Delete note</button>
      </article>`,
  });

  renderCollection({
    key: "characters",
    listId: "characters-list",
    emptyText: "No saved characters yet. Add an NPC, ally, villain, or faction contact.",
    template: (character) => `
      <article class="card entry-card">
        <p class="eyebrow">${escapeHtml(character.role)}</p>
        <h3>${escapeHtml(character.name)}</h3>
        <div class="entry-meta"><span class="tag">Faction: ${escapeHtml(character.faction || "Unaligned")}</span><span class="tag">${escapeHtml(character.createdAt)}</span></div>
        <p>${escapeHtml(character.notes)}</p>
        <button class="btn btn-danger" type="button" data-delete-id="${escapeHtml(character.id)}">Delete character</button>
      </article>`,
  });

  renderCollection({
    key: "items",
    listId: "items-list",
    emptyText: "No saved homebrew yet. Add a weapon, spell, monster, rule, or magic item.",
    template: (item) => `
      <article class="card entry-card">
        <p class="eyebrow">${escapeHtml(item.type)}</p>
        <h3>${escapeHtml(item.name)}</h3>
        <div class="entry-meta"><span class="tag">${escapeHtml(item.createdAt)}</span></div>
        <p>${escapeHtml(item.description)}</p>
        <button class="btn btn-danger" type="button" data-delete-id="${escapeHtml(item.id)}">Delete item</button>
      </article>`,
  });

  renderCollection({
    key: "events",
    listId: "events-list",
    emptyText: "No saved calendar events yet. Add an in-world date to keep pressure on the party.",
    template: (event) => `
      <article class="card entry-card">
        <p class="eyebrow">${escapeHtml(event.date)}</p>
        <h3>${escapeHtml(event.title)}</h3>
        <div class="entry-meta"><span class="tag">${escapeHtml(event.createdAt)}</span></div>
        <p>${escapeHtml(event.description)}</p>
        <button class="btn btn-danger" type="button" data-delete-id="${escapeHtml(event.id)}">Delete event</button>
      </article>`,
  });

  updateSummaryCards();
}

function updateSummaryCards() {
  const notes = getStoredCollection("notes");
  const characters = getStoredCollection("characters");
  const events = getStoredCollection("events");

  const noteTitle = document.getElementById("recent-note-title");
  const noteSummary = document.getElementById("recent-note-summary");
  const npcTitle = document.getElementById("important-npc-title");
  const npcSummary = document.getElementById("important-npc-summary");
  const eventTitle = document.getElementById("next-event-title");
  const eventSummary = document.getElementById("next-event-summary");
  const statNotes = document.getElementById("stat-notes");
  const statCharacters = document.getElementById("stat-characters");

  if (notes[0] && noteTitle && noteSummary) {
    noteTitle.textContent = notes[0].title;
    noteSummary.textContent = notes[0].content.slice(0, 120);
  }
  if (characters[0] && npcTitle && npcSummary) {
    npcTitle.textContent = characters[0].name;
    npcSummary.textContent = `${characters[0].role} · ${characters[0].faction || "Unaligned"}`;
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

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const collection = getStoredCollection(key);
    collection.unshift(buildEntry());
    saveCollection(key, collection);
    form.reset();
    renderDashboard();
  });
}

function initDashboardForms() {
  wireForm("note-form", "notes", () => ({
    id: createId("note"),
    title: document.getElementById("note-title").value.trim(),
    category: document.getElementById("note-category").value,
    content: document.getElementById("note-content").value.trim(),
    createdAt: readableDate(),
  }));

  wireForm("character-form", "characters", () => ({
    id: createId("character"),
    name: document.getElementById("character-name").value.trim(),
    role: document.getElementById("character-role").value.trim(),
    faction: document.getElementById("character-faction").value.trim(),
    notes: document.getElementById("character-notes").value.trim(),
    createdAt: readableDate(),
  }));

  wireForm("item-form", "items", () => ({
    id: createId("item"),
    name: document.getElementById("item-name").value.trim(),
    type: document.getElementById("item-type").value,
    description: document.getElementById("item-description").value.trim(),
    createdAt: readableDate(),
  }));

  wireForm("event-form", "events", () => ({
    id: createId("event"),
    title: document.getElementById("event-title").value.trim(),
    date: document.getElementById("event-date").value.trim(),
    description: document.getElementById("event-description").value.trim(),
    createdAt: readableDate(),
  }));
}

function initFilesPlaceholder() {
  const input = document.getElementById("file-input");
  const list = document.getElementById("selected-files");
  const count = document.getElementById("file-count");
  if (!input || !list) return;

  input.addEventListener("change", () => {
    const files = Array.from(input.files);
    list.innerHTML = files.length
      ? files.map((file) => `<li>${escapeHtml(file.name)} <span class="muted">(${Math.ceil(file.size / 1024)} KB)</span></li>`).join("")
      : "";
    if (count) count.textContent = `${files.length} selected`;
  });
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
      <p class="muted">Question received: “${escapeHtml(asked)}”</p>
    `;
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
      status.textContent = "Please fill out every field before sending your raven.";
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
initDashboardForms();
initFilesPlaceholder();
initAiPlaceholder();
initContactForm();
renderDashboard();

/*
Backend roadmap summary:
Phase 2: add user accounts with React/Next.js, Node/Express or API routes, PostgreSQL/Supabase, and managed auth.
Phase 3: add database tables for users, campaigns, notes, characters, locations, factions, quests, items, maps, calendar_events, files, document_links, and ai_suggestions.
Phase 4: add persistent file uploads with Supabase Storage, Firebase Storage, AWS S3, or Cloudinary.
Phase 5: add a markdown/rich text editor, autosave, tags, search, and backlinks.
Phase 6: add AI with embeddings, vector search, RAG, contradiction detection, summaries, and user-controlled context access.
Phase 7: add uploaded maps, pins, linked annotations, and saved map state.
Phase 8: add collaboration roles for Dungeon Masters, Players, and Viewers.
*/
