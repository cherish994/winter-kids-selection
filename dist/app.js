const products = [
  {
    code: "324",
    name: "撞色点缀居家服",
    type: "两件居家套装",
    category: "homewear",
    ages: ["1-3", "2-5"],
    scenes: ["daily", "gift"],
    size: "80–120 cm",
    note: "柔和撞色，适合秋冬居家与轻外出。",
    kttPrice: 99,
    commission: 4.95,
    officialPrice: 119.5,
  },
  {
    code: "328",
    name: "碎花荷叶边居家服",
    type: "两件居家套装",
    category: "homewear",
    ages: ["1-3", "2-5", "3-6"],
    scenes: ["gift", "birthday", "daily"],
    size: "80–130 cm",
    note: "花边细节更有礼物感，适合女孩周岁与送礼。",
    kttPrice: 109,
    commission: 5.45,
    officialPrice: 139.5,
  },
  {
    code: "327",
    name: "圆领印花套装",
    type: "秋冬套装",
    category: "set",
    ages: ["1-3", "2-5", "3-6"],
    scenes: ["daily", "travel", "gift"],
    size: "80–130 cm",
    note: "一套完成搭配，外出和日常都省心。",
    kttPrice: 129,
    commission: 6.45,
    officialPrice: 149.5,
  },
  {
    code: "325",
    name: "贴身居家服",
    type: "打底居家套装",
    category: "homewear",
    ages: ["0-1", "1-3", "2-5"],
    scenes: ["daily", "birthday"],
    size: "70–120 cm",
    note: "轻薄贴身，适合室内活动与冬季叠穿。",
    kttPrice: 85,
    commission: 4.25,
    officialPrice: 99.5,
  },
  {
    code: "326",
    name: "宽松印花居家服",
    type: "打底居家套装",
    category: "homewear",
    ages: ["0-1", "1-3", "2-5"],
    scenes: ["daily", "gift"],
    size: "70–120 cm",
    note: "宽松版型更自在，适合宝宝日常活动。",
    kttPrice: 85,
    commission: 4.25,
    officialPrice: 99.5,
  },
  {
    code: "321",
    name: "棉莫代尔印花居家服",
    type: "宽松居家套装",
    category: "homewear",
    ages: ["1-3", "2-5", "3-6"],
    scenes: ["gift", "daily", "travel"],
    size: "80–130 cm",
    note: "轻柔材质与活泼图案，作为礼物也合适。",
    kttPrice: null,
    commission: null,
    officialPrice: 99.5,
  },
  {
    code: "378",
    name: "拼色抓绒马甲",
    type: "秋冬马甲",
    category: "vest",
    ages: ["2-5", "3-6"],
    scenes: ["travel", "gift", "daily"],
    size: "90–130 cm",
    note: "适合温差天气的叠穿，方便活动。",
    kttPrice: 159,
    commission: 7.95,
    officialPrice: null,
  },
  {
    code: "329",
    name: "圆领背心",
    type: "秋冬马甲",
    category: "vest",
    ages: ["1-3", "2-5", "3-6"],
    scenes: ["daily", "travel"],
    size: "80–130 cm",
    note: "简洁实穿，适合在居家服外加一层。",
    kttPrice: 79,
    commission: 3.95,
    officialPrice: null,
  },
];

const state = { scene: "daily", age: "1-3", category: "all", tasks: [] };
const sceneLabel = { daily: "日常穿", gift: "送礼", birthday: "周岁", travel: "外出拍照" };
const sceneReason = {
  daily: "优先给你看活动方便、可叠穿、适合日常使用频率高的款式。",
  gift: "优先给你看有细节、有成套感、打开礼物就容易穿上的冬季款式。",
  birthday: "优先给你看舒适亲肤、上镜有细节，又不影响孩子活动的款式。",
  travel: "优先给你看好搭配、适合拍照、能应对室内外温差的冬季款式。",
};

const $ = (selector) => document.querySelector(selector);
const money = (value) => `¥${Number(value).toFixed(2).replace(/\.00$/, "")}`;

function productCard(product) {
  const template = $("#productTemplate");
  const fragment = template.content.cloneNode(true);
  const button = fragment.querySelector(".product-card-button");
  fragment.querySelector(".product-code").textContent = `ROTOTOBEBE ${product.code}`;
  fragment.querySelector(".product-type").textContent = product.type;
  fragment.querySelector(".product-name").textContent = product.name;
  fragment.querySelector(".product-note").textContent = product.note;
  fragment.querySelector(".size-tag").textContent = product.size;
  button.addEventListener("click", () => openProduct(product));
  return fragment;
}

function renderRecommendations() {
  const height = Number($("#height").value);
  const weight = Number($("#weight").value);
  const recommended = products
    .filter((product) => product.ages.includes(state.age))
    .sort((a, b) => Number(b.scenes.includes(state.scene)) - Number(a.scenes.includes(state.scene)))
    .slice(0, 3);
  const label = `${state.age} 岁、${sceneLabel[state.scene]}`;
  let reason = sceneReason[state.scene];
  if (height && weight) reason += ` 已参考你填写的 ${height} cm / ${weight} kg；下单时再按商品尺码表确认。`;
  $("#selectionLabel").textContent = label;
  $("#recommendReason").textContent = reason;
  const container = $("#recommendations");
  container.replaceChildren(...recommended.map(productCard));
}

function renderCatalog() {
  const filtered = state.category === "all" ? products : products.filter((product) => product.category === state.category);
  const container = $("#catalogGrid");
  container.replaceChildren(...filtered.map(productCard));
  $("#catalogCount").textContent = `${filtered.length} 个款式`;
}

function openProduct(product) {
  $("#productDialogBody").innerHTML = `
    <p class="detail-type">ROTOTOBEBE ${product.code} · ${product.type}</p>
    <h2 id="productDialogTitle">${product.name}</h2>
    <p class="detail-description">${product.note} 这一页暂不展示店主成本；消费者将在正式上架后通过对应的快团团购买入口进入选购。</p>
    <div class="detail-meta"><span>建议尺码：${product.size}</span><span>冬季首批</span><span>素材待核对</span></div>
    <p class="detail-notice">购买入口待绑定。店主确认截图、高清图与商品款号匹配后，才会展示购买按钮。</p>`;
  $("#productDialog").showModal();
}

function selectionSetup(container, stateKey) {
  $(container).addEventListener("click", (event) => {
    const button = event.target.closest("button[data-scene], button[data-age]");
    if (!button) return;
    const value = button.dataset.scene || button.dataset.age;
    state[stateKey] = value;
    $(container).querySelectorAll("button").forEach((item) => item.classList.toggle("is-selected", item === button));
    renderRecommendations();
  });
}

function fileLabel(files, emptyText) {
  return files.length ? `已选择 ${files.length} 张` : emptyText;
}

function previewFiles() {
  const kttFiles = [...$("#kttFiles").files];
  const assetFiles = [...$("#assetFiles").files];
  $("#kttSummary").textContent = fileLabel(kttFiles, "还未选择");
  $("#assetSummary").textContent = fileLabel(assetFiles, "还未选择");
  const preview = $("#filePreviews");
  preview.replaceChildren();
  [...kttFiles.map((file) => ({ file, kind: "截图" })), ...assetFiles.map((file) => ({ file, kind: "高清" }))]
    .slice(0, 10)
    .forEach(({ file, kind }) => {
      const box = document.createElement("div");
      box.className = "file-preview";
      const image = document.createElement("img");
      image.alt = `${kind}预览：${file.name}`;
      image.src = URL.createObjectURL(file);
      const badge = document.createElement("span");
      badge.textContent = kind;
      box.append(image, badge);
      preview.append(box);
    });
}

function renderTasks() {
  const container = $("#taskList");
  if (!state.tasks.length) {
    container.innerHTML = '<p class="empty-task">暂时没有任务。上传一批资料后会显示在这里。</p>';
    return;
  }
  container.innerHTML = state.tasks.map((task) => `
    <div class="task-item">
      <div><strong>${task.title}</strong><p>${task.details}</p></div>
      <span class="task-status">等待云端识别</span>
    </div>`).join("");
}

function renderCosts() {
  const rows = products.filter((product) => product.kttPrice !== null).map((product) => {
    const cost = product.kttPrice - product.commission;
    return `<tr><td>${product.code} · ${product.name}</td><td>${money(product.kttPrice)}</td><td>${money(product.commission)}</td><td>${money(cost)}</td></tr>`;
  });
  $("#costRows").innerHTML = rows.join("");
}

function openUpload() { $("#uploadDialog").showModal(); }

selectionSetup("#sceneChips", "scene");
selectionSetup("#ageChips", "age");
renderRecommendations();
renderCatalog();
renderCosts();

$("#recommendForm").addEventListener("submit", (event) => {
  event.preventDefault();
  renderRecommendations();
  $("#recommendHeading").scrollIntoView({ behavior: "smooth", block: "start" });
});

$("#showAll").addEventListener("click", () => $("#catalog").scrollIntoView({ behavior: "smooth" }));
$("#categoryFilters").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  $("#categoryFilters").querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
  renderCatalog();
});

[$("#openUpload"), $("#openUploadSecondary"), $("#footerUpload")].forEach((button) => button.addEventListener("click", openUpload));
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => $(`#${button.dataset.close}`).close()));
[$("#kttFiles"), $("#assetFiles")].forEach((input) => input.addEventListener("change", previewFiles));

$("#uploadForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const kttCount = $("#kttFiles").files.length;
  const assetCount = $("#assetFiles").files.length;
  if (!kttCount && !assetCount) {
    $("#kttSummary").textContent = "请至少选择一张图片";
    return;
  }
  const title = $("#sourceLink").value ? "含团购链接的新批次" : "未绑定团购链接的新批次";
  state.tasks.unshift({
    title,
    details: `快团团截图 ${kttCount} 张 · 高清素材 ${assetCount} 张 · 需要确认款号、名称、售价与佣金`,
  });
  renderTasks();
  $("#uploadForm").reset();
  previewFiles();
});
