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

const MATCHDAY_DEADLINE = new Date("2026-10-23T20:45:00"); 

function initCountdown() {
    function updateTimer() {
        const now = new Date();
        const diff = MATCHDAY_DEADLINE - now;
        if (diff <= 0) return;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        if(document.getElementById("cd-days")) document.getElementById("cd-days").innerText = String(days).padStart(2, '0');
        if(document.getElementById("cd-hours")) document.getElementById("cd-hours").innerText = String(hours).padStart(2, '0');
        if(document.getElementById("cd-mins")) document.getElementById("cd-mins").innerText = String(mins).padStart(2, '0');
        if(document.getElementById("cd-secs")) document.getElementById("cd-secs").innerText = String(secs).padStart(2, '0');
    }
    updateTimer();
    setInterval(updateTimer, 1000);
}

document.addEventListener("DOMContentLoaded", () => {
    initCountdown();
    caricaGiocatoriDaExcel();
});

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
            username, nome, cognome, email, creatoIl: new Date(),
            nomeSquadra, rosa, schierati, riserveSelezionate, budget, moduloSelezionato, formazioneBloccata: false, votiGiornata
        });
        alert(`Registrazione completata! Benvenuto, ${username}.`);
    } catch (err) { alert("Errore Registrazione: " + err.message); }
}

async function handleLogin(e) {
    e.preventDefault();
    try {
        await auth.signInWithEmailAndPassword(document.getElementById('login-email').value.trim(), document.getElementById('login-password').value);
    } catch (err) { alert("Errore Login: " + err.message); }
}

auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-modal').style.display = 'none';
        document.getElementById('global-header-bar').style.display = 'flex';
        document.getElementById('user-display-name').innerText = user.displayName || user.email;
        await caricaDatiSquadraCloud();
    } else {
        currentUser = null;
        document.getElementById('auth-modal').style.display = 'flex';
        document.getElementById('global-header-bar').style.display = 'none';
        document.getElementById('home-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'none';
    }
});

function logout() {
    if (confirm("Vuoi davvero disconnetterti?")) auth.signOut().then(() => location.reload());
}

async function salvaSquadraCloud() {
    if (!currentUser) return;
    try {
        await db.collection("utenti").doc(currentUser.uid).set({
            nomeSquadra, rosa, schierati, riserveSelezionate, budget, moduloSelezionato, formazioneBloccata, votiGiornata, ultimoAggiornamento: new Date()
        }, { merge: true });
    } catch (err) { console.error("Errore salvataggio Cloud:", err); }
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
            document.getElementById('home-screen').style.display = 'none';
            document.getElementById('main-app').style.display = 'flex';

            if (moduloSelezionato) ripristinaCampoTattico();
            renderSlots();
            renderRiserveInline();
            if (formazioneBloccata) showFinalRecap();
        } else {
            // Mostra la home di benvenuto se l'utente non ha ancora una rosa
            document.getElementById('home-screen').style.display = 'block';
        }
    } catch (err) { console.error("Errore caricamento Cloud:", err); }
}

function entraNelDraft() {
    document.getElementById('home-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
}

async function caricaGiocatoriDaExcel() {
    try {
        const response = await fetch("giocatori.xlsx");
        if (!response.ok) throw new Error();
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
        parseAndSetPlayers(XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]));
    } catch (error) {
        console.warn("File giocatori.xlsx non trovato, genero dati di fallback.");
        generaGiocatoriMock();
    }
}

function parseAndSetPlayers(data) {
    if (!data || data.length === 0) { generaGiocatoriMock(); return; }
    customPlayersList = data.map(row => {
        let r = row.ruolo || row.Ruolo || row.RUOLO || "Centrocampista";
        let rUpper = String(r).trim().toUpperCase();
        if (rUpper === 'P' || rUpper === 'PORTIERE') r = 'Portiere';
        else if (rUpper === 'D' || rUpper === 'DIFENSORE') r = 'Difensore';
        else if (rUpper === 'C' || rUpper === 'CENTROCAMPISTA') r = 'Centrocampista';
        else if (rUpper === 'A' || rUpper === 'ATTACCANTE') r = 'Attaccante';

        let val = parseInt(row.valore || row.Valore || row.VALORE || 1);
        return { nome: row.nome || row.Nome || "Sconosciuto", ruolo: r, squadra: row.squadra || "N/D", valore: isNaN(val)?1:val };
    });
}

function generaGiocatoriMock() {
    customPlayersList = [];
    ["Portiere", "Difensore", "Centrocampista", "Attaccante"].forEach(r => {
        for (let i = 1; i <= 15; i++) customPlayersList.push({ nome: `${r} ${i}`, ruolo: r, squadra: "TEAM", valore: 10 });
    });
}

function updateDashboardCounters() {
    document.getElementById("budget-display").innerText = budget;
    let totalAcquistati = Object.values(rosa).reduce((acc, curr) => acc + curr.length, 0);
    document.getElementById("slots-left-display").innerText = 24 - totalAcquistati;

    if (totalAcquistati >= 24) {
        document.getElementById("rosa-panel-title").innerText = "Scegli la tua formazione";
    }

    ["Portiere", "Difensore", "Centrocampista", "Attaccante"].forEach(r => {
        let mancano = limits[r] - rosa[r].length;
        document.getElementById(`count-${r}`).innerText = `${rosa[r].length} / ${limits[r]} (${mancano} mancanti)`;
    });
}

function updateProgressBar() {
    document.getElementById("progress-bar").style.width = (turno / 24) * 100 + "%";
}

function startDraft() {
    if (new Date() >= MATCHDAY_DEADLINE) return alert("⚠️ Mercato chiuso!");
    if (customPlayersList.length < 24) return alert("Caricamento giocatori in corso.");

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
    let candidates = availablePlayers.filter(p => rosa[p.ruolo].length < limits[p.ruolo]);
    if (candidates.length === 0) candidates = availablePlayers;
    if (candidates.length === 0) { showModuloSelection(); return; }

    candidates.sort(() => Math.random() - 0.5).slice(0, 5).forEach(p => {
        container.innerHTML += `
            <div class="player-card ${p.ruolo}">
                <div>
                    <div class="player-name">${p.nome}</div>
                    <div class="player-team">${p.squadra}</div>
                    <span class="player-role"><i class="${roleIcons[p.ruolo]}"></i> ${p.ruolo}</span><br>
                    <div class="valore-badge-draft">💰 ${p.valore}</div>
                </div>
                <button class="draft-btn" onclick="draft('${p.nome.replace(/'/g, "\\'")}')">Acquista</button>
            </div>`;
    });
}

function draft(nome) {
    if (new Date() >= MATCHDAY_DEADLINE) return alert("⚠️ Mercato chiuso!");
    const p = availablePlayers.find(x => x.nome === nome);
    if (!p || rosa[p.ruolo].length >= limits[p.ruolo]) return;

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
            const isBench = (riserveSelezionate[ruolo] || []).some(r => r.nome === p.nome);
            
            let tagStatus = "";
            if (isTit) tagStatus = `<span class="slot-tag campo">Campo</span>`;
            else if (isBench) tagStatus = `<span class="slot-tag panchina">Riserva</span>`;

            div.innerHTML += `
                <div class="slot ${ruolo} ${isTit || isBench ? 'schierato' : ''}" onclick="gestisciClickSlotRosa('${ruolo}', '${p.nome.replace(/'/g, "\\'")}')">
                    <span><i class="${roleIcons[ruolo]}"></i> ${p.nome}</span>
                    <div>${tagStatus}</div>
                </div>`;
        });
    });
}

function gestisciClickSlotRosa(ruolo, nomePlayer) {
    if (formazioneBloccata || new Date() >= MATCHDAY_DEADLINE) return;
    if (!moduloSelezionato) return alert("Scegli prima il modulo tattico!");

    const p = rosa[ruolo].find(x => x.nome === nomePlayer);
    if (!p) return;

    let isTit = schierati.some(s => s.nome === p.nome);
    let isBench = (riserveSelezionate[ruolo] || []).some(r => r.nome === p.nome);

    if (isTit) {
        schierati = schierati.filter(s => s.nome !== p.nome);
        aggiornaCaselleCampo();
        renderSlots();
        renderRiserveInline();
        salvaSquadraCloud();
        return;
    }

    if (isBench) {
        riserveSelezionate[ruolo] = riserveSelezionate[ruolo].filter(r => r.nome !== p.nome);
        renderSlots();
        renderRiserveInline();
        salvaSquadraCloud();
        return;
    }

    let [D, C, A] = moduloSelezionato.split("-").map(n => parseInt(n));
    let maxTitolariRuolo = ruolo === "Portiere" ? 1 : (ruolo === "Difensore" ? D : (ruolo === "Centrocampista" ? C : A));
    let titolariAttualiRuolo = schierati.filter(s => s.ruolo === ruolo).length;

    if (titolariAttualiRuolo < maxTitolariRuolo) {
        schierati.push(p);
        aggiornaCaselleCampo();
        renderSlots();
        renderRiserveInline();
        salvaSquadraCloud();
        return;
    }

    if (!riserveSelezionate[ruolo]) riserveSelezionate[ruolo] = [];
    if (riserveSelezionate[ruolo].length >= 2) {
        return alert(`Hai già raggiunto il limite di 2 riserve per il ruolo: ${ruolo}`);
    }

    riserveSelezionate[ruolo].push(p);
    renderSlots();
    renderRiserveInline();
    salvaSquadraCloud();
}

function aggiornaCaselleCampo() {
    const dropzones = document.querySelectorAll("#campo .dropzone");
    dropzones.forEach(dz => {
        let ruoloDz = dz.dataset.ruolo;
        let ancoraTitolare = schierati.some(s => s.ruolo === ruoloDz && dz.dataset.player === s.nome);
        if (!ancoraTitolare) {
            dz.innerText = ruoloDz;
            dz.dataset.player = "";
            dz.classList.remove("filled");
        }
    });

    schierati.forEach(s => {
        let casellaLibera = Array.from(dropzones).find(dz => dz.dataset.ruolo === s.ruolo && dz.dataset.player === "");
        if (casellaLibera) {
            casellaLibera.innerText = s.nome;
            casellaLibera.dataset.player = s.nome;
            casellaLibera.classList.add("filled");
        }
    });
}

function showModuloSelection() {
    document.getElementById("draft-panel").innerHTML = `
        <h3 style="text-align:center;">Draft Completato!</h3>
        <p style="text-align:center; font-size:12px; color: var(--accent-gold); font-weight: 700;">Assegna un nome alla tua squadra e seleziona il modulo tattico:</p>
        <div class="input-group" style="max-width: 300px; margin: 0 auto 12px auto;">
            <label>Nome Squadra</label>
            <input type="text" id="nome-squadra-input" value="${nomeSquadra}" placeholder="es. FantaReal 2026" class="input-group input" style="width:100%; padding:8px; border-radius:8px; background:#1e293b; color:#fff; border:1px solid var(--card-border);">
        </div>
        <select id="modulo" onchange="setModulo()" style="display:block; margin: 0 auto; padding:8px; border-radius:8px; background:#1e293b; color:#fff; border:1px solid var(--card-border);">
            <option value="">-- Scegli Modulo --</option>
            <option value="4-4-2">4-4-2</option>
            <option value="4-3-3">4-3-3</option>
            <option value="3-4-3">3-4-3</option>
            <option value="4-5-1">4-5-1</option>
            <option value="3-5-2">3-5-2</option>
        </select>
    `;
    document.getElementById("formation-panel").style.display = "block";
}

function distribuisciOrizzontalmente(n) {
    const step = 100 / (n + 1);
    return Array.from({length: n}, (_, i) => step * (i + 1));
}

function setModulo() {
    const inputNome = document.getElementById("nome-squadra-input");
    if (inputNome) {
        nomeSquadra = inputNome.value.trim();
        if (!nomeSquadra) { alert("Inserisci un nome valido!"); document.getElementById("modulo").value = ""; return; }
    }
    moduloSelezionato = document.getElementById("modulo").value;
    if (!moduloSelezionato) return;

    schierati = [];
    riserveSelezionate = { Portiere: [], Difensore: [], Centrocampista: [], Attaccante: [] };
    ripristinaCampoTattico();
    renderSlots();
    renderRiserveInline();
    document.getElementById("conferma-container").style.display = "flex";
    salvaSquadraCloud();
}

function ripristinaCampoTattico() {
    if (!moduloSelezionato) return;
    const [D, C, A] = moduloSelezionato.split("-").map(n => parseInt(n));
    const campo = document.getElementById("campo");
    campo.innerHTML = "";

    let isMobile = window.innerWidth < 600;
    createDropZone(campo, "Portiere", isMobile ? 15 : 30, 50);
    distribuisciOrizzontalmente(D).forEach(left => createDropZone(campo, "Difensore", isMobile ? 105 : 150, left));
    distribuisciOrizzontalmente(C).forEach(left => createDropZone(campo, "Centrocampista", isMobile ? 215 : 310, left));
    distribuisciOrizzontalmente(A).forEach(left => createDropZone(campo, "Attaccante", isMobile ? 325 : 470, left));

    document.getElementById("formation-panel").style.display = "block";
    document.getElementById("conferma-container").style.display = "flex";
}

function createDropZone(campo, ruolo, top, left) {
    const dz = document.createElement("div");
    dz.className = "pos dropzone";
    dz.style.top = top + "px";
    dz.style.left = left + "%";
    dz.dataset.ruolo = ruolo;
    dz.dataset.player = "";
    dz.innerText = ruolo;

    dz.onclick = () => {
        if (formazioneBloccata || new Date() >= MATCHDAY_DEADLINE) return;
        if (dz.dataset.player) {
            schierati = schierati.filter(p => p.nome !== dz.dataset.player);
            dz.innerText = ruolo;
            dz.dataset.player = "";
            dz.classList.remove("filled");
            renderSlots();
            renderRiserveInline();
            salvaSquadraCloud();
        } else {
            apriMenuSceltaGiocatore(ruolo, dz);
        }
    };
    campo.appendChild(dz);
}

function apriMenuSceltaGiocatore(ruolo, dzElement) {
    const oldModal = document.getElementById("player-selector-modal");
    if (oldModal) oldModal.remove();

    const modal = document.createElement("div");
    modal.id = "player-selector-modal";
    modal.className = "player-selector-modal-overlay";
    let disponibili = rosa[ruolo].filter(p => !schierati.some(s => s.nome === p.nome));

    let html = `<div class="player-selector-modal-card"><h3 style="color:var(--accent-blue);">Seleziona ${ruolo}</h3>`;
    if (disponibili.length === 0) html += `<p style="color:var(--text-muted);">Nessun giocatore disponibile.</p>`;
    else {
        disponibili.forEach(p => {
            let isRes = (riserveSelezionate[ruolo] || []).some(r => r.nome === p.nome);
            html += `<div class="player-option-item" onclick="assegnaGiocatoreACampo('${ruolo}', '${p.nome.replace(/'/g, "\\'")}')">
                <div><span style="font-weight:700; color:#fff;">${p.nome}</span> ${isRes ? '<span style="font-size:9px; color:var(--accent-gold);">(Riserva)</span>' : ''}</div>
                <span style="font-size:10px; color:var(--accent-neon-green);">Schiera</span>
            </div>`;
        });
    }
    html += `<button onclick="document.getElementById('player-selector-modal').remove()" class="btn-action delete" style="width:100%; margin-top:15px; max-width:none;">Chiudi</button></div>`;
    modal.innerHTML = html;
    document.body.appendChild(modal);
    window.currentActiveDz = dzElement;
}

function assegnaGiocatoreACampo(ruolo, nomeGiocatore) {
    const p = rosa[ruolo].find(x => x.nome === nomeGiocatore);
    if (!p) return;

    if (window.currentActiveDz.dataset.player) {
        schierati = schierati.filter(s => s.nome !== window.currentActiveDz.dataset.player);
    }
    window.currentActiveDz.innerText = p.nome;
    window.currentActiveDz.dataset.player = p.nome;
    window.currentActiveDz.classList.add("filled");
    schierati.push(p);

    if (riserveSelezionate[ruolo]) {
        riserveSelezionate[ruolo] = riserveSelezionate[ruolo].filter(r => r.nome !== p.nome);
    }

    document.getElementById("player-selector-modal").remove();
    renderSlots();
    renderRiserveInline();
    salvaSquadraCloud();
}

function renderRiserveInline() {
    const container = document.getElementById("riserve-inline-container");
    container.innerHTML = "";
    ["Portiere", "Difensore", "Centrocampista", "Attaccante"].forEach(ruolo => {
        let riserveRuolo = riserveSelezionate[ruolo] || [];
        if (riserveRuolo.length === 0) {
            container.innerHTML += `<div class="riserva-pill" style="opacity:0.5;"><div style="font-weight:700; color:var(--text-muted);">${ruolo}</div><div style="font-size:9px; color:var(--text-muted);">Nessuna</div></div>`;
        } else {
            riserveRuolo.forEach((r, idx) => {
                container.innerHTML += `<div class="riserva-pill"><div style="font-weight:700; color:var(--accent-gold);">${ruolo} (R${idx+1})</div><div style="color:#fff;">${r.nome}</div></div>`;
            });
        }
    });
}

function confermaFormazione() {
    if (new Date() >= MATCHDAY_DEADLINE) return alert("⚠️ Tempo scaduto!");
    if (schierati.length < 11) return alert("Devi schierare tutti gli 11 titolari!");
    if (confirm("Confermi la formazione? L'operazione è definitiva.")) {
        formazioneBloccata = true;
        showFinalRecap();
        salvaSquadraCloud();
    }
}

function showFinal