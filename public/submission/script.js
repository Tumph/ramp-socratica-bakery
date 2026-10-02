(function () {
  "use strict";

  const form = document.getElementById("submission-form");
  const frame = document.getElementById("google-form-frame");
  const status = document.getElementById("form-status");
  const button = document.getElementById("submit-button");
  const success = document.getElementById("success-panel");
  const fields = Array.from(form.querySelectorAll("input, select, textarea"));
  const requiredKeys = fields.map(field => field.name);
  let pending = false;
  let timer;
  let framePrimed = false;

  // The iframe's initial about:blank load is not a form response.
  frame.addEventListener("load", function () {
    if (!pending || !framePrimed) return;
    finish();
  });

  document.getElementById("submit-another").addEventListener("click", function () {
    form.reset();
    success.hidden = true;
    form.hidden = false;
    status.hidden = true;
    form.querySelector("input").focus();
  });

  fields.forEach(field => {
    field.addEventListener("input", () => clearFieldError(field));
    field.addEventListener("change", () => clearFieldError(field));
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (pending) return;
    status.hidden = true;
    let firstInvalid = null;

    fields.forEach(field => {
      const value = field.value.trim();
      let message = "";
      if (field.required && !value) message = "Please fill out this field.";
      else if (field.type === "email" && value && !field.validity.valid) message = "Enter a valid email address.";
      else if (field.type === "url" && value && !/^https?:\/\//i.test(value)) message = "Use a full link starting with https://";
      else if (field.type === "url" && value && !field.validity.valid) message = "Enter a valid web link.";
      if (message) {
        setFieldError(field, message);
        if (!firstInvalid) firstInvalid = field;
      } else clearFieldError(field);
    });
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    const config = window.BAKERIA_FORM_CONFIG || {};
    const url = config.formResponseUrl || "";
    const entries = config.entries || {};
    const validUrl = /^https:\/\/docs\.google\.com\/forms\/d\/(?:e\/)?[^/]+\/formResponse(?:\?.*)?$/i.test(url);
    const missing = requiredKeys.filter(key => !/^entry\.\d+$/.test(entries[key] || ""));
    if (!validUrl || missing.length) {
      showStatus("error", "This site is not connected yet. The organizer needs to add the Google Form URL and entry IDs in config.js.");
      return;
    }
    if (!navigator.onLine) {
      showStatus("error", "You appear to be offline. Reconnect and try again.");
      return;
    }

    // A native POST to a hidden iframe works on GitHub Pages without a server.
    // Google Forms does not expose a cross-origin success result to JavaScript.
    const payload = document.createElement("form");
    payload.method = "POST";
    payload.action = url;
    payload.target = frame.name;
    payload.style.display = "none";
    requiredKeys.forEach(key => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = entries[key];
      input.value = form.elements[key].value.trim();
      payload.appendChild(input);
    });
    document.body.appendChild(payload);
    pending = true;
    framePrimed = true;
    button.disabled = true;
    button.querySelector(".button-label").textContent = "Sending to Grandma…";
    showStatus("loading", "Sending your project to the Google Form…");
    timer = window.setTimeout(() => {
      if (!pending) return;
      resetPending();
      showStatus("error", "We couldn't tell whether the form loaded. Please check your connection and ask an organizer to verify before trying again.");
    }, 15000);
    payload.submit();
    window.setTimeout(() => payload.remove(), 1000);
  });

  function finish() {
    resetPending();
    form.hidden = true;
    success.hidden = false;
    success.focus();
  }
  function resetPending() {
    pending = false;
    window.clearTimeout(timer);
    button.disabled = false;
    button.querySelector(".button-label").textContent = "Hand it to Grandma";
  }
  function setFieldError(field, message) {
    field.setAttribute("aria-invalid", "true");
    field.setAttribute("aria-describedby", field.id + "-error");
    document.getElementById(field.id + "-error").textContent = message;
  }
  function clearFieldError(field) {
    field.removeAttribute("aria-invalid");
    field.removeAttribute("aria-describedby");
    document.getElementById(field.id + "-error").textContent = "";
  }
  function showStatus(type, message) {
    status.className = "form-status " + type;
    status.textContent = message;
    status.hidden = false;
  }
})();
