export function normalizeApiBaseUrl(baseUrl, { defaultBaseUrl = "" } = {}) {
  const raw = String(baseUrl || defaultBaseUrl || "").trim();
  if (!raw) {
    return "";
  }

  const withoutTrailingSlash = raw.replace(/\/+$/, "");
  try {
    const url = new URL(withoutTrailingSlash);
    const pathname = url.pathname.replace(/\/+$/, "");
    const segments = pathname.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1] || "";

    if (lastSegment.toLowerCase() !== "v1") {
      url.pathname = `${pathname === "/" ? "" : pathname}/v1`;
    } else {
      url.pathname = pathname || "/v1";
    }
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch (_error) {
    return /\/v1$/i.test(withoutTrailingSlash)
      ? withoutTrailingSlash
      : `${withoutTrailingSlash}/v1`;
  }
}
