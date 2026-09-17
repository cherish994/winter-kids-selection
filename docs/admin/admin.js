const SUPABASE_URL = "https://dqslxzroiffhxhacnzdg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_YJpsMmce6XnBd47XQ3GO2A_QsGGqLqs";
const SESSION_KEY = "winter-kids-admin-session";

const loginShell = document.querySelector("#loginShell");
const workspace = document.querySelector("#workspace");
const setupNote = document.querySelector("#setupNote");
const loginNotice = document.querySelector("#loginNotice");
const uploadNotice = document.querySelector("#uploadNotice");
const productNotice = document.querySelector("#productNotice");
const sourceFiles = document.querySelector("#sourceFiles");
const highResFiles = document.querySelector("#highResFiles");
const uploadList = document.querySelector("#uploadList");
let session = readSession();

function readSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
}

function saveSession(nextSession) {
  session = nextSession;
  localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
}

function clearSession() {
  session = null;
  localStorage.removeItem(SESSION_KEY);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[character]);
}

function authHeaders(extra = {}) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${session?.access_token || SUPABASE_PUBLISHABLE_KEY}`,
    ...extra
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: authHeaders(options.headers)
  });
  const type = response.headers.get("content-type") || "";
  const body = type.includes("application/json") ? await response.json().catch(() => ({})) : await response.text();
  if (!response.ok) throw new Error(body?.message || body?.error_description || body?.hint || "操作没有完成，请稍后重试。");
  return body;
}

function pathsafe(value) {
  return value.split("/").map(encodeURIComponent).join("/");
}

function filePath(prefix, file) {
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "image";
  return `${prefix}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;
}

function publicImageUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/product-public/${pathsafe(path)}`;
}

function captureMagicLinkSession() {
  const values = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = values.get("access_token");
  if (!accessToken) return;
  saveSession({
    access_token: accessToken,
    refresh_token: values.get("refresh_token"),
    expires_at: Date.now() + Number(values.get("expires_in") || 3600) * 1000
  });
  history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
}

async function getUser() {
  if (!session?.access_token) return null;
  try {
    return await request("/auth/v1/user");
  } catch {
    clearSession();
    return null;
  }
}

async function hasAdminAccess(userId) {
  const rows = await request(`/rest/v1/admin_users?select=user_id&user_id=eq.${encodeURIComponent(userId)}`);
  return Array.isArray(rows) && rows.length > 0;
}

function showLogin(message = "") {
  loginShell.hidden = false;
  workspace.hidden = true;
  document.querySelector("#logoutButton").hidden = true;
  document.querySelector("#adminIdentity").textContent = "店主后台";
  if (message) loginNotice.textContent = message;
}

function showSetup(user) {
  showLogin("登录成功，但还未开通店主权限。");
  setupNote.hidden = false;
  setupNote.innerHTML = `<strong>还差一次管理员开通</strong><p>请在 SQL Editor 运行 <code>002_admin_access.sql</code>，然后运行脚本末尾那行授权语句，并填入当前登录邮箱：<br><b>${escapeHtml(user.email || "")}</b></p><a href="https://github.com/cherish994/winter-kids-selection/blob/main/supabase/002_admin_access.sql" target="_blank" rel="noreferrer">打开管理员权限脚本 ↗</a>`;
}

function showWorkspace(user) {
  loginShell.hidden = true;
  setupNote.hidden = true;
  workspace.hidden = false;
  document.querySelector("#logoutButton").hidden = false;
  document.querySelector("#adminIdentity").textContent = user.email || "店主";
  loadCatalog();
}

async function initialise() {
  captureMagicLinkSession();
  const user = await getUser();
  if (!user) return showLogin();
  try {
    if (await hasAdminAccess(user.id)) showWorkspace(user);
    else showSetup(user);
  } catch {
    showLogin("管理员权限还未设置完成，请检查管理员权限脚本。");
  }
}

document.querySelector("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.querySelector("#loginEmail").value.trim();
  const button = event.submitter;
  button.disabled = true;
  loginNotice.textContent = "正在发送登录链接…";
  try {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    await request(`/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, create_user: true })
    });
    loginNotice.textContent = "登录链接已发送。请在邮箱中打开它，再回到这里继续。";
  } catch (error) {
    loginNotice.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#logoutButton").addEventListener("click", async () => {
  if (session?.access_token) {
    try { await request("/auth/v1/logout?scope=local", { method: "POST" }); } catch { /* local logout is sufficient */ }
  }
  clearSession();
  showLogin("已退出店主后台。");
});

function renderSelectedFiles() {
  const files = [...sourceFiles.files, ...highResFiles.files];
  uploadList.innerHTML = files.map((file) => `<div class="upload-item"><strong>${escapeHtml(file.name)}</strong><small>${Math.ceil(file.size / 1024)} KB · 等待上传</small></div>`).join("");
}

sourceFiles.addEventListener("change", renderSelectedFiles);
highResFiles.addEventListener("change", renderSelectedFiles);

async function uploadOne(file, bucket, prefix) {
  const path = filePath(prefix, file);
  await request(`/storage/v1/object/${bucket}/${pathsafe(path)}`, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" },
    body: file
  });
  return { path, publicUrl: bucket === "product-public" ? publicImageUrl(path) : "" };
}

document.querySelector("#uploadButton").addEventListener("click", async () => {
  const source = [...sourceFiles.files];
  const highRes = [...highResFiles.files];
  if (!source.length && !highRes.length) {
    uploadNotice.textContent = "请先选择截图或高清图。";
    return;
  }
  const button = document.querySelector("#uploadButton");
  button.disabled = true;
  uploadNotice.textContent = "正在上传素材…";
  try {
    const batchPrefix = `batches/${new Date().toISOString().slice(0, 10)}`;
    const sourceResults = [];
    const highResResults = [];
    for (const file of source) sourceResults.push(await uploadOne(file, "product-private", `${batchPrefix}/screenshots`));
    for (const file of highRes) highResResults.push(await uploadOne(file, "product-public", `${batchPrefix}/high-res`));
    if (sourceResults[0]) document.querySelector("#sourceScreenshotPath").value = sourceResults[0].path;
    if (highResResults[0]) document.querySelector("#coverImageUrl").value = highResResults[0].publicUrl;
    uploadList.innerHTML = [...sourceResults.map((result) => ({ label: result.path, kind: "内部截图已保存" })), ...highResResults.map((result) => ({ label: result.path, kind: "高清图已保存" }))]
      .map((item) => `<div class="upload-item"><strong>${escapeHtml(item.label.split("/").pop())}</strong><small>${item.kind}</small></div>`).join("");
    uploadNotice.textContent = `已上传 ${sourceResults.length + highResResults.length} 张素材；第一张已自动带入商品表单。`;
  } catch (error) {
    uploadNotice.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

function splitValues(value) {
  return value.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
}

function nullableNumber(value) {
  return value === "" ? null : Number(value);
}

document.querySelector("#productForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = event.submitter.dataset.status;
  const buttons = event.currentTarget.querySelectorAll("button[type=submit]");
  buttons.forEach((button) => { button.disabled = true; });
  productNotice.textContent = "正在保存商品…";
  const sourcePrice = document.querySelector("#sourcePrice").value;
  const commission = document.querySelector("#commission").value;
  if ((sourcePrice === "") !== (commission === "")) {
    productNotice.textContent = "内部来源售价和佣金请同时填写，或同时留空。";
    buttons.forEach((button) => { button.disabled = false; });
    return;
  }
  try {
    const product = await request("/rest/v1/products", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        sku: document.querySelector("#sku").value.trim(),
        brand: document.querySelector("#brand").value.trim(),
        name: document.querySelector("#productName").value.trim(),
        category: document.querySelector("#category").value,
        scenes: splitValues(document.querySelector("#scenes").value),
        age_groups: splitValues(document.querySelector("#ageGroups").value),
        height_min: nullableNumber(document.querySelector("#heightMin").value),
        height_max: nullableNumber(document.querySelector("#heightMax").value),
        retail_price: nullableNumber(document.querySelector("#retailPrice").value),
        purchase_url: document.querySelector("#purchaseUrl").value.trim() || null,
        description: document.querySelector("#description").value.trim() || null,
        cover_image_url: document.querySelector("#coverImageUrl").value.trim() || null,
        status,
        published_at: status === "published" ? new Date().toISOString() : null
      })
    });
    const saved = Array.isArray(product) ? product[0] : product;
    if (sourcePrice !== "") {
      await request("/rest/v1/product_sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: saved.id,
          source_screenshot_path: document.querySelector("#sourceScreenshotPath").value.trim() || null,
          ktt_sale_price: Number(sourcePrice),
          affiliate_commission: Number(commission)
        })
      });
    }
    productNotice.textContent = status === "published" ? "已发布，顾客端将在刷新后看到它。" : "已保存到待审核商品。";
    event.currentTarget.reset();
    document.querySelector("#brand").value = "ROTOTO BEBE";
    loadCatalog();
  } catch (error) {
    productNotice.textContent = error.message;
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
  }
});

async function loadCatalog() {
  const list = document.querySelector("#catalogList");
  list.innerHTML = `<p class="empty">正在读取本季商品…</p>`;
  try {
    const rows = await request("/rest/v1/products?select=sku,brand,name,status,retail_price,published_at,product_sources(actual_cost)&order=created_at.desc");
    if (!rows.length) {
      list.innerHTML = `<p class="empty">还没有商品。先上传素材，再建立第一张商品卡。</p>`;
      return;
    }
    list.innerHTML = rows.map((product) => {
      const source = Array.isArray(product.product_sources) ? product.product_sources[0] : product.product_sources;
      const cost = source?.actual_cost == null ? "未录入" : `¥${Number(source.actual_cost).toFixed(2)}`;
      const price = product.retail_price == null ? "未定价" : `¥${Number(product.retail_price).toFixed(0)}`;
      return `<div class="catalog-row"><small>${escapeHtml(product.sku)}</small><div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.brand)}</small></div><span class="status ${product.status === "published" ? "published" : ""}">${product.status === "published" ? "已发布" : "待审核"}</span><small class="hide-mobile">${price}</small><small class="hide-mobile">内部成本 ${cost}</small></div>`;
    }).join("");
  } catch (error) {
    list.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
  }
}

document.querySelector("#refreshButton").addEventListener("click", loadCatalog);
initialise();
