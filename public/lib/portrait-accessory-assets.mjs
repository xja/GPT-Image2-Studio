const ASSET_ROOT = "./assets/portrait-accessories/";

export const PORTRAIT_ACCESSORY_ASSET_CATEGORIES = [
  { value: "upper", label: "上衣" },
  { value: "bottom", label: "下装" },
  { value: "outer", label: "外套" },
  { value: "dress", label: "裙装" },
  { value: "shoes", label: "鞋子" },
  { value: "bag", label: "包袋" },
  { value: "accessory", label: "配饰" },
  { value: "hat", label: "帽子" },
  { value: "cosplay", label: "COS" },
];

function asset(id, category, label, extras = {}) {
  return {
    id,
    category,
    label,
    filename: `portrait-accessory-${id}.png`,
    src: `${ASSET_ROOT}${id}.png`,
    ...extras,
  };
}

function colorSet(assetId, entries) {
  return entries.map(([id, label, swatch]) => ({
    id,
    label,
    swatch,
    filename: `portrait-accessory-${assetId}-${id}.png`,
    src: `${ASSET_ROOT}${assetId}-${id}.png`,
  }));
}

export const DEFAULT_PORTRAIT_ACCESSORY_ASSETS = [
  asset("cosplay-shrine-miko", "cosplay", "巫女COS", {
    prompt: "Create a photorealistic cosplay portrait wearing the supplied shrine miko inspired red and white kimono-style costume, wide sleeves, waist bow, hair ribbon, wooden prayer wand, and paper streamer props.",
  }),
  asset("cosplay-magical-girl", "cosplay", "魔法少女COS", {
    prompt: "Create a photorealistic cosplay portrait wearing the supplied magical girl inspired pastel layered dress, bow details, gloves, boots, hair ornaments, star wand, and matching sparkle props.",
  }),
  asset("cosplay-cyber-warrior", "cosplay", "赛博战士COS", {
    prompt: "Create a photorealistic cosplay portrait wearing the supplied cyber warrior inspired fitted armor jacket, luminous trim, visor headset, utility belt, gloves, and handheld tech props.",
  }),
  asset("cosplay-fantasy-knight", "cosplay", "幻想骑士COS", {
    prompt: "Create a photorealistic cosplay portrait wearing the supplied fantasy knight inspired cape, chest armor, bracers, boots, emblem tabard, and lightweight shield and prop sword props.",
  }),
  asset("upper-minimal-tee", "upper", "极简白T", {
    colors: colorSet("upper-minimal-tee", [["pure-white", "纯白", "#f8fafc"], ["pure-black", "纯黑", "#111827"], ["heather-gray", "花灰", "#9ca3af"], ["navy-stripe", "海军条纹", "linear-gradient(135deg,#f8fafc 0 28%,#1e3a8a 28% 42%,#f8fafc 42% 70%,#1e3a8a 70% 84%,#f8fafc 84%)"]]),
  }),
  asset("upper-white-shirt", "upper", "白衬衫", {
    colors: colorSet("upper-white-shirt", [["pure-white", "纯白", "#f8fafc"], ["sky-blue", "天蓝", "#93c5fd"], ["cream-stripe", "奶油细条", "linear-gradient(135deg,#f8fafc 0 35%,#f5e6c8 35% 45%,#f8fafc 45% 72%,#f5e6c8 72% 82%,#f8fafc 82%)"], ["pure-black", "纯黑", "#111827"]]),
  }),
  asset("upper-tube-top", "upper", "抹胸上衣", {
    colors: colorSet("upper-tube-top", [["pure-white", "纯白", "#f8fafc"], ["aqua-blue", "纯蓝", "#38bdf8"], ["pure-black", "纯黑", "#111827"], ["ribbed-pink", "粉色罗纹", "linear-gradient(90deg,#fbcfe8,#f9a8d4,#fbcfe8)"]]),
  }),
  asset("upper-knit-shrug", "upper", "针织短外套", {
    colors: colorSet("upper-knit-shrug", [["pure-white", "纯白", "#f8fafc"], ["soft-pink", "纯粉", "#f4b4bd"], ["oatmeal-knit", "燕麦针织", "linear-gradient(135deg,#e8d7bd,#f4ead8,#d8c0a1)"], ["charcoal-melange", "炭灰混纺", "linear-gradient(135deg,#374151,#6b7280,#1f2937)"]]),
  }),
  asset("bottom-straight-trousers", "bottom", "直筒长裤", {
    colors: colorSet("bottom-straight-trousers", [["pure-white", "纯白", "#f8fafc"], ["pure-black", "纯黑", "#111827"], ["charcoal-gray", "炭灰", "#374151"], ["khaki-twill", "卡其斜纹", "linear-gradient(135deg,#c4a484,#e0c7a3,#b8926a)"]]),
  }),
  asset("bottom-blue-jeans", "bottom", "牛仔裤", {
    colors: colorSet("bottom-blue-jeans", [["pure-white", "纯白", "#f8fafc"], ["indigo-blue", "纯蓝", "#1d4ed8"], ["washed-denim", "浅水洗", "linear-gradient(135deg,#bfdbfe,#60a5fa,#93c5fd)"], ["black-denim", "黑灰牛仔", "linear-gradient(135deg,#111827,#4b5563,#1f2937)"]]),
  }),
  asset("bottom-tailored-trousers", "bottom", "西装长裤", {
    colors: colorSet("bottom-tailored-trousers", [["pure-white", "纯白", "#f8fafc"], ["pure-black", "纯黑", "#111827"], ["navy-blue", "海军蓝", "#1e3a8a"], ["oat-check", "燕麦格纹", "linear-gradient(45deg,#d8c3a5 0 25%,#f3e7d3 25% 50%,#b89f7d 50% 75%,#f3e7d3 75%)"]]),
  }),
  asset("bottom-capri-pants", "bottom", "七分裤", {
    colors: colorSet("bottom-capri-pants", [["pure-white", "纯白", "#f8fafc"], ["pure-black", "纯黑", "#111827"], ["khaki", "卡其", "#b99b6b"], ["denim-blue", "牛仔蓝", "#2563eb"]]),
  }),
  asset("outer-field-jacket", "outer", "工装夹克"),
  asset("outer-parka", "outer", "连帽派克"),
  asset("outer-leather-coat", "outer", "黑色皮大衣"),
  asset("dress-vintage-day", "dress", "复古连衣裙"),
  asset("dress-evening", "dress", "礼服裙"),
  asset("dress-ballet-tutu", "dress", "芭蕾纱裙"),
  asset("shoes-white-sneakers", "shoes", "白色运动鞋", {
    colors: colorSet("shoes-white-sneakers", [["pure-white", "纯白", "#f8fafc"], ["pure-black", "纯黑", "#111827"], ["silver-gray", "银灰", "linear-gradient(135deg,#e5e7eb,#9ca3af,#f8fafc)"], ["green-accent", "白绿点缀", "linear-gradient(135deg,#f8fafc 0 58%,#22c55e 58% 72%,#f8fafc 72%)"]]),
  }),
  asset("shoes-skate-sneakers", "shoes", "滑板鞋", {
    colors: colorSet("shoes-skate-sneakers", [["pure-white", "纯白", "#f8fafc"], ["pure-black", "纯黑", "#111827"], ["brown-white", "棕白拼色", "linear-gradient(135deg,#f8fafc 0 52%,#8b5e34 52%)"], ["navy-blue", "海军蓝", "#1e3a8a"]]),
  }),
  asset("shoes-black-loafers", "shoes", "黑色乐福鞋", {
    colors: colorSet("shoes-black-loafers", [["pure-white", "纯白", "#f8fafc"], ["pure-black", "纯黑", "#111827"], ["burgundy", "酒红", "#7f1d1d"], ["brown-croc", "棕色压纹", "linear-gradient(135deg,#7c4a25,#b77942,#5f3719)"]]),
  }),
  asset("shoes-high-heels", "shoes", "高跟鞋", {
    colors: colorSet("shoes-high-heels", [["pure-white", "纯白", "#f8fafc"], ["pure-black", "纯黑", "#111827"], ["nude-pink", "裸粉", "#f3c7bd"], ["metallic-silver", "金属银", "linear-gradient(135deg,#f8fafc,#9ca3af,#e5e7eb)"]]),
  }),
  asset("bag-doctor", "bag", "复古手提包"),
  asset("bag-beauty-case", "bag", "小方箱包"),
  asset("bag-tote", "bag", "托特包"),
  asset("accessory-blue-tie", "accessory", "蓝色领带"),
  asset("accessory-bow-tie", "accessory", "黑色领结"),
  asset("accessory-leather-belt", "accessory", "皮带"),
  asset("accessory-watch", "accessory", "腕表"),
  asset("accessory-sunglasses", "accessory", "太阳镜"),
  asset("hat-summer", "hat", "夏日草帽"),
  asset("hat-baseball-cap", "hat", "棒球帽"),
  asset("hat-fashion", "hat", "女帽"),
];

export function getPortraitAccessoryAssetColor(asset, colorId) {
  const colors = Array.isArray(asset?.colors) ? asset.colors : [];
  return colors.find((color) => color.id === colorId) || colors[0] || null;
}

export function getPortraitAccessoryAssetFileDescriptor(asset, colorId) {
  const color = getPortraitAccessoryAssetColor(asset, colorId);
  return {
    ...asset,
    colorId: color?.id || "",
    colorLabel: color?.label || "",
    filename: color?.filename || asset?.filename || "",
    label: color?.label ? `${asset.label} · ${color.label}` : asset?.label || "",
    src: color?.src || asset?.src || "",
  };
}
