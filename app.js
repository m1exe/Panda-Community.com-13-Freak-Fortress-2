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

let weaponSearchQuery = "";
let weaponClassFilter = "all";

function weaponRuleSearchText(rule){
  if(!rule) return "";

  const attrs = Object.keys(rule.attributes || {}).join(" ");
  const custom = Object.keys(rule.custom || {}).join(" ");
  const overrides = Object.entries(rule.classOverrides || {}).map(([className, value]) =>
    `${className} ${weaponRuleSearchText(value)}`
  ).join(" ");

  return `${rule.label || ""} ${rule.sourceKey || ""} ${attrs} ${custom} ${overrides}`;
}

function weaponMatchesClass(weapon, classFilter){
  if(classFilter === "all") return true;
  if(classFilter === "Multi-class"){
    return String(weapon.class || "").includes("/") || weapon.class === "Multi-class";
  }
  return String(weapon.class || "").split(" / ").includes(classFilter);
}

function renderWeapons(){
  const q = weaponSearchQuery.toLowerCase().trim();

  const list = weapons.filter(w => {
    const changeText = (w.ff2Changes || []).map(weaponRuleSearchText).join(" ");
    const text = `
      ${w.name || ""}
      ${w.classname || ""}
      ${w.class || ""}
      ${w.slot || ""}
      ${(w.defindexes || []).join(" ")}
      ${changeText}
    `.toLowerCase();

    return weaponMatchesClass(w, weaponClassFilter) && text.includes(q);
  });

  const counter = document.querySelector("#weapon-result-count");
  if(counter) counter.textContent = list.length;

  document.querySelector("#weapon-list").innerHTML = list.map(w => {
    const rules = w.ff2Changes || [];
    const itemRule = rules.find(rule => rule.source === "item");
    const classnameRule = rules.find(rule => rule.source === "classname");

    return `
      <article class="item-card weapon-card">
        ${w.image ? `<img class="item-img" src="${escapeAttr(w.image)}" alt="${escapeAttr(w.name)}" onerror="this.style.display='none'">` : ""}

        <div class="weapon-card-head">
          <div>
            <h3>${escapeHtml(w.name)}</h3>
            <p>${escapeHtml(w.class || "Unknown class")}${w.slot ? ` · ${escapeHtml(w.slot)}` : ""}</p>
          </div>
          ${w.changeCount ? `<span class="weapon-count-badge">${escapeHtml(w.changeCount)} changes</span>` : ""}
        </div>

        ${w.classname ? `<code class="weapon-classname">${escapeHtml(w.classname)}</code>` : ""}

        <div class="weapon-badges">
          ${(w.defindexes || []).length ? `<span class="tag">Item #${w.defindexes.map(escapeHtml).join(", #")}</span>` : ""}
          ${classnameRule ? `<span class="tag shared-rule-tag">Shared classname rule</span>` : ""}
          ${itemRule?.strip || classnameRule?.strip ? `<span class="tag warning-tag">Defaults stripped</span>` : ""}
          ${itemRule?.clip !== undefined ? `<span class="tag">Clip: ${escapeHtml(itemRule.clip)}</span>` : ""}
        </div>

        ${rules.length ? `
          <details class="weapon-details">
            <summary>Show FF2 changes</summary>
            <div class="weapon-details-body">
              ${rules.map(renderWeaponRule).join("")}
            </div>
          </details>
        ` : `<p class="weapon-no-change">No FF2 override data in the imported config.</p>`}
      </article>
    `;
  }).join("") || `<div class="empty-state">No weapons match the current filters.</div>`;
}

function renderWeaponRule(rule){
  const title = rule.source === "item"
    ? (rule.label || "Item-specific rule")
    : "Shared classname rule";

  const source = rule.source === "classname"
    ? (rule.sourceKey || rule.label || "")
    : (rule.sourceKey ? `Indexes: ${rule.sourceKey}` : "");

  return `
    <section class="weapon-rule ${rule.source === "classname" ? "classname-rule" : "item-rule"}">
      <div class="weapon-rule-head">
        <div>
          <strong>${escapeHtml(title)}</strong>
          ${source ? `<code>${escapeHtml(source)}</code>` : ""}
        </div>
        <span>${escapeHtml(ruleChangeCount(rule))} changes</span>
      </div>

      ${renderRuleFlags(rule)}
      ${renderAttributeGroup("Standard attributes", rule.attributes, false)}
      ${renderAttributeGroup("FF2 custom attributes", rule.custom, true)}

      ${Object.keys(rule.classOverrides || {}).length ? `
        <div class="class-override-list">
          <div class="rule-group-title">Class overrides</div>
          ${Object.entries(rule.classOverrides).map(([className, override]) => `
            <div class="class-override">
              <strong>${escapeHtml(className)}</strong>
              ${renderRuleFlags(override)}
              ${renderAttributeGroup("Standard attributes", override.attributes, false)}
              ${renderAttributeGroup("FF2 custom attributes", override.custom, true)}
            </div>
          `).join("")}
        </div>
      ` : ""}
    </section>
  `;
}

function renderRuleFlags(rule){
  const flags = [];
  if(rule.strip !== undefined){
    flags.push(`<span class="rule-flag ${rule.strip ? "danger" : ""}">Strip defaults: ${rule.strip ? "Yes" : "No"}</span>`);
  }
  if(rule.clip !== undefined){
    flags.push(`<span class="rule-flag">Clip: ${escapeHtml(rule.clip)}</span>`);
  }
  return flags.length ? `<div class="rule-flags">${flags.join("")}</div>` : "";
}

function renderAttributeGroup(title, attributes, custom){
  if(!attributes || !Object.keys(attributes).length) return "";

  return `
    <div class="attribute-group ${custom ? "custom-attributes" : ""}">
      <div class="rule-group-title">${escapeHtml(title)}</div>

      <div class="attribute-list">
        ${Object.entries(attributes).map(([name, value]) => `
          <div class="attribute-row">
            <span title="${escapeAttr(name)}">${escapeHtml(prettyWeaponAttribute(name))}</span>
            <code>${escapeHtml(value)}</code>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function ruleChangeCount(rule){
  let total = Object.keys(rule.attributes || {}).length + Object.keys(rule.custom || {}).length;
  if(rule.strip !== undefined) total++;
  if(rule.clip !== undefined) total++;
  Object.values(rule.classOverrides || {}).forEach(override => {
    total += ruleChangeCount(override);
  });
  return total;
}

function prettyWeaponAttribute(name){
  return String(name || "")
    .replace(/_/g, " ")
    .replace(/\bSRifle\b/gi, "Sniper Rifle")
    .replace(/\bdmg\b/gi, "damage")
    .replace(/\bwep\b/gi, "weapon")
    .replace(/\bmod\b/gi, "modifier")
    .replace(/\bmaxammo\b/gi, "max ammo")
    .replace(/\bminicrits\b/gi, "mini-crits")
    .replace(/\bcrits\b/gi, "crits")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());
}

function abilityName(ability){
  if(typeof ability === "string") return ability;
  return ability?.name || ability?.id || "Ability";
}

function creatorName(creator){
  if(typeof creator === "string") return creator;
  return creator?.name || "";
}

function bossFormula(value){
  if(value === undefined || value === null || value === "") return "Not specified";

  return String(value)
    .replace(/\bn\b/gi, "players")
    .replace(/\*/g, " × ");
}

function bossWeaponSearchText(weapon){
  if(!weapon) return "";

  return `
    ${weapon.name || ""}
    ${weapon.type || ""}
    ${weapon.index || ""}
    ${Object.keys(weapon.attributes || {}).join(" ")}
    ${Object.values(weapon.attributes || {}).join(" ")}
  `;
}

function bossAbilitySearchText(ability){
  if(!ability) return "";
  if(typeof ability === "string") return ability;

  return `
    ${ability.name || ""}
    ${ability.id || ""}
    ${ability.description || ""}
    ${Object.entries(ability)
      .filter(([key]) => !["name", "id", "description"].includes(key))
      .map(([key, value]) => `${key} ${value}`)
      .join(" ")}
  `;
}

const expandedBossCards = new Set();

function bossCardId(boss, index){
  return String(boss.id || boss.name || `boss-${index}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function renderBosses(query = ""){
  const q = query.toLowerCase().trim();

  const list = bosses.filter(b => {
    const abilities = (b.abilities || []).map(bossAbilitySearchText).join(" ");
    const creators = (b.creators || []).map(creatorName).join(" ");
    const normalWeapons = (b.weapons || []).map(bossWeaponSearchText).join(" ");
    const rageAbilities = (b.rage?.abilities || []).map(bossAbilitySearchText).join(" ");
    const rageWeapon = bossWeaponSearchText(b.rage?.weapon);

    return `
      ${b.name || ""}
      ${b.class || ""}
      ${b.description || ""}
      ${b.healthFormula || ""}
      ${b.rageDamageFormula || ""}
      ${b.maxSpeed || ""}
      ${abilities}
      ${creators}
      ${normalWeapons}
      ${b.rage?.description || ""}
      ${rageAbilities}
      ${rageWeapon}
    `.toLowerCase().includes(q);
  });

  document.querySelector("#boss-list").innerHTML = list.map((b, index) => {
    const creators = (b.creators || []).map(creatorName).filter(Boolean);
    const mobility = (b.abilities || []).map(abilityName).filter(Boolean);
    const rageAbilities = (b.rage?.abilities || []).map(abilityName).filter(Boolean);
    const normalWeapons = b.weapons || [];
    const rageWeapon = b.rage?.weapon || null;
    const cardId = bossCardId(b, index);
    const expanded = expandedBossCards.has(cardId);

    return `
      <article class="item-card boss-card boss-card-detailed ${expanded ? "boss-open" : "boss-collapsed"}">
        ${b.image ? `<img class="item-img" src="${escapeAttr(b.image)}" alt="${escapeAttr(b.name)}" onerror="this.style.display='none'">` : ""}

        <button
          class="boss-title-toggle"
          type="button"
          data-boss-toggle="${escapeAttr(cardId)}"
          aria-expanded="${expanded ? "true" : "false"}"
        >
          <span class="boss-title-copy">
            <strong class="boss-title-name">${escapeHtml(b.name)}</strong>
            <span class="boss-class">${escapeHtml(b.class || "Boss")}</span>
          </span>

          <span class="boss-title-action">
            <span class="boss-toggle-label">${expanded ? "Hide details" : "View details"}</span>
            <span class="boss-toggle-indicator" aria-hidden="true">${expanded ? "−" : "+"}</span>
          </span>
        </button>

        <p class="boss-description">${escapeHtml(b.description || "No description yet.")}</p>

        <div class="boss-collapsible ${expanded ? "" : "hidden"}">
          <div class="boss-info-grid">
            <section class="boss-info-box">
              <div class="boss-info-title">Health / Rage Damage</div>

              <div class="boss-stat-line">
                <span>Health</span>
                <code>${escapeHtml(bossFormula(b.healthFormula))}</code>
              </div>

              <div class="boss-stat-line">
                <span>Rage damage</span>
                <code>${escapeHtml(bossFormula(b.rageDamageFormula))}</code>
              </div>

              ${(b.healthFormula || b.rageDamageFormula) ? `<small>players = current player count</small>` : ""}
            </section>

            <section class="boss-info-box">
              <div class="boss-info-title">Move Speed</div>
              <strong class="boss-big-value">${b.maxSpeed ? `${escapeHtml(b.maxSpeed)} HU/s` : "Not specified"}</strong>
            </section>

            <section class="boss-info-box">
              <div class="boss-info-title">Mobility</div>
              <div class="boss-mini-list">
                ${mobility.length
                  ? mobility.map(name => `<span>${escapeHtml(name)}</span>`).join("")
                  : `<span class="boss-none">None listed</span>`}
              </div>
            </section>

            <section class="boss-info-box">
              <div class="boss-info-title">Rage</div>
              <div class="boss-mini-list">
                ${rageAbilities.map(name => `<span>${escapeHtml(name)}</span>`).join("")}
                ${rageWeapon?.name ? `<span>Weapon: ${escapeHtml(rageWeapon.name)}</span>` : ""}
                ${!rageAbilities.length && !rageWeapon?.name ? `<span class="boss-none">None listed</span>` : ""}
              </div>
            </section>
          </div>

          ${(normalWeapons.length || rageWeapon) ? `
            <div class="boss-weapons">
              <div class="boss-section-title">Weapon Attributes</div>

              ${normalWeapons.map((weapon, weaponIndex) =>
                renderBossWeapon(weapon, weapon.type || `Weapon ${weaponIndex + 1}`)
              ).join("")}

              ${rageWeapon ? renderBossWeapon(rageWeapon, rageWeapon.name ? `Rage Weapon · ${rageWeapon.name}` : "Rage Weapon") : ""}
            </div>
          ` : ""}

          ${b.rage?.description ? `
            <div class="boss-rage-note">
              <strong>How to use Rage</strong>
              <span>${escapeHtml(b.rage.description)}</span>
            </div>
          ` : ""}

          ${creators.length ? `<p class="boss-creators">Created by ${creators.map(escapeHtml).join(", ")}</p>` : ""}
        </div>
      </article>
    `;
  }).join("") || `<div class="empty-state">No bosses found.</div>`;
}

function renderBossWeapon(weapon, title){
  if(!weapon) return "";

  const attributes = weapon.attributes || {};
  const meta = [];

  if(weapon.index !== undefined) meta.push(`Item #${escapeHtml(weapon.index)}`);
  if(weapon.type && !String(title).toLowerCase().includes(String(weapon.type).toLowerCase())){
    meta.push(escapeHtml(weapon.type));
  }
  if(weapon.maxAmmo !== undefined) meta.push(`Max ammo: ${escapeHtml(weapon.maxAmmo)}`);

  return `
    <section class="boss-weapon-card">
      <div class="boss-weapon-head">
        <strong>${escapeHtml(title || weapon.name || "Weapon")}</strong>
        ${meta.length ? `<span>${meta.join(" · ")}</span>` : ""}
      </div>

      ${Object.keys(attributes).length ? `
        <div class="boss-attribute-list">
          ${Object.entries(attributes).map(([name, value]) => `
            <div class="boss-attribute-row">
              <span title="${escapeAttr(name)}">${escapeHtml(prettyWeaponAttribute(name))}</span>
              <code>${escapeHtml(value)}</code>
            </div>
          `).join("")}
        </div>
      ` : `<p class="boss-no-attributes">No custom weapon attributes listed.</p>`}
    </section>
  `;
}

function renderCommands(query = ""){
  const q = query.toLowerCase().trim();
  const list = commands.filter(c =>
    `${c.command || ""} ${c.title || ""} ${c.description || ""} ${c.category || ""}`
      .toLowerCase()
      .includes(q)
  );

  document.querySelector("#command-list").innerHTML = list.map(c => `
    <article class="command-card">
      <code>${escapeHtml(c.command)}</code>
      <div>
        <h3>${escapeHtml(c.title)}</h3>
        <p>${escapeHtml(c.description)}</p>
      </div>
      <span class="command-meta">${escapeHtml(c.category)}</span>
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
          <span class="change-type">${escapeHtml(entry.type)}</span>
          ${entry.status ? `<span class="change-type">${escapeHtml(entry.status)}</span>` : ""}
        </div>
        <time class="change-date" datetime="${escapeAttr(entry.date)}">${escapeHtml(formatDate(entry.date))}</time>
      </div>
      <h3>${escapeHtml(entry.title)}</h3>
      <p>${escapeHtml(entry.summary)}</p>
      ${entry.source ? `<a href="${escapeAttr(entry.source)}" target="_blank" rel="noreferrer">Forum source</a>` : ""}
    </article>
  `).join("") || `<div class="empty-state">No changelog entries in this category yet.</div>`;
}

document.querySelector("#weapon-search").addEventListener("input", e => {
  weaponSearchQuery = e.target.value;
  renderWeapons();
});

document.querySelector("#weapon-class-filter").addEventListener("change", e => {
  weaponClassFilter = e.target.value;
  renderWeapons();
});
document.querySelector("#boss-search").addEventListener("input", e => renderBosses(e.target.value));

document.querySelector("#boss-list").addEventListener("click", e => {
  const button = e.target.closest("[data-boss-toggle]");
  if(!button) return;

  const id = button.dataset.bossToggle;

  if(expandedBossCards.has(id)){
    expandedBossCards.delete(id);
  }else{
    expandedBossCards.add(id);
  }

  renderBosses(document.querySelector("#boss-search").value);
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

    const custom = items.reduce(
      (n, i) => n + i.blocks.reduce((m, b) => m + b.custom.length, 0),
      0
    );
    const official = items.reduce(
      (n, i) => n + i.blocks.reduce((m, b) => m + b.official.length, 0),
      0
    );

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
