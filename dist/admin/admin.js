document.querySelector("#loginButton").addEventListener("click", () => {
  document.querySelector("#adminNotice").textContent = "请先在 Supabase 启用邮箱登录，并创建你的店主账号。权限接入后，这里才会显示内部商品资料。";
});
