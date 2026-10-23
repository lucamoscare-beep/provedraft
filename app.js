// CONFIGURAZIONE FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyAURiTLIXNg6fFkL1fnHkiHafMytsDHW8I",
    authDomain: "draft-serie-a-4aadd.firebaseapp.com",
    projectId: "draft-serie-a-4aadd",
    storageBucket: "draft-serie-a-4aadd.firebasestorage.app",
    messagingSenderId: "382868267295",
    appId: "1:382868267295:web:f958edb9ffb50fc984102a",
    measurementId: "G-THYVRMRWWH"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let customPlayersList = [];
let availablePlayers = [];
let budget = 600;

const limits = { Portiere: 3, Difensore: 7, Centrocampista: 8, Attaccante: 6 };
const roleIcons = {
    Portiere: "fa-solid fa-hand",
    Difensore: "fa-solid fa-shield-halved",
    Centrocampista: "fa-solid fa-person-running",
    Attaccante: "fa-solid fa-futbol"
};

let rosa = { Portiere: [], Difensore: [], Centrocampista: [], Attaccante: [] };
let schierati = [];
let riserveSelezionate = { Portiere: [], Difensore: [], Centrocampista: [], Attaccante: [] };

let turno = 0;
let moduloSelezionato = "";
let nomeSquadra = "";
let votiGiornata = {};
let formazioneBloccata = false;

// DEFINIZIONE DEADLINE PROSSIMA GIORNATA (Es. 8ª Giornata: Torino-Monza, 23 Ottobre 2026 ore 20:45)
const MATCHDAY_DEADLINE = new Date("2026-10-23T20:45:00"); 

function initCountdown() {
    function updateTimer() {
        const now = new Date();
        const diff = MATCHDAY_DEADLINE - now;

        const banner = document.getElementById("deadline-banner");

        if (diff <= 0) {
            document.getElementById("countdown-timerinnerHTML") = "<span style='color:var(--accent-red);'>MERCATO CHIUSO</span>";
            document.getElementById("deadline-text").innerText = "⚠️ La prima partita della giornata è iniziata. Sessione bloccata.";
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);

        document.getElementById("cd-days").innerText = String(days).padStart(2, '0');
        document.getElementById("cd-hours").innerText = String(hours).padStart(2, '0');
        document.getElementById("cd-mins").innerText = String(mins).padStart(2, '0');
        document.getElementById("cd-secs").innerText = String(secs).padStart(2, '0');
    }

    updateTimer();
    setInterval(updateTimer, 1000);
}

document.addEventListener("DOMContentLoaded", () => {
    initCountdown();
    caricaGiocatoriDaExcel();
});

// TOGGLE MOSTRA/NASCONDI PASSWORD
function togglePasswordVisibility(inputId, iconElement) {
    const input = document.getElementById(inputId);
    if (input.type === "password") {
        input.type = "text";
        iconElement.classList.remove("fa-eye");
        iconElement.classList.add("fa-eye-slash");
    } else {
        input.type = "password";
        iconElement.classList.remove("fa-eye-slash");
        iconElement.classList.add("fa-eye");
    }
}

function switchAuthTab(tab) {
    const isLogin = tab === 'login';
    document.getElementById('login-form').style.display = isLogin ? 'block' : 'none';
    document.getElementById('register-form').style.display = isLogin ? 'none' : 'block';
    document.getElementById('tab-login-btn').className = isLogin ? 'active' : '';
    document.getElementById('tab-register-btn').className = isLogin ? '' : 'active';
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('reg-username').value.trim();
    const nome = document.getElementById('reg-nome').value.trim();
    const cognome = document.getElementById('reg-cognome').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    try {
        const res = await auth.createUserWithEmailAndPassword(email, password);
        await res.user.updateProfile({ displayName: username });
        
        await db.collection("utenti").doc(res.user.uid).set({
            username: username,
            nome: nome,
            cognome: cognome,
            email: email,
            creatoIl: new Date(),
            nomeSquadra: nomeSquadra,
            rosa: rosa,
            schierati: schierati,
            riserveSelezionate: riserveSelezionate,
            budget: budget,
            moduloSelezionato: moduloSelezionato,
            formazioneBloccata: false,
            votiGiornata: votiGiornata
        });

        alert(`Registrazione completata! Benvenuto, ${username}.`);
    } catch (err) {
        alert("Errore Registrazione: " + err.message);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
        alert("Errore Login: " + err.message);
    }
}

auth.onAuthStateChanged(async (user) => {
    const modal = document.getElementById('auth-modal');
    const globalHeader = document.getElementById('global-header-bar');
    
    if (user) {
        currentUser = user;
        modal.style.display = 'none';
        globalHeader.style.display = 'flex';
        document.getElementById('user-display-name').innerText = user.displayName || user.email;
        await caricaDatiSquadraCloud();
    } else {
        currentUser = null;
        modal.style.display = 'flex';
        globalHeader.style.display = 'none';
    }
});

function logout() {
    if (confirm("Vuoi davvero disconnetterti dal tuo account?")) {
        auth.signOut().then(() => location.reload());
    }
}

async function salvaSquadraCloud() {
    if (!currentUser) return;
    try {
        await db.collection("utenti").doc(currentUser.uid).set({
            nomeSquadra: nomeSquadra,
            rosa: rosa,
            schierati: schierati,
            riserveSelezionate: riserveSelezionate,
            budget: budget,
            moduloSelezionato: moduloSelezionato,
            formazioneBloccata: formazioneBloccata,
            votiGiornata: votiGiornata,
            ultimoAggiornamento: new Date()
        }, { merge: true });
    } catch (err) {
        console.error("Errore salvataggio Cloud:", err);
    }
}

async function caricaDatiSquadraCloud() {
    if (!currentUser) return;
    try {
        const doc = await db.collection("utenti").doc(currentUser.uid).get();
        if (doc.exists && doc.data().rosa && Object.keys(doc.data().rosa).length > 0) {
            const data = doc.data();
            nomeSquadra = data.nomeSquadra || "";
            rosa = data.rosa;
            schierati = data.schierati || [];
            riserveSelezionate = data.riserveSelezionate || { Portiere: [], Difensore: [], Centrocampista: [], Attaccante: [] };
            budget = data.budget ?? 600;
            moduloSelezionato = data.moduloSelezionato || "";
            formazioneBloccata = data.formazioneBloccata || true;
            votiGiornata = data.votiGiornata || {};

            updateDashboardCounters();
            
            if (moduloSelezionato) {
                ripristinaCampoTattico();
            }

            renderSlots();
            renderPanchinaGrafica();
            showFinalRecap();
        }
    } catch (err) {
        console.error("Errore caricamento Cloud:", err);
    }
}

function ripristinaCampoTattico() {
    if (!moduloSelezionato) return;

    const [D, C, A] = moduloSelezionato.split("-").map(n => parseInt(n));
    const campo = document.getElementById("campo");
    campo.innerHTML = "";

    let isMobile = window.innerWidth < 600;
    let topPOR = isMobile ? 15 : 30;
    let topDIF = isMobile ? 105 : 150;
    let topCEN = isMobile ? 215 : 310;
    let topATT = isMobile ? 325 : 470;

    createDropZone(campo, "Portiere", topPOR, 50);
    distribuisciOrizzontalmente(D).forEach(left => createDropZone(campo, "Difensore", topDIF, left));
    distribuisciOrizzontalmente(C).forEach(left => createDropZone(campo, "Centrocampista", topCEN, left));
    distribuisciOrizzontalmente(A).forEach(left => createDropZone(campo, "Attaccante", topATT, left));

    const dropzones = campo.querySelectorAll(".dropzone");
    schierati.forEach(p => {
        const libera = Array.from(dropzones).find(z => z.dataset.ruolo === p.ruolo && z.dataset.player === "");
        if (libera) {
            libera.innerText = p.nome;
            libera.dataset.player = p.nome;
        }
    });
}

async function caricaGiocatoriDaExcel() {
    try {
        const response = await fetch("giocatori.xlsx");
        if (!response.ok) throw new Error("File giocatori.xlsx non trovato!");

        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) throw new Error("Il file giocatori.xlsx è vuoto!");

        parseAndSetPlayers(jsonData);

    } catch (error) {
        console.error("Errore caricamento giocatori.xlsx:", error);
    }
}

function parseAndSetPlayers(data) {
    customPlayersList = data.map(row => {
        let r = row.ruolo || row.Ruolo || row.RUOLO || "Centrocampista";
        let rUpper = String(r).trim().toUpperCase();
        if (rUpper === 'P' || rUpper === 'PORTIERE') r = 'Portiere';
        else if (rUpper === 'D' || rUpper === 'DIFENSORE') r = 'Difensore';
        else if (rUpper === 'C' || rUpper === 'CENTROCAMPISTA') r = 'Centrocampista';
        else if (rUpper === 'A' || rUpper === 'ATTACCANTE') r = 'Attaccante';

        let val = parseInt(row.valore || row.Valore || row.VALORE || row.costo || 1);
        if (isNaN(val) || val < 1) val = 1;

        return {
            nome: row.nome || row.Nome || row.NOME || "Sconosciuto",
            ruolo: r,
            squadra: row.squadra || row.Squadra || "N/D",
            valore: val
        };
    });
}

function updateDashboardCounters() {
    document.getElementById("budget-display").innerText = budget;
    let totalAcquistati = Object.values(rosa).reduce((acc, curr) => acc + curr.length, 0);
    let slotsRimanenti = 24 - totalAcquistati;
    document.getElementById("slots-left-display").innerText = slotsRimanenti;

    ["Portiere", "Difensore", "Centrocampista", "Attaccante"].forEach(r => {
        let mancano = limits[r] - rosa[r].length;
        document.getElementById(`count-${r}`).innerText = `${rosa[r].length} / ${limits[r]} (${mancano} mancanti)`;
    });
}

function updateProgressBar() {
    let percentage = (turno / 24) * 100;
    document.getElementById("progress-bar").style.width = percentage + "%";
}

function startDraft() {
    if (new Date() >= MATCHDAY_DEADLINE) {
        alert("⚠️ Impossibile avviare il draft: la prima partita di campionato è già iniziata!");
        return;
    }

    if (customPlayersList.length < 24) {
        alert("Caricamento giocatori in corso o file giocatori.xlsx non valido.");
        return;
    }

    document.getElementById("header-panel").style.display = "none";
    document.getElementById("draft-panel").style.display = "block";
    
    budget = 600;
    updateDashboardCounters();
    availablePlayers = [...customPlayersList];
    nextPick();
}

function nextPick() {
    turno++;
    updateProgressBar();
    updateDashboardCounters();
    
    if (turno > 24) {
        document.getElementById("turno").innerText = 24;
        showModuloSelection();
        return;
    }

    document.getElementById("turno").innerText = turno;
    renderPlayers();
}

function renderPlayers() {
    const container = document.getElementById("players");
    container.innerHTML = "";

    let totalAcquistati = Object.values(rosa).reduce((acc, curr) => acc + curr.length, 0);
    let maxCostAllowed = budget - (24 - totalAcquistati - 1);

    let candidates = availablePlayers.filter(p => rosa[p.ruolo].length < limits[p.ruolo] && p.valore <= maxCostAllowed);
    if (candidates.length === 0) candidates = availablePlayers.filter(p => p.valore <= maxCostAllowed);

    if (candidates.length === 0) {
        alert(`Nessun giocatore disponibile rientra nel budget residuo!`);
        showModuloSelection();
        return;
    }

    let ruoliDisponibili = new Set(candidates.map(p => p.ruolo));
    let five = [];

    if (ruoliDisponibili.size > 1) {
        let tentativi = 0;
        while (five.length < 5 && tentativi < 100) {
            tentativi++;
            let shuffled = [...candidates].sort(() => Math.random() - 0.5);
            let tempSelection = [];

            for (let p of shuffled) {
                if (tempSelection.length >= 5) break;
                let ruoliNelGruppo = tempSelection.map(x => x.ruolo);
                let ugualiInGruppo = ruoliNelGruppo.filter(r => r === p.ruolo).length;

                if (ugualiInGruppo < 3) {
                    tempSelection.push(p);
                }
            }

            if (tempSelection.length === 5) {
                let primoRuolo = tempSelection[0].ruolo;
                let tuttiUguali = tempSelection.every(p => p.ruolo === primoRuolo);
                if (!tuttiUguali) {
                    five = tempSelection;
                    break;
                }
            }
        }
    }

    if (five.length < 5) {
        five = candidates.sort(() => Math.random() - 0.5).slice(0, 5);
    }

    five.forEach(p => {
        const card = document.createElement("div");
        card.className = `player-card ${p.ruolo}`;

        card.innerHTML = `
            <div>
                <div class="player-name">${p.nome}</div>
                <div class="player-team">${p.squadra}</div>
                <span class="player-role"><i class="${roleIcons[p.ruolo]}"></i> ${p.ruolo}</span><br>
                <div class="valore-badge-draft">💰 ${p.valore}</div>
            </div>
            <button class="draft-btn" onclick="draft('${p.nome.replace(/'/g, "\\'")}')">Acquista</button>
        `;
        container.appendChild(card);
    });
}

function draft(nome) {
    if (new Date() >= MATCHDAY_DEADLINE) {
        alert("⚠️ Tempo scaduto! Il mercato è chiuso.");
        return;
    }

    const p = availablePlayers.find(x => x.nome === nome);
    if (!p || p.valore > budget) return;

    budget -= p.valore;
    rosa[p.ruolo].push(p);
    availablePlayers = availablePlayers.filter(x => x.nome !== nome);

    renderSlots();
    salvaSquadraCloud();
    nextPick();
}

function renderSlots() {
    ["Portiere","Difensore","Centrocampista","Attaccante"].forEach(ruolo => {
        const div = document.getElementById("slot-" + ruolo);
        div.innerHTML = "";
        rosa[ruolo].forEach(p => {
            const isTit = schierati.some(s => s.nome === p.nome);
            const isBench = riserveSelezionate[ruolo].some(r => r.nome === p.nome);

            const slot = document.createElement("div");
            let statusClass = (isTit || isBench) ? "schierato" : "";
            
            let tagStatus = "";
            if (isTit) tagStatus = `<span class="slot-tag campo">Campo</span>`;
            else if (isBench) tagStatus = `<span class="slot-tag panchina">Panchina</span>`;

            slot.className = `slot ${ruolo} ${statusClass}`;
            slot.innerHTML = `
                <span><i class="${roleIcons[ruolo]}"></i> ${p.nome}</span>
                <div>
                    ${tagStatus}
                    <span class="valore-badge-slot">💰 ${p.valore} cr</span>
                </div>
            `;
            slot.onclick = () => schieraGiocatore(p, ruolo);
            div.appendChild(slot);
        });
    });
}

function schieraGiocatore(playerObj, ruolo) {
    if (formazioneBloccata || new Date() >= MATCHDAY_DEADLINE) return;

    if (!moduloSelezionato) {
        alert("Scegli prima il modulo per schierare la formazione");
        return;
    }

    if (schierati.some(p => p.nome === playerObj.nome)) {
        return alert(`${playerObj.nome} è già schierato in campo! Clicca sulla sua casella sul campo per rimuoverlo.`);
    }

    const zone = document.querySelectorAll(`.dropzone[data-ruolo="${ruolo}"]`);
    const libera = Array.from(zone).find(z => z.dataset.player === "");

    if (libera) {
        libera.innerText = playerObj.nome;
        libera.dataset.player = playerObj.nome;
        schierati.push(playerObj);

        riserveSelezionate[ruolo] = riserveSelezionate[ruolo].filter(p => p.nome !== playerObj.nome);
    } else {
        if (riserveSelezionate[ruolo].some(r => r.nome === playerObj.nome)) {
            riserveSelezionate[ruolo] = riserveSelezionate[ruolo].filter(p => p.nome !== playerObj.nome);
        } else {
            if (riserveSelezionate[ruolo].length >= 2) {
                return alert(`Hai già selezionato le 2 riserve per il ruolo: ${ruolo}`);
            }
            riserveSelezionate[ruolo].push(playerObj);
        }
    }

    renderSlots();
    renderPanchinaGrafica();
    salvaSquadraCloud();
}

function showModuloSelection() {
    document.getElementById("draft-panel").innerHTML = `
        <h3 style="text-align:center;">Draft Completato!</h3>
        <p style="text-align:center; font-size:12px; color: var(--accent-gold); font-weight: 700;">Assegna un nome alla tua squadra e seleziona il modulo tattico:</p>
        
        <div class="input-group" style="max-width: 300px; margin: 0 auto 12px auto;">
            <label>Nome Squadra</label>
            <input type="text" id="nome-squadra-input" value="${nomeSquadra}" placeholder="es. FantaReal 2026" style="padding: 8px; border-radius: 8px; background: #1e293b; color: white; border:1px solid var(--card-border); width: 100%;">
        </div>

        <select id="modulo" onchange="setModulo()" style="display:block; margin: 0 auto; padding: 8px; border-radius: 8px; background: #1e293b; color: white; border:1px solid var(--card-border);">
            <option value="">-- Scegli Modulo --</option>
            <option value="4-4-2">4-4-2</option>
            <option value="4-3-3">4-3-3</option>
            <option value="3-4-3">3-4-3</option>
            <option value="4-5-1">4-5-1</option>
            <option value="3-5-2">3-5-2</option>
        </select>
    `;
}

function distribuisciOrizzontalmente(n) {
    const step = 100 / (n + 1);
    return Array.from({length: n}, (_, i) => step * (i + 1));
}

function setModulo() {
    if (new Date() >= MATCHDAY_DEADLINE) {
        alert("⚠️ Tempo scaduto! Impossibile impostare la formazione.");
        return;
    }

    const inputNome = document.getElementById("nome-squadra-input");
    if (inputNome) {
        nomeSquadra = inputNome.value.trim();
        if (!nomeSquadra) {
            alert("Inserisci un nome valido per la squadra!");
            document.getElementById("modulo").value = "";
            return;
        }
    }

    moduloSelezionato = document.getElementById("modulo").value;
    if (!moduloSelezionato) return;

    schierati = [];
    riserveSelezionate = { Portiere: [], Difensore: [], Centrocampista: [], Attaccante: [] };

    ripristinaCampoTattico();

    renderSlots();
    renderPanchinaGrafica();
    document.getElementById("conferma-container").style.display = "block";
    salvaSquadraCloud();
}

function createDropZone(campo, ruolo, top, left) {
    const dz = document.createElement("div");
    dz.className = "pos dropzone";
    dz.style.top = top + "px";
    dz.style.left = left + "%";
    dz.dataset.ruolo = ruolo;
    dz.dataset.player = "";

    dz.onclick = () => {
        if (formazioneBloccata || new Date() >= MATCHDAY_DEADLINE || !dz.dataset.player) return;
        schierati = schierati.filter(p => p.nome !== dz.dataset.player);
        dz.innerText = "";
        dz.dataset.player = "";
        renderSlots();
        renderPanchinaGrafica();
        salvaSquadraCloud();
    };
    campo.appendChild(dz);
}

function renderPanchinaGrafica() {
    const container = document.getElementById("panchina-grafica");
    container.innerHTML = "";

    ["Portiere", "Difensore", "Centrocampista", "Attaccante"].forEach(ruolo => {
        const group = document.createElement("div");
        group.className = "panchina-role-group";

        const nonSchierati = rosa[ruolo].filter(p => !schierati.some(s => s.nome === p.nome));
        const riserveRuolo = riserveSelezionate[ruolo];

        let html = `
            <div class="panchina-role-header">
                <i class="${roleIcons[ruolo]}"></i> ${ruolo} (${riserveRuolo.length}/2)
            </div>
            <div class="bench-slots-grid">
        `;

        nonSchierati.forEach(p => {
            let indexInBench = riserveRuolo.findIndex(r => r.nome === p.nome);
            let isBench = indexInBench !== -1;
            let badgeOrder = isBench ? `<span class="bench-order-badge">R${indexInBench + 1}</span>` : "";

            html += `
                <div class="bench-card-slot ${isBench ? 'filled' : ''}" onclick="togglePanchina('${ruolo}', '${p.nome.replace(/'/g, "\\'")}')">
                    ${badgeOrder}
                    <div style="font-size:10px; font-weight:700; color:#fff;">${p.nome}</div>
                    <div style="font-size:8px; color:var(--text-muted);">💰${p.valore}cr</div>
                </div>
            `;
        });

        html += `</div>`;
        group.innerHTML = html;
        container.appendChild(group);
    });
}

function togglePanchina(ruolo, nomePlayer) {
    if (formazioneBloccata || new Date() >= MATCHDAY_DEADLINE) return;

    if (!moduloSelezionato) {
        alert("Scegli prima il modulo per schierare la formazione");
        return;
    }

    let pObj = rosa[ruolo].find(p => p.nome === nomePlayer);
    if (!pObj) return;

    let index = riserveSelezionate[ruolo].findIndex(r => r.nome === nomePlayer);

    if (index !== -1) {
        riserveSelezionate[ruolo].splice(index, 1);
    } else {
        if (riserveSelezionate[ruolo].length >= 2) {
            return alert(`Puoi selezionare al massimo 2 riserve per il ruolo ${ruolo}!`);
        }
        riserveSelezionate[ruolo].push(pObj);
    }

    renderSlots();
    renderPanchinaGrafica();
    salvaSquadraCloud();
}

function confermaFormazione() {
    if (new Date() >= MATCHDAY_DEADLINE) {
        alert("⚠️ Tempo scaduto! La prima partita è già iniziata.");
        return;
    }

    if (schierati.length < 11) return alert("Devi schierare tutti gli 11 titolari!");

    if (confirm("Confermi la formazione? L'operazione è definitiva.")) {
        formazioneBloccata = true;
        showFinalRecap();
        salvaSquadraCloud();
    }
}

function showFinalRecap() {
    document.getElementById("main-app").style.display = "none";
    document.getElementById("recap-screen").style.display = "block";
    document.getElementById("recap-nome-squadra").innerText = nomeSquadra || 'N/D';
    document.getElementById("recap-modulo-title").innerText = moduloSelezionato || 'N/D';

    const recapCampo = document.getElementById("recap-campo");
    recapCampo.innerHTML = "";
    
    const [D, C, A] = (moduloSelezionato || "4-4-2").split("-").map(n => parseInt(n));
    let isMobile = window.innerWidth < 600;
    let topPOR = isMobile ? 15 : 30;
    let topDIF = isMobile ? 105 : 150;
    let topCEN = isMobile ? 215 : 310;
    let topATT = isMobile ? 325 : 470;

    createStaticDropZone(recapCampo, "Portiere", topPOR, 50);
    distribuisciOrizzontalmente(D).forEach(left => createStaticDropZone(recapCampo, "Difensore", topDIF, left));
    distribuisciOrizzontalmente(C).forEach(left => createStaticDropZone(recapCampo, "Centrocampista", topCEN, left));
    distribuisciOrizzontalmente(A).forEach(left => createStaticDropZone(recapCampo, "Attaccante", topATT, left));

    const dropzones = recapCampo.querySelectorAll(".dropzone");
    schierati.forEach(p => {
        const libera = Array.from(dropzones).find(z => z.dataset.ruolo === p.ruolo && z.dataset.player === "");
        if (libera) {
            libera.innerText = p.nome;
            libera.dataset.player = p.nome;
        }
    });

    const panchinaDiv = document.getElementById("recap-panchina");
    panchinaDiv.innerHTML = "";

    ["Portiere", "Difensore", "Centrocampista", "Attaccante"].forEach(ruolo => {
        const riserve = riserveSelezionate[ruolo] || [];
        riserve.forEach((ris, i) => {
            const card = document.createElement("div");
            card.className = "recap-bench-card";
            card.innerHTML = `
                <div>
                    <span class="player-role"><i class="${roleIcons[ruolo]}"></i> ${ruolo} (R${i+1})</span>
                    <div style="font-weight:700; color:#fff; margin-top:2px; font-size:12px;">${ris.nome}</div>
                </div>
                <span class="valore-badge-slot">💰 ${ris.valore} cr</span>
            `;
            panchinaDiv.appendChild(card);
        });
    });

    if (votiGiornata && Object.keys(votiGiornata).length > 0) {
        mostraTabellinoVoti();
    }
}

function createStaticDropZone(campo, ruolo, top, left) {
    const dz = document.createElement("div");
    dz.className = "pos dropzone";
    dz.style.top = top + "px";
    dz.style.left = left + "%";
    dz.dataset.ruolo = ruolo;
    dz.dataset.player = "";
    campo.appendChild(dz);
}

function parseColumnVal(row, colNames) {
    for (let col of colNames) {
        for (let key in row) {
            if (key.trim().toLowerCase() === col.toLowerCase()) {
                let val = parseFloat(row[key]);
                return isNaN(val) ? 0 : val;
            }
        }
    }
    return 0;
}

async function calcolaVotiDaExcelOnline() {
    const btn = document.getElementById("btn-fetch-voti");
    btn.innerText = "⏳ Lettura voti.xlsx...";
    btn.disabled = true;

    votiGiornata = {};
    const tutteLeRiserve = Object.values(riserveSelezionate).flat();
    const tuttiGiocatori = [...schierati, ...tutteLeRiserve];

    try {
        const response = await fetch("voti.xlsx");
        if (!response.ok) throw new Error("File voti.xlsx non trovato!");

        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        let nomeFoglioVoti = workbook.SheetNames.find(s => s.trim().toLowerCase() === "voti") || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[nomeFoglioVoti];
        const rows = XLSX.utils.sheet_to_json(worksheet);

        tuttiGiocatori.forEach(p => {
            let nomePulito = p.nome.trim().toLowerCase();

            let matchRow = rows.find(row => {
                let nomeInRow = String(row.nome || row.Nome || row.NOME || row.calciatore || row.Calciatore || row.Giocatore || "").trim().toLowerCase();
                return nomeInRow === nomePulito || nomeInRow.includes(nomePulito) || nomePulito.includes(nomeInRow);
            });

            if (matchRow) {
                let rawVotoPuro = parseColumnVal(matchRow, ["voto", "Voto", "VOTO"]);
                let rawFanta = parseColumnVal(matchRow, ["fantavoto", "Fantavoto", "FANTAVOTO"]);

                if (rawFanta === 0 && rawVotoPuro > 0) rawFanta = rawVotoPuro;

                if (rawFanta > 0 || rawVotoPuro > 0) {
                    votiGiornata[p.nome] = {
                        voto: rawVotoPuro,
                        fantavoto: rawFanta,
                        sv: false,
                        gf: parseColumnVal(matchRow, ["gf"]),
                        gs: parseColumnVal(matchRow, ["gs"]),
                        ass: parseColumnVal(matchRow, ["ass"]),
                        au: parseColumnVal(matchRow, ["au"]),
                        esp: parseColumnVal(matchRow, ["Esp", "esp"]),
                        amm: parseColumnVal(matchRow, ["amm", "Amm"]),
                        rp: parseColumnVal(matchRow, ["rp"]),
                        rs: parseColumnVal(matchRow, ["rs"]),
                        rf: parseColumnVal(matchRow, ["rf"])
                    };
                    return;
                }
            }

            votiGiornata[p.nome] = { voto: 0, fantavoto: 0, sv: true, gf:0, gs:0, ass:0, au:0, esp:0, amm:0, rp:0, rs:0, rf:0 };
        });

        await salvaSquadraCloud();

    } catch (err) {
        alert("Attenzione: Impossibile leggere voti.xlsx (" + err.message + ").");
        tuttiGiocatori.forEach(p => {
            votiGiornata[p.nome] = { voto: 0, fantavoto: 0, sv: true, gf:0, gs:0, ass:0, au:0, esp:0, amm:0, rp:0, rs:0, rf:0 };
        });
    }

    btn.innerText = "📊 Carica i Fantavoti di giornata";
    btn.disabled = false;

    mostraTabellinoVoti();
}

function generaIconeBonusMalus(vInfo) {
    if (!vInfo || vInfo.sv) return `<span style="color:var(--text-muted); font-size:10px;">-</span>`;

    let html = `<div class="bonus-icon-group">`;
    let count = 0;

    if (vInfo.gf > 0) {
        count++;
        for(let i=0; i < vInfo.gf; i++) html += `<img src="icone/gol.png" class="fanta-icon-img" alt="Gol" title="Gol segnato">`;
    }
    if (vInfo.rf > 0) {
        count++;
        for(let i=0; i < vInfo.rf; i++) html += `<img src="icone/rigore_segnato.png" class="fanta-icon-img" alt="Rigore Segnato" title="Rigore segnato">`;
    }
    if (vInfo.gs > 0) {
        count++;
        for(let i=0; i < vInfo.gs; i++) html += `<img src="icone/gol_subito.png" class="fanta-icon-img" alt="Gol Subito" title="Gol subito">`;
    }
    if (vInfo.ass > 0) {
        count++;
        for(let i=0; i < vInfo.ass; i++) html += `<img src="icone/assist.png" class="fanta-icon-img" alt="Assist" title="Assist">`;
    }
    if (vInfo.au > 0) {
        count++;
        for(let i=0; i < vInfo.au; i++) html += `<img src="icone/autogol.png" class="fanta-icon-img" alt="Autogol" title="Autogol">`;
    }
    if (vInfo.rp > 0) {
        count++;
        for(let i=0; i < vInfo.rp; i++) html += `<img src="icone/rigore_parato.png" class="fanta-icon-img" alt="Rigore Parato" title="Rigore parato">`;
    }
    if (vInfo.rs > 0) {
        count++;
        for(let i=0; i < vInfo.rs; i++) html += `<img src="icone/rigore_sbagliato.png" class="fanta-icon-img" alt="Rigore Sbagliato" title="Rigore sbagliato">`;
    }
    if (vInfo.amm === 1) {
        count++;
        html += `<img src="icone/ammonizione.png" class="fanta-icon-img" alt="Ammonizione" title="Ammonizione">`;
    } else if (vInfo.amm >= 2) {
        count++;
        html += `<img src="icone/doppia_ammonizione.png" class="fanta-icon-img" alt="Doppia Ammonizione" title="Doppia Ammonizione">`;
    }
    if (vInfo.esp > 0) {
        count++;
        for(let i=0; i < vInfo.esp; i++) html += `<img src="icone/espulsione.png" class="fanta-icon-img" alt="Espulsione" title="Espulsione">`;
    }

    html += `</div>`;
    return count > 0 ? html : `<span style="color:var(--text-muted); font-size:10px;">-</span>`;
}

function mostraTabellinoVoti() {
    const container = document.getElementById("tabellino-container");
    let html = `<table class="voti-table">
        <thead>
            <tr>
                <th>Ruolo</th>
                <th>Calciatore</th>
                <th>Stato</th>
                <th>Voto</th>
                <th>Bonus / Malus</th>
                <th>Fantavoto</th>
            </tr>
        </thead>
        <tbody>`;
    let totale = 0;

    let riserveGiaSubentrate = new Set();

    schierati.forEach(tit => {
        let vInfo = votiGiornata[tit.nome];
        let eff = vInfo;
        let note = "<span style='color:var(--accent-green)'>Titolare</span>";

        if (!vInfo || vInfo.sv) {
            let riserveRuolo = riserveSelezionate[tit.ruolo] || [];
            let riservaValida = null;

            for (let ris of riserveRuolo) {
                if (!riserveGiaSubentrate.has(ris.nome)) {
                    let risInfo = votiGiornata[ris.nome];
                    if (risInfo && !risInfo.sv) {
                        riservaValida = { obj: ris, info: risInfo };
                        riserveGiaSubentrate.add(ris.nome);
                        break;
                    }
                }
            }

            if (riservaValida) {
                eff = riservaValida.info;
                note = `<span style='color:var(--accent-gold)'>🔁 Subentra (${riservaValida.obj.nome})</span>`;
            } else {
                note = "<span style='color:var(--accent-red)'>❌ S.V.</span>";
                eff = { voto: 0, fantavoto: 0, sv: true, gf:0, gs:0, ass:0, au:0, esp:0, amm:0, rp:0, rs:0, rf:0 };
            }
        }

        totale += eff.fantavoto;
        let iconeHtml = generaIconeBonusMalus(eff);
        let votoPuroTxt = eff.sv ? "-" : (eff.voto > 0 ? eff.voto : "-");

        html += `<tr>
            <td><i class="${roleIcons[tit.ruolo]}"></i></td>
            <td><strong>${tit.nome}</strong></td>
            <td>${note}</td>
            <td><strong style="color:#cbd5e1;">${votoPuroTxt}</strong></td>
            <td>${iconeHtml}</td>
            <td><strong style="color:var(--accent-blue);">${eff.fantavoto > 0 ? eff.fantavoto : 0}</strong></td>
        </tr>`;
    });

    html += `</tbody></table>
    <div class="totale-punteggio">🏆 Totale Squadra: ${totale} Punti</div>`;

    container.innerHTML = html;
}

async function cancellaRosaFirebase() {
    if (!currentUser) {
        alert("Devi accedere per poter eliminare i dati!");
        return;
    }

    if (new Date() >= MATCHDAY_DEADLINE) {
        alert("⚠️ Impossibile cancellare o modificare la rosa: la giornata di campionato è già iniziata.");
        return;
    }

    if (!confirm("⚠️ Sei sicuro di voler cancellare definitivamente la tua rosa salvata e ricominciare il draft?")) return;

    try {
        await db.collection("utenti").doc(currentUser.uid).update({
            nomeSquadra: firebase.firestore.FieldValue.delete(),
            rosa: firebase.firestore.FieldValue.delete(),
            schierati: firebase.firestore.FieldValue.delete(),
            riserveSelezionate: firebase.firestore.FieldValue.delete(),
            budget: firebase.firestore.FieldValue.delete(),
            moduloSelezionato: firebase.firestore.FieldValue.delete(),
            formazioneBloccata: firebase.firestore.FieldValue.delete(),
            votiGiornata: firebase.firestore.FieldValue.delete(),
            ultimoAggiornamento: new Date()
        });

        alert("🗑️ Rosa eliminata con successo!");
        location.reload();

    } catch (err) {
        alert("❌ Errore durante l'eliminazione: " + err.message);
    }
}