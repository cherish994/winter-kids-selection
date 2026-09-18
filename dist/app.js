const SUPABASE_URL = "https://dqslxzroiffhxhacnzdg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_YJpsMmce6XnBd47XQ3GO2A_QsGGqLqs";

const previewProducts = [
  { id: "preview-324", sku: "324", brand: "ROTO TO BEBE", name: "复古撞色居家服", category: "居家服", scenes: ["日常", "周岁"], ages: "1–5 岁", range: "80–110 cm", description: "轻柔长袖与长裤组合，适合温度刚好的室内日常。", color: "#b7d4ab" },
  { id: "preview-328", sku: "328", brand: "ROTO TO BEBE", name: "小花领口居家服", category: "居家服", scenes: ["日常", "送礼"], ages: "1–5 岁", range: "80–110 cm", description: "细小花纹和宽松空间，留给睡前、早餐和周末。", color: "#ffb9cb" },
  { id: "preview-327", sku: "327", brand: "ROTO TO BEBE", name: "迷你水果套装", category: "套装", scenes: ["出行", "送礼"], ages: "1–5 岁", range: "80–110 cm", description: "亮一点的图案，搭一件外套就能出门。", color: "#fff062" },
  { id: "preview-325", sku: "325", brand: "ROTO TO BEBE", name: "签名撞色家居服", category: "居家服", scenes: ["日常", "周岁"], ages: "1–5 岁", range: "80–110 cm", description: "有趣的边线细节，为每天的居家时间加一点颜色。", color: "#8dc6ff" },
  { id: "preview-326", sku: "326", brand: "ROTO TO BEBE", name: "签名小熊家居服", category: "居家服", scenes: ["日常", "送礼"], ages: "1–5 岁", range: "80–110 cm", description: "舒适、好洗，也适合第一次送给小朋友的礼物。", color: "#ffc59f" },
  { id: "preview-329", sku: "329", brand: "ROTO TO BEBE", name: "背后小狗圆领马甲", category: "马甲", scenes: ["出行", "送礼"], ages: "1–5 岁", range: "80–110 cm", description: "可以叠穿的轻暖马甲，让出门多一个颜色层次。", color: "#cebbff" },
  { id: "preview-378", sku: "378", brand: "ROTO TO BEBE", name: "彩色拼接摇粒绒马甲", category: "马甲", scenes: ["出行", "送礼"], ages: "1–5 岁", range: "80–110 cm", description: "明快拼色与保暖绒感，为降温时刻准备。", color: "#ff806b" },
  { id: "preview-321", sku: "321", brand: "ROTO TO BEBE", name: "棉莫代尔长袖家居服", category: "居家服", scenes: ["日常"], ages: "1–5 岁", range: "80–110 cm", description: "一套不费力的日常基础款，适合在家慢慢长大。", color: "#bff0d0" }
];

let products = [...previewProducts];
let selectedCategory = "全部";
let selectedScene = "";

const grid = document.querySelector("#productGrid");
const status = document.querySelector("#catalogStatus");
const dialog = document.querySelector("#productDialog");

function normalizeProduct(row) {
  return {
    id: row.id,
    sku: row.sku || "NEW",
    brand: row.brand || "小孩 / 衣橱",
    name: row.name,
    category: row.category || "冬季单品",
    scenes: Array.isArray(row.scenes) ? row.scenes : [],
    ages: Array.isArray(row.age_groups) && row.age_groups.length ? row.age_groups.join(" · ") : (row.age_groups || "以尺码表为准"),
    range: row.height_min && row.height_max ? `${row.height_min}–${row.height_max} cm` : "以尺码表为准",
    description: row.description || "",
    price: row.retail_price ? `¥${Number(row.retail_price).toFixed(0)}` : "新品预告",
    purchaseUrl: row.purchase_url,
    coverImage: row.cover_image_url,
    sizeChart: (Array.isArray(row.product_images) ? row.product_images : []).find((image) => image.alt_text === "尺码表")?.image_url,
    color: "#ececec"
  };
}

async function loadPublishedProducts() {
  const endpoint = `${SUPABASE_URL}/rest/v1/products?select=id,sku,brand,name,category,description,age_groups,scenes,height_min,height_max,retail_price,purchase_url,cover_image_url,product_images(image_url,alt_text,sort_order)&status=eq.published&order=published_at.desc`;
  try {
    const response = await fetch(endpoint, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
      }
    });
    if (!response.ok) throw new Error("catalog unavailable");
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) return;
    products = rows.map(normalizeProduct);
    status.textContent = `已上新 ${products.length} 件冬季单品`;
    renderProducts();
  } catch {
    // The pre-launch edit stays visible until the shop owner runs the supplied schema and publishes products.
  }
}

function renderProducts() {
  const visible = products.filter((product) => {
    const categoryMatch = selectedCategory === "全部" || product.category === selectedCategory;
    const sceneMatch = !selectedScene || product.scenes.includes(selectedScene);
    return categoryMatch && sceneMatch;
  });

  grid.innerHTML = visible.map((product) => {
    const imageStyle = product.coverImage ? `background-image:url(&quot;${product.coverImage}&quot;)` : `--card-color:${product.color}`;
    const visualClass = product.coverImage ? "product-visual has-image" : "product-visual";
    const tag = product.scenes.length ? product.scenes.slice(0, 2).join(" · ") : product.category;
    return `<button class="product-card" type="button" data-id="${product.id}">
      <span class="${visualClass}" style="${imageStyle}"><span class="product-number">${product.sku}</span></span>
      <span class="product-info">
        <span class="product-brand">${product.brand}</span>
        <span class="product-name">${product.name}</span>
        <span class="product-bottom"><span class="product-price">${product.price || "新品预告"}</span><span class="product-tag">${tag}</span></span>
      </span>
    </button>`;
  }).join("") || `<p class="empty-state">这个组合正在准备中，换一个场景看看。</p>`;
}

function openProduct(id) {
  const product = products.find((item) => item.id === id);
  if (!product) return;
  const dialogVisual = document.querySelector("#dialogVisual");
  dialogVisual.style.background = product.coverImage ? `url("${product.coverImage}") center / cover` : product.color;
  document.querySelector("#dialogBrand").textContent = product.brand;
  document.querySelector("#dialogTitle").textContent = product.name;
  document.querySelector("#dialogDescription").textContent = product.description;
  document.querySelector("#dialogMeta").innerHTML = `<span>${product.ages}</span><span>${product.range}</span><span>${product.category}</span>`;
  const sizeChart = document.querySelector("#dialogSizeChart");
  sizeChart.hidden = !product.sizeChart;
  if (product.sizeChart) sizeChart.href = product.sizeChart;
  document.querySelector("#dialogPrice").textContent = product.price || "新品预告";
  const action = document.querySelector("#dialogAction");
  if (product.purchaseUrl) {
    action.href = product.purchaseUrl;
    action.target = "_blank";
    action.textContent = "查看商品 ↗";
    action.removeAttribute("aria-disabled");
  } else {
    action.href = "#catalog";
    action.target = "_self";
    action.textContent = "本季上新中";
    action.setAttribute("aria-disabled", "true");
  }
  dialog.showModal();
}

document.querySelector("#productGrid").addEventListener("click", (event) => {
  const card = event.target.closest(".product-card");
  if (card) openProduct(card.dataset.id);
});

document.querySelectorAll(".category").forEach((button) => {
  button.addEventListener("click", () => {
    selectedCategory = button.dataset.category;
    document.querySelectorAll(".category").forEach((item) => item.classList.toggle("active", item === button));
    renderProducts();
  });
});

document.querySelectorAll(".scene-tile").forEach((button) => {
  button.addEventListener("click", () => {
    selectedScene = button.dataset.scene;
    selectedCategory = "全部";
    document.querySelectorAll(".category").forEach((item) => item.classList.toggle("active", item.dataset.category === "全部"));
    status.textContent = `为「${selectedScene}」挑选的冬季单品`;
    renderProducts();
    document.querySelector("#catalog").scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

document.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

document.querySelector("#sizeForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const age = document.querySelector("#age").value;
  const height = Number(document.querySelector("#height").value);
  const result = document.querySelector("#sizeResult");
  if (!age && !height) {
    result.textContent = "先告诉我们年龄或身高，就能给出参考。";
    return;
  }
  let suggestion = "80 码";
  if (height >= 105 || age === "5-7岁") suggestion = "110–120 码";
  else if (height >= 95 || age === "3-5岁") suggestion = "100–110 码";
  else if (height >= 83 || age === "2-3岁") suggestion = "90–100 码";
  else if (height >= 70 || age === "1-2岁") suggestion = "80–90 码";
  result.textContent = `优先看看 ${suggestion}。每个品牌版型不同，请在商品页确认尺码表。`;
});

renderProducts();
loadPublishedProducts();
