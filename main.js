// ---- 백엔드 API 설정 (포트 5000) ----
// Express 라우터가 /api/todos 로 마운트되어 있다고 가정합니다.
const API_BASE_URL = "http://localhost:5000";
const TODOS_ENDPOINT = API_BASE_URL + "/api/todos";

// ---- 영화 API 설정 (오늘의 휴식 보상) ----
const MOVIE_API_URL = "https://example.com/now-playing"; // 여기에 실제 API 주소 입력
const MOVIE_API_KEY = "YOUR_MOVIE_API_KEY"; // 여기에 실제 API Key 입력

// DOM
const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const categorySelect = document.getElementById("todo-category");
const focusToggle = document.getElementById("focus-toggle");
const focusCard = document.getElementById("focus-card");
const categoryRowsEl = document.getElementById("category-rows");
const emptyMsg = document.getElementById("empty-message");
const countEl = document.getElementById("count");
const rewardMoviesEl = document.getElementById("reward-movies");
const rewardErrorEl = document.getElementById("reward-error");
const progressFill = document.getElementById("progress-fill");
const progressPercentEl = document.getElementById("progress-percent");
const confettiCanvas = document.getElementById("confetti-canvas");
const confettiCtx = confettiCanvas ? confettiCanvas.getContext("2d") : null;
const summaryOverlay = document.getElementById("summary-overlay");
const storyMinutesEl = document.getElementById("story-minutes");
const storyCompletedCountEl = document.getElementById("story-completed-count");

let todos = [];
let editingId = null;
let isLoading = false;
let confettiParticles = [];
let confettiAnimationId = null;
const SUMMARY_SHOWN_KEY = "todoapp-summary-shown-date";

function normalizeTodoFromApi(apiTodo) {
  // 백엔드 Todo: { _id, title, completed, importance, estimatedTime, count, aiComfortMessage, createdAt, ... }
  const id = apiTodo._id || apiTodo.id;
  const title = apiTodo.title || apiTodo.text || "";
  return {
    id,
    text: title,
    title,
    done: apiTodo.completed === true,
    completed: apiTodo.completed === true,
    importance: apiTodo.importance ?? 2,
    estimatedTime: apiTodo.estimatedTime ?? 0,
    count: apiTodo.count ?? 0,
    aiComfortMessage: apiTodo.aiComfortMessage || "",
    createdAt: apiTodo.createdAt ? new Date(apiTodo.createdAt).getTime() : Date.now(),
    // 프론트엔드 전용 메타 (카테고리, 포커스)는 있으면 유지
    category: apiTodo.category || "기타",
    isFocus: apiTodo.isFocus === true,
  };
}

// ---- 공통 API 유틸 ----
async function apiRequest(url, options = {}) {
  const config = {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  };

  const res = await fetch(url, config);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      "API 요청 실패 (" + res.status + "): " + (text || res.statusText)
    );
  }
  if (res.status === 204) return null;
  return res.json();
}

async function loadTodos() {
  try {
    isLoading = true;
    const res = await apiRequest(TODOS_ENDPOINT, { method: "GET" });
    const list = res && Array.isArray(res.data) ? res.data : [];
    todos = list.map(normalizeTodoFromApi);
    render();
  } catch (err) {
    console.error("할일 목록 불러오기 실패:", err);
    alert("할일 목록을 불러오지 못했습니다. 백엔드 서버(포트 5000)가 켜져 있는지 확인해주세요.");
  } finally {
    isLoading = false;
  }
}

// ---- 오늘의 휴식 보상: 현재 상영 중인 영화 ----
async function loadRewardMovies() {
  if (!rewardMoviesEl) return;
  // 기본값 그대로면 호출하지 않음
  if (!MOVIE_API_URL || MOVIE_API_URL.includes("example.com")) {
    return;
  }

  rewardMoviesEl.innerHTML =
    '<p class="reward-loading">영화 정보를 불러오는 중입니다...</p>';
  if (rewardErrorEl) rewardErrorEl.textContent = "";

  try {
    const urlWithKey =
      MOVIE_API_URL +
      (MOVIE_API_URL.includes("?") ? "&" : "?") +
      "api_key=" +
      encodeURIComponent(MOVIE_API_KEY);

    const data = await apiRequest(urlWithKey, { method: "GET" });
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data.results)
      ? data.results
      : [];

    rewardMoviesEl.innerHTML = "";

    if (!list.length) {
      rewardMoviesEl.innerHTML =
        '<p class="reward-loading">표시할 영화가 없습니다.</p>';
      return;
    }

    const top = list.slice(0, 8);

    top.forEach((movie) => {
      const card = document.createElement("article");
      card.className = "reward-card";

      const posterWrap = document.createElement("div");
      posterWrap.className = "reward-poster-wrap";

      const img = document.createElement("img");
      img.className = "reward-poster";
      const posterPath = movie.poster_path || movie.image || movie.poster;
      if (posterPath) {
        img.src = posterPath.startsWith("http")
          ? posterPath
          : "https://image.tmdb.org/t/p/w342" + posterPath;
        img.alt = movie.title || movie.name || "영화 포스터";
      } else {
        img.alt = "영화 포스터";
      }
      posterWrap.appendChild(img);

      const body = document.createElement("div");
      body.className = "reward-card-body";

      const title = document.createElement("h3");
      title.className = "reward-title";
      title.textContent = movie.title || movie.name || "제목 미상";

      const meta = document.createElement("div");
      meta.className = "reward-meta";

      const yearTag = document.createElement("span");
      yearTag.className = "reward-tag";
      const dateStr = movie.release_date || movie.first_air_date || "";
      yearTag.textContent = dateStr ? dateStr.slice(0, 4) + " • Now" : "Now";

      const rating = document.createElement("span");
      rating.className = "reward-rating";
      const score = movie.vote_average ?? movie.rating;
      if (score) {
        rating.textContent = "★ " + Number(score).toFixed(1);
      }

      meta.appendChild(yearTag);
      if (score) meta.appendChild(rating);

      body.append(title, meta);
      card.append(posterWrap, body);
      rewardMoviesEl.appendChild(card);
    });
  } catch (err) {
    console.error("영화 정보 불러오기 실패:", err);
    if (rewardErrorEl) {
      rewardErrorEl.textContent =
        "영화 정보를 불러오지 못했습니다. API 주소와 Key를 확인해주세요.";
    }
  }
}

// ---- Confetti (Canvas) ----
function resizeConfettiCanvas() {
  if (!confettiCanvas || !confettiCtx) return;
  confettiCanvas.width = window.innerWidth * window.devicePixelRatio;
  confettiCanvas.height = window.innerHeight * window.devicePixelRatio;
  confettiCtx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
}

if (confettiCanvas && confettiCtx) {
  resizeConfettiCanvas();
  window.addEventListener("resize", resizeConfettiCanvas);
}

function launchConfetti() {
  if (!confettiCanvas || !confettiCtx) return;

  const colors = ["#38bdf8", "#60a5fa", "#a855f7", "#f97316", "#4ade80"];
  const count = 140;
  const w = window.innerWidth;
  const h = window.innerHeight;

  confettiParticles = Array.from({ length: count }).map(() => ({
    x: Math.random() * w,
    y: -20 + Math.random() * 40,
    vx: -2 + Math.random() * 4,
    vy: 2 + Math.random() * 4,
    size: 4 + Math.random() * 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    rotation: Math.random() * Math.PI * 2,
    vr: (-0.2 + Math.random() * 0.4) * Math.PI,
  }));

  const start = performance.now();
  const duration = 900;

  function frame(now) {
    const elapsed = now - start;
    if (elapsed > duration) {
      confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      confettiParticles = [];
      confettiAnimationId = null;
      return;
    }

    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

    confettiParticles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.rotation += p.vr * 0.016;

      confettiCtx.save();
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate(p.rotation);
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.8);
      confettiCtx.restore();
    });

    confettiAnimationId = requestAnimationFrame(frame);
  }

  if (confettiAnimationId) cancelAnimationFrame(confettiAnimationId);
  confettiAnimationId = requestAnimationFrame(frame);
}

function updateCount() {
  const total = todos.length;
  countEl.textContent = "총 " + total + "개";
  emptyMsg.classList.toggle("hidden", total > 0);

  const completed = todos.filter((t) => t.done).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  if (progressPercentEl) {
    progressPercentEl.textContent = percent + "%";
  }
  if (progressFill) {
    progressFill.style.width = percent + "%";
  }

  maybeShowSummaryOverlay(total, completed);
}

function createTodoItem(id, text, done) {
  const li = document.createElement("li");
  li.className = "todo-item" + (done ? " done" : "");
  li.dataset.id = id;

  const textSpan = document.createElement("span");
  textSpan.className = "todo-text";
  textSpan.textContent = text;

  const editInput = document.createElement("input");
  editInput.type = "text";
  editInput.className = "edit-input";
  editInput.value = text;
  editInput.style.display = "none";

  const actions = document.createElement("div");
  actions.className = "todo-actions";

  const doneBtn = document.createElement("button");
  doneBtn.type = "button";
  doneBtn.className = "btn-done";
  doneBtn.textContent = done ? "완료됨" : "완료";
  doneBtn.disabled = done;
  doneBtn.addEventListener("click", function () {
    completeTodo(id);
  });

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "btn-edit";
  editBtn.textContent = "수정";
  editBtn.addEventListener("click", function () {
    startEdit(id);
  });

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn-save";
  saveBtn.textContent = "저장";
  saveBtn.style.display = "none";
  saveBtn.addEventListener("click", function () {
    saveEdit(id, editInput.value.trim());
  });

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn-cancel";
  cancelBtn.textContent = "취소";
  cancelBtn.style.display = "none";
  cancelBtn.addEventListener("click", function () {
    cancelEdit();
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn-delete";
  deleteBtn.textContent = "삭제";
  deleteBtn.addEventListener("click", function () {
    removeTodo(id);
  });

  actions.append(doneBtn, editBtn, saveBtn, cancelBtn, deleteBtn);
  li.append(textSpan, editInput, actions);
  return li;
}

function startEdit(id) {
  if (editingId !== null) cancelEdit();
  editingId = id;
  const li = document.querySelector('[data-id="' + id + '"]');
  if (!li) return;
  const textSpan = li.querySelector(".todo-text");
  const editInput = li.querySelector(".edit-input");
  const editBtn = li.querySelector(".btn-edit");
  const saveBtn = li.querySelector(".btn-save");
  const cancelBtn = li.querySelector(".btn-cancel");
  textSpan.style.display = "none";
  editInput.style.display = "block";
  editInput.value = textSpan.textContent;
  editInput.focus();
  editBtn.style.display = "none";
  saveBtn.style.display = "inline-block";
  cancelBtn.style.display = "inline-block";
}

async function saveEdit(id, newText) {
  if (editingId !== id) return;
  const todo = todos.find(function (t) {
    return t.id === id;
  });
  if (!todo) return cancelEdit();
  if (newText === "") {
    await removeTodo(id);
    cancelEdit();
    return;
  }
  try {
    await apiRequest(TODOS_ENDPOINT + "/" + encodeURIComponent(id), {
      method: "PUT",
      body: JSON.stringify({ title: newText }),
    });
    todo.text = newText;
    todo.title = newText;
    render();
  } catch (err) {
    console.error("수정 실패:", err);
    alert("할일 수정에 실패했습니다.");
  }
  cancelEdit();
}

function cancelEdit() {
  if (editingId === null) return;
  const li = document.querySelector('[data-id="' + editingId + '"]');
  if (li) {
    const textSpan = li.querySelector(".todo-text");
    const editInput = li.querySelector(".edit-input");
    const editBtn = li.querySelector(".btn-edit");
    const saveBtn = li.querySelector(".btn-save");
    const cancelBtn = li.querySelector(".btn-cancel");
    textSpan.style.display = "";
    editInput.style.display = "none";
    editBtn.style.display = "inline-block";
    saveBtn.style.display = "none";
    cancelBtn.style.display = "none";
  }
  editingId = null;
}

/**
 * 할일 추가 - 백엔드 API(포트 5000)로 전송
 */
async function addTodo(text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const addBtn = document.getElementById("add-btn");
  const btnText = addBtn.querySelector(".btn-text");
  addBtn.disabled = true;
  if (btnText) btnText.textContent = "추가 중...";

  try {
    const category = categorySelect ? categorySelect.value : "기타";
    const isFocus = focusToggle ? focusToggle.checked : false;
    const res = await apiRequest(TODOS_ENDPOINT, {
      method: "POST",
      body: JSON.stringify({
        title: trimmed,
        importance: 2,
        estimatedTime: 40,
        completed: false,
        count: 0,
        aiComfortMessage: "",
        // 백엔드 스키마에 없다면 무시되지만, 있다면 함께 저장
        category,
        isFocus,
      }),
    });

    const created = res && res.data ? res.data : null;
    const newTodo = created
      ? normalizeTodoFromApi(created)
      : {
          id: Date.now().toString(36),
          text: trimmed,
          title: trimmed,
          category,
          isFocus,
          done: false,
          completed: false,
          importance: 2,
          estimatedTime: 40,
          count: 0,
          aiComfortMessage: "",
          createdAt: Date.now(),
        };

    todos.push(newTodo);
    render();

    input.value = "";
    input.focus();
    if (focusToggle) focusToggle.checked = false;
  } catch (err) {
    console.error("할일 추가 실패:", err);
    alert("할일 추가에 실패했습니다. 네트워크와 서버 상태를 확인해주세요.");
  } finally {
    addBtn.disabled = false;
    if (btnText) btnText.textContent = "추가";
  }
}

async function removeTodo(id) {
  if (editingId === id) editingId = null;
  try {
    await apiRequest(TODOS_ENDPOINT + "/" + encodeURIComponent(id), {
      method: "DELETE",
    });
    todos = todos.filter((t) => t.id !== id);
    render();
  } catch (err) {
    console.error("삭제 실패:", err);
    alert("할일 삭제에 실패했습니다.");
  }
}

// ---- 오늘의 요약 (Story overlay) ----
function formatTodayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

function openSummaryOverlay(minutes, completed) {
  if (!summaryOverlay) return;
  if (storyMinutesEl) storyMinutesEl.textContent = String(minutes);
  if (storyCompletedCountEl) {
    storyCompletedCountEl.textContent = completed + "개의 할 일";
  }
  summaryOverlay.classList.add("is-open");
  summaryOverlay.setAttribute("aria-hidden", "false");

  const todayKey = formatTodayKey();
  try {
    localStorage.setItem(SUMMARY_SHOWN_KEY, todayKey);
  } catch {
    // ignore
  }
}

function closeSummaryOverlay() {
  if (!summaryOverlay) return;
  summaryOverlay.classList.remove("is-open");
  summaryOverlay.setAttribute("aria-hidden", "true");
}

if (summaryOverlay) {
  summaryOverlay.addEventListener("click", function (e) {
    if (e.target === summaryOverlay) {
      closeSummaryOverlay();
    }
  });
}

function maybeShowSummaryOverlay(total, completed) {
  if (!summaryOverlay) return;
  if (!total || !completed) return;

  const now = new Date();
  const hour = now.getHours();
  if (hour < 23) return;

  const todayKey = formatTodayKey();
  try {
    const stored = localStorage.getItem(SUMMARY_SHOWN_KEY);
    if (stored === todayKey) return;
  } catch {
    // ignore
  }

  const minutes = completed * 40; // 할 일 1개당 40분 집중으로 가정
  openSummaryOverlay(minutes, completed);
}

async function completeTodo(id) {
  const todo = todos.find((t) => t.id === id);
  if (!todo || todo.done) return;

  const li = document.querySelector('[data-id="' + id + '"]');
  if (li) {
    li.classList.add("todo-item--completing");
  }

  try {
    await apiRequest(TODOS_ENDPOINT + "/" + encodeURIComponent(id), {
      method: "PUT",
      body: JSON.stringify({ completed: true }),
    });
    todo.done = true;
    todo.completed = true;
    launchConfetti();
    setTimeout(function () {
      render();
    }, 450);
  } catch (err) {
    console.error("완료 처리 실패:", err);
    alert("할일 완료 처리에 실패했습니다.");
    if (li) {
      li.classList.remove("todo-item--completing");
    }
  }
}

function renderFocus() {
  if (!focusCard) return;

  focusCard.innerHTML = "";

  const focusTodo =
    todos.find((t) => t.isFocus) || (todos.length > 0 ? todos[0] : null);

  if (!focusTodo) {
    focusCard.classList.add("focus-card--empty");
    const main = document.createElement("p");
    main.className = "focus-empty-main";
    main.textContent = "아직 오늘의 집중할 일을 선택하지 않았어요.";
    const sub = document.createElement("p");
    sub.className = "focus-empty-sub";
    sub.textContent =
      "위에서 체크박스를 선택해 오늘의 단 하나의 일을 지정해 보세요.";
    focusCard.append(main, sub);
    return;
  }

  focusCard.classList.remove("focus-card--empty");
  const title = document.createElement("p");
  title.className = "focus-text";
  title.textContent = focusTodo.title || focusTodo.text || "";

  const meta = document.createElement("p");
  meta.className = "focus-meta";
  meta.textContent = focusTodo.category || "Inbox";

  focusCard.append(title, meta);
}

function renderCategories() {
  if (!categoryRowsEl) return;

  categoryRowsEl.innerHTML = "";

  if (!todos.length) {
    emptyMsg.classList.remove("hidden");
    return;
  }

  emptyMsg.classList.add("hidden");

  const groups = new Map();
  todos.forEach((todo) => {
    const category = todo.category || "기타";
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(todo);
  });

  const sortedCategories = Array.from(groups.keys()).sort();

  sortedCategories.forEach((category) => {
    const items = groups.get(category);

    const row = document.createElement("section");
    row.className = "category-row";

    const header = document.createElement("div");
    header.className = "category-row-header";

    const title = document.createElement("h2");
    title.className = "category-row-title";
    title.textContent = category;

    const count = document.createElement("span");
    count.className = "category-row-count";
    count.textContent = items.length + "개";

    header.append(title, count);

    const scroll = document.createElement("div");
    scroll.className = "category-scroll";

    items.forEach((todo) => {
      scroll.appendChild(
        createTodoItem(todo.id, todo.title || todo.text || "", todo.done)
      );
    });

    row.append(header, scroll);
    categoryRowsEl.appendChild(row);
  });
}

function render() {
  // createdAt이 있으면 사용해 정렬, 없으면 원본 순서 유지
  todos.sort((a, b) => {
    if (!a.createdAt && !b.createdAt) return 0;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });

  renderFocus();
  renderCategories();
  updateCount();
}

form.addEventListener("submit", function (e) {
  e.preventDefault();
  addTodo(input.value);
});

// 초기 로드 시 백엔드에서 할일 목록 불러오기
loadTodos();
// 동시에 영화 보상 섹션도 로드
loadRewardMovies();
