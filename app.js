(function () {
  "use strict";

  var TASKS_KEY = "mystudio.tasks.v1";
  var NOTES_KEY = "mystudio.notes.v1";
  var VIEWS = ["tasks", "notes", "ideas"];

  // ---------- storage ----------
  function load(key) {
    try {
      var raw = localStorage.getItem(key);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  function save(key, list) {
    localStorage.setItem(key, JSON.stringify(list));
  }
  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function esc(text) {
    var d = document.createElement("div");
    d.textContent = String(text);
    return d.innerHTML;
  }

  // ---------- routing ----------
  function currentView() {
    var v = (location.hash || "#tasks").slice(1);
    return VIEWS.indexOf(v) === -1 ? "tasks" : v;
  }
  function showView() {
    var v = currentView();
    renderTasks();
    renderNotes();
    VIEWS.forEach(function (name) {
      document.getElementById("view-" + name).hidden = name !== v;
    });
    document.querySelectorAll(".tab").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("data-view") === v);
    });
  }

  // ---------- tasks ----------
  function renderTasks() {
    var tasks = load(TASKS_KEY);
    var list = document.getElementById("task-list");
    var open = tasks.filter(function (t) { return !t.done; }).length;
    document.getElementById("task-count").textContent =
      tasks.length === 0 ? "" : open + " open, " + (tasks.length - open) + " done";
    if (tasks.length === 0) {
      list.innerHTML = '<li class="empty">No tasks yet. Add one above.</li>';
      return;
    }
    list.innerHTML = tasks.map(function (t) {
      return '<li class="item' + (t.done ? " done" : "") + '" data-id="' + esc(t.id) + '">' +
        '<input type="checkbox" class="toggle" aria-label="Mark done" ' + (t.done ? "checked" : "") + ">" +
        '<div class="body">' + esc(t.title) + "</div>" +
        '<div class="actions"><button type="button" class="danger delete">Delete</button></div>' +
        "</li>";
    }).join("");
  }

  document.getElementById("task-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var input = document.getElementById("task-input");
    var title = input.value.trim();
    if (!title) return;
    var tasks = load(TASKS_KEY);
    tasks.unshift({ id: newId(), title: title, done: false, created: new Date().toISOString() });
    save(TASKS_KEY, tasks);
    input.value = "";
    renderTasks();
  });

  document.getElementById("task-list").addEventListener("click", function (e) {
    var item = e.target.closest(".item");
    if (!item) return;
    var id = item.getAttribute("data-id");
    var tasks = load(TASKS_KEY);
    if (e.target.classList.contains("delete")) {
      tasks = tasks.filter(function (t) { return t.id !== id; });
    } else if (e.target.classList.contains("toggle")) {
      tasks = tasks.map(function (t) {
        return t.id === id ? Object.assign({}, t, { done: e.target.checked }) : t;
      });
    } else {
      return;
    }
    save(TASKS_KEY, tasks);
    renderTasks();
  });

  // ---------- notes ----------
  function renderNotes() {
    var notes = load(NOTES_KEY);
    var list = document.getElementById("note-list");
    if (notes.length === 0) {
      list.innerHTML = '<li class="empty">No notes yet.</li>';
      return;
    }
    list.innerHTML = notes.map(function (n) {
      var when = new Date(n.created).toLocaleString();
      return '<li class="item" data-id="' + esc(n.id) + '"><div class="body">' +
        (n.title ? '<div class="title">' + esc(n.title) + "</div>" : "") +
        esc(n.body) + '<div class="meta">' + esc(when) + "</div></div>" +
        '<div class="actions"><button type="button" class="danger delete-note">Delete</button></div></li>';
    }).join("");
  }

  document.getElementById("note-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var titleEl = document.getElementById("note-title");
    var bodyEl = document.getElementById("note-body");
    var body = bodyEl.value.trim();
    if (!body) return;
    var notes = load(NOTES_KEY);
    notes.unshift({
      id: newId(),
      title: titleEl.value.trim(),
      body: body,
      created: new Date().toISOString()
    });
    save(NOTES_KEY, notes);
    titleEl.value = "";
    bodyEl.value = "";
    renderNotes();
  });

  document.getElementById("note-list").addEventListener("click", function (e) {
    if (!e.target.classList.contains("delete-note")) return;
    var id = e.target.closest(".item").getAttribute("data-id");
    save(NOTES_KEY, load(NOTES_KEY).filter(function (n) { return n.id !== id; }));
    renderNotes();
  });

  // ---------- ideas ----------
  var ideas = [];
  var currentIdea = "";
  var lastIdx = -1;

  function pickIdea() {
    if (ideas.length === 0) return "";
    var idx;
    do {
      idx = Math.floor(Math.random() * ideas.length);
    } while (ideas.length > 1 && idx === lastIdx);
    lastIdx = idx;
    return ideas[idx];
  }

  document.getElementById("idea-next").addEventListener("click", function () {
    currentIdea = pickIdea() || "No ideas loaded.";
    document.getElementById("idea-text").textContent = currentIdea;
    document.getElementById("idea-save").disabled = !ideas.length;
  });

  document.getElementById("idea-save").addEventListener("click", function () {
    if (!currentIdea) return;
    var tasks = load(TASKS_KEY);
    tasks.unshift({ id: newId(), title: currentIdea, done: false, created: new Date().toISOString() });
    save(TASKS_KEY, tasks);
    renderTasks();
    document.getElementById("idea-save").textContent = "Added to tasks";
    setTimeout(function () {
      document.getElementById("idea-save").textContent = "Add as task";
    }, 1500);
  });

  // ---------- boot ----------
  fetch("config.json")
    .then(function (r) { return r.json(); })
    .then(function (cfg) {
      if (cfg.appName) {
        document.getElementById("app-name").textContent = cfg.appName;
        document.title = cfg.appName;
      }
    })
    .catch(function () { /* keep the default name in the page */ });

  fetch("ideas.json")
    .then(function (r) { return r.json(); })
    .then(function (list) { ideas = Array.isArray(list) ? list : []; })
    .catch(function () { ideas = []; });

  window.addEventListener("hashchange", showView);
  renderTasks();
  renderNotes();
  showView();
})();
