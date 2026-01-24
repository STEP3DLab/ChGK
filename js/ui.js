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
  setStoredUser,
  getStoredUser,
  STORAGE_KEYS,
  formatTime,
  setBadge,
  showToast,
  normalizeSessionId,
  escapeHtml,
} from "./app.js";
import { getStore } from "./store.js";
import { renderQrCode } from "./qr.js";
import { initWheel, spinWheel } from "./wheel.js";
import { createSoundboard } from "./sound.js";

const store = getStore();

const SAMPLE_QUESTION_TEMPLATES = [
  {
    text: "Сколько будет 7 + 5?",
    answer: "12",
    comment: "Проверка базовой арифметики.",
  },
  {
    text: "Столица Франции?",
    answer: "Париж",
    comment: "Базовый географический вопрос.",
  },
  {
    text: "Кто написал роман «Война и мир»?",
    answer: "Лев Толстой",
    comment: "Тестовый вопрос по литературе.",
  },
];

const createSampleQuestions = (teams) =>
  teams.flatMap((team) =>
    SAMPLE_QUESTION_TEMPLATES.map((template) => ({
      ...template,
      id: createId(8),
      teamId: team.id,
      used: false,
    })),
  );

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
    revealAnswer: false,
  },
});

const getSessionIdFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  return normalizeSessionId(params.get("session"));
};

const ensureSessionAccess = async () => {
  const urlSession = getSessionIdFromUrl();
  if (urlSession) return urlSession;
  const lastSession = normalizeSessionId(loadLocal(STORAGE_KEYS.lastSession, ""));
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
  [...teams]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .forEach((team) => {
    const row = document.createElement("div");
    row.className = "score-row";
    row.innerHTML = `<span>${escapeHtml(team.name)}</span><strong>${team.score ?? 0}</strong>`;
    container.append(row);
    });
};

const renderPlayersList = (container, players, teams) => {
  const teamMap = Object.fromEntries(teams.map((team) => [team.id, team.name]));
  container.innerHTML = "";
  if (!players.length) {
    container.innerHTML = "<p class=\"empty-state\">Пока никто не подключился.</p>";
    return;
  }
  players.forEach((player) => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <strong>${escapeHtml(player.name || "Без имени")}</strong>
      <span class="status-pill ${player.role === "captain" ? "info" : "success"}">
        ${player.role === "captain" ? "Капитан" : "Участник"}
      </span>
      <span>${escapeHtml(teamMap[player.teamId] || "Без команды")}</span>
    `;
    container.append(item);
  });
};

const renderQuestionList = (container, questions) => {
  container.innerHTML = "";
  if (!questions.length) {
    container.innerHTML = "<p class=\"empty-state\">Вопросов нет. Добавьте первый.</p>";
    return;
  }
  questions.forEach((question) => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.dataset.id = question.id;
    item.innerHTML = `
      <strong>${escapeHtml(question.text.slice(0, 80))}</strong>
      <span>Ответ: ${escapeHtml(question.answer || "—")}</span>
      <span class="status-pill ${question.used ? "warning" : "success"}">
        ${question.used ? "Сыгран" : "В пуле"}
      </span>
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

const updateTimer = (element, timer, progress) => {
  if (!element) return;
  if (!timer?.startAt) {
    element.textContent = "—";
    element.classList.remove("is-ending");
    if (progress) {
      progress.style.width = "0%";
      progress.parentElement?.classList.remove("is-ending");
    }
    return;
  }
  const elapsed = (Date.now() - timer.startAt) / 1000;
  const remaining = Math.max(0, timer.durationSec - elapsed);
  const percent = timer.durationSec ? Math.max(0, Math.min(100, (remaining / timer.durationSec) * 100)) : 0;
  element.textContent = formatTime(remaining);
  const isEnding = remaining <= 10;
  element.classList.toggle("is-ending", isEnding);
  if (progress) {
    progress.style.width = `${percent}%`;
    progress.parentElement?.classList.toggle("is-ending", isEnding);
  }
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
  const roleButtons = qsa("[data-role]");
  const captainCodeField = qs("#captain-code-field");
  const captainCodeInput = qs("#captain-code");
  const joinButton = qs("#join-session");
  const statusText = qs("#join-status");
  const nameInput = qs("#player-name");
  const clearButton = qs("#clear-session");

  let currentSession = null;
  let selectedRole = "player";

  const loadSession = async (sessionId) => {
    const normalizedId = normalizeSessionId(sessionId);
    if (!normalizedId) return;
    const session = await store.getSession(normalizedId);
    currentSession = session;
    if (!session) {
      statusText.textContent = "Сессия не найдена.";
      teamSelect.innerHTML = "";
      return;
    }
    statusText.textContent = `Сессия активна. Команд: ${session.teams.length}`;
    renderTeamsOptions(teamSelect, session.teams);
  };

  roleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      roleButtons.forEach((btn) => btn.classList.remove("active"));
      roleButtons.forEach((btn) => btn.setAttribute("aria-pressed", "false"));
      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");
      selectedRole = button.dataset.role;
      captainCodeField.hidden = selectedRole !== "captain";
    });
  });

  clearButton?.addEventListener("click", () => {
    sessionInput.value = "";
    statusText.textContent = "Ожидаем ввод кода.";
    teamSelect.innerHTML = "";
  });

  joinButton?.addEventListener("click", async () => {
    if (!currentSession) return;
    if (!currentSession.teams.length) {
      showToast("Команды еще не созданы", "error");
      return;
    }
    const teamId = teamSelect.value;
    const team = currentSession.teams.find((item) => item.id === teamId);
    if (!team) {
      showToast("Выберите команду", "error");
      return;
    }
    if (selectedRole === "captain" && captainCodeInput.value.trim() !== team.captainCode) {
      showToast("Неверный код капитана", "error");
      return;
    }
    const player = {
      id: createId(8),
      name: nameInput.value.trim() || "Игрок",
      teamId,
      role: selectedRole,
      joinedAt: Date.now(),
    };

    await store.updateSession(currentSession.id, (session) => ({
      ...session,
      players: [...session.players, player],
    }));

    setStoredUser({ sessionId: currentSession.id, playerId: player.id, teamId, role: selectedRole });
    saveLocal(STORAGE_KEYS.lastSession, currentSession.id);

    window.location.href = `${getBaseUrl()}${selectedRole === "captain" ? "captain" : "player"}.html?session=${currentSession.id}`;
  });

  const presetSession = getSessionIdFromUrl();
  if (presetSession) sessionInput.value = presetSession;

  sessionInput?.addEventListener("input", () => {
    const normalized = normalizeSessionId(sessionInput.value);
    if (sessionInput.value !== normalized) {
      sessionInput.value = normalized;
    }
  });
  sessionInput?.addEventListener("change", () => loadSession(sessionInput.value));
  if (sessionInput?.value) await loadSession(sessionInput.value);
};

const initHost = async () => {
  let sessionId = await ensureSessionAccess();
  const sessionStatus = qs("#host-session-status");
  const sessionCode = qs("#host-session-code");
  const sessionLink = qs("#host-session-link");
  const copyLinkButton = qs("#host-copy-link");
  const qrTarget = qs("#host-qr-target");
  const openJoinButton = qs("#open-join");
  const openViewerButton = qs("#open-viewer");
  const createSessionButton = qs("#create-session-host");
  const statusText = qs("#host-status");
  const teamCountInput = qs("#team-count");
  const teamFields = qs("#team-fields");
  const saveTeamsButton = qs("#save-teams");
  const teamList = qs("#team-list");
  const lobbyButton = qs("#open-lobby");
  const playersList = qs("#players-list");
  const teamCountStat = qs("#host-team-count");
  const readyCountStat = qs("#host-ready-count");
  const questionCountStat = qs("#host-question-count");
  const playerCountStat = qs("#host-player-count");
  const readyProgress = qs("#host-ready-progress");

  let currentSession = null;
  const hostData = getStoredHost();

  const updateSessionAccess = (id) => {
    if (!id) return;
    const joinUrl = `${getBaseUrl()}join.html?session=${id}`;
    sessionCode.textContent = id;
    sessionLink.textContent = joinUrl;
    sessionLink.href = joinUrl;
    if (openJoinButton) openJoinButton.href = joinUrl;
    if (openViewerButton) openViewerButton.href = `${getBaseUrl()}player.html?session=${id}`;
    renderQrCode(qrTarget, joinUrl);
    if (sessionStatus) sessionStatus.textContent = "Сессия активна. Подключайте участников.";
  };

  const createNewSession = async () => {
    const newSessionId = createId(6);
    const newHostId = createId(10);
    const payload = createSessionPayload(newSessionId, newHostId);
    await store.createSession(payload);
    saveLocal(STORAGE_KEYS.lastSession, newSessionId);
    setStoredHost({ sessionId: newSessionId, hostId: newHostId });
    window.location.href = `${getBaseUrl()}host.html?session=${newSessionId}`;
  };

  createSessionButton?.addEventListener("click", createNewSession);

  copyLinkButton?.addEventListener("click", async () => {
    const link = sessionLink?.textContent;
    if (!link) return;
    const ok = await copyToClipboard(link);
    showToast(ok ? "Ссылка скопирована" : "Не удалось скопировать", ok ? "success" : "error");
  });

  if (!sessionId) {
    if (sessionStatus) sessionStatus.textContent = "Нет активной сессии. Создайте новую.";
    statusText.textContent = "Сессия не создана.";
    return;
  }

  currentSession = await store.getSession(sessionId);

  if (!currentSession) {
    if (sessionStatus) sessionStatus.textContent = "Сессия не найдена. Создайте новую.";
    statusText.textContent = "Сессия не найдена.";
    return;
  }

  const renderTeams = (teams) => {
    teamList.innerHTML = "";
    if (!teams.length) {
      teamList.innerHTML = "<p class=\"empty-state\">Команды не созданы.</p>";
      return;
    }
    teams.forEach((team) => {
      const item = document.createElement("div");
      item.className = "list-item";
      item.innerHTML = `
        <strong>${escapeHtml(team.name)}</strong>
        <span>Код капитана: <strong>${escapeHtml(team.captainCode)}</strong></span>
        <span class="status-pill ${team.ready ? "success" : "warning"}">
          ${team.ready ? "Готовы" : "Ожидают"}
        </span>
      `;
      teamList.append(item);
    });
  };

  const updateStats = (session) => {
    if (!session) return;
    const totalTeams = session.teams.length;
    const readyTeams = session.teams.filter((team) => team.ready).length;
    const playerCount = session.players.length;
    const questionCount = session.questions.length;
    if (teamCountStat) teamCountStat.textContent = String(totalTeams);
    if (readyCountStat) readyCountStat.textContent = String(readyTeams);
    if (playerCountStat) playerCountStat.textContent = String(playerCount);
    if (questionCountStat) questionCountStat.textContent = String(questionCount);
    if (readyProgress) {
      const progress = totalTeams ? Math.round((readyTeams / totalTeams) * 100) : 0;
      readyProgress.style.width = `${progress}%`;
    }
  };

  const renderFields = (count) => {
    teamFields.innerHTML = "";
    const clampedCount = Math.min(12, Math.max(1, count));
    if (teamCountInput) teamCountInput.value = String(clampedCount);
    for (let i = 0; i < clampedCount; i += 1) {
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
    const count = Number(teamCountInput.value || 1);
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
      captainCode: String(Math.floor(1000 + Math.random() * 9000)),
      score: 0,
      ready: false,
    }));
    const seededQuestions = currentSession.questions.length ? currentSession.questions : createSampleQuestions(teams);
    currentSession = await store.updateSession(sessionId, { teams, questions: seededQuestions });
    renderTeams(currentSession.teams);
    showToast("Команды сохранены", "success");
  });

  updateSessionAccess(sessionId);
  lobbyButton.href = `${getBaseUrl()}game.html?session=${sessionId}`;
  renderTeams(currentSession.teams);
  renderPlayersList(playersList, currentSession.players, currentSession.teams);
  updateStats(currentSession);

  await store.subscribe(sessionId, (session) => {
    if (!session) return;
    currentSession = session;
    renderTeams(session.teams);
    renderPlayersList(playersList, session.players, session.teams);
    updateStats(session);
  });
};

const initCaptain = async () => {
  const sessionId = await ensureSessionAccess();
  const user = getStoredUser();
  const statusText = qs("#captain-status");
  const questionForm = qs("#question-form");
  const questionList = qs("#question-list");
  const questionCount = qs("#question-count");
  const readyButton = qs("#ready-button");
  const answerBlock = qs("#answer-block");
  const answerInput = qs("#answer-input");
  const answerButton = qs("#submit-answer");
  const roundState = qs("#captain-round-state");
  const timerBox = qs("#captain-timer");
  const timerProgress = qs("#captain-timer-progress .progress-bar");
  const questionBox = qs("#captain-question");

  if (!sessionId || !user || user.role !== "captain") {
    statusText.textContent = "Нет доступа капитана.";
    return;
  }

  let currentSession = await store.getSession(sessionId);
  if (!currentSession) {
    statusText.textContent = "Сессия не найдена.";
    return;
  }

  let editingId = null;

  const updateQuestionsView = (session) => {
    const teamQuestions = session.questions.filter((question) => question.teamId === user.teamId);
    renderQuestionList(questionList, teamQuestions);
    questionCount.textContent = String(teamQuestions.length);
  };

  const setReady = async (ready) => {
    currentSession = await store.updateSession(sessionId, (session) => ({
      ...session,
      teams: session.teams.map((team) => (team.id === user.teamId ? { ...team, ready } : team)),
    }));
    readyButton.textContent = ready ? "Снять готовность" : "Готово";
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
    const payload = { id: editingId || createId(8), teamId: user.teamId, text, answer, comment, used: false };
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

  readyButton?.addEventListener("click", () => {
    const team = currentSession.teams.find((item) => item.id === user.teamId);
    setReady(!team?.ready);
  });

  answerButton?.addEventListener("click", async () => {
    if (!answerInput.value.trim()) {
      showToast("Введите ответ", "error");
      return;
    }
    currentSession = await store.updateSession(sessionId, (session) => ({
      ...session,
      game: {
        ...session.game,
        answers: {
          ...session.game.answers,
          [user.teamId]: {
            text: answerInput.value.trim(),
            submittedAt: Date.now(),
          },
        },
      },
    }));
    answerInput.value = "";
    showToast("Ответ отправлен", "success");
  });

  await store.subscribe(sessionId, (session) => {
    if (!session) return;
    currentSession = session;
    updateQuestionsView(session);
    const team = session.teams.find((item) => item.id === user.teamId);
    readyButton.textContent = team?.ready ? "Снять готовность" : "Готово";
    const canAnswer = session.game.roundState === "answering";
    answerBlock.hidden = !canAnswer;
    if (roundState) roundState.textContent = session.game.roundState;
    const question = session.questions.find((q) => q.id === session.game.currentQuestionId);
    if (questionBox) renderQuestionForPlayers(questionBox, question);
    updateTimer(timerBox, session.game.timer, timerProgress);
  });
};

const initPlayer = async () => {
  const sessionId = await ensureSessionAccess();
  const statusText = qs("#player-status");
  const questionBox = qs("#player-question");
  const timerBox = qs("#player-timer");
  const timerProgress = qs("#player-timer-progress .progress-bar");
  const scoreboard = qs("#player-scoreboard");
  const stateLabel = qs("#round-state");
  const answerReveal = qs("#player-answer-reveal");
  const correctAnswer = qs("#player-correct-answer");
  const answerComment = qs("#player-answer-comment");

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
    updateTimer(timerBox, session.game.timer, timerProgress);
    const reveal = session.game.revealAnswer && question;
    answerReveal.hidden = !reveal;
    if (reveal) {
      correctAnswer.textContent = question.answer || "—";
      answerComment.textContent = question.comment || "";
      answerComment.hidden = !question.comment;
    }
  });

  setInterval(async () => {
    const session = await store.getSession(sessionId);
    if (!session) return;
    updateTimer(timerBox, session.game.timer, timerProgress);
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
  const scoreboard = qs("#game-scoreboard");
  const timerBox = qs("#game-timer");
  const timerProgress = qs("#game-timer-progress .progress-bar");
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
    muteButton.textContent = isMuted ? "Со звуком" : "Без звука";
    muteButton.setAttribute("aria-pressed", String(isMuted));
  });

  const updateView = (session) => {
    renderScoreboard(scoreboard, session.teams);
    const question = session.questions.find((q) => q.id === session.game.currentQuestionId);
    renderQuestionForPlayers(questionBox, question);
    roundState.textContent = session.game.roundState;
    updateTimer(timerBox, session.game.timer, timerProgress);

    answerList.innerHTML = "";
    const answers = Object.entries(session.game.answers || {});
    if (answerCount) answerCount.textContent = `Ответов: ${answers.length}`;
    answers.forEach(([teamId, answer]) => {
      const team = session.teams.find((item) => item.id === teamId);
      const row = document.createElement("div");
      row.className = "list-item";
      row.innerHTML = `
        <strong>${escapeHtml(team?.name || "Команда")}</strong>
        <p>${escapeHtml(answer.text)}</p>
        <div class="inline">
          <button class="button secondary" data-score="yes" data-team="${teamId}">Засчитать</button>
          <button class="button ghost" data-score="no" data-team="${teamId}">Не засчитать</button>
        </div>
      `;
      answerList.append(row);
    });

    const hasQuestion = Boolean(question);
    if (revealButton) revealButton.disabled = !hasQuestion;
    if (hideAnswerButton) hideAnswerButton.disabled = !hasQuestion;
    const reveal = session.game.revealAnswer && question;
    if (revealBlock) revealBlock.hidden = !reveal;
    if (reveal) {
      correctAnswer.textContent = question.answer || "—";
      answerComment.textContent = question.comment || "";
      answerComment.hidden = !question.comment;
    }
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
        revealAnswer: false,
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
        revealAnswer: false,
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
        revealAnswer: false,
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
        revealAnswer: false,
      },
    }));
    updateView(currentSession);
  });

  revealButton?.addEventListener("click", async () => {
    if (!requireHost()) return;
    if (!currentSession.game.currentQuestionId) {
      showToast("Сначала выберите вопрос", "error");
      return;
    }
    currentSession = await store.updateSession(sessionId, (session) => ({
      ...session,
      game: {
        ...session.game,
        revealAnswer: true,
      },
    }));
    updateView(currentSession);
  });

  hideAnswerButton?.addEventListener("click", async () => {
    if (!requireHost()) return;
    currentSession = await store.updateSession(sessionId, (session) => ({
      ...session,
      game: {
        ...session.game,
        revealAnswer: false,
      },
    }));
    updateView(currentSession);
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
    updateTimer(timerBox, session.game.timer, timerProgress);
  }, 1000);
};

export const initPage = () => {
  renderModeBadge();
  enableToastStyles();
  const page = document.body.dataset.page;
  if (page === "index") initIndex();
  if (page === "join") initJoin();
  if (page === "host") {
    initHost();
    initGame();
  }
  if (page === "captain") initCaptain();
  if (page === "player") initPlayer();
  if (page === "game") initGame();
};

onReady(initPage);
