(function () {
  /** @type {HTMLInputElement} */
  const baseUrlEl = document.getElementById("baseUrl");
  /** @type {HTMLInputElement} */
  const projectKeyEl = document.getElementById("projectKey");
  /** @type {HTMLSelectElement} */
  const localeEl = document.getElementById("locale");
  /** @type {HTMLTextAreaElement} */
  const messageEl = document.getElementById("message");

  /** @type {HTMLElement} */
  const renderedEl = document.getElementById("rendered");
  /** @type {HTMLElement} */
  const jsonEl = document.getElementById("json");

  /** @type {HTMLButtonElement} */
  const btnSend = document.getElementById("btnSend");
  /** @type {HTMLButtonElement} */
  const btnConfig = document.getElementById("btnConfig");
  /** @type {HTMLButtonElement} */
  const btnClear = document.getElementById("btnClear");

  const baseUrl = window.location.origin;
  baseUrlEl.value = baseUrl;

  function clearOutput() {
    jsonEl.textContent = "";
    renderedEl.innerHTML = "";
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setJson(obj) {
    if (typeof obj === "string") {
      jsonEl.textContent = obj;
      return;
    }
    jsonEl.textContent = JSON.stringify(obj, null, 2);
  }

  function renderError(title, details) {
    renderedEl.innerHTML =
      '<p><strong>' + escapeHtml(title) + '</strong></p>' +
      '<pre class="pre">' + escapeHtml(details) + '</pre>';
  }

  function renderChatResponse(resp) {
    const reply = (resp && resp.reply) || "";
    const warnings = (resp && Array.isArray(resp.warnings) ? resp.warnings : []) || [];
    const safetyLevel = (resp && resp.safetyLevel) || "normal";
    const sources = (resp && Array.isArray(resp.sources) ? resp.sources : []) || [];

    const parts = String(reply).split(/\n\n+/).filter(Boolean);

    let html = '';
    html += '<p><strong>Safety:</strong> ' + escapeHtml(safetyLevel) + '</p>';

    for (const p of parts) {
      html += '<p>' + escapeHtml(p) + '</p>';
    }

    if (warnings.length) {
      html += '<p><strong>Warnings</strong></p><ul>';
      for (const w of warnings) html += '<li>' + escapeHtml(w) + '</li>';
      html += '</ul>';
    }

    if (sources.length) {
      html += '<p><strong>Knowledge sources</strong></p><ul>';
      for (const s of sources) {
        const title = s.title || s.sourceId || 'source';
        const snippet = s.snippet || '';
        const url = s.url || null;
        if (url) {
          html += '<li><a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(title) + '</a> — ' + escapeHtml(snippet) + '</li>';
        } else {
          html += '<li>' + escapeHtml(title) + ' — ' + escapeHtml(snippet) + '</li>';
        }
      }
      html += '</ul>';
    }

    renderedEl.innerHTML = html;
  }

  async function safeFetchJson(url, init) {
    const res = await fetch(url, init);
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { ok: res.ok, status: res.status, data };
  }

  btnClear.addEventListener("click", () => {
    clearOutput();
  });

  btnConfig.addEventListener("click", async () => {
    clearOutput();
    const key = String(projectKeyEl.value || "").trim();
    if (!key) {
      renderError("Missing X-Project-Key", "Enter project key (publicKey). Example: leleka-dev");
      return;
    }

    btnConfig.disabled = true;
    try {
      const url = baseUrl + "/v1/projects/" + encodeURIComponent(key) + "/public-config";
      const { ok, status, data } = await safeFetchJson(url, { method: "GET" });
      setJson(data);
      if (!ok) {
        renderError("Request failed", "HTTP " + status);
      } else {
        renderedEl.innerHTML = '<p><strong>Loaded public-config</strong></p>';
      }
    } catch (e) {
      setJson(String(e && e.message ? e.message : e));
      renderError("Network error", String(e && e.message ? e.message : e));
    } finally {
      btnConfig.disabled = false;
    }
  });

  btnSend.addEventListener("click", async () => {
    clearOutput();
    const key = String(projectKeyEl.value || "").trim();
    if (!key) {
      renderError("Missing X-Project-Key", "Enter project key (publicKey). Example: leleka-dev");
      return;
    }

    const message = String(messageEl.value || "").trim();
    if (!message) {
      renderError("Missing message", "Type any question to send to POST /v1/chat");
      return;
    }

    const locale = String(localeEl.value || "").trim();
    const body = { message: message };
    if (locale) body.locale = locale;

    btnSend.disabled = true;
    try {
      const url = baseUrl + "/v1/chat";
      const { ok, status, data } = await safeFetchJson(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Project-Key": key,
        },
        body: JSON.stringify(body),
      });

      setJson(data);

      if (!ok) {
        const details = typeof data === "string" ? data : JSON.stringify(data, null, 2);
        renderError("Request failed", "HTTP " + status + "\n\n" + details);
        return;
      }

      if (data && typeof data === "object") {
        renderChatResponse(data);
      } else {
        renderError("Unexpected response", String(data));
      }
    } catch (e) {
      const msg = String(e && e.message ? e.message : e);
      setJson(msg);
      renderError("Network error", msg);
    } finally {
      btnSend.disabled = false;
    }
  });
})();
