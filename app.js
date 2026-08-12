import { parseKeyValues, extractItems } from "./parser/cfg-parser.js";

const [weapons, bosses, commands, changelog] = await Promise.all([
  fetch("./data/weapons.json").then(r => r.json()),
  fetch("./data/bosses.json").then(r => r.json()),
  fetch("./data/commands.json").then(r => r.json()),
  fetch("./data/changelog.json").then(r => r.json())
]);

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

function renderBosses(query = ""){
  const q = query.toLowerCase().trim();
  const list = bosses.filter(b =>
    `${b.name} ${b.author || ""} ${b.description || ""} ${(b.abilities || []).join(" ")}`
      .toLowerCase()
      .includes(q)
  );

  document.querySelector("#boss-list").innerHTML = list.map(b => `
    <article class="item-card">
      ${b.image ? `<img class="item-img" src="${escapeAttr(b.image)}" alt="${escapeAttr(b.name)}" onerror="this.style.display='none'">` : ""}
      <h3>${escapeHtml(b.name)}</h3>
      <p>${escapeHtml(b.description || "No description yet.")}</p>
      ${b.author ? `<span class="tag">By ${escapeHtml(b.author)}</span>` : ""}
      ${(b.abilities || []).slice(0, 5).map(a => `<span class="tag">${escapeHtml(a)}</span>`).join("")}
    </article>
  `).join("") || `<div class="empty-state">No bosses found.</div>`;
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
document.querySelector("#boss-search").addEventListener("input", e => renderBosses(e.target.value));
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
