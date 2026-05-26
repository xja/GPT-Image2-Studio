export function createConfigModelPickerController({
  refs,
  state,
  getBrowserPrivateConfigRequestPayload,
  fetchImpl = fetch,
  FormDataCtor = FormData,
} = {}) {
  const documentRef = refs?.modelOptionsList?.ownerDocument || globalThis.document;
  state.configModels ||= { items: [], loading: false, loadingMode: "", open: false };

  function setFeedback(message = "", kind = "") {
    refs.configFeedback.textContent = message;
    refs.configFeedback.dataset.state = kind;
  }

  function getRequestPayloadFromForm() {
    const browserPayload = getBrowserPrivateConfigRequestPayload();
    return {
      ...browserPayload,
      baseUrl: refs.baseUrlInput.value.trim() || browserPayload.baseUrl || state.config?.baseUrl || "",
      apiKey: refs.apiKeyInput.value.trim() || browserPayload.apiKey || "",
      responsesModel:
        refs.responsesModelInput.value.trim() ||
        browserPayload.responsesModel ||
        state.config?.responsesModel ||
        "gpt-5.5",
    };
  }

  function buildModelsFormData() {
    const payload = getRequestPayloadFromForm();
    const formData = new FormDataCtor();
    formData.set("baseUrl", payload.baseUrl);
    formData.set("apiKey", payload.apiKey);
    formData.set("responsesModel", payload.responsesModel);
    return formData;
  }

  function renderActions() {
    const loading = state.configModels.loading;
    refs.testConnectionButton.disabled = loading;
    refs.fetchModelsButton.disabled = loading;
    refs.testConnectionButton.textContent = loading && state.configModels.loadingMode === "test" ? "测试中..." : "测试连接";
    refs.fetchModelsButton.textContent = loading && state.configModels.loadingMode === "models" ? "获取中..." : "获取模型列表";
  }

  function render() {
    refs.modelPickerToggle.hidden = state.configModels.items.length === 0;
    refs.modelPickerToggle.disabled = state.configModels.items.length === 0 || state.configModels.loading;
    refs.modelPickerToggle.setAttribute("aria-expanded", String(state.configModels.open));
    refs.modelOptionsList.hidden = !state.configModels.open || state.configModels.items.length === 0;
    refs.modelOptionsList.innerHTML = "";

    state.configModels.items.forEach((modelId) => {
      const option = documentRef.createElement("button");
      option.type = "button";
      option.className = "model-option";
      option.dataset.modelId = modelId;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(refs.responsesModelInput.value.trim() === modelId));
      option.textContent = modelId;
      refs.modelOptionsList.appendChild(option);
    });

    renderActions();
  }

  function setOpen(open) {
    state.configModels.open = Boolean(open) && state.configModels.items.length > 0;
    render();
  }

  function toggleModelPicker() {
    setOpen(!state.configModels.open);
  }

  function selectModelOption(modelId) {
    refs.responsesModelInput.value = modelId;
    setOpen(false);
  }

  async function fetchConfigModels({ openAfterFetch = true, mode = "models" } = {}) {
    state.configModels.loading = true;
    state.configModels.loadingMode = mode;
    render();
    setFeedback(mode === "test" ? "正在测试连接..." : "正在获取模型列表...", "busy");

    try {
      const response = await fetchImpl("/api/models", {
        method: "POST",
        body: buildModelsFormData(),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.message || "获取模型列表失败。");
      }

      const models = Array.isArray(payload.models)
        ? payload.models.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
      if (models.length === 0) {
        throw new Error("未获取到可调用模型。");
      }

      state.configModels.items = models;
      state.configModels.open = Boolean(openAfterFetch);
      setFeedback(
        mode === "test" ? `连接测试成功，获取到 ${models.length} 个模型。` : `已获取 ${models.length} 个可调用模型。`,
        "success",
      );
    } catch (error) {
      state.configModels.open = false;
      setFeedback(error instanceof Error ? error.message : String(error), "error");
    } finally {
      state.configModels.loading = false;
      state.configModels.loadingMode = "";
      render();
    }
  }

  function bindEvents() {
    refs.testConnectionButton.addEventListener("click", () => {
      fetchConfigModels({ openAfterFetch: false, mode: "test" });
    });
    refs.fetchModelsButton.addEventListener("click", () => {
      fetchConfigModels({ openAfterFetch: true, mode: "models" });
    });
    refs.modelPickerToggle.addEventListener("click", toggleModelPicker);
    refs.modelOptionsList.addEventListener("click", (event) => {
      const option = event.target.closest("[data-model-id]");
      if (option) {
        selectModelOption(option.dataset.modelId);
      }
    });
    refs.responsesModelInput.addEventListener("input", () => {
      state.configModels.open = false;
      render();
    });
    documentRef.addEventListener("click", (event) => {
      const target = event.target;
      if (
        !refs.modelOptionsList.contains(target) &&
        !refs.modelPickerToggle.contains(target) &&
        target !== refs.responsesModelInput
      ) {
        setOpen(false);
      }
    });
  }

  return {
    bindEvents,
    fetchConfigModels,
    render,
    setFeedback,
  };
}
