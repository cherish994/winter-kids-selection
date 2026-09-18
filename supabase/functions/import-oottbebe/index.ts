import { createClient } from "jsr:@supabase/supabase-js@2";

const allowedOrigin = "https://cherish994.github.io";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function decodeHtml(value = "") {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function metaContent(html: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const first = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i").exec(html)?.[1];
  const second = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i").exec(html)?.[1];
  return decodeHtml(first || second || "");
}

function productIdFrom(url: URL) {
  const match = url.pathname.match(/\/(\d+)(?:\/|$)/);
  return match?.[1] || crypto.randomUUID().slice(0, 8);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ message: "Only POST is supported." }, 405);

  const origin = request.headers.get("origin");
  if (origin && origin !== allowedOrigin) return json({ message: "This importer only accepts requests from the shop admin." }, 403);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ message: "Please sign in as the shop owner first." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) return json({ message: "Your login has expired. Please sign in again." }, 401);

  const { data: membership } = await userClient.from("admin_users").select("user_id").eq("user_id", userData.user.id).maybeSingle();
  if (!membership) return json({ message: "This account is not a shop administrator." }, 403);

  let requestedUrl = "";
  try { requestedUrl = String((await request.json()).url || ""); } catch { /* handled below */ }
  let sourceUrl: URL;
  try { sourceUrl = new URL(requestedUrl); } catch { return json({ message: "Please paste a complete OOTTBE product URL." }, 400); }
  if (!/^(www\.)?oottbebe\.com$/i.test(sourceUrl.hostname) || !sourceUrl.pathname.startsWith("/product/")) {
    return json({ message: "Only an OOTTBE product-detail URL can be imported." }, 400);
  }

  const sourceResponse = await fetch(sourceUrl.toString(), {
    headers: { "User-Agent": "WinterKidsCatalog/1.0 (+https://cherish994.github.io/winter-kids-selection/)" },
  });
  if (!sourceResponse.ok) return json({ message: "The official product page could not be read right now." }, 502);
  const html = await sourceResponse.text();
  const productId = productIdFrom(sourceUrl);
  const name = metaContent(html, "og:title") || decodeHtml(/var\s+product_name\s*=\s*'([^']+)'/i.exec(html)?.[1] || "");
  const description = metaContent(html, "description");
  const originalImageUrl = metaContent(html, "og:image");
  if (!name) return json({ message: "The product name could not be found on this page." }, 422);

  let coverImageUrl = "";
  let imageWarning = "";
  if (originalImageUrl && serviceRoleKey) {
    try {
      const imageResponse = await fetch(originalImageUrl);
      if (!imageResponse.ok) throw new Error("image unavailable");
      const type = imageResponse.headers.get("content-type") || "image/webp";
      const extension = type.includes("png") ? "png" : type.includes("jpeg") ? "jpg" : "webp";
      const objectPath = `imports/oottbebe/${productId}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
      const serviceClient = createClient(supabaseUrl, serviceRoleKey);
      const { error: uploadError } = await serviceClient.storage.from("product-public").upload(objectPath, await imageResponse.arrayBuffer(), { contentType: type, upsert: false });
      if (uploadError) throw uploadError;
      const { data } = serviceClient.storage.from("product-public").getPublicUrl(objectPath);
      coverImageUrl = data.publicUrl;
    } catch {
      imageWarning = "商品名称已带入，但封面图未能保存，请手动上传高清图。";
    }
  }

  return json({
    sku: `OOTT-${productId}`,
    brand: "OOTT BEBE",
    name,
    description,
    coverImageUrl,
    sourceUrl: sourceUrl.toString(),
    imageWarning,
  });
});
