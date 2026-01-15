/* Leleka AI Widget (PR-06)
 * Usage:
 * <script src="https://YOUR-AI-SERVICE/widget/widget.js" data-project="PUBLIC_KEY"></script>
 */
(function () {
  "use strict";

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") node.className = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else if (k === "html") node.innerHTML = attrs[k];
        else node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function injectCss(href) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  // Find the script tag that loaded this file.
  var script = document.currentScript;
  if (!script) {
    // Fallback: last script element
    var scripts = document.getElementsByTagName("script");
    script = scripts[scripts.length - 1];
  }

  var projectKey = script && script.getAttribute("data-project");
  var forcedLocale = script && script.getAttribute("data-locale"); // optional: ru|uk|en

  if (!projectKey) {
    console.error("[LelekaWidget] Missing data-project=PUBLIC_KEY on <script> tag");
    return;
  }

  var src = script && script.getAttribute("src");
  var base = "";
  try {
    base = new URL(src, window.location.href).origin;
  } catch (e) {
    base = "";
  }

  var apiBase = base ? base + "/v1" : "/v1";
  var widgetBase = base ? base + "/widget" : "/widget";

  // Avoid double init
  if (window.__LELEKA_WIDGET_MOUNTED__) return;
  window.__LELEKA_WIDGET_MOUNTED__ = true;

  injectCss(widgetBase + "/widget.css");

  var state = {
    config: null,
    history: [],
    isOpen: false,
    isBusy: false,
    isListening: false,
  };

  function mapLocaleToSpeechLang(locale) {
    var l = String(locale || "").toLowerCase();
    if (l === "uk" || l === "ua" || l.startsWith("uk-")) return "uk-UA";
    if (l === "en" || l.startsWith("en-")) return "en-US";
    // default
    return "ru-RU";
  }

  function getSpeechRecognition() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    try {
      return new SR();
    } catch (e) {
      return null;
    }
  }

  function fetchJson(url, opts) {
    return fetch(url, opts).then(function (r) {
      return r
        .text()
        .then(function (t) {
          var data;
          try {
            data = t ? JSON.parse(t) : null;
          } catch (e) {
            data = null;
          }
          if (!r.ok) {
            var msg = (data && data.error && data.error.message) || r.statusText || "Request failed";
            var err = new Error(msg);
            err.status = r.status;
            err.data = data;
            throw err;
          }
          return data;
        });
    });
  }

  function renderMessage(role, text) {
    var list = byId("leleka-widget-messages");
    if (!list) return;

    var bubble = el("div", {
      class: "lw-msg " + (role === "user" ? "lw-msg--user" : "lw-msg--assistant"),
      html: "<div class=\"lw-msg__role\">" + (role === "user" ? "Вы" : "Ассистент") + "</div>" +
        "<div class=\"lw-msg__text\">" + escapeHtml(text).replace(/\n/g, "<br>") + "</div>",
    });

    list.appendChild(bubble);
    list.scrollTop = list.scrollHeight;
  }

  function renderMeta(resp) {
    var meta = byId("leleka-widget-meta");
    if (!meta) return;

    var warnings = (resp && resp.warnings) || [];
    var level = (resp && resp.safetyLevel) || "normal";
    var sources = (resp && resp.sources) || [];

    var parts = [];

    if (warnings.length) {
      parts.push(
        "<div class=\"lw-meta__warnings\"><strong>Предупреждения:</strong><ul>" +
          warnings.map(function (w) { return "<li>" + escapeHtml(w) + "</li>"; }).join("") +
          "</ul></div>"
      );
    }

    if (level && level !== "normal") {
      parts.push(
        "<div class=\"lw-meta__level lw-level-" + escapeHtml(level) + "\">" +
          "Уровень: " + escapeHtml(level) +
        "</div>"
      );
    }

    if (sources.length) {
      parts.push(
        "<details class=\"lw-meta__sources\"><summary>Источники (RAG)</summary>" +
          sources
            .map(function (s) {
              return (
                "<div class=\"lw-source\">" +
                "<div class=\"lw-source__title\">" + escapeHtml(s.title) + "</div>" +
                "<div class=\"lw-source__snippet\">" + escapeHtml(s.snippet) + "</div>" +
                (s.url ? "<div class=\"lw-source__url\"><a target=\"_blank\" rel=\"noopener\" href=\"" + escapeHtml(s.url) + "\">" + escapeHtml(s.url) + "</a></div>" : "") +
                "</div>"
              );
            })
            .join("") +
          "</details>"
      );
    }

    meta.innerHTML = parts.join("");
  }

  function setBusy(isBusy) {
    state.isBusy = isBusy;
    var btn = byId("leleka-widget-send");
    var mic = byId("leleka-widget-mic");
    var input = byId("leleka-widget-input");
    if (btn) btn.disabled = isBusy;
    if (mic) mic.disabled = isBusy;
    if (input) input.disabled = isBusy;
  }

  function openModal() {
    state.isOpen = true;
    var overlay = byId("leleka-widget-overlay");
    if (overlay) overlay.classList.add("lw-open");

    var input = byId("leleka-widget-input");
    if (input) input.focus();
  }

  function closeModal() {
    state.isOpen = false;
    var overlay = byId("leleka-widget-overlay");
    if (overlay) overlay.classList.remove("lw-open");
  }

  function toggleModal() {
    state.isOpen ? closeModal() : openModal();
  }

  function mount() {
    // Button
    var launcher = el("button", { class: "lw-launcher", type: "button", text: "Порадник" });
    launcher.addEventListener("click", toggleModal);

    // Modal structure
    var overlay = el("div", { id: "leleka-widget-overlay", class: "lw-overlay" }, [
      el("div", { class: "lw-modal", role: "dialog", "aria-modal": "true" }, [
        el("div", { class: "lw-header" }, [
          el("div", { class: "lw-title", text: "Лелека — Ассистент" }),
          el("button", { class: "lw-close", type: "button", text: "×", "aria-label": "Close" }),
        ]),
        el("div", { class: "lw-body" }, [
          el("div", { id: "leleka-widget-messages", class: "lw-messages" }),
          el("div", { id: "leleka-widget-meta", class: "lw-meta" }),
        ]),
        el("div", { class: "lw-footer" }, [
          el("button", {
            id: "leleka-widget-mic",
            class: "lw-mic",
            type: "button",
            html:
              '<svg class="lw-mic__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
              '<path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/>' +
              "</svg>",
            title: "Голосовой ввод (если поддерживается браузером)",
            "aria-label": "Голосовой ввод",
          }),
          el("div", { class: "lw-inputwrap" }, [
            el("textarea", {
              id: "leleka-widget-input",
              class: "lw-input",
              rows: "2",
              placeholder: "Напишите вопрос…",
            }),
          ]),
          el("button", { id: "leleka-widget-send", class: "lw-send", type: "button", text: "Отправить" }),
        ]),
        el("div", { id: "leleka-widget-disclaimer", class: "lw-disclaimer" }),
      ]),
    ]);

    document.body.appendChild(launcher);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal();
    });

    overlay.querySelector(".lw-close").addEventListener("click", closeModal);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && state.isOpen) closeModal();
    });

    var sendBtn = byId("leleka-widget-send");
    var micBtn = byId("leleka-widget-mic");
    var input = byId("leleka-widget-input");

    var MIC_ICON =
      '<svg class="lw-mic__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/>' +
      "</svg>";
    var STOP_ICON =
      '<svg class="lw-mic__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<path d="M6 6h12v12H6z"/>' +
      "</svg>";

    function setMicState(listening) {
      if (!micBtn) return;
      if (listening) {
        micBtn.classList.add("lw-mic--active");
        micBtn.innerHTML = STOP_ICON;
        micBtn.title = "Остановить диктовку";
        micBtn.setAttribute("aria-label", "Остановить диктовку");
      } else {
        micBtn.classList.remove("lw-mic--active");
        micBtn.innerHTML = MIC_ICON;
        micBtn.title = "Голосовой ввод (если поддерживается браузером)";
        micBtn.setAttribute("aria-label", "Голосовой ввод");
      }
    }

    // Ensure initial icon/state
    setMicState(false);

    // Voice input (SpeechRecognition API)
    var recognition = getSpeechRecognition();
    if (micBtn) {
      if (!recognition) {
        micBtn.disabled = true;
        micBtn.title = "Голосовой ввод недоступен в этом браузере";
      } else {
        recognition.interimResults = true;
        recognition.continuous = false;

        recognition.onstart = function () {
          state.isListening = true;
          setMicState(true);
        };

        recognition.onend = function () {
          state.isListening = false;
          setMicState(false);
        };

        recognition.onerror = function () {
          // Let onend restore UI
        };

        recognition.onresult = function (event) {
          var transcript = "";
          for (var i = event.resultIndex; i < event.results.length; i++) {
            var res = event.results[i];
            if (res && res[0] && res[0].transcript) transcript += res[0].transcript;
          }
          transcript = String(transcript || "").trim();
          if (!transcript) return;

          // Replace current textarea content with transcript
          input.value = transcript;
        };

        micBtn.addEventListener("click", function () {
          if (state.isBusy) return;
          if (state.isListening) {
            try { recognition.stop(); } catch (e) {}
            return;
          }

          var locale = forcedLocale || (state.config && state.config.localeDefault) || "ru";
          recognition.lang = mapLocaleToSpeechLang(locale);
          try {
            recognition.start();
          } catch (e) {
            // Some browsers throw if start called twice
          }
        });
      }
    }

    function doSend() {
      if (state.isBusy) return;
      var text = (input.value || "").trim();
      if (!text) return;

      input.value = "";
      renderMessage("user", text);

      // Keep history small (server uses last 20 anyway)
      state.history.push({ role: "user", content: text });
      state.history = state.history.slice(-20);

      setBusy(true);

      fetchJson(apiBase + "/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Project-Key": projectKey,
        },
        body: JSON.stringify({
          message: text,
          locale: forcedLocale || (state.config && state.config.localeDefault) || "ru",
          history: state.history,
        }),
      })
        .then(function (resp) {
          var reply = (resp && resp.reply) || "";
          renderMessage("assistant", reply);

          state.history.push({ role: "assistant", content: reply });
          state.history = state.history.slice(-20);

          renderMeta(resp);
        })
        .catch(function (err) {
          var msg = err && err.message ? err.message : "Request failed";
          renderMessage("assistant", "Ошибка: " + msg);
        })
        .finally(function () {
          setBusy(false);
        });
    }

    sendBtn.addEventListener("click", doSend);

    input.addEventListener("keydown", function (e) {
      // Enter to send, Shift+Enter for newline
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        doSend();
      }
    });

    // Load public-config
    fetchJson(apiBase + "/projects/" + encodeURIComponent(projectKey) + "/public-config", {
      method: "GET",
      headers: {
        // path-based access, but still include header to help server logs
        "X-Project-Key": projectKey,
      },
    })
      .then(function (cfg) {
        state.config = cfg;
        var disc = byId("leleka-widget-disclaimer");
        if (disc && cfg && cfg.disclaimer) {
          disc.textContent = cfg.disclaimer;
        }
      })
      .catch(function () {
        // Non-fatal
      });

    // greeting
    renderMessage(
      "assistant",
      "Здравствуйте. Я справочный помощник по теме беременности. Сформулируйте вопрос, и я постараюсь помочь."
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
