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
const PRODUCT_QUEUE_KEY = "winter-kids-product-queue";
const BRAND_SETTINGS_KEY = "winter-kids-brand-settings";
let session = readSession();
let productQueue = readProductQueue();
let brandSettings = readBrandSettings();

function readSession() {
  try {
    const stored = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (!stored) return null;
    const expiresAt = Number(stored.expires_at || 0);
    return expiresAt > 0 && expiresAt <= 1e12
      ? { ...stored, expires_at: expiresAt * 1000 }
      : stored;
  } catch { return null; }
}

function saveSession(nextSession) {
  const rawExpiry = Number(nextSession?.expires_at || 0);
  const expiresAt = rawExpiry > 1e12
    ? rawExpiry
    : rawExpiry > 0
      ? rawExpiry * 1000
      : Date.now() + Number(nextSession?.expires_in || 3600) * 1000;
  session = { ...nextSession, expires_at: expiresAt };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  session = null;
  localStorage.removeItem(SESSION_KEY);
}

function automaticSku() {
  const now = new Date();
  const date = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `WK-${date}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
}

function readProductQueue() {
  try {
    const saved = JSON.parse(localStorage.getItem(PRODUCT_QUEUE_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter((item) => item && item.coverImageUrl).map((item) => ({ ...item, brand: item.brand || "ROTOTO BEBE", matched: item.matched === true, categoryAuto: item.categoryAuto !== false })) : [];
  } catch { return []; }
}

function saveProductQueue() {
  localStorage.setItem(PRODUCT_QUEUE_KEY, JSON.stringify(productQueue));
}

function readBrandSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(BRAND_SETTINGS_KEY) || "{}");
    if (saved && typeof saved === "object" && Object.keys(saved).length) return saved;
  } catch { /* fall through to the previous one-brand setting */ }
  const legacyLink = localStorage.getItem("winter-kids-brand-purchase-url") || "";
  return legacyLink ? { "ROTOTO BEBE": legacyLink } : {};
}

function saveBrandSettings() {
  localStorage.setItem(BRAND_SETTINGS_KEY, JSON.stringify(brandSettings));
}

function activeBrand() {
  return document.querySelector("#activeBrand")?.value.trim() || "ROTOTO BEBE";
}

function sharedPurchaseUrl() {
  return brandSettings[activeBrand()] || "";
}

function productNameFromFile(fileName) {
  const name = fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim();
  return name && !/^image\b/i.test(name) ? name : "待命名冬季单品";
}

function suggestCategory(value = "") {
  const text = String(value).toLowerCase();
  if (/(vest|조끼|马甲|背心)/i.test(text)) return "马甲";
  if (/(jacket|coat|outer|fleece|jumper|점퍼|자켓|코트|아우터|外套|夹克|摇粒绒)/i.test(text)) return "外套";
  if (/(set|two[ -]?piece|上下|套装|세트)/i.test(text)) return "套装";
  if (/(pajama|sleep|homewear|home wear|lounge|실내|내의|잠옷|家居|居家|睡衣)/i.test(text)) return "居家服";
  return "冬季单品";
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

async function refreshSessionIfNeeded() {
  const expiresAt = Number(session?.expires_at || 0);
  if (!session?.refresh_token || (expiresAt && expiresAt > Date.now() + 60_000)) return;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ refresh_token: session.refresh_token })
  });
  const nextSession = await response.json().catch(() => ({}));
  if (!response.ok || !nextSession?.access_token) {
    clearSession();
    throw new Error("登录状态已过期，请重新登录后再设置密码。");
  }
  saveSession(nextSession);
}

async function request(path, options = {}) {
  await refreshSessionIfNeeded();
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
    if (!response.ok) {
      throw new Error(
        body?.message ||
        body?.msg ||
        body?.error_description ||
        body?.hint ||
        (typeof body === "string" && body.trim()) ||
        `操作没有完成（状态 ${response.status}），请稍后重试。`
      );
    }
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

function todayBatchFolder(folder) {
  return `batches/${new Date().toISOString().slice(0, 10)}/${folder}`;
}

async function listStoredImages(folder) {
  const prefix = todayBatchFolder(folder);
  const objects = await request("/storage/v1/object/list/product-public", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, limit: 100, offset: 0, sortBy: { column: "created_at", order: "asc" } })
  });
  return Array.isArray(objects) ? objects.map((object) => {
    const path = object.name.includes("/") ? object.name : `${prefix}/${object.name}`;
    return { path, publicUrl: publicImageUrl(path) };
  }).filter((object) => /\.(png|jpe?g|webp|heic|heif)$/i.test(object.path)) : [];
}

async function restoreTodayProductQueue() {
  if (!session?.access_token) return;
  try {
    const [storedHighRes, storedSizeCharts] = await Promise.all([listStoredImages("high-res"), listStoredImages("size-charts")]);
    const queuedUrls = new Set(productQueue.map((item) => item.coverImageUrl));
    const defaultSizeChart = storedSizeCharts.at(-1)?.publicUrl || "";
    const recovered = storedHighRes.filter((item) => !queuedUrls.has(item.publicUrl));
    if (!recovered.length) return;
    productQueue.push(...recovered.map((item) => ({
      id: crypto.randomUUID(),
      sku: automaticSku(),
      brand: activeBrand(),
      name: productNameFromFile(item.path.split("/").pop()),
      category: suggestCategory(item.path.split("/").pop()),
      categoryAuto: true,
      retailPrice: "",
      purchaseUrl: sharedPurchaseUrl(),
      coverImageUrl: item.publicUrl,
      sizeChartUrl: defaultSizeChart,
      matched: false
    })));
    if (defaultSizeChart) document.querySelector("#sizeChartUrl").value = defaultSizeChart;
    saveProductQueue();
    renderProductQueue();
    document.querySelector("#queueNotice").textContent = `已找回今天上传的 ${recovered.length} 张高清图，已放入待匹配素材。`;
  } catch {
    // The queue remains usable when listing a storage folder is not available for this role.
  }
}

function authCallbackValue(name) {
  const hashValues = new URLSearchParams(window.location.hash.slice(1));
  const queryValues = new URLSearchParams(window.location.search);
  return hashValues.get(name) || queryValues.get(name) || "";
}

function clearAuthCallbackUrl() {
  history.replaceState({}, document.title, window.location.pathname);
}

async function captureMagicLinkSession() {
  // Supabase normally returns credentials in the URL fragment. Some mail apps
  // preserve them as query parameters instead, so accept either form.
  const accessToken = authCallbackValue("access_token");
  if (accessToken) {
    saveSession({
      access_token: accessToken,
      refresh_token: authCallbackValue("refresh_token"),
      expires_at: Date.now() + Number(authCallbackValue("expires_in") || 3600) * 1000
    });
    clearAuthCallbackUrl();
    return "";
  }

  // This also supports a future token-hash email template without exposing the
  // confirmation token in browser history after it has been redeemed.
  const tokenHash = authCallbackValue("token_hash");
  const tokenType = authCallbackValue("type");
  if (tokenHash && tokenType) {
    const authSession = await request("/auth/v1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token_hash: tokenHash, type: tokenType })
    });
    if (!authSession?.access_token) throw new Error("登录链接未能换取登录会话，请重新发送一封新链接。");
    saveSession(authSession);
    clearAuthCallbackUrl();
    return "";
  }

  const callbackError = authCallbackValue("error_description") || authCallbackValue("error");
  if (callbackError) {
    clearAuthCallbackUrl();
    return `登录链接未生效：${callbackError}。请重新发送一封新链接。`;
  }
  return "";
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
  document.querySelector("#passwordSettingsForm").hidden = true;
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
  restoreTodayProductQueue();
  loadCatalog();
}

async function initialise() {
  let callbackMessage = "";
  try {
    callbackMessage = await captureMagicLinkSession();
  } catch (error) {
    callbackMessage = error.message || "登录链接未能完成验证，请重新发送一封新链接。";
  }
  const user = await getUser();
  if (!user) return showLogin(callbackMessage);
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
  const password = document.querySelector("#loginPassword").value;
  const mode = event.submitter?.dataset.loginMode || "password";
  const button = event.submitter;
  button.disabled = true;
  loginNotice.textContent = mode === "magic" ? "正在发送登录链接…" : "正在验证密码…";
  try {
    if (mode === "magic") {
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      await request(`/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, create_user: true })
      });
      loginNotice.textContent = "登录链接已发送。请在邮箱中打开它，再回到这里继续。";
      return;
    }
    if (password.length < 8) throw new Error("请输入至少 8 位的密码；首次使用可先发送邮箱登录链接。");
    const authSession = await request("/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!authSession?.access_token) throw new Error("未能完成密码登录，请改用邮箱登录链接。" );
    saveSession(authSession);
    document.querySelector("#loginPassword").value = "";
    await initialise();
  } catch (error) {
    loginNotice.textContent = error.message === "Invalid login credentials" ? "邮箱或密码不正确；首次使用可先发送邮箱登录链接。" : error.message;
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#passwordSettingsButton").addEventListener("click", () => {
  const form = document.querySelector("#passwordSettingsForm");
  form.hidden = !form.hidden;
  if (!form.hidden) document.querySelector("#newPassword").focus();
});

document.querySelector("#passwordSettingsForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const password = document.querySelector("#newPassword").value;
  const confirmation = document.querySelector("#confirmPassword").value;
  const notice = document.querySelector("#passwordNotice");
  const button = event.submitter;
  if (password.length < 8) {
    notice.textContent = "密码至少需要 8 位。";
    return;
  }
  if (password !== confirmation) {
    notice.textContent = "两次输入的密码不一致。";
    return;
  }
  button.disabled = true;
  notice.textContent = "正在保存密码…";
  try {
    await request("/auth/v1/user", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    form.reset();
    notice.textContent = "密码已设置。下次可直接使用邮箱和密码登录。";
  } catch (error) {
    notice.textContent = error.message;
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
    if (kind === "size" && results[0]) {
      document.querySelector("#sizeChartUrl").value = results[0].publicUrl;
      productQueue = productQueue.map((item) => item.sizeChartUrl ? item : { ...item, sizeChartUrl: results[0].publicUrl });
      saveProductQueue();
      renderProductQueue();
    }
    if (kind === "high-res") {
      productQueue.push(...results.map((result, index) => ({
        id: crypto.randomUUID(),
        sku: automaticSku(),
        brand: activeBrand(),
        name: productNameFromFile(files[index].name),
        category: suggestCategory(files[index].name),
        categoryAuto: true,
        retailPrice: "",
        purchaseUrl: sharedPurchaseUrl(),
        coverImageUrl: result.publicUrl,
        sizeChartUrl: document.querySelector("#sizeChartUrl").value.trim(),
        matched: false
      })));
      saveProductQueue();
      renderProductQueue();
    }
    uploadNotice.textContent = `已保存 ${results.length} 张${description}${kind === "high-res" ? "；已放入待匹配素材" : kind === "size" ? "；已作为默认尺码表" : ""}。`;
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

function categoryOptions(selected) {
  return ["居家服", "套装", "马甲", "外套", "冬季单品"].map((category) => `<option${category === selected ? " selected" : ""}>${category}</option>`).join("");
}

function renderProductQueue() {
  const list = document.querySelector("#queueList");
  if (!productQueue.length) {
    list.innerHTML = `<p class="empty">上传高清图后，会先显示为待匹配素材；确认快团团价格后才生成商品卡。</p>`;
    return;
  }
  const candidates = productQueue.filter((item) => !item.matched && item.brand === activeBrand());
  const matched = productQueue.filter((item) => item.matched);
  const candidateMarkup = candidates.length ? `<div class="candidate-heading"><strong>${escapeHtml(activeBrand())} · 待匹配素材（${candidates.length}）</strong><small>未确认快团团价格，不会生成商品卡或展示给顾客。</small></div><div class="candidate-list">${candidates.map((item, index) => `<article class="candidate-card" data-queue-id="${item.id}"><img src="${escapeHtml(item.coverImageUrl)}" alt="待匹配素材 ${index + 1}" /><div><strong>素材 ${String(index + 1).padStart(2, "0")}</strong><small>${escapeHtml(item.name)}</small></div><button class="queue-remove" type="button" data-queue-remove="${item.id}">移除</button></article>`).join("")}</div>` : "";
  const matchedMarkup = matched.length ? `<div class="candidate-heading"><strong>已匹配商品卡（${matched.length}）</strong><small>这些商品已确认快团团价格，可以继续编辑或发布。</small></div>${matched.map((item, index) => `<article class="queue-card" data-queue-id="${item.id}">
    <img class="queue-image" src="${escapeHtml(item.coverImageUrl)}" alt="${escapeHtml(item.name || `商品图片 ${index + 1}`)}" />
    <div class="queue-card-body">
      <div class="queue-card-head"><div><strong>图片 ${String(index + 1).padStart(2, "0")}</strong><small>款号 ${escapeHtml(item.sku)}</small></div><button class="queue-remove" type="button" data-queue-remove="${item.id}">移除</button></div>
      <div class="queue-fields">
        <label>商品名<input data-queue-field="name" value="${escapeHtml(item.name)}" /></label>
        <label>快团团展示价（¥）<input data-queue-field="retailPrice" type="number" min="0" step="0.01" value="${escapeHtml(item.retailPrice)}" placeholder="159" /></label>
        <label class="queue-wide">快团团链接<input data-queue-field="purchaseUrl" type="url" value="${escapeHtml(item.purchaseUrl)}" placeholder="https://ktt.pinduoduo.com/t/…" /></label>
        <label>分类${item.categoryAuto ? `<span class="category-suggestion">智能建议</span>` : ""}<select data-queue-field="category">${categoryOptions(item.category)}</select></label>
      </div>
    </div>
  </article>`).join("")}` : "";
  list.innerHTML = candidateMarkup + matchedMarkup;
}

function updateQueueItem(id, field, value) {
  const item = productQueue.find((entry) => entry.id === id);
  if (!item) return;
  item[field] = value;
  if (field === "name" && item.categoryAuto) item.category = suggestCategory(value);
  if (field === "category") item.categoryAuto = false;
  saveProductQueue();
}

document.querySelector("#queueList").addEventListener("input", (event) => {
  const field = event.target.dataset.queueField;
  const card = event.target.closest("[data-queue-id]");
  if (field && card) updateQueueItem(card.dataset.queueId, field, event.target.value);
});

document.querySelector("#queueList").addEventListener("change", (event) => {
  const field = event.target.dataset.queueField;
  const card = event.target.closest("[data-queue-id]");
  if (field && card) updateQueueItem(card.dataset.queueId, field, event.target.value);
});

document.querySelector("#queueList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-queue-remove]");
  if (!button) return;
  productQueue = productQueue.filter((item) => item.id !== button.dataset.queueRemove);
  saveProductQueue();
  renderProductQueue();
});

document.querySelector("#applyBatchButton").addEventListener("click", () => {
  const lines = document.querySelector("#batchInfo").value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const notice = document.querySelector("#batchNotice");
  const commonLink = sharedPurchaseUrl();
  const candidates = productQueue.filter((item) => !item.matched);
  if (!candidates.length) {
    notice.textContent = "没有待匹配素材。请先上传高清图，或继续编辑已匹配商品卡。";
    return;
  }
  if (!lines.length) {
    notice.textContent = "请粘贴售价和快团团链接，每行对应一张图片。";
    return;
  }
  let applied = 0;
  lines.slice(0, candidates.length).forEach((line, index) => {
    const price = line.match(/(?:¥|￥)?\s*(\d+(?:\.\d{1,2})?)/)?.[1];
    const link = line.match(/https?:\/\/\S+/i)?.[0] || commonLink;
    if (price) {
      candidates[index].retailPrice = price;
      if (link) candidates[index].purchaseUrl = link;
      candidates[index].matched = true;
      applied += 1;
    }
  });
  saveProductQueue();
  renderProductQueue();
  notice.textContent = applied ? `已按顺序确认 ${applied} 件商品；未填价格的素材仍不会生成商品卡。` : "没有识别到售价。只有确认快团团价格后，素材才会生成商品卡。";
});

document.querySelector("#activeBrand").addEventListener("input", () => {
  const brand = activeBrand();
  document.querySelector("#brandPurchaseUrl").value = brandSettings[brand] || "";
  document.querySelector("#batchNotice").textContent = `当前品牌：${brand}。上传和匹配只会作用于这个品牌。`;
  renderProductQueue();
});

document.querySelector("#brandPurchaseUrl").addEventListener("input", (event) => {
  const brand = activeBrand();
  const link = event.target.value.trim();
  brandSettings[brand] = link;
  saveBrandSettings();
  if (!link) return;
  productQueue = productQueue.map((item) => item.brand === brand ? { ...item, purchaseUrl: link } : item);
  saveProductQueue();
  renderProductQueue();
  const count = productQueue.filter((item) => item.brand === brand).length;
  document.querySelector("#batchNotice").textContent = `品牌链接已同步到 ${brand} 的 ${count} 张素材；其他品牌不会受影响。`;
});

async function saveQueuedProducts(status) {
  const notice = document.querySelector("#queueNotice");
  const buttons = [document.querySelector("#saveQueueButton"), document.querySelector("#publishQueueButton")];
  const matchedItems = productQueue.filter((item) => item.matched);
  if (!matchedItems.length) {
    notice.textContent = "还没有已匹配价格的商品卡。先在上方粘贴快团团价格。";
    return;
  }
  if (status === "published") {
    const incomplete = matchedItems.find((item) => !item.name.trim() || !item.retailPrice || !item.purchaseUrl.trim());
    if (incomplete) {
      notice.textContent = "发布前，每张商品卡都需要商品名、顾客售价和快团团链接。";
      return;
    }
  }
  buttons.forEach((button) => { button.disabled = true; });
  const savedIds = [];
  try {
    for (const [index, item] of matchedItems.entries()) {
      notice.textContent = `正在保存第 ${index + 1}/${matchedItems.length} 张商品卡…`;
      const product = await request("/rest/v1/products", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({
          sku: item.sku,
          brand: item.brand || "ROTOTO BEBE",
          name: item.name.trim(),
          category: item.category || "冬季单品",
          retail_price: item.retailPrice === "" ? null : Number(item.retailPrice),
          purchase_url: item.purchaseUrl.trim() || null,
          cover_image_url: item.coverImageUrl,
          status,
          published_at: status === "published" ? new Date().toISOString() : null
        })
      });
      const saved = Array.isArray(product) ? product[0] : product;
      if (item.sizeChartUrl) {
        await request("/rest/v1/product_images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_id: saved.id, image_url: item.sizeChartUrl, alt_text: "尺码表", sort_order: 99 })
        });
      }
      savedIds.push(item.id);
    }
    productQueue = productQueue.filter((item) => !savedIds.includes(item.id));
    saveProductQueue();
    renderProductQueue();
    document.querySelector("#batchInfo").value = "";
    notice.textContent = status === "published" ? "已发布。顾客端刷新后即可看到这些商品。" : "已保存到待审核商品。";
    loadCatalog();
  } catch (error) {
    productQueue = productQueue.filter((item) => !savedIds.includes(item.id));
    saveProductQueue();
    renderProductQueue();
    notice.textContent = `${error.message} 已保存的商品不会重复保存，其余商品仍留在这里。`;
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
  }
}

document.querySelector("#saveQueueButton").addEventListener("click", () => saveQueuedProducts("review"));
document.querySelector("#publishQueueButton").addEventListener("click", () => saveQueuedProducts("published"));

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
    document.querySelector("#sku").value = automaticSku();
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
document.querySelector("#sku").value = automaticSku();
document.querySelector("#brandPurchaseUrl").value = brandSettings[activeBrand()] || "";
renderProductQueue();
initialise();
