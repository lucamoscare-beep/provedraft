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

// ----------------------------------------------------
// CALENDARIO DI SICUREZZA (FALLBACK IN CASO DI RETE ASSENTE)
// ----------------------------------------------------
const CALENDARIO_FALLBACK = {
    8: { inizio: new Date("2026-10-20T18:30:00"), fine: new Date("2026-10-22T23:00:00") },
    9: { inizio: new Date("2026-10-27T18:30:00"), fine: new Date("2026-10-29T23:00:00") },
    10: { inizio: new Date("2026-10-31T15:30:00"), fine: new Date("2026-11-02T23:00:00") },
    11: { inizio: new Date("2026-11-06T20:45:00"), fine: new Date("2026-11-08T23:00:00") },
    12: { inizio: new Date("2026-11-21T15:00:00"), fine: new Date("2026-11-23T23:00:00") },
    13: { inizio: new Date("2026-11-27T20:45:00"), fine: new Date("2026-11-30T23:00:00") },                                                14: { inizio: new Date("2026-12-04T20:45:00"), fine: new Date("2026-12-07T23:00:00") },
15: { inizio: new Date("2026-12-11T120:45:00"), fine: new Date("2026-12-14T23:00:00") },
16: { inizio: new Date("2026-12-18T18:30:00"), fine: new Date("2026-12-20T23:00:00") }

};

let ACTIVE_MATCHDAY = 9; 
let CURRENT_MATCHDAY_START = null;
let CURRENT_MATCHDAY_END = null;

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

const roleColors = {
    Portiere: "var(--role-por)",
    Difensore: "var(--role-dif)",
    Centrocampista: "var(--role-cen)",
    Attaccante: "var(--role-att)"
};

let userSquadre = []; 
let activeTeamIndex = -1; 
let isVotiOkAvailable = false;
let currentSelectedMatchday = ACTIVE_MATCHDAY; 

let tempNomeSquadra = "";
let isTestMode = false;
let rosa = { Portiere: [], Difensore: [], Centrocampista: [], Attaccante: [] };
let schierati = [];
let riserveSelezionate = { Portiere: [], Difensore: [], Centrocampista: [], Attaccante: [] };

let turno = 0;
let moduloSelezionato = "";

// Funzione di utilità per attivare il marquee solo se il testo è più lungo del contenitore
function initMarquee(el, isInline = false) {
    if (!el) return;
    el.classList.add('marquee-container');
    if (isInline) el.classList.add('inline');
    
    const textEl = el.querySelector('.marquee-text');
    if (!textEl) return;
    
    textEl.classList.remove('scroll-active');
    
    requestAnimationFrame(() => {
        const containerWidth = el.clientWidth;
        const textWidth = textEl.scrollWidth;
        
        if (textWidth > containerWidth && containerWidth > 0) {
            const distance = containerWidth - textWidth - 5;
            textEl.style.setProperty('--scroll-distance', `${distance}px`);
            textEl.classList.add('scroll-active');
        } else {
            textEl.style.removeProperty('--scroll-distance');
        }
    });
}

function refreshAllMarquees() {
    document.querySelectorAll('.marquee-container').forEach(el => {
        const isInline = el.classList.contains('inline');
        initMarquee(el, isInline);
    });
}

window.addEventListener('resize', () => {
    refreshAllMarquees();
});

async function inizializzaGiornataEDeadlineDinamica() {
    const keyCache = "draft_seriea_matchday_info";
    const keyTime = "draft_seriea_matchday_time";
    const oraAttuale = new Date().getTime();
    const durataCache = 30 * 60 * 1000; // 30 minuti

    const cacheSalvata = localStorage.getItem(keyCache);
    const timeSalvato = localStorage.getItem(keyTime);

    if (cacheSalvata && timeSalvato && (oraAttuale - parseInt(timeSalvato) < durataCache)) {
        try {
            const parsed = JSON.parse(cacheSalvata);
            const startCache = new Date(parsed.start);
            const endCache = new Date(parsed.end);
            
            if (endCache > new Date()) {
                ACTIVE_MATCHDAY = parsed.giornata;
                CURRENT_MATCHDAY_START = startCache;
                CURRENT_MATCHDAY_END = endCache;
                currentSelectedMatchday = Math.max(1, ACTIVE_MATCHDAY - 1);
                return;
            }
        } catch(e) {}
    }

    try {
        const response = await fetch("https://api.football-data.org/v4/competitions/SA/matches?status=SCHEDULED,LIVE,IN_PLAY", {
            headers: { "X-Auth-Token": "1803bfcd108f4c2cb2ee7663a7d45761" }
        });

        if (response.ok) {
            const data = await response.json();
            if (data && data.matches && data.matches.length > 0) {
                let giornataCorrente = data.matches[0].matchday;

                const resMatchday = await fetch(`https://api.football-data.org/v4/competitions/SA/matches?matchday=${giornataCorrente}`, {
                    headers: { "X-Auth-Token": "1803bfcd108f4c2cb2ee7663a7d45761" }
                });

                if (resMatchday.ok) {
                    const dataMatchday = await resMatchday.json();
                    const matches = dataMatchday.matches;

                    if (matches && matches.length > 0) {
                        matches.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

                        const primaPartita = matches[0];
                        const ultimaPartita = matches[matches.length - 1];

                        CURRENT_MATCHDAY_START = new Date(primaPartita.utcDate);
                        CURRENT_MATCHDAY_END = new Date(new Date(ultimaPartita.utcDate).getTime() + (2.5 * 60 * 60 * 1000));

                        if (new Date() > CURRENT_MATCHDAY_END) {
                            ACTIVE_MATCHDAY = giornataCorrente + 1;
                            await inizializzaGiornataEDeadlineDinamica();
                            return;
                        }

                        ACTIVE_MATCHDAY = giornataCorrente;
                        currentSelectedMatchday = Math.max(1, ACTIVE_MATCHDAY - 1);

                        localStorage.setItem(keyCache, JSON.stringify({
                            giornata: ACTIVE_MATCHDAY,
                            start: CURRENT_MATCHDAY_START.toISOString(),
                            end: CURRENT_MATCHDAY_END.toISOString()
                        }));
                        localStorage.setItem(keyTime, oraAttuale.toString());
                        return;
                    }
                }
            }
        }
    } catch (err) {}

    // Fallback di sicurezza
    const adesso = new Date();
    let trovata = 9;
    for (let [giornata, info] of Object.entries(CALENDARIO_FALLBACK)) {
        if (adesso < info.fine) {
            trovata = parseInt(giornata);
            break;
        }
    }
    ACTIVE_MATCHDAY = trovata;
    const fallbackInfo = CALENDARIO_FALLBACK[ACTIVE_MATCHDAY] || CALENDARIO_FALLBACK[9];
    CURRENT_MATCHDAY_START = fallbackInfo.inizio;
    CURRENT_MATCHDAY_END = fallbackInfo.fine;
    currentSelectedMatchday = getUltimaGiornataConVoti();
}

function getUltimaGiornataConVoti() {
    return Math.max(1, ACTIVE_MATCHDAY - 1);
}

function getRealUsername(uData, defaultAuthUser) {
    if (uData && uData.username && uData.username.trim() !== "") {
        return uData.username.trim();
    }
    if (uData && uData.displayName && uData.displayName.trim() !== "") {
        return uData.displayName.trim();
    }
    if (uData && (uData.nome || uData.cognome)) {
        const nomeCompleto = `${uData.nome || ''} ${uData.cognome || ''}`.trim();
        if (nomeCompleto !== "") return nomeCompleto;
    }
    if (uData && uData.email && uData.email.includes('@')) {
        return uData.email.split('@')[0];
    }
    if (defaultAuthUser) {
        if (defaultAuthUser.displayName && defaultAuthUser.displayName.trim() !== "") {
            return defaultAuthUser.displayName.trim();
        }
        if (defaultAuthUser.email && defaultAuthUser.email.includes('@')) {
            return defaultAuthUser.email.split('@')[0];
        }
    }
    return "Utente";
}

function isMarketOpen() {
    if (isTestMode) return true;
    const adesso = new Date();
    if (!CURRENT_MATCHDAY_START || !CURRENT_MATCHDAY_END) return true;

    // Bloccato dall'inizio della prima partita fino alla fine dell'ultima
    if (adesso >= CURRENT_MATCHDAY_START && adesso <= CURRENT_MATCHDAY_END) {
        return false;
    }

    if (adesso > CURRENT_MATCHDAY_END) {
        inizializzaGiornataEDeadlineDinamica();
        return true;
    }

    return true;
}

function initCountdown() {
    function updateTimer() {
        const now = new Date();
        if (!CURRENT_MATCHDAY_START || !CURRENT_MATCHDAY_END) return;

        const adesso = new Date();

        if (adesso >= CURRENT_MATCHDAY_START && adesso <= CURRENT_MATCHDAY_END) {
            document.querySelectorAll(".countdown-timer").forEach(el => el.innerHTML = `<span style='color:var(--accent-red); font-size:15px; font-weight:900;'>🔒 G${ACTIVE_MATCHDAY} IN CORSO (BLOCCATO)</span>`);
            const textEl = document.getElementById("welcome-deadline-text");
            if (textEl) textEl.innerText = `Le partite della giornata ${ACTIVE_MATCHDAY} sono in corso. Il mercato riaprirà al termine dell'ultimo match.`;
            return;
        }

        if (adesso > CURRENT_MATCHDAY_END) {
            inizializzaGiornataEDeadlineDinamica();
            return;
        }

        const diff = CURRENT_MATCHDAY_START - now;
        if (diff <= 0) {
            inizializzaGiornataEDeadlineDinamica();
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);

        ["w-cd-days"].forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerText = String(days).padStart(2, '0'); });
        ["w-cd-hours"].forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerText = String(hours).padStart(2, '0'); });
        ["w-cd-mins"].forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerText = String(mins).padStart(2, '0'); });
        ["w-cd-secs"].forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerText = String(secs).padStart(2, '0'); });
        
        const textEl = document.getElementById("welcome-deadline-text");
        if (textEl) textEl.innerText = `Iscrivi le tue squadre alla giornata ${ACTIVE_MATCHDAY} entro l'inizio della prima partita:`;
    }

    updateTimer();
    setInterval(updateTimer, 1000);
}

document.addEventListener("DOMContentLoaded", async () => {
    await inizializzaGiornataEDeadlineDinamica();
    initCountdown();
    await caricaGiocatoriDaExcel();
    await verificaDisponibilitaVotiOk();
    await verificaECalcolaVotiAutomaticamente(); 
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
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('register-form');
    const forgotForm = document.getElementById('forgot-form');
    const tabsHeader = document.getElementById('auth-tabs-header');

    loginForm.style.display = 'none';
    regForm.style.display = 'none';
    forgotForm.style.display = 'none';

    document.getElementById('tab-login-btn').className = '';
    document.getElementById('tab-register-btn').className = '';

    if (tab === 'login') {
        loginForm.style.display = 'block';
        document.getElementById('tab-login-btn').className = 'active';
        tabsHeader.style.display = 'flex';
    } else if (tab === 'register') {
        regForm.style.display = 'block';
        document.getElementById('tab-register-btn').className = 'active';
        tabsHeader.style.display = 'flex';
    } else if (tab === 'forgot') {
        forgotForm.style.display = 'block';
        tabsHeader.style.display = 'none';
    }
}

async function handleForgotPassword(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    try {
        await auth.sendPasswordResetEmail(email);
        alert("✉️ Email di ripristino inviata! Controlla la tua casella di posta.");
        switchAuthTab('login');
    } catch (err) {
        alert("❌ Errore durante l'invio dell'email: " + err.message);
    }
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
            displayName: username,
            nome: nome,
            cognome: cognome,
            email: email,
            squadre: [],
            draftTentati: 0,
            creatoIl: new Date()
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
        
        let displayUsername = user.displayName;
        try {
            const userDoc = await db.collection("utenti").doc(user.uid).get();
            if (userDoc.exists) {
                displayUsername = getRealUsername(userDoc.data(), user);
            }
        } catch(e) {}

        document.getElementById('user-display-name').innerText = displayUsername;
        document.getElementById('welcome-greeting').innerText = `Bentornato, ${displayUsername}!`;
        await caricaDatiUtenteCloud();
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

async function caricaDatiUtenteCloud() {
    if (!currentUser) return;
    try {
        const doc = await db.collection("utenti").doc(currentUser.uid).get();
        if (doc.exists && doc.data().squadre) {
            userSquadre = doc.data().squadre || [];
        } else {
            userSquadre = [];
        }
        await calcolaEVisualizzaTotaleSquadreGlobali(ACTIVE_MATCHDAY);
        renderWelcomeScreen();
    } catch (err) {
        console.error("Errore caricamento dati utente:", err);
    }
}

async function calcolaEVisualizzaTotaleSquadreGlobali(giornataCorrente = ACTIVE_MATCHDAY) {
    try {
        const snapshot = await db.collection("utenti").get();
        let conteggioTotale = 0;

        snapshot.forEach(doc => {
            const uData = doc.data();
            const squadreArr = uData.squadre || [];
            squadreArr.forEach(sq => {
                let g = sq.giornata !== undefined ? sq.giornata : 8;
                if (g === giornataCorrente) conteggioTotale++;
            });
        });

        // Al click apre direttamente la schermata della classifica della giornata corrente
        const badgeEl = document.getElementById("total-global-teams-count");
        if (badgeEl) {
            badgeEl.innerText = conteggioTotale;
            badgeEl.style.cursor = "pointer";
            badgeEl.onclick = () => apriSchermataClassifica(giornataCorrente);
        }
        
        const titleEl = document.getElementById("global-teams-card-title");
        if (titleEl) {
            titleEl.innerText = `Squadre Iscritte (Giornata ${giornataCorrente})`;
            titleEl.style.cursor = "pointer";
            titleEl.onclick = () => apriSchermataClassifica(giornataCorrente);
        }

        const globalCardBox = document.querySelector(".global-teams-card") || (badgeEl ? badgeEl.parentElement : null);
        if (globalCardBox) {
            globalCardBox.style.cursor = "pointer";
            globalCardBox.onclick = () => apriSchermataClassifica(giornataCorrente);
        }

    } catch (err) {
        const badgeEl = document.getElementById("total-global-teams-count");
        if (badgeEl) badgeEl.innerText = "0";
    }
}

async function ottieniNomiSquadreGlobaliGiornata(giornata) {
    try {
        const snapshot = await db.collection("utenti").get();
        let nomiSquadre = [];

        snapshot.forEach(doc => {
            const uData = doc.data();
            const squadreArr = uData.squadre || [];
            squadreArr.forEach(sq => {
                let g = sq.giornata !== undefined ? sq.giornata : 8;
                if (g === giornata && sq.nomeSquadra) {
                    nomiSquadre.push(sq.nomeSquadra.toLowerCase().trim());
                }
            });
        });
        return nomiSquadre;
    } catch (err) {
        return [];
    }
}

function verificaDisponibilitaVotiOk() {
    const ultimaGiornataVoti = getUltimaGiornataConVoti();
    const fileName = `voti_ok${ultimaGiornataVoti}.xlsx`;
    fetch(fileName, { method: "HEAD" })
        .then(res => { 
            isVotiOkAvailable = res.ok; 
            updateHomeStatusBannerState(); 
        })
        .catch(() => { 
            isVotiOkAvailable = false; 
            updateHomeStatusBannerState(); 
        });
}

function updateHomeStatusBannerState() {
    const container = document.getElementById("home-status-banner-container");
    const banner = document.getElementById("home-status-banner");
    const icon = document.getElementById("home-status-icon");
    const text = document.getElementById("home-status-text");
    const ultimaGiornataVoti = getUltimaGiornataConVoti();

    container.style.display = "block";

    // Cliccando sul banner si apre sempre la classifica della giornata dei voti (es. la 8)
    banner.style.cursor = "pointer";
    banner.onclick = () => apriSchermataClassifica(ultimaGiornataVoti);

    if (!isVotiOkAvailable) {
        banner.className = "home-status-banner waiting";
        icon.className = "fa-solid fa-hourglass-half";
        text.innerText = `In attesa dei voti della giornata ${ultimaGiornataVoti}`;
    } else {
        banner.className = "home-status-banner ready";
        icon.className = "fa-solid fa-trophy";
        text.innerText = `Voti aggiornati per la giornata ${ultimaGiornataVoti}! Guarda i risultati delle tue squadre`;
    }
}

function renderWelcomeScreen() {
    document.getElementById("welcome-screen").style.display = "block";
    document.getElementById("main-app").style.display = "none";
    document.getElementById("recap-screen").style.display = "none";
    document.getElementById("classifica-screen").style.display = "none";
    document.getElementById("profilo-screen").style.display = "none";

    const squadreGiornataCorrente = userSquadre.filter(sq => (sq.giornata !== undefined ? sq.giornata : 8) === ACTIVE_MATCHDAY);

    let gettoniRimasti = 3 - squadreGiornataCorrente.length;
    document.getElementById("tokens-count-display-inline").innerText = `${gettoniRimasti} / 3`;

    if (!isMarketOpen()) {
        document.getElementById("new-team-creation-area").style.display = "none";
        document.getElementById("tokens-exhausted-msg").style.display = "block";
        document.getElementById("tokens-exhausted-msg").innerText = "🔒 Il mercato è chiuso. Non è più possibile creare o modificare rose per questo turno.";
    } else if (gettoniRimasti <= 0) {
        document.getElementById("new-team-creation-area").style.display = "none";
        document.getElementById("tokens-exhausted-msg").style.display = "block";
        document.getElementById("tokens-exhausted-msg").innerText = "⚠️ Hai utilizzato tutti i 3 gettoni a disposizione per questa giornata!";
    } else {
        document.getElementById("new-team-creation-area").style.display = "block";
        document.getElementById("tokens-exhausted-msg").style.display = "none";
    }

    updateHomeStatusBannerState();

    document.getElementById("user-created-teams-title").innerText = `Le tue Squadre create per la giornata di campionato n°${ACTIVE_MATCHDAY}`;

    const container = document.getElementById("created-teams-container");
    container.innerHTML = "";

    if (squadreGiornataCorrente.length === 0) {
        container.innerHTML = `<p style="color:var(--text-muted); font-size:12px;">Nessuna squadra ancora creata per la giornata ${ACTIVE_MATCHDAY}.</p>`;
        return;
    }

    squadreGiornataCorrente.forEach((sq) => {
        const item = document.createElement("div");
        item.className = "team-card-item";
        
        let punteggioHtml = "";
        if (sq.punteggioTotale !== undefined && sq.punteggioTotale !== null) {
            punteggioHtml = `<div style="font-size:11px; font-weight:900; color:var(--accent-gold); margin-top:2px;">🏆 Punteggio: ${sq.punteggioTotale} pt</div>`;
        }

        const realIndex = userSquadre.indexOf(sq);

        item.innerHTML = `
            <div class="team-card-info">
                <div class="marquee-container"><span class="marquee-text team-card-name">${sq.nomeSquadra}</span></div>
                <div style="font-size:10px; color:var(--text-muted);">Modulo: ${sq.moduloSelezionato}</div>
                ${punteggioHtml}
            </div>
            <button onclick="apriRecapSquadraUtenteCorrente(${realIndex})" class="btn-small-recap">
                <i class="fa-solid fa-eye"></i> Vedi Squadra
            </button>
        `;
        container.appendChild(item);
    });
    
    refreshAllMarquees();
}

async function apriSchermataClassifica(giornata) {
    if (giornata === undefined || giornata === null) {
        giornata = ACTIVE_MATCHDAY;
    }
    currentSelectedMatchday = giornata;

    document.getElementById("welcome-screen").style.display = "none";
    document.getElementById("main-app").style.display = "none";
    document.getElementById("recap-screen").style.display = "none";
    document.getElementById("profilo-screen").style.display = "none";
    document.getElementById("classifica-screen").style.display = "block";

    document.getElementById("classifica-heading-text").innerText = `Classifica della giornata n°${giornata}`;

    renderMatchdayPills(giornata);

    const podiumArea = document.getElementById("podium-area");
    const tableBody = document.getElementById("classifica-table-body");
    podiumArea.innerHTML = "";
    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">Caricamento dati classifica in corso...</td></tr>`;

    try {
        const snapshot = await db.collection("utenti").get();
        let tutteSquadreLega = [];

        snapshot.forEach(doc => {
            const uData = doc.data();
            const username = getRealUsername(uData, null);
            const squadreArr = uData.squadre || [];

            squadreArr.forEach(sq => {
                let g = sq.giornata !== undefined ? sq.giornata : 8; 
                if (g === giornata) {
                    let budgetResiduo = sq.budget !== undefined && sq.budget !== null ? sq.budget : 0;
                    tutteSquadreLega.push({
                        username: username,
                        userId: doc.id,
                        nomeSquadra: sq.nomeSquadra,
                        punteggio: sq.punteggioTotale !== null && sq.punteggioTotale !== undefined ? sq.punteggioTotale : 0,
                        budgetResiduo: budgetResiduo,
                        squadraObj: sq
                    });
                }
            });
        });

        tutteSquadreLega.sort((a, b) => {
            if (b.punteggio !== a.punteggio) {
                return b.punteggio - a.punteggio;
            }
            return b.budgetResiduo - a.budgetResiduo;
        });

        if (tutteSquadreLega.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">Nessuna squadra iscritta per la giornata n°${giornata}.</td></tr>`;
            return;
        }

        let classificaConRango = [];
        for (let i = 0; i < tutteSquadreLega.length; i++) {
            classificaConRango.push({
                ...tutteSquadreLega[i],
                rank: i + 1
            });
        }

        const topTre = classificaConRango.filter(item => item.rank <= 3);

        if (topTre.length > 0) {
            const gruppiPodio = { 1: [], 2: [], 3: [] };
            topTre.forEach(item => {
                if (gruppiPodio[item.rank]) gruppiPodio[item.rank].push(item);
            });

            [2, 1, 3].forEach(targetRank => {
                const listaGruppo = gruppiPodio[targetRank];
                if (listaGruppo && listaGruppo.length > 0) {
                    const classes = { 1: "gold", 2: "silver", 3: "bronze" };
                    const trophyImages = { 1: "icone/coppa1.png", 2: "icone/coppa2.png", 3: "icone/coppa3.png" };
                    
                    const leaderCard = listaGruppo[0];
                    const puntiLeader = leaderCard.punteggio;
                    
                    const quantiConStessoPunteggio = tutteSquadreLega.filter(x => x.punteggio === puntiLeader).length;
                    const altriPariPunti = quantiConStessoPunteggio - 1;

                    let subtextHtml = "";
                    if (altriPariPunti > 0) {
                        subtextHtml = `<div class="podium-tie-subtext">🤝 e altri ${altriPariPunti} fantallenator${altriPariPunti === 1 ? 'e' : 'i'} a ${puntiLeader} pt</div>`;
                    }

                    const card = document.createElement("div");
                    card.className = `podium-card ${classes[targetRank]}`;
                    card.innerHTML = `
                        <div class="podium-rank-badge"><img src="${trophyImages[targetRank]}" class="fanta-trophy-img" alt="${targetRank}° Posto"></div>
                        <div class="podium-team-name"><div class="marquee-container"><span class="marquee-text">${leaderCard.nomeSquadra}</span></div></div>
                        <div class="podium-user-name" onclick="apriProfiloUtente('${leaderCard.userId}')"><i class="fa-solid fa-user"></i> <span class="marquee-container" style="display:inline-block; max-width:140px; vertical-align:middle;"><span class="marquee-text">${leaderCard.username}</span></span></div>
                        <div style="font-size:10px; color:var(--text-muted); margin-bottom:4px;">Budget: ${leaderCard.budgetResiduo} cr</div>
                        <div class="podium-score">${leaderCard.punteggio} pt</div>
                        ${subtextHtml}
                        <button onclick="visualizzaSquadraGenerica('${leaderCard.userId}', '${leaderCard.nomeSquadra.replace(/'/g, "\\'")}', ${giornata})" class="btn-action-primary" style="padding:4px 10px; font-size:10px; margin-top:8px;" title="Vedi Formazione">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                    `;
                    podiumArea.appendChild(card);
                }
            });
        }

        tableBody.innerHTML = "";
        classificaConRango.forEach((item) => {
            const tr = document.createElement("tr");
            
            if (currentUser && item.userId === currentUser.uid) {
                tr.className = "current-user-row";
            }

            let rankDisplay = item.rank;
            if (item.rank === 1) rankDisplay = `<img src="icone/coppa1.png" class="fanta-trophy-img" alt="1° Posto">`;
            else if (item.rank === 2) rankDisplay = `<img src="icone/coppa2.png" class="fanta-trophy-img" alt="2° Posto">`;
            else if (item.rank === 3) rankDisplay = `<img src="icone/coppa3.png" class="fanta-trophy-img" alt="3° Posto">`;

            tr.innerHTML = `
                <td class="rank-cell">${rankDisplay}</td>
                <td style="font-weight:700; color:var(--accent-blue); cursor:pointer;" onclick="apriProfiloUtente('${item.userId}')"><div class="marquee-container" style="max-width: 120px;"><span class="marquee-text"><i class="fa-solid fa-user"></i> ${item.username}</span></div></td>
                <td style="font-weight:800; color:#fff;"><div class="marquee-container" style="max-width: 150px;"><span class="marquee-text">${item.nomeSquadra}</span></div></td>
                <td style="font-weight:900; color:var(--accent-neon-green); font-size:13px;">${item.punteggio} pt</td>
                <td style="color:var(--accent-gold); font-weight:700;">${item.budgetResiduo} cr</td>
                <td style="text-align:right;">
                    <button onclick="visualizzaSquadraGenerica('${item.userId}', '${item.nomeSquadra.replace(/'/g, "\\'")}', ${giornata})" class="btn-action-primary" style="padding:6px 12px; font-size:11px;" title="Vedi Formazione">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        refreshAllMarquees();

    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--accent-red);">Errore durante il caricamento della classifica.</td></tr>`;
    }
}

async function apriProfiloUtente(targetUserId) {
   if (!targetUserId && currentUser) targetUserId = currentUser.uid;
    if (!targetUserId) return;

    document.getElementById("welcome-screen").style.display = "none";
    document.getElementById("main-app").style.display = "none";
    document.getElementById("recap-screen").style.display = "none";
    document.getElementById("classifica-screen").style.display = "none";
    document.getElementById("profilo-screen").style.display = "block";

    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
        const userDoc = await db.collection("utenti").doc(targetUserId).get();
        if (!userDoc.exists) {
            alert("Utente non trovato.");
            tornaAllaHome();
            return;
        }

        const uData = userDoc.data();
        const username = getRealUsername(uData, null);
        document.getElementById("profilo-username-title").innerText = `Profilo di ${username}`;

        const squadre = uData.squadre || [];
        const draftTentati = uData.draftTentati || 0;

        let squadreCreateCount = squadre.length;
        let puntiTotali = 0;
        let migliorPunteggio = 0;
        let budgetSpesoTotale = 0;

        // Oggetti per contare le frequenze
        let conteggioGiocatoriUtente = {};
        let conteggioSquadreSerieA = {};

        squadre.forEach(sq => {
            let pts = sq.punteggioTotale !== undefined && sq.punteggioTotale !== null ? sq.punteggioTotale : 0;
            puntiTotali += pts;
            if (pts > migliorPunteggio) migliorPunteggio = pts;

            // Calcolo del budget speso
            let budgetResiduo = sq.budget !== undefined && sq.budget !== null ? sq.budget : 600;
            let spesoPerQuestaSquadra = 600 - budgetResiduo;
            if (spesoPerQuestaSquadra < 0) spesoPerQuestaSquadra = 0;
            budgetSpesoTotale += spesoPerQuestaSquadra;

            // Raccogliamo i giocatori della rosa
            try {
                let giocatoriDellaSquadra = [];

                if (sq.schierati && Array.isArray(sq.schierati)) {
                    giocatoriDellaSquadra.push(...sq.schierati);
                }
                if (sq.rosa) {
                    if (Array.isArray(sq.rosa)) {
                        giocatoriDellaSquadra.push(...sq.rosa);
                    } else if (typeof sq.rosa === 'object') {
                        Object.values(sq.rosa).forEach(listaRuolo => {
                            if (Array.isArray(listaRuolo)) giocatoriDellaSquadra.push(...listaRuolo);
                        });
                    }
                }
                if (sq.riserveSelezionate) {
                    if (Array.isArray(sq.riserveSelezionate)) {
                        giocatoriDellaSquadra.push(...sq.riserveSelezionate);
                    } else if (typeof sq.riserveSelezionate === 'object') {
                        Object.values(sq.riserveSelezionate).forEach(listaRiserve => {
                            if (Array.isArray(listaRiserve)) giocatoriDellaSquadra.push(...listaRiserve);
                        });
                    }
                }

                // Incrementiamo i contatori per giocatore e per club
                giocatoriDellaSquadra.forEach(p => {
                    if (p) {
                        if (p.nome) {
                            let nomeG = String(p.nome).trim();
                            if (nomeG !== "") conteggioGiocatoriUtente[nomeG] = (conteggioGiocatoriUtente[nomeG] || 0) + 1;
                        }
                        if (p.squadra) {
                            let nomeSa = String(p.squadra).trim();
                            if (nomeSa !== "" && nomeSa !== "N/D") conteggioSquadreSerieA[nomeSa] = (conteggioSquadreSerieA[nomeSa] || 0) + 1;
                        }
                    }
                });
            } catch (errInner) {}
        });

        // Troviamo il Giocatore Preferito
        let giocatorePreferito = "Nessuno";
        let maxScelteG = 0;
        for (let [nomeG, count] of Object.entries(conteggioGiocatoriUtente)) {
            if (count > maxScelteG) { maxScelteG = count; giocatorePreferito = nomeG; }
        }

        // Troviamo la Squadra Preferita
        let squadraPreferita = "Nessuna";
        let maxScelteS = 0;
        for (let [nomeS, count] of Object.entries(conteggioSquadreSerieA)) {
            if (count > maxScelteS) { maxScelteS = count; squadraPreferita = nomeS; }
        }

        // Calcolo Podi
        let ori = 0, argenti = 0, bronzi = 0;
        const ultimaGiornataVoti = getUltimaGiornataConVoti();
        
        for (let g = 1; g <= ultimaGiornataVoti; g++) {
            const snapAll = await db.collection("utenti").get();
            let listaGiornata = [];
            snapAll.forEach(docU => {
                const dU = docU.data();
                const sArr = dU.squadre || [];
                sArr.forEach(sq => {
                    let gSq = sq.giornata !== undefined ? sq.giornata : 8;
                    if (gSq === g) {
                        listaGiornata.push({
                            userId: docU.id,
                            punteggio: sq.punteggioTotale !== null && sq.punteggioTotale !== undefined ? sq.punteggioTotale : 0,
                            budgetResiduo: sq.budget !== undefined && sq.budget !== null ? sq.budget : 0
                        });
                    }
                });
            });

            if (listaGiornata.length === 0) continue;

            listaGiornata.sort((a, b) => {
                if (b.punteggio !== a.punteggio) return b.punteggio - a.punteggio;
                return b.budgetResiduo - a.budgetResiduo;
            });

            listaGiornata.forEach((item, index) => {
                let rank = index + 1;
                if (item.userId === targetUserId) {
                    if (rank === 1) ori++;
                    else if (rank === 2) argenti++;
                    else if (rank === 3) bronzi++;
                }
            });
        }

        // Stampiamo i valori nell'HTML
        document.getElementById("stat-squadre-create").innerText = squadreCreateCount;
        document.getElementById("stat-draft-tentati").innerText = draftTentati;
        document.getElementById("stat-miglior-punteggio").innerText = `${migliorPunteggio.toFixed(1)} pt`;
        document.getElementById("stat-punti-totali").innerText = `${puntiTotali.toFixed(1)} pt`;

        if (document.getElementById("stat-budget-speso")) {
            document.getElementById("stat-budget-speso").innerText = `${budgetSpesoTotale} cr`;
        }

        if (document.getElementById("stat-giocatore-preferito")) {
            let testoG = maxScelteG > 0 ? `${giocatorePreferito} <span style="font-size:14px; color:var(--accent-blue); font-weight:700;">(${maxScelteG} ${maxScelteG === 1 ? 'volta' : 'volte'})</span>` : "Nessuno";
            document.getElementById("stat-giocatore-preferito").innerHTML = testoG;
        }

        if (document.getElementById("stat-squadra-preferita")) {
            let testoS = maxScelteS > 0 ? `${squadraPreferita} <span style="font-size:14px; color:var(--accent-neon-green); font-weight:700;">(${maxScelteS} ${maxScelteS === 1 ? 'giocatore' : 'giocatori'})</span>` : "Nessuna";
            document.getElementById("stat-squadra-preferita").innerHTML = testoS;
        }

        document.getElementById("stat-podi-oro").innerText = ori;
        document.getElementById("stat-podi-argento").innerText = argenti;
        document.getElementById("stat-podi-bronzo").innerText = bronzi;

    } catch (err) {
        alert("Errore nel caricamento delle statistiche utente.");
        tornaAllaHome();
    }
}

async function incrementaDraftTentatiCloud() {
    if (!currentUser) return;
    try {
        const userRef = db.collection("utenti").doc(currentUser.uid);
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(userRef);
            let currentDrafts = 0;
            if (doc.exists && doc.data().draftTentati !== undefined) {
                currentDrafts = doc.data().draftTentati;
            }
            transaction.update(userRef, { draftTentati: currentDrafts + 1 });
        });
    } catch (e) {}
}

function renderMatchdayPills(selectedDay) {
    const container = document.getElementById("matchdays-pills-container");
    container.innerHTML = "";

    // Genera le pillole fino alla giornata attiva (incluso il turno in corso)
    for (let g = 1; g <= ACTIVE_MATCHDAY; g++) {
        const btn = document.createElement("button");
        btn.className = `btn-matchday-pill ${g === selectedDay ? 'active' : ''}`;
        btn.innerText = `Giornata ${g}`;
        btn.onclick = () => apriSchermataClassifica(g);
        container.appendChild(btn);
    }
}

async function visualizzaSquadraGenerica(userId, nomeSquadra, giornata) {
    try {
        const doc = await db.collection("utenti").doc(userId).get();
        if (!doc.exists) return alert("Utente non trovato.");

        const uData = doc.data();
        const username = getRealUsername(uData, null);
        const squadreArr = uData.squadre || [];

        const sq = squadreArr.find(s => s.nomeSquadra.toLowerCase() === nomeSquadra.toLowerCase() && (s.giornata !== undefined ? s.giornata : 8) === giornata);
        if (!sq) return alert("Squadra non trovata per questa giornata.");

        renderRecapScreenReadOnly(sq, username, true);
    } catch (err) {
        alert("Errore nel caricamento della squadra: " + err.message);
    }
}

async function apriRecapSquadraUtenteCorrente(index) {
    const sq = userSquadre[index];
    let username = "Fantallenatore";
    if (currentUser) {
        try {
            const uDoc = await db.collection("utenti").doc(currentUser.uid).get();
            if (uDoc.exists) {
                username = getRealUsername(uDoc.data(), currentUser);
            } else {
                username = getRealUsername(null, currentUser);
            }
        } catch(e) {
            username = getRealUsername(null, currentUser);
        }
    }
    renderRecapScreenReadOnly(sq, username, false);
}

function renderRecapScreenReadOnly(sq, usernameOwner, fromClassifica = false) {
    document.getElementById("welcome-screen").style.display = "none";
    document.getElementById("main-app").style.display = "none";
    document.getElementById("classifica-screen").style.display = "none";
    document.getElementById("profilo-screen").style.display = "none";
    document.getElementById("recap-screen").style.display = "block";

    document.getElementById("recap-nome-squadra").innerText = sq.nomeSquadra;
    document.getElementById("recap-utente-owner").innerText = `Username: ${usernameOwner}`;
    document.getElementById("recap-modulo-title").innerText = sq.moduloSelezionato;

    const btnBackClassifica = document.getElementById("btn-recap-back-classifica");
    btnBackClassifica.style.display = fromClassifica ? "inline-flex" : "none";

    const recapBadge = document.getElementById("recap-badge-status");
    if (sq.isTest) {
        recapBadge.style.background = "rgba(139, 92, 246, 0.2)";
        recapBadge.style.borderColor = "#a78bfa";
        recapBadge.style.color = "#c4b5fd";
        recapBadge.innerText = "🧪 TEST DRAFT (NON SALVATO)";
    } else {
        recapBadge.style.background = "rgba(16, 185, 129, 0.2)";
        recapBadge.style.borderColor = "var(--accent-neon-green)";
        recapBadge.style.color = "var(--accent-neon-green)";
        recapBadge.innerText = `🔒 SQUADRA SALVATA (GIORNATA ${sq.giornata || 8})`;
    }

    const recapCampo = document.getElementById("recap-campo");
    recapCampo.innerHTML = "";
    
    const [D, C, A] = sq.moduloSelezionato.split("-").map(n => parseInt(n));
    
    creaRepartoCampo(recapCampo, "Portiere", [sq.schierati.find(p => p.ruolo === "Portiere")], true);
    creaRepartoCampo(recapCampo, "Difensore", sq.schierati.filter(p => p.ruolo === "Difensore"), true);
    creaRepartoCampo(recapCampo, "Centrocampista", sq.schierati.filter(p => p.ruolo === "Centrocampista"), true);
    creaRepartoCampo(recapCampo, "Attaccante", sq.schierati.filter(p => p.ruolo === "Attaccante"), true);

    const panchinaDiv = document.getElementById("recap-panchina");
    panchinaDiv.innerHTML = "";

    ["Portiere", "Difensore", "Centrocampista", "Attaccante"].forEach(ruolo => {
        const riserve = sq.riserveSelezionate[ruolo] || [];
        riserve.forEach((ris, i) => {
            const card = document.createElement("div");
            card.className = "recap-bench-card";
            card.innerHTML = `
                <div>
                    <div class="bench-player-meta">
                        <i class="${roleIcons[ruolo]}"></i> ${ruolo} (R${i+1})
                    </div>
                    <div class="bench-player-name">
                        <div class="marquee-container" style="max-width:220px;"><span class="marquee-text">${ris.nome}</span></div>
                    </div>
                </div>
            `;
            panchinaDiv.appendChild(card);
        });
    });

    if (sq.votiGiornata && Object.keys(sq.votiGiornata).length > 0) {
        mostraTabellinoVoti(sq);
    } else {
        document.getElementById("tabellino-container").innerHTML = `<p style="text-align:center; color:var(--text-muted); font-size:12px;">I voti per questa squadra non sono ancora stati calcolati.</p>`;
    }
    
    refreshAllMarquees();
}

function tornaAllaHome() {
    renderWelcomeScreen();
}

function avviaTestDraft() {
    if (customPlayersList.length < 24) {
        alert("Caricamento giocatori in corso o file giocatori.xlsx non valido.");
        return;
    }

    incrementaDraftTentatiCloud();
    isTestMode = true;
    tempNomeSquadra = "🧪 Squadra Test Draft";

    document.getElementById("draft-panel").innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div>
                <h2>Scegli il tuo giocatore (Test)</h2>
                <span style="font-size:11px; color:var(--accent-blue); font-weight:600;">👇 Tocca la scheda per acquistarlo</span>
            </div>
            <button onclick="annullaERicominciaDraft()" class="btn-action-danger" style="padding:6px 12px; font-size:11px;"><i class="fa-solid fa-arrow-rotate-left"></i> Ricomincia Test</button>
        </div>
        <div id="players" class="players-container"></div>
    `;

    document.getElementById("btn-conferma-formazione").innerHTML = `<i class="fa-solid fa-vials"></i> Termina Test e Visualizza Recap`;

    resetDraftState();

    document.getElementById("welcome-screen").style.display = "none";
    document.getElementById("main-app").style.display = "flex";
    document.getElementById("current-draft-team-title").innerText = `Rosa Test: ${tempNomeSquadra}`;

    window.scrollTo({ top: 0, behavior: 'smooth' });
    nextPick();
}

async function preparaEAvviaDraft() {
    if (!isMarketOpen()) {
        alert(`⚠️ Il mercato è chiuso per la Giornata ${ACTIVE_MATCHDAY}.`);
        return;
    }

    const squadreGiornataCorrente = userSquadre.filter(sq => (sq.giornata !== undefined ? sq.giornata : 8) === ACTIVE_MATCHDAY);
    if (squadreGiornataCorrente.length >= 3) {
        alert(`Hai già utilizzato tutti i 3 gettoni disponibili per la Giornata ${ACTIVE_MATCHDAY}!`);
        return;
    }

    const inputName = document.getElementById("new-team-name-input").value.trim();
    if (!inputName) {
        alert("Inserisci un nome per la tua nuova squadra!");
        return;
    }

    const nomiEsistentiLega = await ottieniNomiSquadreGlobaliGiornata(ACTIVE_MATCHDAY);
    if (nomiEsistentiLega.includes(inputName.toLowerCase())) {
        alert(`❌ Il nome "${inputName}" è già stato scelto da un utente per la Giornata ${ACTIVE_MATCHDAY}! Scegli un nome differente.`);
        return;
    }

    if (customPlayersList.length < 24) {
        alert("Caricamento giocatori in corso o file giocatori.xlsx non valido.");
        return;
    }

    incrementaDraftTentatiCloud();
    isTestMode = false;
    tempNomeSquadra = inputName;
    
    document.getElementById("draft-panel").innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div>
                <h2>Scegli il tuo giocatore</h2>
                <span style="font-size:11px; color:var(--accent-blue); font-weight:600;">👇 Tocca la scheda per acquistarlo</span>
            </div>
            <button onclick="annullaERicominciaDraft()" class="btn-action-danger" style="padding:6px 12px; font-size:11px;"><i class="fa-solid fa-arrow-rotate-left"></i> Ricomincia Draft</button>
        </div>
        <div id="players" class="players-container"></div>
    `;

    document.getElementById("btn-conferma-formazione").innerHTML = `<i class="fa-solid fa-lock"></i> Conferma e salva la tua formazione`;

    resetDraftState();

    document.getElementById("welcome-screen").style.display = "none";
    document.getElementById("main-app").style.display = "flex";
    document.getElementById("current-draft-team-title").innerText = `Rosa: ${tempNomeSquadra} (Giornata ${ACTIVE_MATCHDAY})`;

    window.scrollTo({ top: 0, behavior: 'smooth' });
    nextPick();
}

function resetDraftState() {
    budget = 600;
    turno = 0;
    moduloSelezionato = "";
    rosa = { Portiere: [], Difensore: [], Centrocampista: [], Attaccante: [] };
    schierati = [];
    riserveSelezionate = { Portiere: [], Difensore: [], Centrocampista: [], Attaccante: [] };
    availablePlayers = [...customPlayersList];
    
    document.getElementById("campo-panel-container").style.display = "none";
    document.getElementById("panchina-panel-container").style.display = "none";

    document.getElementById("campo").innerHTML = "";
    document.getElementById("panchina-grafica").innerHTML = "";
    document.getElementById("conferma-container").style.display = "none";
    
    renderSlots();
    updateDashboardCounters();
}

function annullaERicominciaDraft() {
    if (confirm("Vuoi davvero ricominciare il draft? I giocatori selezionati verranno azzerati.")) {
        incrementaDraftTentatiCloud();
        const titleHtml = isTestMode ? '<h2>Scegli il tuo giocatore (Test)</h2>' : '<h2>Scegli il tuo giocatore</h2>';
        const btnText = isTestMode ? 'Ricomincia Test' : 'Ricomincia Draft';

        document.getElementById("draft-panel").innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <div>
                    ${titleHtml}
                    <span style="font-size:11px; color:var(--accent-blue); font-weight:600;">👇 Tocca la scheda per acquistarlo</span>
                </div>
                <button onclick="annullaERicominciaDraft()" class="btn-action-danger" style="padding:6px 12px; font-size:11px;"><i class="fa-solid fa-arrow-rotate-left"></i> ${btnText}</button>
            </div>
            <div id="players" class="players-container"></div>
        `;
        resetDraftState();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        nextPick();
    }
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
    } catch (error) {}
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

    const budgetCard = document.getElementById("budget-card-row");
    if (budgetCard) {
        budgetCard.classList.remove("high-credits", "medium-credits", "low-credits");
        if (budget >= 300) {
            budgetCard.classList.add("high-credits");
        } else if (budget >= 100) {
            budgetCard.classList.add("medium-credits");
        } else {
            budgetCard.classList.add("low-credits");
        }
    }

    ["Portiere", "Difensore", "Centrocampista", "Attaccante"].forEach(r => {
        let count = rosa[r].length;
        let max = limits[r];
        document.getElementById(`count-box-${r}`).innerText = `${count}/${max}`;
    });
}

function updateProgressBar() {
    let percentage = (turno / 24) * 100;
    document.getElementById("progress-bar").style.width = percentage + "%";
}

function nextPick() {
    turno++;
    updateProgressBar();
    updateDashboardCounters();
    
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (turno > 24) {
        showModuloSelection();
        return;
    }

    renderPlayers();
}

function renderPlayers() {
    const container = document.getElementById("players");
    container.innerHTML = "";

    let totalAcquistati = Object.values(rosa).reduce((acc, curr) => acc + curr.length, 0);
    let giocatoriMancanti = 24 - totalAcquistati;

    let ruoliDisponibili = availablePlayers.filter(p => rosa[p.ruolo].length < limits[p.ruolo]);
    let maxCostAllowed = budget - (giocatoriMancanti - 1);
    let candidates = ruoliDisponibili.filter(p => p.valore <= maxCostAllowed);

    if (candidates.length === 0) {
        candidates = ruoliDisponibili.filter(p => p.valore <= budget);
    }

    if (candidates.length === 0) {
        alert(`Attenzione: Impossibile trovare giocatori compatibili con il budget residuo!`);
        showModuloSelection();
        return;
    }

    let ruoliNecessari = Object.keys(limits).filter(r => rosa[r].length < limits[r]);
    let five = [];

    if (ruoliNecessari.length > 1) {
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
        card.onclick = () => draft(p.nome);

        card.innerHTML = `
            <div style="width: 100%;">
                <div class="player-name">
                    <div class="marquee-container">
                        <span class="marquee-text">${p.nome}</span>
                    </div>
                </div>
                <div class="player-team">${p.squadra}</div>
                <span class="player-role-label">${p.ruolo}</span>
            </div>
            <div class="valore-badge-draft">💰 ${p.valore}</div>
        `;
        container.appendChild(card);
    });

    refreshAllMarquees();
}

function draft(nome) {
    if (!isTestMode && !isMarketOpen()) {
        alert("⚠️ Tempo scaduto! Il mercato è chiuso per questa giornata.");
        return;
    }

    const p = availablePlayers.find(x => x.nome === nome);
    if (!p) return;

    if (rosa[p.ruolo].length >= limits[p.ruolo]) {
        alert(`Hai già raggiunto il limite massimo di ${limits[p.ruolo]} giocatori per il ruolo ${p.ruolo}!`);
        return;
    }

    if (p.valore > budget) {
        alert(`Non hai abbastanza crediti per acquistare ${p.nome}! Budget residuo: ${budget}`);
        return;
    }

    budget -= p.valore;
    rosa[p.ruolo].push(p);
    availablePlayers = availablePlayers.filter(x => x.nome !== nome);

    renderSlots();
    nextPick();
}

function renderSlots() {
    const titleContainer = document.querySelector(".section-rosa h2");
    if (titleContainer && !document.getElementById("rosa-legenda-box")) {
        titleContainer.innerHTML = `La Tua Rosa <span style="font-size:11px; color:var(--accent-blue); font-weight:normal;">(Clicca per schierare)</span>`;
        
        const legendaDiv = document.createElement("div");
        legendaDiv.className = "rosa-legenda";
        legendaDiv.id = "rosa-legenda-box";
        legendaDiv.innerHTML = `
            <span style="font-weight:700; color:#fff; font-size:10px; text-transform:uppercase;">Legenda:</span>
            <div class="legenda-item"><span class="slot-tag titolare">T</span> Titolare</div>
            <div class="legenda-item"><span class="slot-tag riserva">R</span> Riserva</div>
        `;
        titleContainer.insertAdjacentElement("afterend", legendaDiv);
    }

    ["Portiere","Difensore","Centrocampista","Attaccante"].forEach(ruolo => {
        const div = document.getElementById("slot-" + ruolo);
        const countSpan = document.getElementById("count-rosa-" + ruolo);
        
        div.innerHTML = "";
        countSpan.innerText = rosa[ruolo].length;

        if (rosa[ruolo].length === 0) {
            div.innerHTML = `<div style="font-size:9px; color:var(--text-muted); text-align:center; padding:8px 0; font-style:italic;">Vuoto</div>`;
            return;
        }

        rosa[ruolo].forEach(p => {
            const isTit = schierati.some(s => s.nome === p.nome);
            const isBench = riserveSelezionate[ruolo].some(r => r.nome === p.nome);

            const slot = document.createElement("div");
            let statusClass = (isTit || isBench) ? "schierato" : "";
            
            let tagStatus = "";
            if (isTit) tagStatus = `<span class="slot-tag titolare" title="Titolare in Campo">T</span>`;
            else if (isBench) tagStatus = `<span class="slot-tag riserva" title="Riserva in Panchina">R</span>`;

            slot.className = `slot ${ruolo} ${statusClass}`;
            slot.innerHTML = `
                <div class="marquee-container" style="max-width: 70%;">
                    <span class="marquee-text"><i class="${roleIcons[ruolo]}"></i> ${p.nome}</span>
                </div>
                <div>${tagStatus}</div>
            `;
            slot.onclick = () => schieraGiocatoreDaLista(p, ruolo);
            div.appendChild(slot);
        });
    });

    refreshAllMarquees();
}

function schieraGiocatoreDaLista(playerObj, ruolo) {
    if (!isTestMode && !isMarketOpen()) return;
    if (!moduloSelezionato) {
        alert("Scegli prima il modulo tattico");
        return;
    }

    const isTit = schierati.some(s => s.nome === playerObj.nome);
    const isBench = riserveSelezionate[ruolo].some(r => r.nome === playerObj.nome);

    if (isTit) {
        schierati = schierati.filter(s => s.nome !== playerObj.nome);
    } else if (isBench) {
        riserveSelezionate[ruolo] = riserveSelezionate[ruolo].filter(r => r.nome !== playerObj.nome);
    } else {
        const [D, C, A] = moduloSelezionato.split("-").map(n => parseInt(n));
        const maxTitolariRuolo = ruolo === "Portiere" ? 1 : (ruolo === "Difensore" ? D : (ruolo === "Centrocampista" ? C : A));
        const titolariAttualiRuolo = schierati.filter(s => s.ruolo === ruolo).length;

        if (titolariAttualiRuolo < maxTitolariRuolo) {
            schierati.push(playerObj);
        } else {
            if (riserveSelezionate[ruolo].length < 2) {
                riserveSelezionate[ruolo].push(playerObj);
            } else {
                alert(`Hai già esaurito i posti in campo e le 2 riserve per il ruolo ${ruolo}!`);
            }
        }
    }

    ripristinaCampoTattico();
    renderSlots();
    renderPanchinaGrafica();
}

function apriModaleScelta(ruolo, targetType, indexTitolare = null) {
    if (!isTestMode && !isMarketOpen()) return;
    if (!moduloSelezionato) {
        alert("Scegli prima il modulo tattico");
        return;
    }

    const giocatoriRuolo = rosa[ruolo];
    if (giocatoriRuolo.length === 0) {
        alert(`Non hai acquistato alcun giocatore nel ruolo: ${ruolo}`);
        return;
    }

    const colorRuolo = roleColors[ruolo];
    const overlay = document.createElement("div");
    overlay.className = "custom-modal-overlay";
    overlay.id = "selection-modal";

    let titoloTarget = targetType === "campo" ? `Titolare (${ruolo})` : `Panchina R${targetType + 1} (${ruolo})`;
    if (targetType === "campo_indice" && indexTitolare !== null) {
        titoloTarget = `Slot Titolare #${indexTitolare + 1} (${ruolo})`;
    }

    let cardHtml = `
        <div class="custom-modal-card" style="border: 2px solid ${colorRuolo};">
            <h3 style="color:${colorRuolo}; font-size:16px; margin-bottom:12px;">Seleziona ${titoloTarget}</h3>
            <div style="max-height: 250px; overflow-y: auto; text-align: left; margin-bottom: 12px;">
    `;

    giocatoriRuolo.forEach(p => {
        const isTitolarissimo = schierati.some(s => s.nome === p.nome);
        const isRiserva = riserveSelezionate[ruolo].some(r => r.nome === p.nome);
        
        let statoLabel = `<span style="color:var(--accent-blue); font-size:10px;">Disponibile</span>`;
        if (isTitolarissimo) statoLabel = `<span style="color:var(--accent-neon-green); font-size:10px;">👤 Già in Campo</span>`;
        else if (isRiserva) statoLabel = `<span style="color:var(--accent-gold); font-size:10px;">🛋️ In Panchina</span>`;

        let paramType = targetType;
        if (targetType === "campo_indice") paramType = `campo_indice_${indexTitolare}`;

        cardHtml += `
            <div class="modal-player-item" style="border-left: 3px solid ${colorRuolo};" onclick="assegnaGiocatoreDaModale('${p.nome.replace(/'/g, "\\'")}', '${ruolo}', '${paramType}')">
                <div>
                    <div class="marquee-container" style="max-width:200px;"><span class="marquee-text" style="color:#fff; font-size:12px; font-weight:bold;">${p.nome}</span></div>
                    <span style="font-size:10px; color:var(--text-muted);">${p.squadra}</span>
                </div>
                <div>${statoLabel}</div>
            </div>
        `;
    });

    cardHtml += `
            </div>
            <div style="display:flex; gap:8px;">
                <button onclick="apriModaleRimuoviGiocatore('${ruolo}')" class="btn-action-danger" style="flex:1; padding:8px; font-size:11px;">Rimuovi giocatore</button>
                <button onclick="chiudiModale()" class="btn-action-primary" style="flex:1; padding:8px; font-size:11px; background:rgba(51, 65, 85, 0.9);">Chiudi</button>
            </div>
        </div>
    `;

    overlay.innerHTML = cardHtml;
    document.body.appendChild(overlay);
    refreshAllMarquees();
}

function apriModaleRimuoviGiocatore(ruolo) {
    chiudiModale();

    const colorRuolo = roleColors[ruolo];
    const overlay = document.createElement("div");
    overlay.className = "custom-modal-overlay";
    overlay.id = "selection-modal";

    const titolariRuolo = schierati.filter(s => s.ruolo === ruolo);
    const riserveRuolo = riserveSelezionate[ruolo] || [];

    let cardHtml = `
        <div class="custom-modal-card" style="border: 2px solid ${colorRuolo};">
            <h3 style="color:${colorRuolo}; font-size:16px; margin-bottom:4px;">Rimuovi Giocatore</h3>
            <p style="font-size:11px; color:var(--text-muted); margin-bottom:12px;">Scegli il giocatore da rimuovere:</p>
            <div style="max-height: 250px; overflow-y: auto; text-align: left; margin-bottom: 12px;">
    `;

    let totalePresenti = titolariRuolo.length + riserveRuolo.length;

    if (totalePresenti === 0) {
        cardHtml += `<div style="text-align:center; color:var(--text-muted); font-size:12px; padding:15px;">Nessun giocatore schierato in questo ruolo.</div>`;
    } else {
        titolariRuolo.forEach(p => {
            cardHtml += `
                <div class="modal-player-item" style="border-left: 3px solid var(--accent-neon-green);" onclick="eseguiRimozioneGiocatore('${p.nome.replace(/'/g, "\\'")}', '${ruolo}')">
                    <div>
                        <div class="marquee-container" style="max-width:200px;"><span class="marquee-text" style="color:#fff; font-size:12px; font-weight:bold;">${p.nome}</span></div>
                        <span style="font-size:10px; color:var(--text-muted);">${p.squadra}</span>
                    </div>
                    <div><span style="color:var(--accent-neon-green); font-size:10px; font-weight:bold;">👤 In Campo</span></div>
                </div>
            `;
        });

        riserveRuolo.forEach((p, idx) => {
            cardHtml += `
                <div class="modal-player-item" style="border-left: 3px solid var(--accent-gold);" onclick="eseguiRimozioneGiocatore('${p.nome.replace(/'/g, "\\'")}', '${ruolo}')">
                    <div>
                        <div class="marquee-container" style="max-width:200px;"><span class="marquee-text" style="color:#fff; font-size:12px; font-weight:bold;">${p.nome}</span></div>
                        <span style="font-size:10px; color:var(--text-muted);">${p.squadra}</span>
                    </div>
                    <div><span style="color:var(--accent-gold); font-size:10px; font-weight:bold;">🛋️ Panchina R${idx + 1}</span></div>
                </div>
            `;
        });
    }

    cardHtml += `
            </div>
            <button onclick="chiudiModale()" class="btn-action-primary" style="width:100%; padding:8px; font-size:11px; background:rgba(51, 65, 85, 0.9);">Chiudi</button>
        </div>
    `;

    overlay.innerHTML = cardHtml;
    document.body.appendChild(overlay);
    refreshAllMarquees();
}

function eseguiRimozioneGiocatore(nomeGiocatore, ruolo) {
    schierati = schierati.filter(s => s.nome !== nomeGiocatore);
    if (riserveSelezionate[ruolo]) {
        riserveSelezionate[ruolo] = riserveSelezionate[ruolo].filter(r => r.nome !== nomeGiocatore);
    }

    chiudiModale();
    ripristinaCampoTattico();
    renderSlots();
    renderPanchinaGrafica();
}

function chiudiModale() {
    const modal = document.getElementById("selection-modal");
    if (modal) modal.remove();
}

function assegnaGiocatoreDaModale(nomeGiocatore, ruolo, targetType) {
    const playerObj = rosa[ruolo].find(p => p.nome === nomeGiocatore);
    if (!playerObj) return;

    schierati = schierati.filter(s => s.nome !== playerObj.nome);
    riserveSelezionate[ruolo] = riserveSelezionate[ruolo].filter(r => r.nome !== playerObj.nome);

    if (targetType === "campo") {
        schierati.push(playerObj);
    } else if (targetType.startsWith("campo_indice_")) {
        let indexTitolare = parseInt(targetType.replace("campo_indice_", ""));
        let titolariRuolo = schierati.filter(s => s.ruolo === ruolo);
        
        if (titolariRuolo[indexTitolare]) {
            schierati = schierati.filter(s => s.nome !== titolariRuolo[indexTitolare].nome);
        }
        schierati.push(playerObj);
    } else {
        let index = parseInt(targetType);
        if (riserveSelezionate[ruolo].length > index) {
            riserveSelezionate[ruolo][index] = playerObj;
        } else {
            riserveSelezionate[ruolo].push(playerObj);
        }
    }

    chiudiModale();
    ripristinaCampoTattico();
    renderSlots();
    renderPanchinaGrafica();
}

function rimuoviSlotSelezionato(ruolo, targetType, indexTitolare = null) {
    if (targetType === "campo" || targetType.startsWith("campo_indice_")) {
        let idx = indexTitolare;
        if (targetType.startsWith("campo_indice_")) {
            idx = parseInt(targetType.replace("campo_indice_", ""));
        }
        let titolariRuolo = schierati.filter(s => s.ruolo === ruolo);
        if (idx !== null && !isNaN(idx) && titolariRuolo[idx]) {
            schierati = schierati.filter(s => s.nome !== titolariRuolo[idx].nome);
        }
    } else {
        let index = parseInt(targetType);
        if (!isNaN(index) && riserveSelezionate[ruolo][index]) {
            riserveSelezionate[ruolo].splice(index, 1);
        }
    }
    chiudiModale();
    ripristinaCampoTattico();
    renderSlots();
    renderPanchinaGrafica();
}

function showModuloSelection() {
    const headerTitle = isTestMode ? `Test Draft Completato!` : `Draft Completato per ${tempNomeSquadra}!`;
    document.getElementById("draft-panel").innerHTML = `
        <h3 style="text-align:center;">${headerTitle}</h3>
        <p style="text-align:center; font-size:12px; color: var(--accent-gold); font-weight: 700;">Seleziona il modulo tattico per schierare la tua formazione:</p>
        
        <select id="modulo" onchange="setModulo()" class="styled-input" style="display:block; margin: 0 auto 10px auto; max-width:250px;">
            <option value="">-- Scegli Modulo --</option>
            <option value="4-4-2">4-4-2</option>
            <option value="4-3-3">4-3-3</option>
            <option value="3-4-3">3-4-3</option>
            <option value="4-5-1">4-5-1</option>
            <option value="3-5-2">3-5-2</option>
        </select>
        
        <div style="text-align:center; margin-top:12px;">
            <button onclick="annullaERicominciaDraft()" class="btn-action-danger"><i class="fa-solid fa-trash-can"></i> Scarta Rosa e Ricomincia</button>
        </div>
    `;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setModulo() {
    if (!isTestMode && !isMarketOpen()) {
        alert("⚠️ Tempo scaduto! Impossibile impostare la formazione.");
        return;
    }

    moduloSelezionato = document.getElementById("modulo").value;
    if (!moduloSelezionato) return;

    schierati = [];
    riserveSelezionate = { Portiere: [], Difensore: [], Centrocampista: [], Attaccante: [] };

    document.getElementById("campo-panel-container").style.display = "block";
    document.getElementById("panchina-panel-container").style.display = "block";

    ripristinaCampoTattico();

    renderSlots();
    renderPanchinaGrafica();
    document.getElementById("conferma-container").style.display = "flex";
}

function ripristinaCampoTattico() {
    if (!moduloSelezionato) return;

    const [D, C, A] = moduloSelezionato.split("-").map(n => parseInt(n));
    const campo = document.getElementById("campo");
    campo.innerHTML = "";

    creaRepartoCampo(campo, "Portiere", 1);
    creaRepartoCampo(campo, "Difensore", D);
    creaRepartoCampo(campo, "Centrocampista", C);
    creaRepartoCampo(campo, "Attaccante", A);
    
    refreshAllMarquees();
}

function creaRepartoCampo(campoContainer, ruolo, countOrPlayers, isReadOnly = false) {
    const reparto = document.createElement("div");
    reparto.className = "reparto-campo";

    let quantita = typeof countOrPlayers === 'number' ? countOrPlayers : countOrPlayers.length;

    for (let i = 0; i < quantita; i++) {
        const dz = document.createElement("div");
        dz.className = "pos dropzone";
        dz.dataset.ruolo = ruolo;

        if (Array.isArray(countOrPlayers)) {
            const p = countOrPlayers[i];
            if (p) {
                dz.innerHTML = `<div class="marquee-container" style="width:100%;"><span class="marquee-text">${p.nome}</span></div>`;
                dz.classList.add("filled");
            }
        } else {
            const titolariRuolo = schierati.filter(s => s.ruolo === ruolo);
            if (titolariRuolo[i]) {
                dz.innerHTML = `<div class="marquee-container" style="width:100%;"><span class="marquee-text">${titolariRuolo[i].nome}</span></div>`;
                dz.classList.add("filled");
            } else {
                dz.innerText = `+ ${ruolo.substring(0,3)}`;
            }
        }

        if (!isReadOnly) {
            const indexSlot = i;
            dz.onclick = () => apriModaleScelta(ruolo, "campo_indice", indexSlot);
        }

        reparto.appendChild(dz);
    }
    campoContainer.appendChild(reparto);
    refreshAllMarquees();
}

function renderPanchinaGrafica() {
    const container = document.getElementById("panchina-grafica");
    container.innerHTML = "";

    ["Portiere", "Difensore", "Centrocampista", "Attaccante"].forEach(ruolo => {
        const group = document.createElement("div");
        group.className = "panchina-role-group";

        const riserveRuolo = riserveSelezionate[ruolo] || [];

        let html = `
            <div class="panchina-role-header">
                <i class="${roleIcons[ruolo]}"></i> ${ruolo} (${riserveRuolo.length}/2)
            </div>
            <div class="bench-slots-grid">
        `;

        for (let i = 0; i < 2; i++) {
            const p = riserveRuolo[i];
            const isFilled = p !== undefined;
            const textDisplay = isFilled ? `<div class="marquee-container" style="width:100%;"><span class="marquee-text">${p.nome}</span></div>` : `+ R${i+1}`;

            html += `
                <div class="pos bench-pos ${isFilled ? 'filled' : ''}" data-ruolo="${ruolo}" onclick="apriModaleScelta('${ruolo}', ${i})">
                    ${textDisplay}
                </div>
            `;
        }

        html += `</div>`;
        group.innerHTML = html;
        container.appendChild(group);
    });
    
    refreshAllMarquees();
}

async function confermaFormazioneDefinitiva() {
    if (schierati.length < 11) return alert("Devi schierare tutti gli 11 titolari!");

    if (isTestMode) {
        const squadraTestObj = {
            giornata: ACTIVE_MATCHDAY,
            nomeSquadra: tempNomeSquadra,
            moduloSelezionato: moduloSelezionato,
            schierati: JSON.parse(JSON.stringify(schierati)),
            riserveSelezionate: JSON.parse(JSON.stringify(riserveSelezionate)),
            budget: budget,
            votiGiornata: {},
            punteggioTotale: null,
            isTest: true
        };

        let currentUsername = "Test User";
        if (currentUser) {
            try {
                const uDoc = await db.collection("utenti").doc(currentUser.uid).get();
                if (uDoc.exists) currentUsername = getRealUsername(uDoc.data(), currentUser);
                else currentUsername = getRealUsername(null, currentUser);
            } catch(e) {}
        }

        renderRecapScreenReadOnly(squadraTestObj, currentUsername, false);
        return;
    }

    if (!isMarketOpen()) {
        alert("⚠️ Tempo scaduto! Non è più possibile confermare la formazione.");
        return;
    }

    if (confirm(`Confermi la squadra "${tempNomeSquadra}" per la Giornata ${ACTIVE_MATCHDAY}? Questa operazione scalerà 1 Gettone ed è definitiva.`)) {
        try {
            const nomiEsistentiLega = await ottieniNomiSquadreGlobaliGiornata(ACTIVE_MATCHDAY);
            if (nomiEsistentiLega.includes(tempNomeSquadra.toLowerCase().trim())) {
                alert(`❌ Un altro utente ha già registrato una squadra chiamata "${tempNomeSquadra}" per la Giornata ${ACTIVE_MATCHDAY}! Scegli un nome differente.`);
                return;
            }

            const userDocRef = db.collection("utenti").doc(currentUser.uid);
            const docSnapshot = await userDocRef.get();
            
            let squadreEsistenti = [];
            if (docSnapshot.exists && docSnapshot.data().squadre) {
                squadreEsistenti = docSnapshot.data().squadre;
            }

            const squadreGiornataCorrente = squadreEsistenti.filter(s => (s.giornata !== undefined ? s.giornata : 8) === ACTIVE_MATCHDAY);
            if (squadreGiornataCorrente.length >= 3) {
                alert(`⚠️ Hai già utilizzato tutti i 3 gettoni disponibili per la Giornata ${ACTIVE_MATCHDAY}!`);
                return;
            }

            const nuovaSquadra = {
                giornata: ACTIVE_MATCHDAY,
                nomeSquadra: tempNomeSquadra,
                rosa: JSON.parse(JSON.stringify(rosa)),
                schierati: JSON.parse(JSON.stringify(schierati)),
                riserveSelezionate: JSON.parse(JSON.stringify(riserveSelezionate)),
                budget: budget,
                moduloSelezionato: moduloSelezionato,
                formazioneBloccata: true,
                votiGiornata: {},
                punteggioTotale: null,
                creataIl: new Date()
            };

            squadreEsistenti.push(nuovaSquadra);
            userSquadre = squadreEsistenti;

            await userDocRef.set({
                squadre: userSquadre
            }, { merge: true });

            alert(`🎉 Squadra "${tempNomeSquadra}" convalidata e salvata con successo per la Giornata ${ACTIVE_MATCHDAY}!`);
            document.getElementById("new-team-name-input").value = "";
            await calcolaEVisualizzaTotaleSquadreGlobali(ACTIVE_MATCHDAY);
            renderWelcomeScreen();

        } catch (err) {
            alert("❌ Errore durante il salvataggio: " + err.message);
        }
    }
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

async function verificaECalcolaVotiAutomaticamente() {
    try {
        const ultimaGiornataVoti = getUltimaGiornataConVoti();
        const fileName = `voti_ok${ultimaGiornataVoti}.xlsx`;
        const response = await fetch(fileName, { method: "HEAD" });
        if (!response.ok) {
            isVotiOkAvailable = false;
            updateHomeStatusBannerState();
            return; 
        }

        isVotiOkAvailable = true;
        updateHomeStatusBannerState();

        const snapshot = await db.collection("utenti").get();
        let fileResponse = await fetch(fileName);
        let arrayBuffer = await fileResponse.arrayBuffer();
        let workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });

        let nomeFoglioVoti = workbook.SheetNames.find(s => s.trim().toLowerCase() === "voti") || workbook.SheetNames[0];
        let rows = XLSX.utils.sheet_to_json(workbook.Sheets[nomeFoglioVoti]);

        for (const docUser of snapshot.docs) {
            let uData = docUser.data();
            let squadreArr = uData.squadre || [];
            let modificato = false;

            squadreArr.forEach(sq => {
                let giornataSquadra = sq.giornata !== undefined ? sq.giornata : 8;
                if (giornataSquadra === ultimaGiornataVoti && (sq.punteggioTotale === undefined || sq.punteggioTotale === null)) {
                    let votiObj = {};
                    let totaleSquadra = 0;
                    let riserveGiaSubentrate = new Set();

                    const tutteLeRiserve = Object.values(sq.riserveSelezionate || {}).flat();
                    const tuttiGiocatori = [...(sq.schierati || []), ...tutteLeRiserve];

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
                                votiObj[p.nome] = {
                                    voto: rawVotoPuro,
                                    fantavoto: rawFanta,
                                    sv: false,
                                    gf: parseColumnVal(matchRow, ["gf"]),
                                    gs: parseColumnVal(matchRow, ["gs"]),
                                    ass: parseColumnVal(matchRow, ["ass"]),
                                    au: parseColumnVal(matchRow, ["au"]),
                                    esp: parseColumnVal(matchRow, ["esp", "Esp"]),
                                    amm: parseColumnVal(matchRow, ["amm", "Amm"]),
                                    rp: parseColumnVal(matchRow, ["rp"]),
                                    rs: parseColumnVal(matchRow, ["rs"]),
                                    rf: parseColumnVal(matchRow, ["rf"])
                                };
                                return;
                            }
                        }
                        votiObj[p.nome] = { voto: 0, fantavoto: 0, sv: true, gf:0, gs:0, ass:0, au:0, esp:0, amm:0, rp:0, rs:0, rf:0 };
                    });

                    (sq.schierati || []).forEach(tit => {
                        let vInfo = votiObj[tit.nome];
                        let eff = vInfo;

                        if (!vInfo || vInfo.sv) {
                            let riserveRuolo = (sq.riserveSelezionate || {})[tit.ruolo] || [];
                            let riservaValida = null;

                            for (let ris of riserveRuolo) {
                                if (!riserveGiaSubentrate.has(ris.nome)) {
                                    let risInfo = votiObj[ris.nome];
                                    if (risInfo && !risInfo.sv) {
                                        riservaValida = { obj: ris, info: risInfo };
                                        riserveGiaSubentrate.add(ris.nome);
                                        break;
                                    }
                                }
                            }

                            if (riservaValida) {
                                eff = riservaValida.info;
                            } else {
                                eff = { voto: 0, fantavoto: 0, sv: true };
                            }
                        }
                        totaleSquadra += (eff.fantavoto > 0 ? eff.fantavoto : 0);
                    });

                    sq.votiGiornata = votiObj;
                    sq.punteggioTotale = totaleSquadra;
                    modificato = true;
                }
            });

            if (modificato) {
                await db.collection("utenti").doc(docUser.id).update({ squadre: squadreArr });
            }
        }

        if (currentUser) {
            await caricaDatiUtenteCloud();
        }
    } catch (err) {}
}

function generaIconeBonusMalus(vInfo) {
    if (!vInfo || vInfo.sv) return `<span style="color:var(--text-muted); font-size:10px;">-</span>`;

    let html = `<div class="bonus-icon-group">`;
    let count = 0;

    if (vInfo.gf > 0) { count++; for(let i=0; i < vInfo.gf; i++) html += `<img src="icone/gol.png" class="fanta-icon-img" alt="Gol">`; }
    if (vInfo.rf > 0) { count++; for(let i=0; i < vInfo.rf; i++) html += `<img src="icone/rigore_segnato.png" class="fanta-icon-img" alt="Rigore Segnato">`; }
    if (vInfo.gs > 0) { count++; for(let i=0; i < vInfo.gs; i++) html += `<img src="icone/gol_subito.png" class="fanta-icon-img" alt="Gol Subito">`; }
    if (vInfo.ass > 0) { count++; for(let i=0; i < vInfo.ass; i++) html += `<img src="icone/assist.png" class="fanta-icon-img" alt="Assist">`; }
    if (vInfo.au > 0) { count++; for(let i=0; i < vInfo.au; i++) html += `<img src="icone/autogol.png" class="fanta-icon-img" alt="Autogol">`; }
    if (vInfo.rp > 0) { count++; for(let i=0; i < vInfo.rp; i++) html += `<img src="icone/rigore_parato.png" class="fanta-icon-img" alt="Rigore Parato">`; }
    if (vInfo.rs > 0) { count++; for(let i=0; i < vInfo.rs; i++) html += `<img src="icone/rigore_sbagliato.png" class="fanta-icon-img" alt="Rigore Sbagliato">`; }
    if (vInfo.amm === 1) { count++; html += `<img src="icone/ammonizione.png" class="fanta-icon-img" alt="Ammonizione">`; }
    else if (vInfo.amm >= 2) { count++; html += `<img src="icone/doppia_ammonizione.png" class="fanta-icon-img" alt="Doppia Ammonizione">`; }
    if (vInfo.esp > 0) { count++; for(let i=0; i < vInfo.esp; i++) html += `<img src="icone/espulsione.png" class="fanta-icon-img" alt="Espulsione">`; }

    html += `</div>`;
    return count > 0 ? html : `<span style="color:var(--text-muted); font-size:10px;">-</span>`;
}

function mostraTabellinoVoti(sq) {
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

    sq.schierati.forEach(tit => {
        let vInfo = sq.votiGiornata[tit.nome];
        let eff = vInfo;
        let note = "<span style='color:var(--accent-green)'>Titolare</span>";

        if (!vInfo || vInfo.sv) {
            let riserveRuolo = sq.riserveSelezionate[tit.ruolo] || [];
            let riservaValida = null;

            for (let ris of riserveRuolo) {
                if (!riserveGiaSubentrate.has(ris.nome)) {
                    let risInfo = sq.votiGiornata[ris.nome];
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

        totale += (eff.fantavoto > 0 ? eff.fantavoto : 0);
        let iconeHtml = generaIconeBonusMalus(eff);
        let votoPuroTxt = eff.sv ? "-" : (eff.voto > 0 ? eff.voto : "-");

        html += `<tr>
            <td><i class="${roleIcons[tit.ruolo]}"></i></td>
            <td><div class="marquee-container" style="max-width: 140px;"><span class="marquee-text"><strong>${tit.nome}</strong></span></div></td>
            <td>${note}</td>
            <td><strong style="color:#cbd5e1;">${votoPuroTxt}</strong></td>
            <td>${iconeHtml}</td>
            <td><strong style="color:var(--accent-blue);">${eff.fantavoto > 0 ? eff.fantavoto : 0}</strong></td>
        </tr>`;
    });

    html += `</tbody></table>
    <div class="totale-punteggio">🏆 Totale Squadra: ${sq.punteggioTotale !== null ? sq.punteggioTotale : totale} Punti</div>`;

    container.innerHTML = html;
    refreshAllMarquees();
}