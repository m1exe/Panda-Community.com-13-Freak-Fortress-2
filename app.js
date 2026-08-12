import { parseKeyValues, extractItems } from "./parser/cfg-parser.js";

const [weaponsData, bossesData, commandsData, changelogData] = await Promise.all([
  fetch("./data/weapons.json", { cache: "no-store" }).then(r => r.json()),
  fetch("./data/bosses.json", { cache: "no-store" }).then(r => r.json()),
  fetch("./data/commands.json", { cache: "no-store" }).then(r => r.json()),
  fetch("./data/changelog.json", { cache: "no-store" }).then(r => r.json())
]);

const weapons = Array.isArray(weaponsData) ? weaponsData : [weaponsData];
const bosses = Array.isArray(bossesData) ? bossesData : [bossesData];
const commands = Array.isArray(commandsData) ? commandsData : [commandsData];
const changelog = Array.isArray(changelogData) ? changelogData : [changelogData];

const views = [...document.querySelectorAll(".view")];

function showView(id){
  views.forEach(v => v.classList.toggle("active", v.id === id));
  document.querySelectorAll(".nav-btn").forEach(
    b => b.classList.toggle("active", b.dataset.view === id)
  );
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-view]").forEach(
  b => b.addEventListener("click", () => showView(b.dataset.view))
);
document.querySelectorAll("[data-view-link]").forEach(
  b => b.addEventListener("click", () => showView(b.dataset.viewLink))
);

function renderWeapons(query = ""){
  const q = query.toLowerCase().trim();
  const list = weapons.filter(w =>
    `${w.name} ${w.classname} ${w.class} ${w.slot}`.toLowerCase().includes(q)
  );

  document.querySelector("#weapon-list").innerHTML = list.map(w => `
    <article class="item-card">
      ${w.image ? `<img class="item-img" src="${escapeAttr(w.image)}" alt="${escapeAttr(w.name)}" onerror="this.style.display='none'">` : ""}
      <h3>${escapeHtml(w.name)}</h3>
      <p>${escapeHtml(w.class)} · ${escapeHtml(w.slot)}</p>
      <span class="tag">${escapeHtml(w.classname)}</span>
      ${w.ff2 ? `<span class="tag">Panda FF2</span>` : ""}
    </article>
  `).join("") || `<div class="empty-state">No weapons found.</div>`;
}

function bossAbilityText(ability){
  if(typeof ability === "string") return ability;
  return `${ability?.name || ""} ${ability?.id || ""} ${ability?.description || ""}`;
}

function bossCreatorText(creator){
  if(typeof creator === "string") return creator;
  return creator?.name || "";
}

function renderBosses(query = ""){
  const q = query.toLowerCase().trim();

  const list = bosses.filter(b => {
    const abilities = (b.abilities || []).map(bossAbilityText).join(" ");
    const creators = (b.creators || []).map(bossCreatorText).join(" ");
    const rageAbilities = (b.rage?.abilities || []).map(bossAbilityText).join(" ");
    const rageWeapon = b.rage?.weapon
      ? `${b.rage.weapon.name || ""} ${b.rage.weapon.classname || ""} ${b.rage.weapon.index || ""}`
      : "";

    return `
      ${b.name || ""}
      ${b.class || ""}
      ${b.description || ""}
      ${b.model || ""}
      ${abilities}
      ${creators}
      ${rageAbilities}
      ${rageWeapon}
    `.toLowerCase().includes(q);
  });

  document.querySelector("#boss-list").innerHTML = list.map(b => `
    <article class="item-card boss-card">
      ${b.image ? `<img class="item-img" src="${escapeAttr(b.image)}" alt="${escapeAttr(b.name)}" onerror="this.style.display='none'">` : ""}
      <div class="boss-card-head">
        <div>
          <h3>${escapeHtml(b.name)}</h3>
          <p>${escapeHtml(b.class || "Unknown class")}${b.maxSpeed ? ` · ${escapeHtml(b.maxSpeed)} HU/s` : ""}</p>
        </div>
      </div>

      <p>${escapeHtml(b.description || "No description yet.")}</p>

      <div class="boss-card-tags">
        ${b.healthFormula ? `<span class="tag">Health formula</span>` : ""}
        ${b.rageDamageFormula ? `<span class="tag">Rage</span>` : ""}
        ${(b.abilities || []).slice(0, 4).map(a =>
          `<span class="tag">${escapeHtml(typeof a === "string" ? a : (a.name || a.id || "Ability"))}</span>`
        ).join("")}
      </div>

      <button class="boss-details-btn" data-boss-id="${escapeAttr(b.id || b.name)}">View details</button>
    </article>
  `).join("") || `<div class="empty-state">No bosses found.</div>`;
}

document.querySelector("#boss-list").addEventListener("click", e => {
  const button = e.target.closest("[data-boss-id]");
  if(!button) return;

  const id = button.dataset.bossId;
  const boss = bosses.find(b => String(b.id || b.name) === id);
  if(boss) showBossDetails(boss);
});

function showBossDetails(boss){
  const detail = document.querySelector("#boss-detail");
  const list = document.querySelector("#boss-list");

  const creators = (boss.creators || []).map(c => {
    const name = typeof c === "string" ? c : c.name;
    const steam = typeof c === "object" ? c.steamId64 : "";
    return steam
      ? `<a href="https://steamcommunity.com/profiles/${escapeAttr(steam)}" target="_blank" rel="noreferrer">${escapeHtml(name)}</a>`
      : escapeHtml(name);
  }).join(", ");

  const weapons = (boss.weapons || []).map(w => `
    <div class="boss-subcard">
      <div class="boss-subcard-title">
        <strong>${escapeHtml(w.type || w.name || "Weapon")}</strong>
        <span>${escapeHtml(w.classname || "")}${w.index !== undefined ? ` · #${escapeHtml(w.index)}` : ""}</span>
      </div>
      ${renderAttributes(w.attributes)}
    </div>
  `).join("");

  const abilities = (boss.abilities || []).map(a => {
    if(typeof a === "string"){
      return `<div class="boss-subcard"><strong>${escapeHtml(a)}</strong></div>`;
    }

    const ignored = new Set(["id", "name", "description"]);
    const stats = Object.entries(a)
      .filter(([key, value]) => !ignored.has(key) && value !== undefined && value !== null)
      .map(([key, value]) => `<li><span>${escapeHtml(prettyKey(key))}</span><strong>${escapeHtml(value)}</strong></li>`)
      .join("");

    return `
      <div class="boss-subcard">
        <strong>${escapeHtml(a.name || a.id || "Ability")}</strong>
        ${a.description ? `<p>${escapeHtml(a.description)}</p>` : ""}
        ${stats ? `<ul class="boss-stat-list">${stats}</ul>` : ""}
      </div>
    `;
  }).join("");

  const rageAbilities = (boss.rage?.abilities || []).map(a => {
    if(typeof a === "string"){
      return `<div class="boss-subcard"><strong>${escapeHtml(a)}</strong></div>`;
    }

    const stats = Object.entries(a)
      .filter(([key]) => key !== "name")
      .map(([key, value]) => `<li><span>${escapeHtml(prettyKey(key))}</span><strong>${escapeHtml(value)}</strong></li>`)
      .join("");

    return `
      <div class="boss-subcard">
        <strong>${escapeHtml(a.name || "Rage ability")}</strong>
        ${stats ? `<ul class="boss-stat-list">${stats}</ul>` : ""}
      </div>
    `;
  }).join("");

  const rageWeapon = boss.rage?.weapon ? `
    <div class="boss-subcard">
      <div class="boss-subcard-title">
        <strong>${escapeHtml(boss.rage.weapon.name || "Rage weapon")}</strong>
        <span>${escapeHtml(boss.rage.weapon.classname || "")}${boss.rage.weapon.index !== undefined ? ` · #${escapeHtml(boss.rage.weapon.index)}` : ""}</span>
      </div>
      ${boss.rage.weapon.maxAmmo !== undefined ? `<p>Maximum ammo: ${escapeHtml(boss.rage.weapon.maxAmmo)}</p>` : ""}
      ${renderAttributes(boss.rage.weapon.attributes)}
    </div>
  ` : "";

  const music = (boss.music || []).map(track => `
    <div class="boss-subcard">
      <strong>${escapeHtml(track.name || "Unknown track")}</strong>
      ${track.artist ? `<p>${escapeHtml(track.artist)}${track.duration ? ` · ${escapeHtml(formatDuration(track.duration))}` : ""}</p>` : ""}
    </div>
  `).join("");

  detail.innerHTML = `
    <button class="boss-back-btn" id="boss-back">← Back to bosses</button>

    <div class="boss-detail-header">
      <div>
        <p class="eyebrow">${escapeHtml(boss.class || "Boss")}</p>
        <h3>${escapeHtml(boss.name)}</h3>
        <p>${escapeHtml(boss.description || "")}</p>
      </div>
      <div class="boss-detail-meta">
        ${boss.maxSpeed !== undefined ? `<span><small>MAX SPEED</small><strong>${escapeHtml(boss.maxSpeed)} HU/s</strong></span>` : ""}
        ${boss.ff2Version !== undefined ? `<span><small>FF2 VERSION</small><strong>${escapeHtml(boss.ff2Version)}</strong></span>` : ""}
      </div>
    </div>

    <div class="boss-overview">
      ${boss.healthFormula ? `<div><small>HEALTH FORMULA</small><code>${escapeHtml(boss.healthFormula)}</code></div>` : ""}
      ${boss.rageDamageFormula ? `<div><small>RAGE DAMAGE</small><code>${escapeHtml(boss.rageDamageFormula)}</code></div>` : ""}
      ${boss.model ? `<div class="boss-wide"><small>MODEL</small><code>${escapeHtml(boss.model)}</code></div>` : ""}
      ${creators ? `<div class="boss-wide"><small>CREATORS</small><p>${creators}</p></div>` : ""}
    </div>

    ${abilities ? `<section class="boss-detail-section"><h4>Abilities</h4><div class="boss-detail-grid">${abilities}</div></section>` : ""}
    ${weapons ? `<section class="boss-detail-section"><h4>Weapons</h4><div class="boss-detail-grid">${weapons}</div></section>` : ""}

    ${(rageAbilities || rageWeapon || boss.rage?.description) ? `
      <section class="boss-detail-section">
        <h4>Rage</h4>
        ${boss.rage?.description ? `<p class="boss-section-copy">${escapeHtml(boss.rage.description)}</p>` : ""}
        <div class="boss-detail-grid">${rageAbilities}${rageWeapon}</div>
      </section>
    ` : ""}

    ${(boss.multiMelee || []).length ? `
      <section class="boss-detail-section">
        <h4>Multi-melee indexes</h4>
        <div class="boss-inline-tags">${boss.multiMelee.map(i => `<span class="tag">#${escapeHtml(i)}</span>`).join("")}</div>
      </section>
    ` : ""}

    ${music ? `<section class="boss-detail-section"><h4>Music</h4><div class="boss-detail-grid">${music}</div></section>` : ""}
  `;

  detail.classList.remove("hidden");
  list.classList.add("hidden");
  document.querySelector("#boss-search").classList.add("hidden");

  detail.querySelector("#boss-back").addEventListener("click", closeBossDetails);
  detail.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeBossDetails(){
  document.querySelector("#boss-detail").classList.add("hidden");
  document.querySelector("#boss-list").classList.remove("hidden");
  document.querySelector("#boss-search").classList.remove("hidden");
}

function renderAttributes(attributes){
  if(!attributes || !Object.keys(attributes).length) return "";

  return `
    <ul class="boss-attribute-list">
      ${Object.entries(attributes).map(([name, value]) => `
        <li><span>${escapeHtml(name)}</span><code>${escapeHtml(value)}</code></li>
      `).join("")}
    </ul>
  `;
}

function prettyKey(key){
  return String(key)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatDuration(seconds){
  const total = Number(seconds);
  if(!Number.isFinite(total)) return seconds;
  const minutes = Math.floor(total / 60);
  const secs = Math.round(total % 60).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
}

function renderCommands(query = ""){
  const q = query.toLowerCase().trim();
  const list = commands.filter(c =>
    `${c.command} ${c.title} ${c.description} ${c.category}`.toLowerCase().includes(q)
  );

  document.querySelector("#command-list").innerHTML = list.map(c => `
    <article class="command-card">
      <code>${escapeHtml(c.command)}</code>
      <div>
        <h3>${escapeHtml(c.title)}</h3>
        <p>${escapeHtml(c.description)}</p>
        <span class="command-meta">${escapeHtml(c.category)}</span>
      </div>
    </article>
  `).join("") || `<div class="empty-state">No matching commands found.</div>`;
}

let activeChangeFilter = "all";

function renderChangelog(filter = activeChangeFilter){
  activeChangeFilter = filter;
  const list = changelog
    .filter(entry => filter === "all" || entry.type === filter)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  document.querySelector("#changelog-list").innerHTML = list.map(entry => `
    <article class="change-card" data-type="${escapeAttr(entry.type)}">
      <div class="change-top">
        <div>
          <span class="change-type ${escapeAttr(entry.type)}">${escapeHtml(entry.type)}</span>
          ${entry.status ? `<span class="change-type">${escapeHtml(entry.status)}</span>` : ""}
        </div>
        <time class="change-date" datetime="${escapeAttr(entry.date)}">${escapeHtml(formatDate(entry.date))}</time>
      </div>
      <h3>${escapeHtml(entry.title)}</h3>
      <p>${escapeHtml(entry.summary)}</p>
      ${entry.source ? `<a href="${escapeAttr(entry.source)}" target="_blank" rel="noreferrer">Panda forum source</a>` : ""}
    </article>
  `).join("") || `<div class="empty-state">No changelog entries in this category yet.</div>`;
}

document.querySelector("#weapon-search").addEventListener("input", e => renderWeapons(e.target.value));
document.querySelector("#boss-search").addEventListener("input", e => {
  closeBossDetails();
  renderBosses(e.target.value);
});
document.querySelector("#command-search").addEventListener("input", e => renderCommands(e.target.value));

document.querySelectorAll("[data-change-filter]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-change-filter]").forEach(
      b => b.classList.toggle("active", b === btn)
    );
    renderChangelog(btn.dataset.changeFilter);
  });
});

const fileInput = document.querySelector("#cfg-file");
const drop = document.querySelector("#dropzone");
const output = document.querySelector("#analysis-output");

fileInput.addEventListener("change", e => e.target.files[0] && analyze(e.target.files[0]));

["dragenter", "dragover"].forEach(ev =>
  drop.addEventListener(ev, e => {
    e.preventDefault();
    drop.classList.add("drag");
  })
);

["dragleave", "drop"].forEach(ev =>
  drop.addEventListener(ev, e => {
    e.preventDefault();
    drop.classList.remove("drag");
  })
);

drop.addEventListener("drop", e => e.dataTransfer.files[0] && analyze(e.dataTransfer.files[0]));

async function analyze(file){
  output.classList.remove("hidden");
  output.innerHTML = `<div class="result"><h3>Parsing configuration…</h3><p>Please wait.</p></div>`;

  try{
    const text = await file.text();
    const root = parseKeyValues(text);
    const items = extractItems(root);
    const custom = items.reduce((n, i) => n + i.blocks.reduce((m, b) => m + b.custom.length, 0), 0);
    const official = items.reduce((n, i) => n + i.blocks.reduce((m, b) => m + b.official.length, 0), 0);

    output.innerHTML = `
      <div class="summary">
        <div class="stat"><b>${items.length}</b><span>Parsed items</span></div>
        <div class="stat"><b>${official}</b><span>Official attributes</span></div>
        <div class="stat"><b>${custom}</b><span>Custom / FF2 attributes</span></div>
        <div class="stat"><b>${items.filter(i => i.blocks.some(b => b.className)).length}</b><span>Class overrides</span></div>
      </div>
      ${items.map(i => `
        <article class="result">
          <h3>${escapeHtml(i.name || i.id)}</h3>
          <p>${escapeHtml(i.id)}</p>
          ${i.blocks.map(b => `
            <div>
              <strong>${b.className ? escapeHtml(b.className) : "Default"}</strong>
              <pre>${escapeHtml([
                ...b.official.map(x => `${x.key}: ${x.value}`),
                ...b.custom.map(x => `${x.key}: ${x.value}`)
              ].join("\n"))}</pre>
            </div>
          `).join("")}
        </article>
      `).join("")}
    `;
  }catch(err){
    output.innerHTML = `
      <div class="result">
        <h3>Could not parse file</h3>
        <p>${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

function formatDate(value){
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date);
}

function escapeHtml(value){
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    "\"":"&quot;",
    "'":"&#39;"
  }[c]));
}

function escapeAttr(value){
  return escapeHtml(value);
}

renderWeapons();
renderBosses();
renderCommands();
renderChangelog();
