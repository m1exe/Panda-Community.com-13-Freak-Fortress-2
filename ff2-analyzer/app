import { parseKeyValues, extractItems } from "./parser/cfg-parser.js";

const weapons = await fetch("./data/weapons.json").then(r => r.json());
const bosses = await fetch("./data/bosses.json").then(r => r.json());

const views = [...document.querySelectorAll(".view")];
function showView(id){
  views.forEach(v=>v.classList.toggle("active",v.id===id));
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===id));
  window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
document.querySelectorAll("[data-view-link]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.viewLink)));

function renderWeapons(query=""){
  const q=query.toLowerCase();
  const list=weapons.filter(w=>`${w.name} ${w.classname} ${w.class}`.toLowerCase().includes(q));
  document.querySelector("#weapon-list").innerHTML=list.map(w=>`
    <article class="item-card">
      ${w.image ? `<img class="item-img" src="${w.image}" alt="" onerror="this.style.display='none'">` : ""}
      <h3>${escapeHtml(w.name)}</h3>
      <p>${escapeHtml(w.class)} · ${escapeHtml(w.slot)}</p>
      <span class="tag">${escapeHtml(w.classname)}</span>
      ${w.ff2 ? `<span class="tag">FF2</span>` : ""}
    </article>`).join("") || `<p>No weapons found.</p>`;
}
function renderBosses(query=""){
  const q=query.toLowerCase();
  const list=bosses.filter(b=>`${b.name} ${b.author} ${b.description}`.toLowerCase().includes(q));
  document.querySelector("#boss-list").innerHTML=list.map(b=>`
    <article class="item-card">
      ${b.image ? `<img class="item-img" src="${b.image}" alt="" onerror="this.style.display='none'">` : ""}
      <h3>${escapeHtml(b.name)}</h3>
      <p>${escapeHtml(b.description||"No description yet.")}</p>
      ${b.author ? `<span class="tag">By ${escapeHtml(b.author)}</span>` : ""}
      ${(b.abilities||[]).slice(0,4).map(a=>`<span class="tag">${escapeHtml(a)}</span>`).join("")}
    </article>`).join("") || `<p>No bosses found.</p>`;
}
document.querySelector("#weapon-search").addEventListener("input",e=>renderWeapons(e.target.value));
document.querySelector("#boss-search").addEventListener("input",e=>renderBosses(e.target.value));

const fileInput=document.querySelector("#cfg-file"), drop=document.querySelector("#dropzone"), output=document.querySelector("#analysis-output");
fileInput.addEventListener("change",e=>e.target.files[0]&&analyze(e.target.files[0]));
["dragenter","dragover"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add("drag")}));
["dragleave","drop"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove("drag")}));
drop.addEventListener("drop",e=>e.dataTransfer.files[0]&&analyze(e.dataTransfer.files[0]));

async function analyze(file){
  output.classList.remove("hidden");
  output.innerHTML="<div class='result'><h3>Parsing…</h3><p>Please wait.</p></div>";
  try{
    const text=await file.text();
    const root=parseKeyValues(text);
    const items=extractItems(root);
    const custom=items.reduce((n,i)=>n+i.blocks.reduce((m,b)=>m+b.custom.length,0),0);
    const official=items.reduce((n,i)=>n+i.blocks.reduce((m,b)=>m+b.official.length,0),0);
    output.innerHTML=`
      <div class="summary">
        <div class="stat"><b>${items.length}</b><span>Parsed items</span></div>
        <div class="stat"><b>${official}</b><span>Official attributes</span></div>
        <div class="stat"><b>${custom}</b><span>Custom / FF2 attributes</span></div>
        <div class="stat"><b>${items.filter(i=>i.blocks.some(b=>b.className)).length}</b><span>Class overrides</span></div>
      </div>
      ${items.map(i=>`
        <article class="result">
          <h3>${escapeHtml(i.name||i.id)}</h3>
          <p>${escapeHtml(i.id)}</p>
          ${i.blocks.map(b=>`
            <div><strong>${b.className ? escapeHtml(b.className) : "Default"}</strong>
            <pre>${escapeHtml([...b.official.map(x=>x.key+": "+x.value),...b.custom.map(x=>x.key+": "+x.value)].join("\\n"))}</pre></div>
          `).join("")}
        </article>`).join("")}`;
  }catch(err){
    output.innerHTML=`<div class="result"><h3>Could not parse file</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
renderWeapons(); renderBosses();