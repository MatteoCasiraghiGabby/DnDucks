// DnDucks Phase 1 frontend behavior. Data is intentionally local-only until a backend is added.
const STORAGE_KEYS = {
  notes: "dnducks.notes",
  characters: "dnducks.characters",
  items: "dnducks.items",
  encounters: "dnducks.encounters",
  locations: "dnducks.locations",
  events: "dnducks.events",
  calendarSettings: "dnducks.calendarSettings",
  weather: "dnducks.weather",
  campaigns: "dnducks.campaigns",
};

const USER_WIDGET_COLLECTIONS = new Set(["notes", "characters", "items", "encounters", "locations", "events"]);

const DEFAULT_CAMPAIGN_ID = "local";
const DEFAULT_CAMPAIGN = {
  id: DEFAULT_CAMPAIGN_ID,
  name: "Your campaign",
  description: "Create campaign notes, NPCs, encounters, items, events, and player characters in this local workspace.",
  status: "active",
  workspaceLabel: "Local workspace",
  players: [],
  setupCompleted: false,
  campaignStartNoteId: "",
  createdAt: "Local draft",
  updatedAt: "Local draft",
};

function normalizeCampaign(campaign = {}) {
  return {
    ...DEFAULT_CAMPAIGN,
    ...campaign,
    id: String(campaign.id || DEFAULT_CAMPAIGN.id),
    players: Array.isArray(campaign.players) ? campaign.players.filter(Boolean) : [],
    setupCompleted: Boolean(campaign.setupCompleted),
  };
}

function getCampaigns() {
  const raw = localStorage.getItem(STORAGE_KEYS.campaigns);
  if (!raw) return [normalizeCampaign(DEFAULT_CAMPAIGN)];
  try {
    const parsed = JSON.parse(raw);
    const campaigns = Array.isArray(parsed) ? parsed.map(normalizeCampaign) : [];
    return campaigns.length ? campaigns : [normalizeCampaign(DEFAULT_CAMPAIGN)];
  } catch (error) {
    console.warn("Could not parse campaigns from localStorage", error);
    return [normalizeCampaign(DEFAULT_CAMPAIGN)];
  }
}

function saveCampaigns(campaigns) {
  localStorage.setItem(STORAGE_KEYS.campaigns, JSON.stringify(campaigns.map(normalizeCampaign)));
}

function getCampaign(campaignId = DEFAULT_CAMPAIGN_ID) {
  return getCampaigns().find((campaign) => campaign.id === campaignId) || null;
}

function upsertCampaign(nextCampaign) {
  const normalized = normalizeCampaign({ ...nextCampaign, updatedAt: readableDate() });
  const campaigns = getCampaigns();
  const index = campaigns.findIndex((campaign) => campaign.id === normalized.id);
  if (index >= 0) campaigns[index] = normalized;
  else campaigns.unshift(normalized);
  saveCampaigns(campaigns);
  return normalized;
}

function currentCampaign() {
  return getCampaign(DEFAULT_CAMPAIGN_ID) || upsertCampaign(DEFAULT_CAMPAIGN);
}

function playerDisplayName(player) {
  return firstDisplayText([player.characterName, player.playerName], "Unnamed hero");
}

function buildPlayerCharacter(form) {
  const playerName = form.querySelector("#player-name")?.value.trim() || "";
  const characterName = form.querySelector("#player-character-name")?.value.trim() || "";
  const levelValue = form.querySelector("#player-level")?.value.trim() || "";
  const level = levelValue ? Number(levelValue) : "";
  return {
    id: createId("player"),
    campaignId: DEFAULT_CAMPAIGN_ID,
    playerName,
    characterName,
    classRole: form.querySelector("#player-class-role")?.value.trim() || "",
    level,
    race: form.querySelector("#player-race")?.value.trim() || "",
    background: form.querySelector("#player-background")?.value.trim() || "",
    description: form.querySelector("#player-description")?.value.trim() || "",
    notes: form.querySelector("#player-notes")?.value.trim() || "",
    avatarUrl: "",
    createdAt: readableDate(),
    updatedAt: readableDate(),
  };
}

function playerFormHasData(form) {
  return ["#player-name", "#player-character-name", "#player-class-role", "#player-level", "#player-race", "#player-background", "#player-description", "#player-notes"]
    .some((selector) => String(form.querySelector(selector)?.value || "").trim());
}

function validatePlayerCharacter(player, requireData = true) {
  const errors = [];
  if (!requireData && !player.playerName && !player.characterName && !player.classRole && !player.level && !player.race && !player.background && !player.description && !player.notes) return errors;
  if (!player.playerName) errors.push("Player name is required.");
  if (!player.characterName) errors.push("Character name is required.");
  if (player.level !== "" && (!Number.isFinite(player.level) || player.level < 1)) errors.push("Level must be a number greater than 0.");
  return errors;
}

function savePlayerToCampaign(campaignId, player) {
  const campaign = getCampaign(campaignId);
  if (!campaign) return null;
  const savedPlayer = { ...player, avatarUrl: player.avatarUrl || player.imageDataUrl || "" };
  return upsertCampaign({ ...campaign, players: [...campaign.players, savedPlayer] });
}

function campaignStartContent(players, description = "") {
  const summary = players.length
    ? `\n\nParty summary:\n${players.map((player) => `- ${player.playerName}: ${player.characterName}${player.classRole ? `, ${player.classRole}` : ""}${player.level ? ` level ${player.level}` : ""}`).join("\n")}`
    : "";
  const intro = description.trim() || "The campaign has started. Party members have been created and are ready for the adventure.";
  return `${intro}${summary}`;
}

function getCampaignStartNote(campaign) {
  const notes = getStoredCollection("notes");
  const existingId = campaign.campaignStartNoteId;
  return notes.find((note) => note.id === existingId || (note.campaignId === campaign.id && note.generatedBy === "campaign-setup-start"));
}

function campaignReady(campaign) {
  return Boolean(campaign?.setupCompleted && getCampaignStartNote(campaign)?.campaignStartDate);
}

function saveCampaignStartNote(campaign, noteData = {}) {
  const notes = getStoredCollection("notes");
  const existing = getCampaignStartNote(campaign);
  const startDate = noteData.startDate || currentIsoDate();
  const title = noteData.title?.trim() || campaign.name;
  const description = noteData.description?.trim() || "";
  const note = {
    ...(existing || {}),
    id: existing?.id || createId("note"),
    campaignId: campaign.id,
    generatedBy: "campaign-setup-start",
    title,
    category: "Session Note",
    content: campaignStartContent(campaign.players, description),
    campaignStartDate: startDate,
    createdAt: readableDateFromIso(startDate),
    sortAt: Date.parse(`${startDate}T00:00:00`),
  };
  const nextNotes = existing
    ? notes.map((item) => item.id === existing.id ? note : item)
    : [...notes, note];
  saveCollection("notes", nextNotes);
  return { notes: nextNotes, noteId: note.id };
}

function completeCampaignSetup(campaignId, noteData = {}) {
  const campaign = getCampaign(campaignId);
  if (!campaign) return null;
  const campaignName = noteData.title?.trim() || campaign.name;
  const nextCampaign = { ...campaign, name: campaignName };
  const { noteId } = saveCampaignStartNote(nextCampaign, noteData);
  return upsertCampaign({ ...nextCampaign, setupCompleted: true, campaignStartNoteId: noteId });
}

function campaignSetupHref(campaignId) {
  return `index.html#/campaigns/${encodeURIComponent(campaignId)}/setup`;
}

function campaignStartNoteHref(campaignId) {
  return `index.html#/campaigns/${encodeURIComponent(campaignId)}/start-note`;
}

function playerCharacterHref(campaignId, playerId) {
  return `index.html#/campaigns/${encodeURIComponent(campaignId)}/players/${encodeURIComponent(playerId)}`;
}

function goToDashboard() {
  window.location.href = "index.html#dashboard";
  window.location.reload();
}

function routeParts() {
  const hashPath = window.location.hash && window.location.hash.startsWith("#/")
    ? window.location.hash.slice(1)
    : "";
  const routePath = hashPath || window.location.pathname;
  return routePath.split("/").filter(Boolean).map(decodeURIComponent);
}


function getStoredCollection(key) {
  const raw = localStorage.getItem(STORAGE_KEYS[key]);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return USER_WIDGET_COLLECTIONS.has(key) ? parsed.filter(isUserProducedEntry) : parsed;
  } catch (error) {
    console.warn(`Could not parse ${key} from localStorage`, error);
    return [];
  }
}

function saveCollection(key, collection) {
  const nextCollection = USER_WIDGET_COLLECTIONS.has(key) ? collection.filter(isUserProducedEntry) : collection;
  localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(nextCollection));
}

const DEFAULT_CALENDAR_SETTINGS = {
  weekLength: 7,
  weekdays: ["Moonday", "Tirsday", "Windsday", "Thundersday", "Fireday", "Starday", "Sunday"],
  months: ["Bloomwane", "Highsun", "Goldleaf", "Frostwane"],
  daysPerMonth: 30,
  yearName: "DR",
  currentYear: 1492,
  currentMonthIndex: 0,
};

const WEATHER_OPTIONS = [
  "Clear skies", "Light rain", "Heavy rain", "Silver fog", "Cold wind", "Thunderheads",
  "Warm breeze", "Ashfall", "Glittering frost", "Oppressive heat", "Moonlit calm", "Arcane aurora",
];

function getCalendarSettings() {
  const raw = localStorage.getItem(STORAGE_KEYS.calendarSettings);
  if (!raw) return { ...DEFAULT_CALENDAR_SETTINGS, weekdays: [...DEFAULT_CALENDAR_SETTINGS.weekdays], months: [...DEFAULT_CALENDAR_SETTINGS.months] };
  try {
    const parsed = JSON.parse(raw);
    const weekLength = Math.max(1, Number(parsed.weekLength) || DEFAULT_CALENDAR_SETTINGS.weekLength);
    const weekdays = Array.isArray(parsed.weekdays) && parsed.weekdays.length
      ? parsed.weekdays.map((day) => String(day).trim()).filter(Boolean).slice(0, weekLength)
      : DEFAULT_CALENDAR_SETTINGS.weekdays.slice(0, weekLength);
    while (weekdays.length < weekLength) weekdays.push(`Day ${weekdays.length + 1}`);
    const storedMonths = Array.isArray(parsed.months) && parsed.months.length
      ? parsed.months.map((month) => String(month).trim()).filter(Boolean)
      : [];
    const months = storedMonths.length ? storedMonths : [...DEFAULT_CALENDAR_SETTINGS.months];
    return {
      ...DEFAULT_CALENDAR_SETTINGS,
      ...parsed,
      weekLength,
      weekdays,
      months,
      daysPerMonth: Math.max(1, Number(parsed.daysPerMonth) || DEFAULT_CALENDAR_SETTINGS.daysPerMonth),
      currentYear: Number(parsed.currentYear) || DEFAULT_CALENDAR_SETTINGS.currentYear,
      currentMonthIndex: Math.min(Math.max(0, Number(parsed.currentMonthIndex) || 0), months.length - 1),
      yearName: String(parsed.yearName || DEFAULT_CALENDAR_SETTINGS.yearName).trim() || DEFAULT_CALENDAR_SETTINGS.yearName,
    };
  } catch (error) {
    console.warn("Could not parse campaign calendar settings", error);
    return { ...DEFAULT_CALENDAR_SETTINGS, weekdays: [...DEFAULT_CALENDAR_SETTINGS.weekdays], months: [...DEFAULT_CALENDAR_SETTINGS.months] };
  }
}

function saveCalendarSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.calendarSettings, JSON.stringify(settings));
}

function getWeatherMap() {
  const raw = localStorage.getItem(STORAGE_KEYS.weather);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (error) { console.warn("Could not parse weather", error); return {}; }
}

function saveWeatherMap(weather) {
  localStorage.setItem(STORAGE_KEYS.weather, JSON.stringify(weather));
}

function weatherKey(year, monthIndex, day) {
  return `${year}-${monthIndex}-${day}`;
}

function eventDateLabel(event, settings = getCalendarSettings()) {
  if (Number.isFinite(Number(event.day)) && Number.isFinite(Number(event.monthIndex)) && Number.isFinite(Number(event.year))) {
    const monthName = settings.months[Number(event.monthIndex)] || `Month ${Number(event.monthIndex) + 1}`;
    return `${event.day} ${monthName}, ${event.year} ${settings.yearName}`.trim();
  }
  return displayText(event.date, "Unscheduled");
}

function eventSortValue(event) {
  if (Number.isFinite(Number(event.day)) && Number.isFinite(Number(event.monthIndex)) && Number.isFinite(Number(event.year))) {
    return Number(event.year) * 10000 + Number(event.monthIndex) * 100 + Number(event.day);
  }
  return Number.MAX_SAFE_INTEGER;
}

function sortedEvents() {
  return getStoredCollection("events").filter(Boolean).sort((a, b) => eventSortValue(a) - eventSortValue(b));
}

function nextImminentEvent() {
  const settings = getCalendarSettings();
  const current = settings.currentYear * 10000 + settings.currentMonthIndex * 100 + 1;
  return sortedEvents().find((event) => eventSortValue(event) >= current) || sortedEvents()[0];
}

function eventWeather(event) {
  if (!event || !Number.isFinite(Number(event.day))) return "Weather unknown";
  return getWeatherMap()[weatherKey(event.year, event.monthIndex, event.day)] || "Weather not generated";
}

function populateCalendarFormDefaults() {
  const settings = getCalendarSettings();
  document.querySelectorAll("#event-month").forEach((select) => {
    const selected = select.value || String(settings.currentMonthIndex);
    select.innerHTML = settings.months.map((month, index) => `<option value="${index}">${escapeHtml(month)}</option>`).join("");
    select.value = selected;
  });
  document.querySelectorAll("#event-year").forEach((input) => { if (!input.value) input.value = settings.currentYear; });
  document.querySelectorAll("#event-day").forEach((input) => { input.max = settings.daysPerMonth; });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function uploadImages(files) {
  const selected = Array.from(files || []).filter(Boolean);
  if (!selected.length) return [];
  const formData = new FormData();
  selected.forEach((file) => formData.append("images", file));
  const payload = await fetchJson("/api/uploads/images", { method: "POST", body: formData });
  return payload.images || [];
}

async function imageToDataUrl(fileInput) {
  const file = fileInput?.files?.[0];
  if (!file) return "";
  if (!file.type.startsWith("image/")) {
    throw new Error("Widget images must be image files.");
  }
  const [image] = await uploadImages([file]);
  return image?.url || "";
}

function displayText(value, fallback) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function firstDisplayText(values, fallback) {
  const found = values.find((value) => String(value ?? "").trim());
  return displayText(found, fallback);
}

function widgetImageMarkup(entry, label) {
  const title = displayText(label, "Widget");
  const alt = escapeHtml(`${title} image`);
  const imageUrl = entry.imageUrl || entry.imageDataUrl || entry.image?.url;
  const imageActionLabel = imageUrl ? `Change image for ${title}` : `Add image for ${title}`;
  const actionAttributes = entry.id
    ? `button type="button" data-image-upload-id="${escapeHtml(entry.id)}" aria-label="${escapeHtml(imageActionLabel)}" title="${escapeHtml(imageActionLabel)}"`
    : `div aria-label="No image upload target available"`;
  const closeTag = entry.id ? "button" : "div";

  if (imageUrl) {
    return `
    <${actionAttributes} class="widget-media widget-media-action widget-media-filled">
      <img src="${escapeHtml(imageUrl)}" alt="${alt}" loading="lazy" />
      <span class="widget-media-overlay">Change image</span>
    </${closeTag}>`;
  }

  return `
    <${actionAttributes} class="widget-media widget-media-empty widget-media-action">
      <span aria-hidden="true">＋</span>
      <small>Add image</small>
    </${closeTag}>`;
}

function widgetImageDisplayMarkup(entry, label) {
  const title = displayText(label, "Widget");
  const alt = escapeHtml(`${title} image`);
  const imageUrl = entry.imageUrl || entry.imageDataUrl || entry.image?.url;

  if (imageUrl) {
    return `
    <div class="widget-media widget-media-filled">
      <img src="${escapeHtml(imageUrl)}" alt="${alt}" loading="lazy" />
    </div>`;
  }

  return `
    <div class="widget-media widget-media-empty" aria-hidden="true">
      <span>＋</span>
      <small>No image</small>
    </div>`;
}

function widgetDescriptionMarkup(value) {
  const text = String(value || "").trim();
  return text ? `<p class="widget-description">${escapeHtml(text)}</p>` : "";
}

function entryTags(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value.split(",").map((tag) => tag.trim());
  return [];
}

function widgetTagsMarkup(tags) {
  const tagMarkup = tags
    .map((tag) => String(tag ?? "").trim())
    .filter(Boolean)
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join("");
  return tagMarkup ? `<div class="tag-row widget-tags">${tagMarkup}</div>` : "";
}

function isUserProducedEntry(entry) {
  return Boolean(entry?.id) && !String(entry.id).startsWith("demo-");
}

function widgetOriginAttribute(entry) {
  return `data-widget-origin="${isUserProducedEntry(entry) ? "user" : "permanent"}"`;
}

function widgetDeleteActionMarkup(entry, label) {
  if (!isUserProducedEntry(entry)) return "";

  return `
          <div class="entry-actions">
            <button class="btn btn-danger" type="button" data-delete-id="${escapeHtml(entry.id)}">${escapeHtml(label)}</button>
          </div>`;
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readableDate() {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date());
}

function currentIsoDate() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

function readableDateFromIso(value) {
  if (!value) return readableDate();
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function noteChronologyValue(note) {
  if (note?.campaignStartDate) return Date.parse(`${note.campaignStartDate}T00:00:00`);
  if (note?.sortAt) return Number(note.sortAt);
  const idTimestamp = Number(String(note?.id || "").split("-")[1]);
  if (Number.isFinite(idTimestamp)) return idTimestamp;
  const parsedDate = Date.parse(note?.createdAt || "");
  return Number.isNaN(parsedDate) ? 0 : parsedDate;
}

function sortedNotes() {
  return getStoredCollection("notes").sort((a, b) => noteChronologyValue(a) - noteChronologyValue(b));
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

function statusBadgeClass(status) {
  return {
    active: "status-active",
    prepared: "status-prepared",
    hidden: "status-hidden",
    completed: "status-completed",
  }[status] || "status-active";
}

function statusLabel(status) {
  return {
    active: "Active",
    prepared: "Prepared",
    hidden: "DM-only",
    completed: "Completed",
  }[status] || "Active";
}

function resetImagePickers(root) {
  const pickers = root.matches?.("[data-image-picker]") ? [root] : Array.from(root.querySelectorAll("[data-image-picker]"));
  pickers.forEach((picker) => {
    const status = picker.querySelector("[data-image-status]");
    const preview = picker.querySelector("[data-image-preview]");
    if (status) {
      status.textContent = "No image chosen";
      status.classList.remove("error");
    }
    if (preview) {
      preview.removeAttribute("src");
      preview.hidden = true;
    }
  });
}

function selectedFilePreviews(files) {
  return Array.from(files || []).filter((file) => file.type.startsWith("image/")).map((file) => ({
    url: URL.createObjectURL(file),
    originalFilename: file.name,
    fileSize: file.size,
    previewOnly: true,
  }));
}

function initImagePickers() {
  document.querySelectorAll("[data-image-picker]").forEach((picker) => {
    const input = picker.querySelector('input[type="file"]');
    const trigger = picker.querySelector("[data-image-trigger]");
    const status = picker.querySelector("[data-image-status]");
    const preview = picker.querySelector("[data-image-preview]");
    const maxFiles = Number(picker.dataset.maxFiles || input?.dataset.maxFiles || 0);
    if (!input || !trigger) return;

    trigger.addEventListener("click", () => input.click());
    input.addEventListener("change", () => {
      const files = Array.from(input.files || []);
      if (maxFiles && files.length > maxFiles) {
        input.value = "";
        if (status) {
          status.textContent = `Choose ${maxFiles} image${maxFiles === 1 ? "" : "s"} or fewer.`;
          status.classList.add("error");
        }
        return;
      }
      if (status) {
        status.textContent = files.length ? `${files.length} image${files.length === 1 ? "" : "s"} ready.` : "No image chosen";
        status.classList.remove("error");
      }
      const previews = selectedFilePreviews(files);
      if (preview) {
        if (!previews[0]) {
          preview.removeAttribute("src");
          preview.hidden = true;
          return;
        }
        preview.src = previews[0].url;
        preview.hidden = false;
      }
    });
  });
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

function chooseWidgetImage() {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp,image/gif";
    input.addEventListener("change", async () => {
      try {
        resolve(await imageToDataUrl(input));
      } catch (error) {
        reject(error);
      }
    }, { once: true });
    input.click();
  });
}

function renderCollection({ key, listId, emptyText, template, getCollection }) {
  const list = document.getElementById(listId);
  if (!list) return;

  const collection = (getCollection ? getCollection() : getStoredCollection(key)).filter(Boolean);
  if (!collection.length) {
    list.innerHTML = `<div class="empty-state">${emptyText}</div>`;
    return;
  }

  list.innerHTML = collection.map((entry) => template(entry)).join("");

  list.querySelectorAll("[data-image-upload-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const imageDataUrl = await chooseWidgetImage();
        if (!imageDataUrl) return;
        const nextCollection = getStoredCollection(key).map((entry) => (
          entry.id === button.dataset.imageUploadId ? { ...entry, imageDataUrl } : entry
        ));
        saveCollection(key, nextCollection);
        renderDashboard();
        renderCampaignCalendar();
      } catch (error) {
        alert(error.message);
      }
    });
  });

  list.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextCollection = getStoredCollection(key).filter((entry) => entry.id !== button.dataset.deleteId);
      saveCollection(key, nextCollection);
      renderDashboard();
      renderCampaignCalendar();
    });
  });
}

function playerCharacterCard(player) {
  const title = playerDisplayName(player);
  const searchable = textForSearch([player.playerName, player.characterName, player.classRole, player.race, "player character party"]);
  const imageEntry = { imageUrl: player.avatarUrl, imageDataUrl: player.avatarUrl };
  return `
    <a class="content-card entry-card widget-card player-card" href="${escapeHtml(playerCharacterHref(player.campaignId || DEFAULT_CAMPAIGN_ID, player.id))}" data-searchable="${escapeHtml(searchable)}" data-status="active">
      ${widgetImageDisplayMarkup(imageEntry, title)}
      <div class="card-kicker"><span class="status-badge status-active">Player</span><span>${escapeHtml(player.classRole || "Party member")}</span></div>
      <h3>${escapeHtml(title)}</h3>
      ${widgetDescriptionMarkup(player.description || player.notes)}
      ${widgetTagsMarkup([`Player: ${player.playerName}`, player.level ? `Level ${player.level}` : "", player.race])}
    </a>`;
}

function renderDashboardOverview() {
  const grid = document.getElementById("campaigns");
  if (!grid) return;
  const campaign = currentCampaign();
  const playerCards = (campaign.players || []).map(playerCharacterCard);
  grid.innerHTML = playerCards.length
    ? playerCards.join("")
    : `<div class="empty-state">No player widgets yet. Create player characters to populate this campaign overview.</div>`;
}

function renderDashboard() {
  renderDashboardOverview();

  renderCollection({
    key: "encounters",
    listId: "encounters-list",
    emptyText: "No encounters yet. Add one to prepare a scene, hazard, or combat card.",
    template: (encounter) => {
      const status = encounter.status || "prepared";
      const title = firstDisplayText([encounter.title, encounter.name], "Untitled encounter");
      const tier = firstDisplayText([encounter.tier, encounter.type, encounter.sceneType], "Encounter");
      const description = firstDisplayText([encounter.description, encounter.notes, encounter.content], "Add creatures, hazards, clues, terrain, and rewards for this encounter.");
      const tags = entryTags(encounter.tags);
      const searchable = textForSearch([title, tier, description, tags.join(" "), "encounter scene combat"]);
      return `
        <article class="content-card entry-card widget-card" ${widgetOriginAttribute(encounter)} data-searchable="${escapeHtml(searchable)}" data-status="${escapeHtml(status)}">
          ${widgetImageMarkup(encounter, title)}
          <div class="card-kicker"><span class="status-badge ${statusBadgeClass(status)}">${statusLabel(status)}</span><span>${escapeHtml(tier)}</span></div>
          <h3>${escapeHtml(title)}</h3>
          ${widgetDescriptionMarkup(description)}
          ${widgetTagsMarkup([encounter.createdAt, ...tags])}
${widgetDeleteActionMarkup(encounter, "Delete encounter")}
        </article>`;
    },
  });

  renderCollection({
    key: "locations",
    listId: "locations-list",
    emptyText: "No locations yet. Add a place, faction site, region, or route.",
    template: (location) => {
      const status = location.status || "active";
      const name = firstDisplayText([location.name, location.title], "Untitled location");
      const type = firstDisplayText([location.type, location.regionType], "Location");
      const description = firstDisplayText([location.description, location.notes, location.content], "Add terrain, factions, secrets, routes, and hooks for this location.");
      const tags = entryTags(location.tags);
      const searchable = textForSearch([name, type, description, tags.join(" "), "location atlas place faction"]);
      return `
        <article class="content-card entry-card widget-card" ${widgetOriginAttribute(location)} data-searchable="${escapeHtml(searchable)}" data-status="${escapeHtml(status)}">
          ${widgetImageMarkup(location, name)}
          <div class="card-kicker"><span class="status-badge ${statusBadgeClass(status)}">${statusLabel(status)}</span><span>${escapeHtml(type)}</span></div>
          <h3>${escapeHtml(name)}</h3>
          ${widgetDescriptionMarkup(description)}
          ${widgetTagsMarkup([location.createdAt, ...tags])}
${widgetDeleteActionMarkup(location, "Delete location")}
        </article>`;
    },
  });

  renderCollection({
    key: "notes",
    listId: "notes-list",
    emptyText: "No saved notes yet. Add one above to begin your campaign wiki.",
    getCollection: sortedNotes,
    template: (note) => {
      const searchable = textForSearch([note.title, note.category, note.content, note.createdAt, "note campaign wiki"]);
      const noteDate = note.campaignStartDate ? `Campaign begins ${note.createdAt}` : note.createdAt;
      return `
        <article class="content-card entry-card widget-card" ${widgetOriginAttribute(note)} data-searchable="${escapeHtml(searchable)}" data-status="active">
          ${widgetImageMarkup(note, note.title)}
          <div class="card-kicker"><span class="status-badge status-active">${escapeHtml(note.category)}</span><span>Note</span></div>
          <h3>${escapeHtml(note.title)}</h3>
          ${widgetDescriptionMarkup(note.content)}
          ${widgetTagsMarkup([noteDate, "Backlinks soon"])}
${widgetDeleteActionMarkup(note, "Delete note")}
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
        <article class="content-card entry-card widget-card" ${widgetOriginAttribute(character)} data-searchable="${escapeHtml(searchable)}" data-status="hidden">
          ${widgetImageMarkup(character, character.name)}
          <div class="card-kicker"><span class="status-badge status-hidden">DM-only</span><span>${escapeHtml(character.role)}</span></div>
          <h3>${escapeHtml(character.name)}</h3>
          ${widgetDescriptionMarkup(character.notes)}
          ${widgetTagsMarkup([`Faction: ${character.faction || "Unaligned"}`, character.createdAt, "NPC"])}
${widgetDeleteActionMarkup(character, "Delete NPC")}
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
        <article class="content-card entry-card widget-card" ${widgetOriginAttribute(item)} data-searchable="${escapeHtml(searchable)}" data-status="${status}">
          ${widgetImageMarkup(item, item.name)}
          <div class="card-kicker"><span class="status-badge ${status === "prepared" ? "status-prepared" : "status-active"}">${statusLabel}</span><span>${escapeHtml(item.type)}</span></div>
          <h3>${escapeHtml(item.name)}</h3>
          ${widgetDescriptionMarkup(item.description)}
          ${widgetTagsMarkup([item.createdAt, "Loot & rules"])}
${widgetDeleteActionMarkup(item, "Delete item")}
        </article>`;
    },
  });

  renderCollection({
    key: "events",
    listId: "events-list",
    emptyText: "No saved calendar events yet. Add an in-world date to keep pressure on the party.",
    template: (event) => {
      const searchable = textForSearch([event.title, eventDateLabel(event), event.description, "session calendar event"]);
      return `
        <article class="content-card entry-card widget-card" ${widgetOriginAttribute(event)} data-searchable="${escapeHtml(searchable)}" data-status="prepared">
          ${widgetImageMarkup(event, event.title)}
          <div class="card-kicker"><span class="status-badge status-prepared">Prepared</span><span>${escapeHtml(eventDateLabel(event))}</span></div>
          <h3>${escapeHtml(event.title)}</h3>
          ${widgetDescriptionMarkup(event.description)}
          ${widgetTagsMarkup([event.createdAt, "Session timeline", "Calendar"])}
${widgetDeleteActionMarkup(event, "Delete event")}
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
  const eventDate = document.getElementById("next-event-date");
  const eventWeatherText = document.getElementById("next-event-weather");
  const previewTitle = document.getElementById("preview-next-event-title");
  const previewSummary = document.getElementById("preview-next-event-summary");
  const previewDate = document.getElementById("preview-next-event-date");
  const previewWeather = document.getElementById("preview-next-event-weather");
  const statNotes = document.getElementById("stat-notes");
  const statCharacters = document.getElementById("stat-characters");
  const statEvents = document.getElementById("stat-events");
  const statPlayers = document.getElementById("stat-players");
  const campaign = currentCampaign();

  if (notes[0] && noteTitle && noteSummary) {
    noteTitle.textContent = notes[0].title;
    noteSummary.textContent = notes[0].content.slice(0, 120);
  } else {
    if (noteTitle) noteTitle.textContent = "No notes yet";
    if (noteSummary) noteSummary.textContent = "Create your first note to populate this summary.";
  }
  const nextEvent = nextImminentEvent();
  if (nextEvent) {
    const dateLabel = eventDateLabel(nextEvent);
    const weatherLabel = eventWeather(nextEvent);
    if (eventTitle) eventTitle.textContent = nextEvent.title;
    if (eventSummary) eventSummary.textContent = `${dateLabel}: ${nextEvent.description.slice(0, 95)}`;
    if (eventDate) eventDate.textContent = dateLabel;
    if (eventWeatherText) eventWeatherText.textContent = weatherLabel;
    if (previewTitle) previewTitle.textContent = nextEvent.title;
    if (previewSummary) previewSummary.textContent = nextEvent.description.slice(0, 140);
    if (previewDate) previewDate.textContent = dateLabel;
    if (previewWeather) previewWeather.textContent = weatherLabel;
  } else {
    if (eventTitle) eventTitle.textContent = "No events yet";
    if (eventSummary) eventSummary.textContent = "Add an event to schedule the campaign timeline.";
    if (eventDate) eventDate.textContent = "Calendar";
    if (eventWeatherText) eventWeatherText.textContent = "Weather pending";
    if (previewTitle) previewTitle.textContent = "No upcoming event";
    if (previewSummary) previewSummary.textContent = "Saved events appear on the full calendar page and update this dashboard preview.";
    if (previewDate) previewDate.textContent = "No date set";
    if (previewWeather) previewWeather.textContent = "Weather unknown";
  }
  if (statNotes) statNotes.textContent = notes.length;
  if (statCharacters) statCharacters.textContent = characters.length;
  if (statEvents) statEvents.textContent = events.length;
  if (statPlayers) statPlayers.textContent = campaign.players.length;
  document.querySelectorAll(".campaign-action-button").forEach((button) => {
    if (campaignReady(campaign)) {
      button.href = "#dashboard";
      button.textContent = "Open Campaign";
    } else if (campaign.players.length) {
      button.href = campaignStartNoteHref(campaign.id);
      button.textContent = "Open Campaign";
    } else {
      button.href = campaignSetupHref(campaign.id);
      button.textContent = "Start Campaign";
    }
  });
  const widgetTitle = document.getElementById("campaign-widget-title");
  if (widgetTitle) widgetTitle.textContent = campaign.name;
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
      resetImagePickers(form);
      populateCalendarFormDefaults();
      renderDashboard();
      renderCampaignCalendar();
    } catch (error) {
      alert(error.message);
    }
  });
}

function initDashboardForms() {
  wireForm("encounter-form", "encounters", async () => ({
    id: createId("encounter"),
    title: document.getElementById("encounter-title").value.trim(),
    tier: document.getElementById("encounter-tier").value.trim(),
    status: document.getElementById("encounter-status").value,
    description: document.getElementById("encounter-description").value.trim(),
    tags: document.getElementById("encounter-tags").value.split(",").map((tag) => tag.trim()).filter(Boolean),
    imageDataUrl: await imageToDataUrl(document.getElementById("encounter-image")),
    createdAt: readableDate(),
  }));

  wireForm("location-form", "locations", async () => ({
    id: createId("location"),
    name: document.getElementById("location-name").value.trim(),
    type: document.getElementById("location-type").value.trim(),
    status: document.getElementById("location-status").value,
    description: document.getElementById("location-description").value.trim(),
    tags: document.getElementById("location-tags").value.split(",").map((tag) => tag.trim()).filter(Boolean),
    imageDataUrl: await imageToDataUrl(document.getElementById("location-image")),
    createdAt: readableDate(),
  }));

  wireForm("note-form", "notes", async () => ({
    id: createId("note"),
    title: document.getElementById("note-title").value.trim(),
    category: document.getElementById("note-category").value,
    content: document.getElementById("note-content").value.trim(),
    imageDataUrl: await imageToDataUrl(document.getElementById("note-image")),
    createdAt: readableDate(),
    sortAt: Date.now(),
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

  wireForm("event-form", "events", async () => {
    const settings = getCalendarSettings();
    const monthIndex = Number(document.getElementById("event-month")?.value ?? settings.currentMonthIndex);
    const day = Number(document.getElementById("event-day")?.value ?? 1);
    const year = Number(document.getElementById("event-year")?.value ?? settings.currentYear);
    const event = {
      id: createId("event"),
      title: document.getElementById("event-title").value.trim(),
      monthIndex,
      day,
      year,
      description: document.getElementById("event-description").value.trim(),
      imageDataUrl: await imageToDataUrl(document.getElementById("event-image")),
      createdAt: readableDate(),
    };
    event.date = eventDateLabel(event, settings);
    return event;
  });
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
        <article class="content-card entry-card material-card" data-widget-origin="user" data-searchable="${escapeHtml(searchable)}" data-status="active">
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
      <h3>Assistant response unavailable</h3>
      <p>AI analysis is not connected yet. When available, it will retrieve user-created notes, NPCs, factions, items, maps, and calendar events before answering.</p>
      <ul class="compact-list">
        <li>Save the relevant campaign widgets before asking for context-aware analysis.</li>
        <li>Keep private notes marked DM-only when player visibility matters.</li>
        <li>Review linked calendar events before making timeline changes.</li>
      </ul>
      <p class="muted">Question received: "${escapeHtml(asked)}"</p>
    `;
  });
}


function renderNotFoundPage(message) {
  document.querySelector("main").innerHTML = `
    <section class="page-layout section-shell">
      <div class="page-hero">
        <p class="eyebrow">Not found</p>
        <h1>We could not find that campaign page.</h1>
        <p>${escapeHtml(message)}</p>
        <a class="btn btn-primary" href="index.html">Back to dashboard</a>
      </div>
    </section>`;
}

function renderAddedPlayersSummary(campaign) {
  const list = document.getElementById("added-players-summary");
  if (!list) return;
  const players = campaign.players || [];
  if (!players.length) {
    list.innerHTML = `<div class="empty-state">No player characters added yet. Save the first hero to build the party.</div>`;
    return;
  }
  list.innerHTML = players.map((player) => `
    <article class="content-card compact-player-card">
      <div class="card-kicker"><span class="status-badge status-active">Saved</span><span>${escapeHtml(player.classRole || "Party member")}</span></div>
      <h3>${escapeHtml(player.characterName)}</h3>
      ${widgetTagsMarkup([`Player: ${player.playerName}`, player.level ? `Level ${player.level}` : "", player.race])}
    </article>`).join("");
}

function playerCharacterFormMarkup() {
  return `
    <form class="panel form-grid player-character-form" id="player-character-form" novalidate>
      <label>Player name<input id="player-name" type="text" placeholder="Player name" required /></label>
      <label>Character name<input id="player-character-name" type="text" placeholder="Character name" required /></label>
      <label>Character class / role<input id="player-class-role" type="text" placeholder="Ranger, Cleric, Face, Tank..." /></label>
      <label>Level<input id="player-level" type="number" min="1" step="1" placeholder="1" /></label>
      <label>Race / ancestry<input id="player-race" type="text" placeholder="Elf, Human, Tiefling..." /></label>
      <label>Background<input id="player-background" type="text" placeholder="Acolyte, Outlander, Noble..." /></label>
      <label class="full-width">Short description<textarea id="player-description" rows="3" placeholder="What should the table know about this hero?"></textarea></label>
      <label class="full-width">Notes<textarea id="player-notes" rows="3" placeholder="Secrets, bonds, safety notes, goals, or mechanics to remember..."></textarea></label>
      <div class="file-picker image-picker full-width" data-image-picker>
        <label for="player-avatar">Optional avatar</label>
        <input id="player-avatar" class="image-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
        <button class="btn btn-secondary image-picker-button" type="button" data-image-trigger="player-avatar">Choose image</button>
        <span class="image-picker-status" data-image-status>No image chosen</span>
        <img class="image-picker-preview" data-image-preview alt="Selected player avatar preview" hidden />
      </div>
      <div class="form-message full-width" id="player-form-message" aria-live="polite"></div>
      <div class="setup-actions full-width">
        <button class="btn btn-secondary" type="button" id="add-another-player">ADD ANOTHER PLAYER</button>
        <button class="btn btn-primary" type="button" id="go-on-campaign">GO ON</button>
      </div>
    </form>`;
}

async function saveCurrentPlayerFromSetup(form, { requireData }) {
  const message = document.getElementById("player-form-message");
  const campaignId = form.dataset.campaignId;
  const player = buildPlayerCharacter(form);
  const hasData = playerFormHasData(form);
  if (!requireData && !hasData) return { saved: false, campaign: getCampaign(campaignId) };
  const errors = validatePlayerCharacter(player, requireData);
  if (errors.length) {
    if (message) {
      message.textContent = errors.join(" ");
      message.classList.add("error");
    }
    return { saved: false, errors };
  }
  player.avatarUrl = await imageToDataUrl(document.getElementById("player-avatar"));
  const campaign = savePlayerToCampaign(campaignId, player);
  form.reset();
  resetImagePickers(form);
  if (message) {
    message.textContent = `${player.characterName} has joined the party.`;
    message.classList.remove("error");
  }
  return { saved: true, campaign };
}

function renderCampaignSetupPage(campaignId) {
  const campaign = getCampaign(campaignId);
  if (!campaign) {
    renderNotFoundPage("The requested campaign does not exist in local storage.");
    return;
  }
  if (campaignReady(campaign)) {
    goToDashboard();
    return;
  }
  if (campaign.setupCompleted && campaign.players.length) {
    window.location.href = campaignStartNoteHref(campaign.id);
    return;
  }
  document.querySelector("main").innerHTML = `
    <section class="page-layout section-shell setup-page">
      <div class="page-hero">
        <p class="eyebrow">Start campaign</p>
        <h1>${escapeHtml(campaign.name)}</h1>
        <p>Create the party one character sheet at a time before entering the live campaign dashboard.</p>
      </div>
      <div class="setup-grid">
        <section class="setup-form-panel">
          <div class="section-heading"><div><p class="eyebrow">Party builder</p><h2>Add a player character</h2></div></div>
          ${playerCharacterFormMarkup()}
        </section>
        <aside class="setup-summary-panel">
          <div class="section-heading"><div><p class="eyebrow">Already added</p><h2>Party so far</h2></div></div>
          <div class="collection-grid setup-player-list" id="added-players-summary" aria-live="polite"></div>
        </aside>
      </div>
    </section>`;
  const form = document.getElementById("player-character-form");
  form.dataset.campaignId = campaign.id;
  initImagePickers();
  renderAddedPlayersSummary(campaign);
  document.getElementById("add-another-player").addEventListener("click", async () => {
    const result = await saveCurrentPlayerFromSetup(form, { requireData: true });
    if (result.campaign) renderAddedPlayersSummary(result.campaign);
  });
  document.getElementById("go-on-campaign").addEventListener("click", async () => {
    const result = await saveCurrentPlayerFromSetup(form, { requireData: false });
    if (result.errors) return;
    const nextCampaign = result.campaign || getCampaign(campaign.id);
    if (!nextCampaign.players.length) {
      const message = document.getElementById("player-form-message");
      if (message) {
        message.textContent = "Add at least one player character before starting the campaign.";
        message.classList.add("error");
      }
      return;
    }
    window.location.href = campaignStartNoteHref(campaign.id);
  });
}

function renderCampaignStartNotePage(campaignId) {
  const campaign = getCampaign(campaignId);
  if (!campaign) {
    renderNotFoundPage("The requested campaign does not exist in local storage.");
    return;
  }
  if (!campaign.players.length) {
    renderCampaignSetupPage(campaign.id);
    return;
  }
  if (campaignReady(campaign)) {
    goToDashboard();
    return;
  }
  document.querySelector("main").innerHTML = `
    <section class="page-layout section-shell setup-page">
      <div class="page-hero">
        <p class="eyebrow">Campaign beginning</p>
        <h1>Write the first note.</h1>
        <p>Set the campaign title, beginning date, and opening description before entering the dashboard.</p>
      </div>
      <form class="panel form-grid campaign-start-note-form" id="campaign-start-note-form">
        <label>Campaign title<input id="campaign-start-title" type="text" value="${escapeHtml(campaign.name)}" required /></label>
        <label>Beginning date<input id="campaign-start-date" type="date" value="${currentIsoDate()}" required /></label>
        <label class="full-width">Description<textarea id="campaign-start-description" rows="5" placeholder="Write the opening note, premise, first scene, or table context..." required></textarea></label>
        <div class="form-message full-width" id="campaign-start-note-message" aria-live="polite"></div>
        <div class="setup-actions full-width">
          <a class="btn btn-secondary" href="${escapeHtml(campaignSetupHref(campaign.id))}">BACK TO PLAYERS</a>
          <button class="btn btn-primary" type="submit">OPEN CAMPAIGN</button>
        </div>
      </form>
    </section>`;
  const form = document.getElementById("campaign-start-note-form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const completed = completeCampaignSetup(campaign.id, {
      title: document.getElementById("campaign-start-title").value.trim(),
      startDate: document.getElementById("campaign-start-date").value,
      description: document.getElementById("campaign-start-description").value.trim(),
    });
    if (!completed) {
      const message = document.getElementById("campaign-start-note-message");
      if (message) {
        message.textContent = "Could not save the campaign beginning.";
        message.classList.add("error");
      }
      return;
    }
    goToDashboard();
  });
}

function renderPlayerCharacterPage(campaignId, playerId) {
  const campaign = getCampaign(campaignId);
  if (!campaign) {
    renderNotFoundPage("The requested campaign does not exist in local storage.");
    return;
  }
  const player = (campaign.players || []).find((item) => item.id === playerId);
  if (!player) {
    renderNotFoundPage("That player character is not saved in this campaign.");
    return;
  }
  document.querySelector("main").innerHTML = `
    <section class="page-layout section-shell character-page">
      <div class="page-hero character-hero">
        <div>
          <p class="eyebrow">Player character</p>
          <h1>${escapeHtml(player.characterName)}</h1>
          <p>Played by ${escapeHtml(player.playerName)} in ${escapeHtml(campaign.name)}.</p>
          <a class="btn btn-secondary" href="index.html#campaigns">Back to campaign dashboard</a>
        </div>
        ${player.avatarUrl ? `<img class="character-avatar" src="${escapeHtml(player.avatarUrl)}" alt="${escapeHtml(player.characterName)} avatar" />` : `<div class="card-visual character-avatar-placeholder" aria-hidden="true"><span>${cardVisualLabel(player.characterName)}</span></div>`}
      </div>
      <div class="info-grid character-sheet-grid">
        <article class="content-card"><p class="eyebrow">Class / role</p><h2>${escapeHtml(player.classRole || "Not set")}</h2></article>
        <article class="content-card"><p class="eyebrow">Level</p><h2>${escapeHtml(player.level || "Not set")}</h2></article>
        <article class="content-card"><p class="eyebrow">Race / ancestry</p><h2>${escapeHtml(player.race || "Not set")}</h2></article>
      </div>
      <article class="content-card prose-card">
        <p class="eyebrow">Background</p>
        <p>${escapeHtml(player.background || "No background recorded yet.")}</p>
        <p class="eyebrow">Description</p>
        <p>${escapeHtml(player.description || "No short description recorded yet.")}</p>
        <p class="eyebrow">Notes</p>
        <p>${escapeHtml(player.notes || "No notes recorded yet.")}</p>
      </article>
    </section>`;
}

function initCampaignRoutes() {
  const parts = routeParts();
  if (parts[0] !== "campaigns") return false;
  const campaignId = parts[1] || DEFAULT_CAMPAIGN_ID;
  if (parts[2] === "setup") {
    renderCampaignSetupPage(campaignId);
    return true;
  }
  if (parts[2] === "start-note") {
    renderCampaignStartNotePage(campaignId);
    return true;
  }
  if (parts[2] === "players" && parts[3]) {
    renderPlayerCharacterPage(campaignId, parts[3]);
    return true;
  }
  renderNotFoundPage("This campaign route is not available yet.");
  return true;
}

function renderCampaignCalendar() {
  const grid = document.getElementById("calendar-grid");
  const title = document.getElementById("calendar-current-title");
  if (!grid) return;
  const settings = getCalendarSettings();
  const weather = getWeatherMap();
  const monthName = settings.months[settings.currentMonthIndex] || `Month ${settings.currentMonthIndex + 1}`;
  if (title) title.textContent = `${monthName} ${settings.currentYear} ${settings.yearName}`;

  const monthEvents = sortedEvents().filter((event) => (
    Number(event.year) === settings.currentYear && Number(event.monthIndex) === settings.currentMonthIndex
  ));
  const headers = settings.weekdays.map((day) => `<div class="calendar-weekday">${escapeHtml(day)}</div>`).join("");
  const days = Array.from({ length: settings.daysPerMonth }, (_, index) => {
    const day = index + 1;
    const dayEvents = monthEvents.filter((event) => Number(event.day) === day);
    const forecast = weather[weatherKey(settings.currentYear, settings.currentMonthIndex, day)] || "No forecast";
    return `<article class="calendar-day">
      <div class="calendar-day-top"><strong>${day}</strong><span>${escapeHtml(forecast)}</span></div>
      <div class="calendar-day-events">
        ${dayEvents.map((event) => `<button type="button" class="calendar-event-pill" data-calendar-event-id="${escapeHtml(event.id)}">${escapeHtml(event.title)}</button>`).join("")}
      </div>
    </article>`;
  }).join("");
  grid.style.setProperty("--calendar-week-length", settings.weekLength);
  grid.innerHTML = headers + days;
  grid.querySelectorAll("[data-calendar-event-id]").forEach((button) => {
    button.addEventListener("click", () => openEventDetail(button.dataset.calendarEventId));
  });
}

function openEventDetail(eventId) {
  const modal = document.getElementById("event-detail-modal");
  const body = document.getElementById("event-detail-body");
  if (!modal || !body) return;
  const event = getStoredCollection("events").find((item) => item.id === eventId);
  if (!event) return;
  body.innerHTML = `
    <div class="card-kicker"><span class="status-badge status-prepared">Calendar event</span><span>${escapeHtml(eventDateLabel(event))}</span></div>
    <h2 id="event-detail-title">${escapeHtml(event.title)}</h2>
    <p>${escapeHtml(event.description)}</p>
    <div class="tag-row"><span class="tag">${escapeHtml(eventWeather(event))}</span><span class="tag">Created ${escapeHtml(event.createdAt || "Unknown")}</span></div>
  `;
  modal.hidden = false;
}

function initCalendarPage() {
  const settingsForm = document.getElementById("calendar-settings-form");
  const prev = document.getElementById("calendar-prev");
  const next = document.getElementById("calendar-next");
  const weatherButton = document.getElementById("weather-generate");
  const modal = document.getElementById("event-detail-modal");
  const settings = getCalendarSettings();

  populateCalendarFormDefaults();
  if (settingsForm) {
    document.getElementById("calendar-week-length").value = settings.weekLength;
    document.getElementById("calendar-weekdays").value = settings.weekdays.join(", ");
    document.getElementById("calendar-months").value = settings.months.join("\n");
    document.getElementById("calendar-days-per-month").value = settings.daysPerMonth;
    document.getElementById("calendar-year-name").value = settings.yearName;
    document.getElementById("calendar-active-year").value = settings.currentYear;

    settingsForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const weekLength = Math.max(1, Number(document.getElementById("calendar-week-length").value) || 7);
      const months = document.getElementById("calendar-months").value.split(/\n|,/).map((month) => month.trim()).filter(Boolean);
      const weekdays = document.getElementById("calendar-weekdays").value.split(",").map((day) => day.trim()).filter(Boolean).slice(0, weekLength);
      while (weekdays.length < weekLength) weekdays.push(`Day ${weekdays.length + 1}`);
      saveCalendarSettings({
        ...getCalendarSettings(),
        weekLength,
        weekdays,
        months: months.length ? months : [...DEFAULT_CALENDAR_SETTINGS.months],
        daysPerMonth: Math.max(1, Number(document.getElementById("calendar-days-per-month").value) || 30),
        yearName: document.getElementById("calendar-year-name").value.trim() || "Year",
        currentYear: Number(document.getElementById("calendar-active-year").value) || settings.currentYear,
        currentMonthIndex: 0,
      });
      populateCalendarFormDefaults();
      renderCampaignCalendar();
      renderDashboard();
    });
  }

  if (prev) prev.addEventListener("click", () => {
    const current = getCalendarSettings();
    current.currentMonthIndex -= 1;
    if (current.currentMonthIndex < 0) { current.currentMonthIndex = current.months.length - 1; current.currentYear -= 1; }
    saveCalendarSettings(current); populateCalendarFormDefaults(); renderCampaignCalendar(); renderDashboard();
  });
  if (next) next.addEventListener("click", () => {
    const current = getCalendarSettings();
    current.currentMonthIndex += 1;
    if (current.currentMonthIndex >= current.months.length) { current.currentMonthIndex = 0; current.currentYear += 1; }
    saveCalendarSettings(current); populateCalendarFormDefaults(); renderCampaignCalendar(); renderDashboard();
  });
  if (weatherButton) weatherButton.addEventListener("click", () => {
    const current = getCalendarSettings();
    const weather = getWeatherMap();
    for (let day = 1; day <= current.daysPerMonth; day += 1) {
      weather[weatherKey(current.currentYear, current.currentMonthIndex, day)] = WEATHER_OPTIONS[Math.floor(Math.random() * WEATHER_OPTIONS.length)];
    }
    saveWeatherMap(weather); renderCampaignCalendar(); renderDashboard();
  });
  if (modal) {
    modal.addEventListener("click", (event) => { if (event.target === modal || event.target.matches("[data-close-modal]")) modal.hidden = true; });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") modal.hidden = true; });
  }
  renderCampaignCalendar();
}


initMobileNavigation();
if (!initCampaignRoutes()) {
  initCommandInterface();
  initImagePickers();
  populateCalendarFormDefaults();
  initDashboardForms();
  initCalendarPage();
  initMaterials();
  initAiPlaceholder();
  renderDashboard();
}
window.addEventListener("hashchange", () => {
  if (window.location.hash.startsWith("#/campaigns")) initCampaignRoutes();
});

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
