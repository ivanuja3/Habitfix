const STORAGE_KEY = "habitfix:v1";
const DAY_LABELS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const RING_LENGTH = 302;
const HABIT_COLORS = ["#8dff7a", "#71d7ff", "#ffd166", "#ff8fab", "#b892ff", "#4dd4ac", "#ff9f5a"];

const state = {
  habits: [],
  weekOffset: 0,
};

const habitForm = document.querySelector("#habitForm");
const habitName = document.querySelector("#habitName");
const habitList = document.querySelector("#habitList");
const emptyState = document.querySelector("#emptyState");
const habitTemplate = document.querySelector("#habitTemplate");
const weekRange = document.querySelector("#weekRange");
const totalPoints = document.querySelector("#totalPoints");
const bestStreak = document.querySelector("#bestStreak");
const todayDone = document.querySelector("#todayDone");
const dashboardTitle = document.querySelector("#dashboardTitle");
const dashboardMessage = document.querySelector("#dashboardMessage");
const weeklyProgress = document.querySelector("#weeklyProgress");
const weeklyProgressRing = document.querySelector("#weeklyProgressRing");
const streakMeterFill = document.querySelector("#streakMeterFill");
const streakMeterValue = document.querySelector("#streakMeterValue");
const streakMessage = document.querySelector("#streakMessage");
const focusHabit = document.querySelector("#focusHabit");
const focusMeta = document.querySelector("#focusMeta");
const weekDots = document.querySelector("#weekDots");
const weekStatusText = document.querySelector("#weekStatusText");
const trendSummary = document.querySelector("#trendSummary");
const trendMeta = document.querySelector("#trendMeta");
const weeklyChartArea = document.querySelector("#weeklyChartArea");
const weeklyChartLine = document.querySelector("#weeklyChartLine");
const weeklyChartPoints = document.querySelector("#weeklyChartPoints");
const weeklyChartLabels = document.querySelector("#weeklyChartLabels");

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    state.habits = [
      createHabit("Entrenar 20 minutos"),
      createHabit("Leer 10 paginas"),
      createHabit("Anotar gastos del dia"),
    ];
    saveState();
    return;
  }

  try {
    const parsed = JSON.parse(saved);
    state.habits = Array.isArray(parsed.habits) ? parsed.habits : [];
  } catch {
    state.habits = [];
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ habits: state.habits }));
}

function createHabit(name) {
  const fallbackId = String(Date.now() + Math.random());
  return {
    id: window.crypto && crypto.randomUUID ? crypto.randomUUID() : fallbackId,
    name: name.trim(),
    completed: {},
    createdAt: todayKey(),
  };
}

function startOfWeek(date) {
  const clone = new Date(date);
  clone.setHours(0, 0, 0, 0);
  const day = clone.getDay();
  const distanceFromMonday = day === 0 ? -6 : 1 - day;
  clone.setDate(clone.getDate() + distanceFromMonday);
  return clone;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayKey() {
  return dateKey(new Date());
}

function parseDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getVisibleWeek() {
  const monday = startOfWeek(new Date());
  monday.setDate(monday.getDate() + state.weekOffset * 7);
  return DAY_LABELS.map((label, index) => {
    const date = addDays(monday, index);
    return { label, date, key: dateKey(date) };
  });
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(date);
}

function calculateStreak(habit) {
  const completedKeys = Object.keys(habit.completed)
    .filter((key) => habit.completed[key])
    .sort();

  if (completedKeys.length === 0) return 0;

  let cursor = parseDateKey(completedKeys[completedKeys.length - 1]);
  let streak = 0;

  while (habit.completed[dateKey(cursor)]) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function calculateBestHabitChain(habit, week) {
  let best = 0;
  let current = 0;

  week.forEach((day) => {
    if (habit.completed[day.key]) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  });

  return best;
}

function calculateWeeklyChain(week) {
  return state.habits.reduce((max, habit) => {
    return Math.max(max, calculateBestHabitChain(habit, week));
  }, 0);
}

function getChainLeader(week) {
  return state.habits
    .map((habit) => ({
      habit,
      chain: calculateBestHabitChain(habit, week),
    }))
    .sort((a, b) => b.chain - a.chain)[0];
}

function calculateLongestStreak(habit) {
  const completedKeys = Object.keys(habit.completed)
    .filter((key) => habit.completed[key])
    .sort();
  let best = 0;
  let current = 0;
  let previousKey = "";

  completedKeys.forEach((key) => {
    if (!previousKey) {
      current = 1;
    } else {
      const previous = parseDateKey(previousKey);
      previous.setDate(previous.getDate() + 1);
      current = dateKey(previous) === key ? current + 1 : 1;
    }

    best = Math.max(best, current);
    previousKey = key;
  });

  return best;
}

function calculateGlobalChain() {
  return state.habits.reduce((max, habit) => {
    return Math.max(max, calculateLongestStreak(habit));
  }, 0);
}

function getGlobalChainLeader() {
  return state.habits
    .map((habit) => ({
      habit,
      chain: calculateLongestStreak(habit),
    }))
    .sort((a, b) => b.chain - a.chain)[0];
}

function calculatePoints(habit) {
  return Object.values(habit.completed).filter(Boolean).length * 10;
}

function countWeekMarkedDays(habit, week) {
  return week.filter((day) => habit.completed[day.key]).length;
}

function formatDays(amount) {
  return amount === 1 ? "1 dia" : `${amount} dias`;
}

function getWeekStats(week) {
  const totalSlots = state.habits.length * week.length;
  const completedSlots = state.habits.reduce((sum, habit) => {
    return sum + week.filter((day) => habit.completed[day.key]).length;
  }, 0);
  const percent = totalSlots ? Math.round((completedSlots / totalSlots) * 100) : 0;
  const dayTotals = week.map((day) => {
    return state.habits.filter((habit) => habit.completed[day.key]).length;
  });
  const dayPercents = dayTotals.map((total) => {
    return state.habits.length ? Math.round((total / state.habits.length) * 100) : 0;
  });
  const topHabit = state.habits
    .map((habit) => ({
      habit,
      done: week.filter((day) => habit.completed[day.key]).length,
      streak: calculateStreak(habit),
    }))
    .sort((a, b) => b.done - a.done || b.streak - a.streak)[0];

  return { totalSlots, completedSlots, percent, dayTotals, dayPercents, topHabit };
}

function getDashboardCopy(percent, best) {
  if (state.habits.length === 0) {
    return {
      title: "Disena tu sistema de habitos",
      message: "Agrega tu primer habito y Habitfix empieza a medir el progreso.",
    };
  }

  if (percent === 0) {
    return {
      title: "Hoy puede ser el primer tilde",
      message: "No necesitas una semana perfecta. Necesitas no abandonar la cadena.",
    };
  }

  if (percent < 35) {
    return {
      title: "Ya arrancaste: ahora dale continuidad",
      message: `Llevas ${percent}% de la semana. El proximo check cambia el ritmo.`,
    };
  }

  if (percent < 75) {
    return {
      title: "Buen ritmo, segui empujando",
      message: `Vas ${percent}% de avance semanal y tu cadena diaria es de ${formatDays(best)}.`,
    };
  }

  return {
    title: "Semana fuerte, no cortes la cadena",
    message: `Estas en ${percent}% de cumplimiento. Este es el momento de sostener.`,
  };
}

function getStreakCopy(best) {
  if (best === 0) return "Marca cualquier habito hoy y activa la cadena.";
  if (best === 1) return "Un dia activo. El objetivo es repetir manana.";
  if (best < 4) return "Ya hay dias seguidos. Protege la cadena.";
  if (best < 8) return "Buen envion. Una semana completa esta cerca.";
  return "Cadena fuerte. No negocies con el sistema que ya construiste.";
}

function updateMetrics(week) {
  const stats = getWeekStats(week);
  const points = state.habits.reduce((sum, habit) => sum + calculatePoints(habit), 0);
  const best = calculateWeeklyChain(week);
  const today = todayKey();
  const doneToday = state.habits.filter((habit) => habit.completed[today]).length;
  const todayPercent = state.habits.length ? Math.round((doneToday / state.habits.length) * 100) : 0;
  const copy = getDashboardCopy(stats.percent, best);

  totalPoints.textContent = points;
  bestStreak.textContent = best;
  todayDone.textContent = `${todayPercent}%`;
  dashboardTitle.textContent = copy.title;
  dashboardMessage.textContent = copy.message;
  weeklyProgress.textContent = `${stats.percent}%`;
  weeklyProgressRing.style.strokeDashoffset = String(RING_LENGTH - (RING_LENGTH * stats.percent) / 100);
  streakMeterFill.style.width = `${Math.min(100, (best / 14) * 100)}%`;
  streakMeterValue.textContent = formatDays(best);
  streakMessage.textContent = getStreakCopy(best);

  if (stats.topHabit && stats.topHabit.done > 0) {
    focusHabit.textContent = stats.topHabit.habit.name;
    focusMeta.textContent = `${stats.topHabit.done} de 7 dias marcados esta semana. En la fila se cuenta el total semanal.`;
  } else {
    focusHabit.textContent = state.habits.length ? "Todavia sin favorito" : "Sin datos";
    focusMeta.textContent = state.habits.length
      ? "Marca un dia para detectar tu habito mas fuerte."
      : "Crea o marca un habito para ver el foco de la semana.";
  }

  renderWeekDots(week, stats.dayTotals);
  renderHabitLineChart(week);
  weekStatusText.textContent = getWeekStatusText(stats);
}

function renderHabitLineChart(week) {
  const chartLeft = 72;
  const chartRight = 684;
  const chartTop = 44;
  const chartBottom = 258;
  const xStep = (chartRight - chartLeft) / 6;
  const visibleHabits = state.habits.slice(0, 5);
  const maxMarked = Math.max(1, ...visibleHabits.map((habit) => countWeekMarkedDays(habit, week)));
  const totalMarked = state.habits.reduce((sum, habit) => sum + countWeekMarkedDays(habit, week), 0);
  const strongest = state.habits
    .map((habit) => ({ habit, marked: countWeekMarkedDays(habit, week) }))
    .sort((a, b) => b.marked - a.marked)[0];

  weeklyChartArea.setAttribute("d", "");
  weeklyChartLine.setAttribute("d", "");
  weeklyChartPoints.innerHTML = "";
  weeklyChartLabels.innerHTML = "";

  trendSummary.textContent = state.habits.length ? "Lineas por habito" : "Sin habitos";
  trendMeta.textContent = totalMarked
    ? `${totalMarked} checks esta semana. Mas fuerte: ${strongest.habit.name} (${formatDays(strongest.marked)}).`
    : "Marca dias para ver como crece cada curva.";

  for (let tick = 0; tick <= maxMarked; tick += 1) {
    const y = chartBottom - ((chartBottom - chartTop) * tick) / maxMarked;
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("class", "axis-label");
    label.setAttribute("x", 54);
    label.setAttribute("y", y + 4);
    label.textContent = tick;
    weeklyChartLabels.appendChild(label);
  }

  week.forEach((day, index) => {
    const x = chartLeft + xStep * index;
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("class", "chart-label");
    label.setAttribute("x", x);
    label.setAttribute("y", 282);
    label.textContent = day.label;
    weeklyChartLabels.appendChild(label);
  });

  visibleHabits.forEach((habit, habitIndex) => {
    const color = HABIT_COLORS[habitIndex % HABIT_COLORS.length];
    let accumulated = 0;
    const points = week.map((day, dayIndex) => {
      const x = chartLeft + xStep * dayIndex;
      if (habit.completed[day.key]) accumulated += 1;
      const y = chartBottom - ((chartBottom - chartTop) * accumulated) / maxMarked;
      return { x, y, accumulated, marked: Boolean(habit.completed[day.key]) };
    });
    const trackPath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
    const hasAnyMarked = countWeekMarkedDays(habit, week) > 0;
    const track = document.createElementNS("http://www.w3.org/2000/svg", "path");
    track.setAttribute("class", `habit-track${hasAnyMarked ? "" : " is-empty"}`);
    track.setAttribute("d", trackPath);
    track.setAttribute("stroke", color);
    weeklyChartPoints.appendChild(track);

    const habitLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    habitLabel.setAttribute("class", "legend-label");
    habitLabel.setAttribute("x", 82 + habitIndex * 124);
    habitLabel.setAttribute("y", 22);
    habitLabel.textContent = habit.name.length > 13 ? `${habit.name.slice(0, 12)}...` : habit.name;
    weeklyChartLabels.appendChild(habitLabel);

    const legendDot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    legendDot.setAttribute("cx", 70 + habitIndex * 124);
    legendDot.setAttribute("cy", 18);
    legendDot.setAttribute("r", 5);
    legendDot.setAttribute("fill", color);
    weeklyChartPoints.appendChild(legendDot);

    points.forEach((point) => {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("class", `habit-point${point.marked ? "" : " is-empty"}`);
      circle.setAttribute("cx", point.x);
      circle.setAttribute("cy", point.y);
      circle.setAttribute("r", point.marked ? 7 : 4);
      circle.setAttribute("fill", point.marked ? color : "#111616");
      circle.setAttribute("stroke", point.marked ? "#f6fff0" : "#35413e");
      weeklyChartPoints.appendChild(circle);
    });
  });

  if (state.habits.length > visibleHabits.length) {
    const more = document.createElementNS("http://www.w3.org/2000/svg", "text");
    more.setAttribute("class", "chart-label");
    more.setAttribute("x", 408);
    more.setAttribute("y", 24);
    more.textContent = `+${state.habits.length - visibleHabits.length} habitos mas`;
    weeklyChartLabels.appendChild(more);
  }
}

function getWeekStatusText(stats) {
  if (state.habits.length === 0) return "Tu tablero esta listo para el primer habito.";
  if (stats.completedSlots === 0) return "La semana empieza con el primer check.";
  if (stats.percent < 50) return `${stats.completedSlots} checks completados. Todavia hay mucho margen para remontar.`;
  if (stats.percent < 85) return `${stats.completedSlots} checks completados. La semana ya tiene traccion.`;
  return `${stats.completedSlots} checks completados. Semana casi blindada.`;
}

function renderWeekDots(week, dayTotals) {
  weekDots.innerHTML = "";
  week.forEach((day, index) => {
    const dot = document.createElement("div");
    dot.className = "week-dot";
    dot.classList.toggle("done", dayTotals[index] > 0);
    dot.textContent = day.label;
    dot.title = `${dayTotals[index]} habitos marcados`;
    weekDots.appendChild(dot);
  });
}

function renderWeekLabel(week) {
  weekRange.textContent = `${formatShortDate(week[0].date)} - ${formatShortDate(week[6].date)}`;
}

function renderHabits() {
  const week = getVisibleWeek();
  renderWeekLabel(week);
  habitList.innerHTML = "";
  emptyState.classList.toggle("is-visible", state.habits.length === 0);

  state.habits.forEach((habit) => {
    const row = habitTemplate.content.firstElementChild.cloneNode(true);
    const title = row.querySelector(".habit-title");
    const cells = row.querySelector(".day-cells");
    const streak = row.querySelector(".streak-pill");
    const deleteButton = row.querySelector(".delete-button");

    title.value = habit.name;
    title.addEventListener("change", () => {
      habit.name = title.value.trim() || "Habito sin nombre";
      title.value = habit.name;
      saveState();
      renderHabits();
    });

    week.forEach((day) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "day-button";
      button.setAttribute("aria-label", `${habit.name}: ${day.label}`);
      button.title = `${day.label} ${formatShortDate(day.date)}`;
      button.classList.toggle("done", Boolean(habit.completed[day.key]));
      button.classList.toggle("today", day.key === todayKey());
      button.addEventListener("click", () => {
        if (habit.completed[day.key]) {
          delete habit.completed[day.key];
        } else {
          habit.completed[day.key] = true;
        }
        saveState();
        renderHabits();
      });
      cells.appendChild(button);
    });

    streak.textContent = formatDays(countWeekMarkedDays(habit, week));
    deleteButton.addEventListener("click", () => {
      state.habits = state.habits.filter((item) => item.id !== habit.id);
      saveState();
      renderHabits();
    });

    habitList.appendChild(row);
  });

  updateMetrics(week);
}

habitForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = habitName.value.trim();
  if (!name) return;
  state.habits.unshift(createHabit(name));
  habitName.value = "";
  saveState();
  renderHabits();
});

document.querySelector("#previousWeek").addEventListener("click", () => {
  state.weekOffset -= 1;
  renderHabits();
});

document.querySelector("#nextWeek").addEventListener("click", () => {
  state.weekOffset += 1;
  renderHabits();
});

loadState();
renderHabits();
