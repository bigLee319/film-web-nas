const base = "http://192.168.x.x:3980"
let authKey = "", rollId = "", assetId = "", type = 1

async function api(u, o = {}) {
  o.headers = { ...o.headers, "X-Key": authKey }
  const r = await fetch(base + u, o)
  if (r.status === 401) { alert("请登录"); showLogin(); throw new Error() }
  return r
}

function hideAll() { document.querySelectorAll(".panel").forEach(p => p.classList.add("hidden")) }
function showLogin() { document.getElementById("login").classList.remove("hidden") }

function login() {
  authKey = document.getElementById("key").value
  document.getElementById("login").classList.add("hidden")
  document.querySelectorAll("header,.section").forEach(e => e.classList.remove("hidden"))
  loadRolls()
}

async function loadRolls() {
  const r = await api("/roll/list")
  const list = await r.json()
  document.getElementById("rolls").innerHTML = list.map(i => `
    <div class="roll" onclick="openRoll('${i.id}')">${i.brand} ${i.model} ${i.shoot_date||''}</div>
  `).join('')
}

function showAddRoll() { hideAll(); document.getElementById("addRoll").classList.remove("hidden") }
async function addRoll() {
  await api("/roll/add", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      brand: document.getElementById("brand").value,
      model: document.getElementById("model").value,
      iso: document.getElementById("iso").value,
      camera_name: document.getElementById("camera").value,
      shoot_date: document.getElementById("shootDate").value,
      shoot_location: document.getElementById("loc").value,
      develop_date: document.getElementById("devDate").value,
      develop_lab: document.getElementById("lab").value,
      scan_device: document.getElementById("scan").value,
      notes: document.getElementById("note").value
    })
  })
  hideAll(); loadRolls()
}

async function openRoll(id) {
  rollId = id; hideAll();
  document.getElementById("detail").classList.remove("hidden")
  load(1)
}

async function load(t) {
  type = t
  const r = await api(`/asset/list?roll_id=${rollId}&type=${t}`)
  const list = await r.json()
  document.getElementById("grid").innerHTML = list.map(i => `
    <img src="${base}/${i.url}" onclick="preview('${i.id}')">
  `).join('')
}

function showUpload() { hideAll(); document.getElementById("upload").classList.remove("hidden") }
async function upload() {
  const files = document.getElementById("files").files
  const t = document.getElementById("t").value
  const fn = document.getElementById("fn").value
  const st = document.getElementById("st").value
  const loc = document.getElementById("sloc").value
  for (const f of files) {
    const fd = new FormData()
    fd.append("file", f)
    fd.append("roll_id", rollId)
    fd.append("type", t)
    fd.append("frame_number", fn)
    fd.append("shoot_time", st)
    fd.append("location", loc)
    await api("/asset/upload", { method: "POST", body: fd })
  }
  alert("上传完成")
  hideAll(); load(type)
}

async function preview(id) {
  assetId = id; hideAll();
  document.getElementById("preview").classList.remove("hidden")
  const r1 = await api(`/asset/list?roll_id=${rollId}&type=1`)
  const r2 = await api(`/asset/list?roll_id=${rollId}&type=2`)
  const all = [...await r1.json(), ...await r2.json()]
  const a = all.find(x => x.id === id)
  document.getElementById("pImg").src = base + "/" + a.url
  document.getElementById("pInfo").innerText = `${a.type == 1 ? "底片" : "扫描"} 帧${a.frame_number || "-"}`
}

async function goBind() {
  const r1 = await api(`/asset/list?roll_id=${rollId}&type=1`)
  const r2 = await api(`/asset/list?roll_id=${rollId}&type=2`)
  const all = [...await r1.json(), ...await r2.json()]
  const a = all.find(x => x.id === assetId)
  if (!a?.bind_id) return alert("未绑定")
  preview(a.bind_id)
}

async function doBind() {
  const tar = prompt("输入目标图片ID")
  if (!tar) return
  await api("/asset/bind", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from: assetId, to: tar })
  })
  alert("绑定成功")
}

async function unBind() {
  await api("/asset/unbind", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: assetId })
  })
  alert("已解绑")
}

async function reName() {
  const n = prompt("新名称")
  if (!n) return
  await api("/asset/rename", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: assetId, name: n })
  })
  alert("已修改")
}

async function delAsset() {
  await api("/asset/del", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: assetId })
  })
  alert("已删除")
  hideAll(); load(type)
}

async function delRoll() {
  if (!confirm("删除整卷？")) return
  await api("/roll/del", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: rollId })
  })
  alert("已删除")
  hideAll(); loadRolls()
}

function save() {
  const a = document.createElement("a")
  a.href = document.getElementById("pImg").src
  a.download = ""
  a.click()
}

async function exportBackup() {
  const a = document.createElement("a")
  a.href = base + "/backup/export"
  a.download = "film-backup.json"
  a.click()
}

async function importBackup(el) {
  const f = el.files[0]
  if (!f) return
  const rd = new FileReader()
  rd.onload = async e => {
    try {
      await api("/backup/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: e.target.result
      })
      alert("恢复成功，刷新页面")
      location.reload()
    } catch (e) { alert("失败") }
  }
  rd.readAsText(f)
}

hideAll(); showLogin();
