import {
  onReady,
  qs,
  qsa,
  createId,
  getBaseUrl,
  copyToClipboard,
  saveLocal,
  loadLocal,
  setStoredHost,
  getStoredHost,
  STORAGE_KEYS,
  formatTime,
  setBadge,
  showToast,
} from "./app.js";
import { getStore } from "./store.js";
import { renderQrCode } from "./qr.js";
import { initWheel, spinWheel } from "./wheel.js";
import { createSoundboard } from "./sound.js";

const store = getStore();

const createSessionPayload = (sessionId, hostId) => ({
  id: sessionId,
  createdAt: Date.now(),
  status: "lobby",
  hostId,
  teams: [],
  players: [],
  questions: [],
  game: {
    currentQuestionId: null,
    roundState: "lobby",
    timer: {
      startAt: null,
      durationSec: 60,
    },
    answers: {},
  },
});

const getSessionIdFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("session");
};

const ensureSessionAccess = async () => {
  const urlSession = getSessionIdFromUrl();
  if (urlSession) return urlSession.toUpperCase();
  const lastSession = loadLocal(STORAGE_KEYS.lastSession, "");
  return lastSession || "";
};

const renderModeBadge = () => {
  setBadge(store.mode === "firebase" ? "ONLINE (Firebase)" : "DEMO (Offline)");
};

const renderTeamsOptions = (select, teams) => {
  select.innerHTML = "";
  if (!teams.length) {
    const option = document.createElement("option");
    option.textContent = "Команды не созданы";
    option.disabled = true;
    option.selected = true;
    select.append(option);
    return;
  }
  teams.forEach((team) => {
    const option = document.createElement("option");
    option.value = team.id;
    option.textContent = team.name;
    select.append(option);
  });
};

const renderScoreboard = (container, teams) => {
  container.innerHTML = "";
  teams.forEach((team) => {
    const row = document.createElement("div");
    row.className = "score-row";
    row.innerHTML = `<span>${team.name}</span><strong>${team.score ?? 0}</strong>`;
    container.append(row);
  });
};

const renderQuestionList = (container, questions) => {
  container.innerHTML = "";
  if (!questions.length) {
    container.innerHTML = "<p>Вопросов нет. Добавьте первый.</p>";
    return;
  }
  questions.forEach((question) => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.dataset.id = question.id;
    item.innerHTML = `
      <strong>${question.text.slice(0, 80)}</strong>
      <span>Ответ: ${question.answer || "—"}</span>
      <span class="status-pill">${question.used ? "Сыгран" : "В пуле"}</span>
      <div class="inline">
        <button class="button secondary" data-action="edit">Редактировать</button>
        <button class="button ghost" data-action="delete">Удалить</button>
      </div>
    `;
    container.append(item);
  });
};

const renderQuestionForPlayers = (container, question) => {
  container.textContent = question ? question.text : "Ожидаем вопрос.";
};

const updateTimer = (element, timer) => {
  if (!timer?.startAt) {
    element.textContent = "—";
    return;
  }
  const elapsed = (Date.now() - timer.startAt) / 1000;
  const remaining = Math.max(0, timer.durationSec - elapsed);
  element.textContent = formatTime(remaining);
};

const enableToastStyles = () => {
  const toast = qs("#toast");
  if (!toast) return;
  toast.style.opacity = "0";
  toast.style.transition = "opacity 0.25s ease";
  const observer = new MutationObserver(() => {
    toast.style.opacity = toast.classList.contains("show") ? "1" : "0";
  });
  observer.observe(toast, { attributes: true, attributeFilter: ["class"] });
};

const initIndex = () => {
  const createButton = qs("#create-session");
  const sessionBlock = qs("#session-block");
  const sessionCode = qs("#session-code");
  const sessionLink = qs("#session-link");
  const copyButton = qs("#copy-link");
  const hostButton = qs("#go-host");
  const qrTarget = qs("#qr-target");

  createButton?.addEventListener("click", async () => {
    const sessionId = createId(6);
    const hostId = createId(10);
    const payload = createSessionPayload(sessionId, hostId);
    await store.createSession(payload);
    saveLocal(STORAGE_KEYS.lastSession, sessionId);
    setStoredHost({ sessionId, hostId });

    const joinUrl = `${getBaseUrl()}join.html?session=${sessionId}`;
    sessionBlock.hidden = false;
    sessionCode.textContent = sessionId;
    sessionLink.textContent = joinUrl;
    sessionLink.href = joinUrl;
    hostButton.href = `${getBaseUrl()}host.html?session=${sessionId}`;

    renderQrCode(qrTarget, joinUrl);
    showToast("Сессия создана", "success");
  });

  copyButton?.addEventListener("click", async () => {
    const link = sessionLink.textContent;
    if (!link) return;
    const ok = await copyToClipboard(link);
    showToast(ok ? "Ссылка скопирована" : "Не удалось скопировать", ok ? "success" : "error");
  });
};

const initJoin = async () => {
  const sessionInput = qs("#session-input");
  const teamSelect = qs("#team-select");
  const joinButton = qs("#join-session");
  const statusText = qs("#join-status");

  let currentSession = null;

  if (joinButton) joinButton.disabled = true;

  const loadSession = async (sessionId) => {
    if (!sessionId) return;
    const session = await store.getSession(sessionId.toUpperCase());
    currentSession = session;
    if (!session) {
      statusText.textContent = "Сессия не найдена.";
      teamSelect.innerHTML = "";
      joinButton.disabled = true;
      return;
    }
    statusText.textContent = `Сессия активна. Команд: ${session.teams.length}`;
    renderTeamsOptions(teamSelect, session.teams);
    joinButton.disabled = false;
  };

  joinButton?.addEventListener("click", async () => {
    if (!currentSession) return;
    if (!currentSession.teams.length) {
      showToast("Команды еще не созданы", "error");
      return;
    }
    saveLocal(STORAGE_KEYS.lastSession, currentSession.id);
    window.location.href = `${getBaseUrl()}player.html?session=${currentSession.id}`;
  });

  const presetSession = getSessionIdFromUrl();
  if (presetSession) sessionInput.value = presetSession.toUpperCase();

  sessionInput?.addEventListener("change", () => loadSession(sessionInput.value.trim()));
  if (sessionInput?.value) await loadSession(sessionInput.value.trim());
};

const initHost = async () => {
  const sessionId = await ensureSessionAccess();
  const statusText = qs("#host-status");
  const teamCountInput = qs("#team-count");
  const teamFields = qs("#team-fields");
  const saveTeamsButton = qs("#save-teams");
  const teamList = qs("#team-list");
  const lobbyButton = qs("#open-lobby");
  const questionForm = qs("#question-form");
  const questionList = qs("#question-list");
  const questionCount = qs("#question-count");

  if (!sessionId) {
    statusText.textContent = "Нет активной сессии.";
    return;
  }

  let currentSession = await store.getSession(sessionId);
  const hostData = getStoredHost();

  if (!currentSession) {
    statusText.textContent = "Сессия не найдена.";
    return;
  }

  const renderTeams = (teams) => {
    teamList.innerHTML = "";
    if (!teams.length) {
      teamList.innerHTML = "<p>Команды не созданы.</p>";
      return;
    }
    teams.forEach((team) => {
      const item = document.createElement("div");
      item.className = "list-item";
      item.innerHTML = `
        <strong>${team.name}</strong>
        <span>Очки: <strong>${team.score ?? 0}</strong></span>
      `;
      teamList.append(item);
    });
  };

  const renderFields = (count) => {
    teamFields.innerHTML = "";
    for (let i = 0; i < count; i += 1) {
      const field = document.createElement("div");
      field.className = "field";
      field.innerHTML = `
        <label>Команда ${i + 1}</label>
        <input type="text" data-team-name placeholder="Введите название" />
      `;
      teamFields.append(field);
    }
  };

  teamCountInput?.addEventListener("change", () => {
    const count = Math.max(1, Number(teamCountInput.value || 1));
    renderFields(count);
  });

  if (teamCountInput) {
    renderFields(Number(teamCountInput.value || 1));
  }

  saveTeamsButton?.addEventListener("click", async () => {
    if (hostData?.hostId !== currentSession.hostId) {
      showToast("Только ведущий может сохранить команды", "error");
      return;
    }
    const names = qsa("[data-team-name]", teamFields)
      .map((input) => input.value.trim())
      .filter(Boolean);
    if (!names.length) {
      showToast("Введите хотя бы одно название", "error");
      return;
    }
    const teams = names.map((name) => ({
      id: createId(4),
      name,
      score: 0,
    }));
    currentSession = await store.updateSession(sessionId, { teams });
    renderTeams(currentSession.teams);
    showToast("Команды сохранены", "success");
  });

  let editingId = null;

  const updateQuestionsView = (session) => {
    renderQuestionList(questionList, session.questions);
    questionCount.textContent = String(session.questions.length);
  };

  questionForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = qs("#question-text").value.trim();
    const answer = qs("#question-answer").value.trim();
    const comment = qs("#question-comment").value.trim();
    if (!text || !answer) {
      showToast("Заполните вопрос и ответ", "error");
      return;
    }
    const payload = { id: editingId || createId(8), text, answer, comment, used: false };
    currentSession = await store.updateSession(sessionId, (session) => {
      const nextQuestions = editingId
        ? session.questions.map((item) => (item.id === editingId ? payload : item))
        : [...session.questions, payload];
      return { ...session, questions: nextQuestions };
    });
    editingId = null;
    questionForm.reset();
    updateQuestionsView(currentSession);
  });

  questionList?.addEventListener("click", async (event) => {
    const action = event.target.dataset.action;
    const item = event.target.closest(".list-item");
    if (!action || !item) return;
    const questionId = item.dataset.id;
    const question = currentSession.questions.find((q) => q.id === questionId);
    if (!question) return;
    if (action === "edit") {
      editingId = questionId;
      qs("#question-text").value = question.text;
      qs("#question-answer").value = question.answer;
      qs("#question-comment").value = question.comment || "";
      showToast("Редактирование вопроса", "info");
    }
    if (action === "delete") {
      currentSession = await store.updateSession(sessionId, (session) => ({
        ...session,
        questions: session.questions.filter((q) => q.id !== questionId),
      }));
      updateQuestionsView(currentSession);
    }
  });

  lobbyButton.href = `${getBaseUrl()}game.html?session=${sessionId}`;
  renderTeams(currentSession.teams);
  updateQuestionsView(currentSession);

  await store.subscribe(sessionId, (session) => {
    if (!session) return;
    currentSession = session;
    renderTeams(session.teams);
    updateQuestionsView(session);
  });
};

const initPlayer = async () => {
  const sessionId = await ensureSessionAccess();
  const statusText = qs("#player-status");
  const questionBox = qs("#player-question");
  const timerBox = qs("#player-timer");
  const scoreboard = qs("#player-scoreboard");
  const stateLabel = qs("#round-state");

  if (!sessionId) {
    statusText.textContent = "Нет активной сессии.";
    return;
  }

  await store.subscribe(sessionId, (session) => {
    if (!session) return;
    statusText.textContent = "Подключено";
    renderScoreboard(scoreboard, session.teams);
    const question = session.questions.find((q) => q.id === session.game.currentQuestionId);
    renderQuestionForPlayers(questionBox, question);
    stateLabel.textContent = session.game.roundState;
    updateTimer(timerBox, session.game.timer);
  });

  setInterval(async () => {
    const session = await store.getSession(sessionId);
    if (!session) return;
    updateTimer(timerBox, session.game.timer);
  }, 1000);
};

const initGame = async () => {
  const sessionId = await ensureSessionAccess();
  const statusText = qs("#game-status");
  const spinButton = qs("#spin-button");
  const startButton = qs("#start-button");
  const nextButton = qs("#next-round");
  const replayButton = qs("#replay-spin");
  const exportButton = qs("#export-json");
  const durationSelect = qs("#timer-duration");
  const questionBox = qs("#game-question");
  const answerList = qs("#answer-list");
  const saveAnswersButton = qs("#save-answers");
  const scoreboard = qs("#game-scoreboard");
  const timerBox = qs("#game-timer");
  const roundState = qs("#game-round-state");
  const volumeControl = qs("#volume");
  const muteButton = qs("#mute-sound");

  if (!sessionId) {
    statusText.textContent = "Нет активной сессии.";
    return;
  }

  let currentSession = await store.getSession(sessionId);
  if (!currentSession) {
    statusText.textContent = "Сессия не найдена.";
    return;
  }

  const host = getStoredHost();
  const wheel = initWheel(qs("#wheel"));
  const soundboard = createSoundboard();
  let isMuted = false;

  qsa("[data-sound]").forEach((button) => {
    button.addEventListener("click", () => soundboard.play(button.dataset.sound));
  });

  volumeControl?.addEventListener("input", () => {
    soundboard.setVolume(Number(volumeControl.value));
  });

  muteButton?.addEventListener("click", () => {
    isMuted = !isMuted;
    soundboard.mute(isMuted);
    muteButton.textContent = isMuted ? "Unmute" : "Mute";
  });

  const renderAnswerInputs = (session) => {
    answerList.innerHTML = "";
    session.teams.forEach((team) => {
      const row = document.createElement("div");
      row.className = "list-item";
      const existing = session.game.answers?.[team.id];
      row.innerHTML = `
        <div class="answer-meta">
          <strong>${team.name}</strong>
          <span class="status-pill">${existing?.text ? "Есть ответ" : "Нет ответа"}</span>
        </div>
        <div class="field">
          <label for="answer-${team.id}">Ответ</label>
          <input id="answer-${team.id}" type="text" data-answer-input="${team.id}" value="${existing?.text || ""}" />
        </div>
        <div class="inline">
          <button class="button secondary" data-score="yes" data-team="${team.id}">Засчитать</button>
          <button class="button ghost" data-score="clear" data-team="${team.id}">Очистить</button>
        </div>
      `;
      answerList.append(row);
    });
  };

  const updateView = (session) => {
    renderScoreboard(scoreboard, session.teams);
    const question = session.questions.find((q) => q.id === session.game.currentQuestionId);
    renderQuestionForPlayers(questionBox, question);
    roundState.textContent = session.game.roundState;
    updateTimer(timerBox, session.game.timer);
    renderAnswerInputs(session);
  };

  const requireHost = () => {
    if (!host || host.hostId !== currentSession.hostId) {
      showToast("Только ведущий может управлять игрой", "error");
      return false;
    }
    return true;
  };

  spinButton?.addEventListener("click", async () => {
    if (!requireHost()) return;
    const available = currentSession.questions.filter((q) => !q.used);
    if (!available.length) {
      showToast("Вопросы закончились", "error");
      return;
    }
    soundboard.play("spin");
    const selected = spinWheel(wheel, available.map((q) => q.id));
    currentSession = await store.updateSession(sessionId, (session) => ({
      ...session,
      game: {
        ...session.game,
        currentQuestionId: selected,
        roundState: "reading",
      },
    }));
    updateView(currentSession);
  });

  startButton?.addEventListener("click", async () => {
    if (!requireHost()) return;
    if (!currentSession.game.currentQuestionId) {
      showToast("Сначала раскрутите волчок", "error");
      return;
    }
    const duration = Number(durationSelect.value || 60);
    soundboard.play("gong");
    currentSession = await store.updateSession(sessionId, (session) => ({
      ...session,
      game: {
        ...session.game,
        roundState: "answering",
        timer: { startAt: Date.now(), durationSec: duration },
      },
      questions: session.questions.map((q) =>
        q.id === session.game.currentQuestionId ? { ...q, used: true } : q
      ),
    }));
    updateView(currentSession);
  });

  replayButton?.addEventListener("click", async () => {
    if (!requireHost()) return;
    currentSession = await store.updateSession(sessionId, (session) => ({
      ...session,
      game: {
        ...session.game,
        currentQuestionId: null,
        roundState: "spinning",
      },
    }));
    updateView(currentSession);
  });

  nextButton?.addEventListener("click", async () => {
    if (!requireHost()) return;
    soundboard.play("end");
    currentSession = await store.updateSession(sessionId, (session) => ({
      ...session,
      game: {
        currentQuestionId: null,
        roundState: "lobby",
        timer: { startAt: null, durationSec: session.game.timer.durationSec },
        answers: {},
      },
    }));
    updateView(currentSession);
  });

  saveAnswersButton?.addEventListener("click", async () => {
    if (!requireHost()) return;
    const inputs = qsa("[data-answer-input]", answerList);
    const nextAnswers = inputs.reduce((acc, input) => {
      const value = input.value.trim();
      if (value) {
        acc[input.dataset.answerInput] = { text: value, submittedAt: Date.now() };
      }
      return acc;
    }, {});
    currentSession = await store.updateSession(sessionId, (session) => ({
      ...session,
      game: {
        ...session.game,
        answers: nextAnswers,
      },
    }));
    updateView(currentSession);
    showToast("Ответы сохранены", "success");
  });

  answerList?.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (!requireHost()) return;
    const teamId = button.dataset.team;
    if (button.dataset.score === "yes") {
      currentSession = await store.updateSession(sessionId, (session) => ({
        ...session,
        teams: session.teams.map((team) =>
          team.id === teamId ? { ...team, score: (team.score || 0) + 1 } : team
        ),
      }));
      showToast("Очко добавлено", "success");
      updateView(currentSession);
    }
    if (button.dataset.score === "clear") {
      currentSession = await store.updateSession(sessionId, (session) => {
        const nextAnswers = { ...(session.game.answers || {}) };
        delete nextAnswers[teamId];
        return {
          ...session,
          game: {
            ...session.game,
            answers: nextAnswers,
          },
        };
      });
      updateView(currentSession);
      showToast("Ответ очищен", "info");
    }
  });

  exportButton?.addEventListener("click", () => {
    const data = JSON.stringify(currentSession, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `step3d-${sessionId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  await store.subscribe(sessionId, (session) => {
    if (!session) return;
    currentSession = session;
    updateView(session);
  });

  setInterval(async () => {
    const session = await store.getSession(sessionId);
    if (!session) return;
    updateTimer(timerBox, session.game.timer);
  }, 1000);
};

export const initPage = () => {
  renderModeBadge();
  enableToastStyles();
  const page = document.body.dataset.page;
  if (page === "index") initIndex();
  if (page === "join") initJoin();
  if (page === "host") initHost();
  if (page === "player") initPlayer();
  if (page === "game") initGame();
};

onReady(initPage);
