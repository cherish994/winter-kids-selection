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
const sizeChartFiles = document.querySelector("#sizeChartFiles");
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
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs || 45000);
  try {
    const response = await fetch(`${SUPABASE_URL}${path}`, {
      ...options,
      signal: options.signal || controller.signal,
      headers: authHeaders(options.headers)
    });
    const type = response.headers.get("content-type") || "";
    const body = type.includes("application/json") ? await response.json().catch(() => ({})) : await response.text();
    if (!response.ok) throw new Error(body?.message || body?.error_description || body?.hint || "操作没有完成，请稍后重试。");
    return body;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("上传超过 45 秒仍未完成。请检查网络后重新选择这张图片。\n");
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
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

async function uploadOne(file, bucket, prefix) {
  const path = filePath(prefix, file);
  await request(`/storage/v1/object/${bucket}/${pathsafe(path)}`, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" },
    body: file
  });
  return { path, publicUrl: bucket === "product-public" ? publicImageUrl(path) : "" };
}

function renderUploadItems(items) {
  uploadList.innerHTML = items.map((item) => `<div class="upload-item">${item.previewUrl ? `<img src="${escapeHtml(item.previewUrl)}" alt="${escapeHtml(item.label)}" />` : ""}<div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.kind)}</small></div></div>`).join("");
}

async function uploadFiles(files, kind) {
  if (!files.length) return;
  const description = kind === "source" ? "快团团截图" : kind === "size" ? "尺码表" : "官方高清图";
  const unsupported = files.find((file) => !/^image\/(png|jpe?g|webp|heic|heif)$/i.test(file.type));
  const tooLarge = files.find((file) => file.size > 15 * 1024 * 1024);
  if (unsupported) {
    uploadNotice.textContent = `「${unsupported.name}」不是支持的图片格式。请使用 PNG、JPG、WebP 或 HEIC。`;
    return;
  }
  if (tooLarge) {
    uploadNotice.textContent = `「${tooLarge.name}」超过 15 MB，请压缩后再上传。`;
    return;
  }
  if (!session?.access_token) {
    uploadNotice.textContent = "登录状态已失效，请重新用店主邮箱登录后再上传。";
    return;
  }
  const localPreviews = files.map((file) => URL.createObjectURL(file));
  const items = files.map((file, index) => ({ label: file.name, kind: "等待上传", previewUrl: localPreviews[index] }));
  renderUploadItems(items);
  uploadNotice.textContent = `正在保存${description}…`;
  try {
    const batchPrefix = `batches/${new Date().toISOString().slice(0, 10)}`;
    const bucket = kind === "source" ? "product-private" : "product-public";
    const folder = kind === "source" ? "screenshots" : kind === "size" ? "size-charts" : "high-res";
    const results = [];
    for (const [index, file] of files.entries()) {
      items[index].kind = "正在上传…";
      renderUploadItems(items);
      uploadNotice.textContent = `正在保存${description}（${index + 1}/${files.length}）…`;
      const result = await uploadOne(file, bucket, `${batchPrefix}/${folder}`);
      results.push(result);
      items[index] = {
        label: result.path.split("/").pop(),
        kind: `${description}已保存`,
        previewUrl: result.publicUrl || localPreviews[index]
      };
      renderUploadItems(items);
    }
    if (kind === "high-res" && results[0]) document.querySelector("#coverImageUrl").value = results[0].publicUrl;
    if (kind === "size" && results[0]) document.querySelector("#sizeChartUrl").value = results[0].publicUrl;
    uploadNotice.textContent = `已保存 ${results.length} 张${description}${kind === "high-res" || kind === "size" ? "；第一张已带入商品卡" : ""}。`;
  } catch (error) {
    uploadNotice.textContent = `${error.message} 这张图没有保存，请重新选择后重试。`;
  }
}

sourceFiles.addEventListener("change", () => uploadFiles([...sourceFiles.files], "source"));
highResFiles.addEventListener("change", () => uploadFiles([...highResFiles.files], "high-res"));
sizeChartFiles.addEventListener("change", () => uploadFiles([...sizeChartFiles.files], "size"));
document.querySelector("#uploadButton").addEventListener("click", () => {
  uploadFiles([...sourceFiles.files], "source");
  uploadFiles([...highResFiles.files], "high-res");
  uploadFiles([...sizeChartFiles.files], "size");
});

document.querySelector("#importOfficialButton").addEventListener("click", async () => {
  const input = document.querySelector("#officialProductUrl");
  const button = document.querySelector("#importOfficialButton");
  const notice = document.querySelector("#importNotice");
  if (!input.value.trim()) {
    notice.textContent = "请先粘贴 OOTT BEBE 商品详情页链接。";
    return;
  }
  button.disabled = true;
  notice.textContent = "正在读取官网商品资料…";
  try {
    const imported = await request("/functions/v1/import-oottbebe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: input.value.trim() })
    });
    document.querySelector("#sku").value = imported.sku || "";
    document.querySelector("#brand").value = imported.brand || "OOTT BEBE";
    document.querySelector("#productName").value = imported.name || "";
    document.querySelector("#description").value = imported.description || "";
    if (imported.coverImageUrl) document.querySelector("#coverImageUrl").value = imported.coverImageUrl;
    notice.textContent = imported.imageWarning || "资料已带入商品卡；现在只需补充顾客售价和购买链接。";
    document.querySelector("#productForm").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    notice.textContent = error.message || "官网资料暂时无法读取。";
  } finally {
    button.disabled = false;
  }
});

function splitValues(value) {
  return value.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
}

document.querySelector("#productForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = event.submitter.dataset.status;
  const buttons = event.currentTarget.querySelectorAll("button[type=submit]");
  buttons.forEach((button) => { button.disabled = true; });
  productNotice.textContent = "正在保存商品…";
  const retailPrice = document.querySelector("#retailPrice").value;
  const purchaseUrl = document.querySelector("#purchaseUrl").value.trim();
  if (status === "published" && (!retailPrice || !purchaseUrl)) {
    productNotice.textContent = "发布前请填写顾客售价和购买链接。";
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
        retail_price: retailPrice === "" ? null : Number(retailPrice),
        purchase_url: purchaseUrl || null,
        description: document.querySelector("#description").value.trim() || null,
        cover_image_url: document.querySelector("#coverImageUrl").value.trim() || null,
        status,
        published_at: status === "published" ? new Date().toISOString() : null
      })
    });
    const saved = Array.isArray(product) ? product[0] : product;
    const sizeChartUrl = document.querySelector("#sizeChartUrl").value.trim();
    if (sizeChartUrl) {
      await request("/rest/v1/product_images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: saved.id,
          image_url: sizeChartUrl,
          alt_text: "尺码表",
          sort_order: 99
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
