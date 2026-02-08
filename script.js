// --- 1. STATE MANAGEMENT ---
let state = {
    masterList: [], // { id, text, category, time, done }
    habits: [
        { id: 'h1', name: "Caminhada 20 min", data: {} },
        { id: 'h2', name: "Treino corpo livre", data: {} }
    ],
    weeklyTasks: [], // IDs of tasks selected for the week
    weeklyPeriod: { start: "", end: "" },
    daily: {
        mainTaskId: null,
        mainTaskText: "",
        mainTaskDone: false,
        secondaryTasks: [
            { text: "", done: false },
            { text: "", done: false },
            { text: "", done: false }
        ],
        failureReason: ""
    }
};

const STORAGE_KEY = '3-1-HOJE-STATE-V3';

function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        state = JSON.parse(saved);
        // Ensure done property exists for all tasks
        state.masterList.forEach(t => { if (t.done === undefined) t.done = false; });
        if (!state.weeklyPeriod) state.weeklyPeriod = { start: "", end: "" };

        // Migration: ensure secondary tasks use 'text' property
        state.daily.secondaryTasks = state.daily.secondaryTasks.map(slot => {
            if (slot.id && !slot.text) {
                const task = state.masterList.find(t => t.id === slot.id);
                return { text: task ? task.text : "", done: slot.done || false };
            }
            if (!slot.text) return { text: "", done: slot.done || false };
            return slot;
        });
    }
    renderAll();
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updateEfficiency();
}

// --- 2. HELPERS ---
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function formatTime(time) {
    if (!time) return "";
    let clean = time.toLowerCase().replace('min', '').trim();
    return clean ? `${clean} min` : "";
}

// --- 3. RENDERING ---

function renderAll() {
    renderMasterList();
    renderHabits();
    renderWeeklyPlanner();
    renderDailyPage();
    updateEfficiency();
    updateHabitEfficiency();
}

// 3.2 Master List
function renderMasterList() {
    const listEl = document.getElementById('mestre-list');
    listEl.innerHTML = '';

    // Mapping for category colors
    const catClasses = {
        'Trabalho': 'cat-trabalho',
        'Joias': 'cat-joias',
        'Saúde': 'cat-saude',
        'Pessoal': 'cat-pessoal',
        'Outro': 'cat-outro'
    };

    state.masterList.forEach((task) => {
        const isWeekly = state.weeklyTasks.includes(task.id);
        const item = document.createElement('div');
        item.className = 'task-item';

        const catClass = catClasses[task.category] || 'cat-outro';

        item.innerHTML = `
            <div class="task-info">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="category-tag ${catClass}">${task.category}</span>
                    <span class="task-text ${task.done ? 'strikethrough' : ''}">${task.text}</span>
                </div>
                ${task.time ? `<span class="task-subtext">Tempo estimado: ${task.time} min</span>` : ''}
            </div>
            <div class="task-actions">
                <button class="small-btn ${isWeekly ? 'secondary' : ''}" onclick="toggleWeeklyTask('${task.id}')">
                    ${isWeekly ? '✓ Remover da Semana' : '+ Planejar Semana'}
                </button>
                <button class="delete-btn" onclick="deleteMasterTask('${task.id}')" title="Excluir Permanentemente">Excluir</button>
            </div>
        `;
        listEl.appendChild(item);
    });
}

// 3.2 Habits
function renderHabits() {
    const headerEl = document.getElementById('days-header');
    headerEl.innerHTML = '';

    // Add an empty space for the habit name column in the header align
    for (let i = 1; i <= 30; i++) {
        const d = document.createElement('div');
        d.className = 'day-cell day-label';
        d.textContent = i;
        headerEl.appendChild(d);
    }

    const listEl = document.getElementById('habits-list');
    listEl.innerHTML = '';
    const today = new Date().getDate();
    state.habits.forEach((habit, hIdx) => {
        // Calculate individual efficiency based on 30-day goal
        let doneDays = 0;
        for (let d = 1; d <= 31; d++) {
            const val = habit.data[d] || 0;
            if (val === 1 || val === 2) doneDays++;
        }
        const habitEff = Math.round((doneDays / 30) * 100);

        let effColor = '#6B7280'; // Default gray
        if (habitEff >= 80) effColor = '#059669'; // Green
        else if (habitEff >= 50) effColor = '#D97706'; // Orange

        const row = document.createElement('div');
        row.className = 'habit-row';

        row.innerHTML = `
            <span class="delete-habit" onclick="deleteHabit('${habit.id}')">🗑️</span>
            <div class="habit-name" title="${habit.name}">
                ${habit.name} <span style="color: ${effColor}; font-weight: bold; font-size: 0.8em;">(${habitEff}%)</span>
            </div>
            <div class="habit-days-grid"></div>
        `;

        const grid = row.querySelector('.habit-days-grid');
        for (let day = 1; day <= 30; day++) {
            const cell = document.createElement('div');
            cell.className = 'day-cell';
            const val = habit.data[day] || 0;
            if (val === 1) cell.classList.add('done');
            if (val === 2) cell.classList.add('min');
            cell.onclick = () => toggleHabit(hIdx, day);
            grid.appendChild(cell);
        }
        listEl.appendChild(row);
    });
    updateHabitEfficiency();
}

// 3.3 Weekly Planner
function renderWeeklyPlanner() {
    const weeklyEl = document.getElementById('weekly-list');
    const startInp = document.getElementById('week-start');
    const endInp = document.getElementById('week-end');

    // Mapping for category colors
    const catClasses = {
        'Trabalho': 'cat-trabalho',
        'Joias': 'cat-joias',
        'Saúde': 'cat-saude',
        'Pessoal': 'cat-pessoal',
        'Outro': 'cat-outro'
    };

    if (startInp) startInp.value = state.weeklyPeriod.start || "";
    if (endInp) endInp.value = state.weeklyPeriod.end || "";

    if (startInp && !startInp.onchange) {
        startInp.onchange = (e) => { state.weeklyPeriod.start = e.target.value; saveState(); };
    }
    if (endInp && !endInp.onchange) {
        endInp.onchange = (e) => { state.weeklyPeriod.end = e.target.value; saveState(); };
    }

    weeklyEl.innerHTML = '';

    if (state.weeklyTasks.length === 0) {
        weeklyEl.innerHTML = '<p class="task-subtext">Nenhuma tarefa selecionada na Lista Mestre.</p>';
        return;
    }

    state.weeklyTasks.forEach(tid => {
        const task = state.masterList.find(t => t.id === tid);
        if (!task) return;

        const catClass = catClasses[task.category] || 'cat-outro';

        const item = document.createElement('div');
        item.className = 'task-item';
        item.innerHTML = `
            <div class="task-info">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="checkbox" ${task.done ? 'checked' : ''} onchange="setTaskDone('${task.id}', this.checked)">
                    <span class="category-tag ${catClass}">${task.category}</span>
                    <span class="task-text ${task.done ? 'strikethrough' : ''}">${task.text}</span>
                </div>
                ${task.time ? `<span class="task-subtext">Tempo estimado: ${task.time} min</span>` : ''}
            </div>
            <div class="task-actions">
                <button class="small-btn secondary" onclick="toggleWeeklyTask('${task.id}')">✓ Remover da Semana</button>
            </div>
        `;
        weeklyEl.appendChild(item);
    });
}

// 3.4 Daily Page
function renderDailyPage() {
    const mainSelect = document.getElementById('daily-main-task');
    const secList = document.getElementById('daily-secondary-list');
    const mainCheck = document.getElementById('main-task-check');
    const mainMeta = document.getElementById('main-task-meta');
    const failureContainer = document.getElementById('failure-reason-container');

    const optionsHtml = '<option value="">Selecione...</option>' +
        state.weeklyTasks.map(tid => {
            const task = state.masterList.find(t => t.id === tid);
            return task ? `<option value="${task.id}">${task.text}</option>` : '';
        }).join('');

    const mTaskObj = state.masterList.find(t => t.id === state.daily.mainTaskId);
    const mTaskText = mTaskObj ? mTaskObj.text : state.daily.mainTaskText;
    const mTaskDone = mTaskObj ? mTaskObj.done : state.daily.mainTaskDone;

    // Main Task
    mainSelect.innerHTML = optionsHtml;
    mainSelect.value = state.daily.mainTaskId || "";
    mainCheck.checked = mTaskDone;

    // Apply strike-through to select
    if (mTaskDone) mainSelect.classList.add('strikethrough');
    else mainSelect.classList.remove('strikethrough');

    mainMeta.textContent = mTaskObj && mTaskObj.time ? `Tempo estimado: ${formatTime(mTaskObj.time)}` : "";

    // Secondary tasks
    secList.innerHTML = '';

    // Populate datalist for hybrid input
    const datalist = document.getElementById('weekly-options');
    if (datalist) {
        datalist.innerHTML = state.weeklyTasks.map(tid => {
            const t = state.masterList.find(x => x.id === tid);
            return t ? `<option value="${t.text}"></option>` : '';
        }).join('');
    }

    state.daily.secondaryTasks.forEach((slot, i) => {
        const div = document.createElement('div');
        div.className = 'secondary-item';

        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.checked = slot.done;
        chk.onchange = (e) => setSecondaryTaskDone(i, e.target.checked);

        const inp = document.createElement('input');
        inp.type = 'text';
        inp.setAttribute('list', 'weekly-options'); // Enable suggestions
        inp.className = 'task-select'; // Keep styling
        inp.placeholder = `Tarefa secundária ${i + 1} (digite ou selecione)`;
        inp.value = slot.text || "";
        if (slot.done) inp.classList.add('strikethrough');
        inp.oninput = (e) => setSecondaryTaskText(i, e.target.value, e.target);

        div.appendChild(chk);
        div.appendChild(inp);
        secList.appendChild(div);
    });

    // Failure reason
    if (state.daily.mainTaskId && !mTaskDone) {
        failureContainer.classList.remove('hidden');
        document.getElementById('failure-reason').value = state.daily.failureReason;
    } else {
        failureContainer.classList.add('hidden');
    }
}

function updateEfficiency() {
    let totalPlanned = state.weeklyTasks.length;
    let totalDone = 0;

    state.weeklyTasks.forEach(tid => {
        const task = state.masterList.find(t => t.id === tid);
        if (task && task.done) {
            totalDone++;
        }
    });

    const efficiency = totalPlanned > 0 ? Math.round((totalDone / totalPlanned) * 100) : 0;
    const badge = document.getElementById('efficiency-badge');
    badge.textContent = `Eficiência Semanal: ${efficiency}%`;

    if (efficiency >= 80) badge.style.backgroundColor = '#10B981';
    else if (efficiency >= 50) badge.style.backgroundColor = '#F59E0B';
    else badge.style.backgroundColor = '#1E3A8A';
}

function updateHabitEfficiency() {
    const board = document.getElementById('habit-stats-board');
    if (!board) return;
    board.innerHTML = '';

    if (state.habits.length === 0) {
        board.innerHTML = '<p class="task-subtext">Adicione hábitos para ver a eficiência.</p>';
        return;
    }

    const today = new Date().getDate();

    state.habits.forEach(habit => {
        let doneDays = 0;
        for (let d = 1; d <= 31; d++) {
            const val = habit.data[d] || 0;
            if (val === 1 || val === 2) doneDays++;
        }
        const efficiency = Math.round((doneDays / 30) * 100);

        const statItem = document.createElement('div');
        statItem.className = 'habit-stat-item';
        statItem.textContent = `${habit.name}: ${efficiency}%`;

        if (efficiency >= 80) statItem.style.backgroundColor = '#059669';
        else if (efficiency >= 50) statItem.style.backgroundColor = '#D97706';
        else statItem.style.backgroundColor = '#6B7280';

        board.appendChild(statItem);
    });
}

// --- 4. ACTIONS ---

function addMasterTask() {
    const text = document.getElementById('mestre-input').value;
    const category = document.getElementById('mestre-category').value;
    const time = document.getElementById('mestre-time').value;
    if (!text) return;

    state.masterList.push({
        id: generateId(),
        text: text,
        category: category,
        time: time,
        done: false
    });
    document.getElementById('mestre-input').value = '';
    document.getElementById('mestre-time').value = '';
    saveState();
    renderAll();
}

function setTaskDone(id, done) {
    const task = state.masterList.find(t => t.id === id);
    if (task) {
        task.done = done;

        // Sync with secondary tasks (by text)
        state.daily.secondaryTasks.forEach(slot => {
            if (slot.text === task.text) {
                slot.done = done;
            }
        });

        saveState();
        renderAll();
    }
}

function deleteMasterTask(id) {
    if (state.daily.mainTaskId === id) {
        // Capture text before deletion for persistence in Focus of the Day
        const task = state.masterList.find(t => t.id === id);
        if (task) {
            state.daily.mainTaskText = task.text;
            state.daily.mainTaskDone = task.done;
        }
        state.daily.mainTaskId = null;
    }
    state.masterList = state.masterList.filter(t => t.id !== id);
    state.weeklyTasks = state.weeklyTasks.filter(tid => tid !== id);
    saveState();
    renderAll();
}

function toggleWeeklyTask(id) {
    const idx = state.weeklyTasks.indexOf(id);
    if (idx > -1) {
        state.weeklyTasks.splice(idx, 1);
    } else {
        state.weeklyTasks.push(id);
    }
    saveState();
    renderAll();
}

// Habit Actions
function toggleHabit(hIdx, day) {
    let current = state.habits[hIdx].data[day] || 0;
    state.habits[hIdx].data[day] = (current + 1) % 3;
    saveState();
    renderHabits();
    updateHabitEfficiency();
}

function addHabit() {
    const name = document.getElementById('new-habit-name').value;
    if (!name) return;
    if (state.habits.length >= 5) {
        alert("Máximo de 5 hábitos!");
        return;
    }
    state.habits.push({ id: generateId(), name: name, data: {} });
    document.getElementById('new-habit-name').value = '';
    saveState();
    renderHabits();
    updateHabitEfficiency();
}

function deleteHabit(id) {
    state.habits = state.habits.filter(h => h.id !== id);
    saveState();
    renderHabits();
    updateHabitEfficiency();
}

// Daily Actions
function setSecondaryTaskText(slot, text, inputEl) {
    state.daily.secondaryTasks[slot].text = text;

    // Check if this text matches an existing task in master list to sync 'done' status
    const matchingTask = state.masterList.find(t => t.text === text);
    if (matchingTask) {
        state.daily.secondaryTasks[slot].done = matchingTask.done;
    }

    saveState();

    // Surgical UI update to keep focus and be fast
    if (inputEl) {
        if (state.daily.secondaryTasks[slot].done) {
            inputEl.classList.add('strikethrough');
        } else {
            inputEl.classList.remove('strikethrough');
        }

        const container = inputEl.parentElement;
        const checkbox = container.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.checked = state.daily.secondaryTasks[slot].done;
        }
    }
}

function setSecondaryTaskDone(slot, done) {
    const text = state.daily.secondaryTasks[slot].text;
    state.daily.secondaryTasks[slot].done = done;

    // Sync with master list (by text)
    const matchingTask = state.masterList.find(t => t.text === text);
    if (matchingTask) {
        matchingTask.done = done;

        saveState();
        renderAll();
    } else {
        saveState();
        renderDailyPage();
    }
}

function resetDailyFocus() {
    // Reset main task if done
    if (state.daily.mainTaskDone || (state.daily.mainTaskId === null && state.daily.mainTaskText !== "")) {
        state.daily.mainTaskId = null;
        state.daily.mainTaskText = "";
        state.daily.mainTaskDone = false;
        state.daily.failureReason = "";
    }

    // Reset secondary tasks if done
    state.daily.secondaryTasks.forEach(slot => {
        if (slot.done) {
            slot.text = "";
            slot.done = false;
        }
    });

    saveState();
    renderDailyPage();
}

function clearWeeklyCompleted() {
    const idsToClear = state.weeklyTasks.filter(tid => {
        const task = state.masterList.find(t => t.id === tid);
        return task && task.done;
    });

    if (idsToClear.length === 0) return;

    idsToClear.forEach(tid => {
        // Handle persistence for focus of the day before deletion
        if (state.daily.mainTaskId === tid) {
            const task = state.masterList.find(t => t.id === tid);
            if (task) {
                state.daily.mainTaskText = task.text;
                state.daily.mainTaskDone = task.done;
            }
            state.daily.mainTaskId = null;
        }
    });

    state.masterList = state.masterList.filter(t => !idsToClear.includes(t.id));
    state.weeklyTasks = state.weeklyTasks.filter(tid => !idsToClear.includes(tid));

    saveState();
    renderAll();
}

function clearHabitData() {
    if (state.habits.length === 0) return;

    let message = "Digite o NÚMERO do hábito que deseja LIMPAR (limpa todo o mês):\n\n";
    state.habits.forEach((h, i) => {
        message += `${i + 1}. ${h.name}\n`;
    });

    const choice = prompt(message);
    if (choice === null) return; // Cancelled

    const index = parseInt(choice) - 1;
    if (index >= 0 && index < state.habits.length) {
        const habit = state.habits[index];
        if (confirm(`Tem certeza que deseja limpar TODO o registro do hábito "${habit.name}"?`)) {
            habit.data = {};
            saveState();
            renderAll();
        }
    } else {
        alert("Número inválido.");
    }
}

// --- 5. EVENTS ---

document.getElementById('add-mestre-btn').onclick = addMasterTask;

// Add shortcut: Enter to add task
['mestre-input', 'mestre-time'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addMasterTask();
    });
});

document.getElementById('manage-habits-btn').onclick = () => {
    const ui = document.getElementById('habit-management-ui');
    ui.classList.toggle('hidden');
};

document.getElementById('add-habit-btn').onclick = addHabit;

document.getElementById('daily-main-task').onchange = (e) => {
    state.daily.mainTaskId = e.target.value;
    const task = state.masterList.find(t => t.id === e.target.value);
    state.daily.mainTaskText = task ? task.text : "";
    state.daily.mainTaskDone = task ? task.done : false;
    saveState();
    renderDailyPage();
};

document.getElementById('main-task-check').onchange = (e) => {
    setTaskDone(state.daily.mainTaskId, e.target.checked);
};

document.getElementById('failure-reason').oninput = (e) => {
    state.daily.failureReason = e.target.value;
    saveState();
};

// Portability Actions
document.getElementById('export-btn').onclick = () => {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `3-1-hoje-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

document.getElementById('import-input').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importedState = JSON.parse(event.target.result);
            if (importedState.masterList && importedState.habits) {
                state = importedState;
                saveState();
                renderAll();
                alert("Dados importados com sucesso!");
            } else {
                alert("Arquivo de backup inválido.");
            }
        } catch (err) {
            alert("Erro ao ler o arquivo. Certifique-se de que é um arquivo .json válido.");
        }
    };
    reader.readAsText(file);
};

// Start
loadState();
