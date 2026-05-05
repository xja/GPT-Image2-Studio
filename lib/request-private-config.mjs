function readRequestField(source, key) {
  if (!source) {
    return "";
  }

  if (typeof source.get === "function") {
    return String(source.get(key) || "").trim();
  }

  return String(source[key] || "").trim();
}

export function mergeRequestPrivateConfig(source, fallbackConfig) {
  const requestApiKey = readRequestField(source, "apiKey");
  if (!requestApiKey) {
    return fallbackConfig;
  }

  const requestBaseUrl = readRequestField(source, "baseUrl");
  const requestModel = readRequestField(source, "responsesModel");

  return {
    ...fallbackConfig,
    baseUrl: requestBaseUrl || fallbackConfig.baseUrl,
    apiKey: requestApiKey,
    responsesModel: requestModel || fallbackConfig.responsesModel,
  };
}
