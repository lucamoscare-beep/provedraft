const firebaseConfig = {
    apiKey: "AIzaSyAURiTLIXNg6fFkL1fnHkiHafMytsDHW8I",
    authDomain: "draft-serie-a-4aadd.firebaseapp.com",
    projectId: "draft-serie-a-4aadd",
    storageBucket: "draft-serie-a-4aadd.firebasestorage.app",
    messagingSenderId: "382868267295",
    appId: "1:382868267295:web:f958edb9ffb50fc984102a",
    measurementId: "G-THYVRMRWWH"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// ----------------------------------------------------
// CALENDARIO MANUALE DI RIFERIMENTO (SENZA API ESTERNE)
// ----------------------------------------------------
const CALENDARIO_FALLBACK = {
    8: { inizio: new Date("2026-10-20T18:30:00"), fine: new Date("2026-10-22T23:00:00") },
    9: { inizio: new Date("2026-10-27T18:30:00"), fine: new Date("2026-10-29T23:00:00") },
    10: { inizio: new Date("2026-10-31T15:30:00"), fine: new Date("2026-11-02T23:00:00") },
    11: { inizio: new Date("2026-11-06T20:45:00"), fine: new Date("2026-11-08T23:00:00") },
    12: { inizio: new Date("2026-11-21T15:00:00"), fine: new Date("2026-11-23T23:00:00") },
    13: { inizio: new Date("2026-11-27T20:45:00"), fine: new Date("2026-11-30T23:00:00") },
    14: { inizio: new Date("2026-12-04T20:45:00"), fine: new Date("2026-12-07T23:00:00") },
    15: { inizio: new Date("2026-12-11T12:45:00"), fine: new Date("2026-12-14T23:00:00") },
    16: { inizio: new Date("2026-12-18T18:30:00"), fine: new Date("2026-12-20T23:00:00") }
};

let ACTIVE_MATCHDAY = 13;
let CURRENT_MATCHDAY_START = null;
let CURRENT_MATCHDAY_END = null;

let currentUser = null;
let customPlayersList = [];
let availablePlayers = [];
let budget = 800;
let isViewingOwnProfile = false;

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

let currentRecapSquadraObj = null;
let currentRecapSquadraIndex = -1;

let tempNomeSquadra = "";
let isTestMode = false;
let rosa = { Portiere: [], Difensore: [], Centrocampista: [], Attaccante: [] };
let schierati = [];
let riserveSelezionate = { Portiere: [], Difensore: [], Centrocampista: [], Attaccante: [] };

let turno = 0;
let moduloSelezionato = "";

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
            const duration = Math.max(3, Math.abs(distance) * 0.04);
            textEl.style.setProperty('--scroll-duration', `${duration}s`);
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
    localStorage.removeItem("draft_seriea_matchday_info");
    localStorage.removeItem("draft_seriea_matchday_time");

    const adesso = new Date();
    const giornateOrdinate = Object.keys(CALENDARIO_FALLBACK)
        .map(n => parseInt(n, 10))
        .sort((a, b) => a - b);

    let trovata = giornateOrdinate[giornateOrdinate.length - 1] || 13;
    for (const giornata of giornateOrdinate) {
        const info = CALENDARIO_FALLBACK[giornata];
        if (adesso <= info.fine) {
            trovata = giornata;
            break;
        }
    }

    ACTIVE_MATCHDAY = trovata;
    const fallbackInfo = CALENDARIO_FALLBACK[ACTIVE_MATCHDAY] || CALENDARIO_FALLBACK[13];
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

    if (adesso >= CURRENT_MATCHDAY_START && adesso <= CURRENT_MATCHDAY_END) {
        return false;
    }

    if (adesso > CURRENT_MATCHDAY_END) {
        inizializzaGiornataEDeadlineDinamica();
        return true;
    }

    return true;
}

function isMarketOpenForMatchday(giornata) {
    if (isTestMode) return true;
    if (giornata < ACTIVE_MATCHDAY) return false;
    if (giornata === ACTIVE_MATCHDAY) return isMarketOpen();
    return true;
}

function aggiornaStatoMercatoUi() {
    const pill = document.getElementById("hp-market-status-pill");
    const label = document.getElementById("hp-market-status-label");
    const dayLabel = document.getElementById("hp-active-matchday-label");
    if (dayLabel) dayLabel.innerText = ACTIVE_MATCHDAY;

    const open = isMarketOpen();
    if (pill) pill.classList.toggle("is-closed", !open);
    if (label) label.innerText = open ? `Mercato aperto (G${ACTIVE_MATCHDAY})` : `Mercato chiuso (G${ACTIVE_MATCHDAY})`;
}

function initCountdown() {
    function updateTimer() {
        const now = new Date();
        if (!CURRENT_MATCHDAY_START || !CURRENT_MATCHDAY_END) return;

        aggiornaStatoMercatoUi();

        if (now >= CURRENT_MATCHDAY_START && now <= CURRENT_MATCHDAY_END) {
            document.querySelectorAll(".countdown-timer").forEach(el => {
                el.innerHTML = `<span style='color:var(--accent-red); font-size:14px; font-weight:900;'>G${ACTIVE_MATCHDAY} IN CORSO</span>`;
            });
            const textEl = document.getElementById("welcome-deadline-text");
            if (textEl) textEl.innerText = `Le partite della giornata ${ACTIVE_MATCHDAY} sono in corso. Il mercato riaprirà al termine dell'ultimo match.`;
            return;
        }

        if (now > CURRENT_MATCHDAY_END) {
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

        ["w-cd-days", "recap-cd-days"].forEach(id => { if (document.getElementById(id)) document.getElementById(id).innerText = String(days).padStart(2, '0'); });
        ["w-cd-hours", "recap-cd-hours"].forEach(id => { if (document.getElementById(id)) document.getElementById(id).innerText = String(hours).padStart(2, '0'); });
        ["w-cd-mins", "recap-cd-mins"].forEach(id => { if (document.getElementById(id)) document.getElementById(id).innerText = String(mins).padStart(2, '0'); });
        ["w-cd-secs", "recap-cd-secs"].forEach(id => { if (document.getElementById(id)) document.getElementById(id).innerText = String(secs).padStart(2, '0'); });

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
        mostraNotifica("Email Inviata", "Email di ripristino inviata. Controlla la tua casella di posta.", "success");
        switchAuthTab('login');
    } catch (err) {
        mostraNotifica("Errore Invio", "Errore durante l'invio dell'email: " + err.message, "error");
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
        try {
            await res.user.updateProfile({ displayName: username });
        } catch (profileErr) {}

        try {
            await db.collection("utenti").doc(res.user.uid).set({
                username: username,
                displayName: username,
                nome: nome,
                cognome: cognome,
                email: email,
                squadre: [],
                draftTentati: 0,
                creatoIl: new Date()
            }, { merge: true });
        } catch (fsErr) {
            console.warn("Errore scrittura profilo Firestore:", fsErr);
        }

        const modal = document.getElementById('auth-modal');
        const globalHeader = document.getElementById('global-header-bar');
        if (modal) modal.style.display = 'none';
        if (globalHeader) globalHeader.style.display = 'flex';

        mostraNotifica("Registrazione Completata", `Registrazione completata. Benvenuto, <strong>${username}</strong>.`, "success");
    } catch (err) {
        mostraNotifica("Errore Registrazione", err.message, "error");
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (err) {
        mostraNotifica("Errore Login", err.message, "error");
    }
}

auth.onAuthStateChanged(async (user) => {
    const modal = document.getElementById('auth-modal');
    const globalHeader = document.getElementById('global-header-bar');

    if (user) {
        currentUser = user;
        if (modal) modal.style.display = 'none';
        if (globalHeader) globalHeader.style.display = 'flex';

        let displayUsername = getRealUsername(null, user);
        try {
            const userDoc = await db.collection("utenti").doc(user.uid).get();
            if (userDoc.exists) {
                const uData = userDoc.data();
                displayUsername = getRealUsername(uData, user);
                controllaRuoloAdmin(uData);
                aggiornaAvatarGrafica(uData && uData.photoURL ? uData.photoURL : null);
            } else {
                aggiornaAvatarGrafica(null);
            }
        } catch (e) {}

        const displayEl = document.getElementById('user-display-name');
        if (displayEl) displayEl.innerText = displayUsername;

        const introGreetingEl = document.getElementById('welcome-intro-greeting');
        if (introGreetingEl) {
            introGreetingEl.innerHTML = `<i class="fa-solid fa-crown"></i><span>Bentornato Mister ${displayUsername}!</span>`;
        }
        await caricaDatiUtenteCloud();
    } else {
        currentUser = null;
        if (modal) modal.style.display = 'flex';
        if (globalHeader) globalHeader.style.display = 'none';
    }
});

async function logout() {
    const ok = await mostraConferma(
        "Disconnessione",
        "Vuoi davvero disconnetterti dal tuo account?",
        "warning",
        "Sì, esci",
        "No"
    );
    if (ok) {
        auth.signOut().then(() => location.reload());
    }
}

async function caricaDatiUtenteCloud() {
    if (!currentUser) return;
    try {
        const doc = await db.collection("utenti").doc(currentUser.uid).get();
        if (doc.exists) {
            const uData = doc.data();
            userSquadre = uData.squadre || [];
            aggiornaAvatarGrafica(uData && uData.photoURL ? uData.photoURL : null);
        } else {
            userSquadre = [];
        }
        await calcolaEVisualizzaTotaleSquadreGlobali(ACTIVE_MATCHDAY);
        renderWelcomeScreen();
    } catch (err) {
        console.error("Errore caricamento dati utente:", err);
        renderWelcomeScreen();
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

        const badgeEl = document.getElementById("total-global-teams-count");
        if (badgeEl) {
            badgeEl.innerText = conteggioTotale;
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

    if (!container || !banner || !icon || !text) return;
    container.style.display = "block";
    banner.style.cursor = "pointer";
    banner.onclick = () => apriSchermataClassifica(ultimaGiornataVoti);

    if (!isVotiOkAvailable) {
        banner.className = "hp-voti-banner waiting";
        icon.className = "fa-solid fa-hourglass-half";
        text.innerText = `In attesa dei voti della giornata ${ultimaGiornataVoti}`;
    } else {
        banner.className = "hp-voti-banner ready";
        icon.className = "fa-solid fa-trophy";
        text.innerText = `Voti aggiornati per la giornata ${ultimaGiornataVoti}. Guarda i risultati delle tue squadre`;
    }
}

function toggleGuidaDraft() {
    const box = document.getElementById("guida-4-passi-box");
    if (!box) return;
    const isHidden = box.style.display === "none" || !box.style.display;
    box.style.display = isHidden ? "block" : "none";
    if (isHidden) {
        box.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
}

async function apriStatisticheGiocatore() {
    if (!currentUser) return;
    await apriProfiloUtente(currentUser.uid);
    setTimeout(() => {
        const statsGrid = document.getElementById("profilo-stats-grid");
        if (statsGrid) statsGrid.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
}

function renderWelcomeScreen() {
    document.getElementById("welcome-screen").style.display = "block";
    document.getElementById("main-app").style.display = "none";
    document.getElementById("recap-screen").style.display = "none";
    document.getElementById("classifica-screen").style.display = "none";
    document.getElementById("profilo-screen").style.display = "none";
    document.getElementById("admin-screen").style.display = "none";

    aggiornaStatoMercatoUi();

    const squadreGiornataCorrente = userSquadre.filter(sq => (sq.giornata !== undefined ? sq.giornata : 8) === ACTIVE_MATCHDAY);
    let gettoniRimasti = 3 - squadreGiornataCorrente.length;
    document.getElementById("tokens-count-display-inline").innerText = `${gettoniRimasti} / 3`;

    if (!isMarketOpen()) {
        document.getElementById("new-team-creation-area").style.display = "none";
        document.getElementById("tokens-exhausted-msg").style.display = "block";
        document.getElementById("tokens-exhausted-msg").innerText = "Il mercato è chiuso. Non è più possibile creare o modificare rose per questo turno.";
    } else if (gettoniRimasti <= 0) {
        document.getElementById("new-team-creation-area").style.display = "none";
        document.getElementById("tokens-exhausted-msg").style.display = "block";
        document.getElementById("tokens-exhausted-msg").innerText = "Hai utilizzato tutti i 3 gettoni a disposizione per questa giornata.";
    } else {
        document.getElementById("new-team-creation-area").style.display = "flex";
        document.getElementById("tokens-exhausted-msg").style.display = "none";
    }

    updateHomeStatusBannerState();
    document.getElementById("user-created-teams-title").innerText = `Le tue Squadre create per la giornata di campionato n°${ACTIVE_MATCHDAY}`;

    const container = document.getElementById("created-teams-container");
    container.innerHTML = "";

    if (squadreGiornataCorrente.length === 0) {
        container.innerHTML = `<p style="color:var(--text-muted); font-size:12.5px;">Nessuna squadra ancora creata per la giornata ${ACTIVE_MATCHDAY}.</p>`;
        return;
    }

    squadreGiornataCorrente.forEach((sq) => {
        const item = document.createElement("div");
        item.className = "team-card-item";

        let punteggioHtml = "";
        if (sq.punteggioTotale !== undefined && sq.punteggioTotale !== null) {
            punteggioHtml = `<div style="font-size:11px; font-weight:800; color:var(--accent-gold); margin-top:2px;">Punteggio: ${sq.punteggioTotale} pt</div>`;
        }

        const realIndex = userSquadre.indexOf(sq);
        const nomeSquadra = sq.nomeSquadra || "Squadra Senza Nome";
        const infoModulo = sq.moduloSelezionato ? `Modulo ${sq.moduloSelezionato}` : "";

        item.innerHTML = `
            <div class="team-card-left-content">
                <div class="team-card-icon-box">
                    <i class="fa-solid fa-shirt"></i>
                </div>
                <div class="team-card-info">
                    <div class="team-card-name-wrapper">${nomeSquadra}</div>
                    <span class="team-card-label">${infoModulo}</span>
                    ${punteggioHtml}
                </div>
            </div>
            <div class="team-card-actions">
                <button type="button" onclick="apriRecapSquadraUtenteCorrente(${realIndex})" class="btn-team-action">
                    <i class="fa-solid fa-eye"></i> Visualizza
                </button>
            </div>
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
    document.getElementById("admin-screen").style.display = "none";

    renderMatchdayPills(giornata);

    const podiumArea = document.getElementById("podium-area");
    const regolaParitaBox = document.getElementById("regola-parita-box");
    const tableBody = document.getElementById("classifica-table-body");

    podiumArea.innerHTML = "";
    podiumArea.style.display = "none";
    if (regolaParitaBox) regolaParitaBox.style.display = "none";

    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">Caricamento elenco squadre...</td></tr>`;

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
                    const haVotiSquadra = sq.punteggioTotale !== null && sq.punteggioTotale !== undefined;
                    tutteSquadreLega.push({
                        username: username,
                        userId: doc.id,
                        nomeSquadra: sq.nomeSquadra,
                        punteggio: haVotiSquadra ? sq.punteggioTotale : null,
                        budgetResiduo: budgetResiduo,
                        squadraObj: sq
                    });
                }
            });
        });

        const esistonoVotiGiornata = tutteSquadreLega.some(sq => sq.punteggio !== null);
        document.getElementById("classifica-heading-text").innerText = esistonoVotiGiornata
            ? `Classifica della giornata n°${giornata}`
            : `Squadre iscritte – Giornata n°${giornata}`;

        if (tutteSquadreLega.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">Nessuna squadra iscritta per la giornata n°${giornata}.</td></tr>`;
            return;
        }

        if (!esistonoVotiGiornata) {
            tableBody.innerHTML = "";
            tutteSquadreLega.forEach((item) => {
                const tr = document.createElement("tr");
                if (currentUser && item.userId === currentUser.uid) {
                    tr.className = "current-user-row";
                }

                tr.innerHTML = `
                    <td style="color:var(--text-muted);">-</td>
                    <td style="font-weight:700; color:var(--accent-sky-bright); cursor:pointer;" onclick="apriProfiloUtente('${item.userId}')"><i class="fa-solid fa-user"></i> ${item.username}</td>
                    <td style="font-weight:800; color:#fff;">${item.nomeSquadra}</td>
                    <td style="color:var(--text-muted); font-size:12px;">In attesa voti</td>
                    <td style="color:var(--accent-gold); font-weight:700;">${item.budgetResiduo} cr</td>
                    <td style="text-align:right;">
                        <button type="button" onclick="visualizzaSquadraGenerica('${item.userId}', '${item.nomeSquadra.replace(/'/g, "\'")}', ${giornata})" class="btn-action-primary" style="padding:6px 12px; font-size:11px;" title="Vedi Formazione">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                    </td>
                `;
                tableBody.appendChild(tr);
            });
            return;
        }

        podiumArea.style.display = "grid";
        if (regolaParitaBox) regolaParitaBox.style.display = "flex";

        tutteSquadreLega.sort((a, b) => {
            if (b.punteggio !== a.punteggio) return b.punteggio - a.punteggio;
            return b.budgetResiduo - a.budgetResiduo;
        });

        let classificaConRango = tutteSquadreLega.map((item, i) => ({ ...item, rank: i + 1 }));
        const topTre = classificaConRango.filter(item => item.rank <= 3);

        if (topTre.length > 0) {
            const gruppiPodio = { 1: [], 2: [], 3: [] };
            topTre.forEach(item => {
                if (gruppiPodio[item.rank]) gruppiPodio[item.rank].push(item);
            });

            [2, 1, 3].forEach(targetRank => {
                const listaGruppo = gruppiPodio[targetRank];
                if (listaGruppo && listaGruppo.length > 0) {
                    const leaderCard = listaGruppo[0];
                    const card = document.createElement("div");
                    card.className = "podium-card";
                    card.innerHTML = `
                        <div style="font-size:12px; font-weight:800; color:var(--accent-gold);">${targetRank}° Posto</div>
                        <div style="font-size:15px; font-weight:900; color:#fff; margin-top:4px;">${leaderCard.nomeSquadra}</div>
                        <div style="font-size:12px; color:var(--accent-sky-bright); cursor:pointer; margin-top:2px;" onclick="apriProfiloUtente('${leaderCard.userId}')">${leaderCard.username}</div>
                        <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Budget: ${leaderCard.budgetResiduo} cr</div>
                        <div class="podium-score">${leaderCard.punteggio} pt</div>
                        <button type="button" onclick="visualizzaSquadraGenerica('${leaderCard.userId}', '${leaderCard.nomeSquadra.replace(/'/g, "\'")}', ${giornata})" class="btn-action-secondary" style="padding:5px 10px; font-size:11px; margin-top:8px;">
                            <i class="fa-solid fa-eye"></i> Rosa
                        </button>
                    `;
                    podiumArea.appendChild(card);
                }
            });
        }

        tableBody.innerHTML = "";
        classificaConRango.forEach((item) => {
            const tr = document.createElement("tr");
            if (currentUser && item.userId === currentUser.uid) tr.className = "current-user-row";
            tr.innerHTML = `
                <td style="font-weight:800;">${item.rank}</td>
                <td style="font-weight:700; color:var(--accent-sky-bright); cursor:pointer;" onclick="apriProfiloUtente('${item.userId}')">${item.username}</td>
                <td style="font-weight:800; color:#fff;">${item.nomeSquadra}</td>
                <td style="font-weight:900; color:var(--accent-emerald-bright);">${item.punteggio} pt</td>
                <td style="color:var(--accent-gold); font-weight:700;">${item.budgetResiduo} cr</td>
                <td style="text-align:right;">
                    <button type="button" onclick="visualizzaSquadraGenerica('${item.userId}', '${item.nomeSquadra.replace(/'/g, "\'")}', ${giornata})" class="btn-action-primary" style="padding:6px 12px; font-size:11px;">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--accent-red);">Errore durante il caricamento della classifica.</td></tr>`;
    }
}

async function apriProfiloUtente(targetUserId) {
    if (!targetUserId && currentUser) targetUserId = currentUser.uid;
    if (!targetUserId) return;

    isViewingOwnProfile = (currentUser && targetUserId === currentUser.uid);

    document.getElementById("welcome-screen").style.display = "none";
    document.getElementById("main-app").style.display = "none";
    document.getElementById("recap-screen").style.display = "none";
    document.getElementById("classifica-screen").style.display = "none";
    document.getElementById("profilo-screen").style.display = "block";
    document.getElementById("admin-screen").style.display = "none";

    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
        const userDoc = await db.collection("utenti").doc(targetUserId).get();
        if (!userDoc.exists) {
            mostraNotifica("Utente Non Trovato", "Impossibile trovare i dati dell'utente richiesto.", "error");
            tornaAllaHome();
            return;
        }

        const uData = userDoc.data();
        const username = getRealUsername(uData, null);
        document.getElementById("profilo-username-title").innerText = `Profilo di ${username}`;

        const profImg = document.getElementById("profilo-avatar-img");
        const cameraOverlay = document.querySelector("#profilo-screen .profilo-camera-btn");
        const uploadTextElement = document.getElementById("upload-foto-label");

        if (uData && uData.photoURL && uData.photoURL.trim() !== "") {
            if (profImg) profImg.src = uData.photoURL;
        } else {
            if (profImg) profImg.src = "https://via.placeholder.com/60";
        }

        if (isViewingOwnProfile) {
            if (cameraOverlay) cameraOverlay.style.display = "flex";
            if (uploadTextElement) uploadTextElement.style.display = "block";
        } else {
            if (cameraOverlay) cameraOverlay.style.display = "none";
            if (uploadTextElement) uploadTextElement.style.display = "none";
        }

        const squadre = uData.squadre || [];
        const draftTentati = uData.draftTentati || 0;

        let puntiTotali = 0;
        let migliorPunteggio = 0;
        let budgetSpesoTotale = 0;
        let conteggioGiocatoriUtente = {};
        let conteggioSquadreSerieA = {};
        let conteggioModuli = {};

        squadre.forEach(sq => {
            let pts = sq.punteggioTotale !== undefined && sq.punteggioTotale !== null ? sq.punteggioTotale : 0;
            puntiTotali += pts;
            if (pts > migliorPunteggio) migliorPunteggio = pts;

            let budgetResiduo = sq.budget !== undefined && sq.budget !== null ? sq.budget : 800;
            let spesoPerQuestaSquadra = Math.max(0, 800 - budgetResiduo);
            budgetSpesoTotale += spesoPerQuestaSquadra;

            if (sq.moduloSelezionato) {
                let modulo = String(sq.moduloSelezionato).trim();
                if (modulo !== "") conteggioModuli[modulo] = (conteggioModuli[modulo] || 0) + 1;
            }

            let giocatoriDellaSquadra = [];
            if (Array.isArray(sq.schierati)) giocatoriDellaSquadra.push(...sq.schierati);
            if (sq.rosa && typeof sq.rosa === 'object') {
                Object.values(sq.rosa).forEach(listaRuolo => {
                    if (Array.isArray(listaRuolo)) giocatoriDellaSquadra.push(...listaRuolo);
                });
            }
            if (sq.riserveSelezionate && typeof sq.riserveSelezionate === 'object') {
                Object.values(sq.riserveSelezionate).forEach(listaRiserve => {
                    if (Array.isArray(listaRiserve)) giocatoriDellaSquadra.push(...listaRiserve);
                });
            }

            giocatoriDellaSquadra.forEach(p => {
                if (!p) return;
                if (p.nome) {
                    let nomeG = String(p.nome).trim();
                    if (nomeG !== "") conteggioGiocatoriUtente[nomeG] = (conteggioGiocatoriUtente[nomeG] || 0) + 1;
                }
                if (p.squadra) {
                    let nomeSa = String(p.squadra).trim();
                    if (nomeSa !== "" && nomeSa !== "N/D") conteggioSquadreSerieA[nomeSa] = (conteggioSquadreSerieA[nomeSa] || 0) + 1;
                }
            });
        });

        let giocatorePreferito = "Nessuno";
        let maxScelteG = 0;
        for (let [nomeG, count] of Object.entries(conteggioGiocatoriUtente)) {
            if (count > maxScelteG) { maxScelteG = count; giocatorePreferito = nomeG; }
        }

        let squadraPreferita = "Nessuna";
        let maxScelteS = 0;
        for (let [nomeS, count] of Object.entries(conteggioSquadreSerieA)) {
            if (count > maxScelteS) { maxScelteS = count; squadraPreferita = nomeS; }
        }

        let moduloPreferito = "Nessuno";
        let maxScelteModulo = 0;
        for (let [mod, count] of Object.entries(conteggioModuli)) {
            if (count > maxScelteModulo) { maxScelteModulo = count; moduloPreferito = mod; }
        }

        let ori = 0, argenti = 0, bronzi = 0;
        const ultimaGiornataVoti = getUltimaGiornataConVoti();
        const snapAll = await db.collection("utenti").get();

        for (let g = 1; g <= ultimaGiornataVoti; g++) {
            let listaGiornata = [];
            snapAll.forEach(docU => {
                const dU = docU.data();
                (dU.squadre || []).forEach(sq => {
                    let gSq = sq.giornata !== undefined ? sq.giornata : 8;
                    if (gSq === g && sq.punteggioTotale !== null && sq.punteggioTotale !== undefined) {
                        listaGiornata.push({
                            userId: docU.id,
                            punteggio: sq.punteggioTotale,
                            budgetResiduo: sq.budget !== undefined && sq.budget !== null ? sq.budget : 0
                        });
                    }
                });
            });

            if (listaGiornata.length === 0) continue;
            listaGiornata.sort((a, b) => (b.punteggio !== a.punteggio) ? b.punteggio - a.punteggio : b.budgetResiduo - a.budgetResiduo);
            listaGiornata.forEach((item, index) => {
                let rank = index + 1;
                if (item.userId === targetUserId) {
                    if (rank === 1) ori++;
                    else if (rank === 2) argenti++;
                    else if (rank === 3) bronzi++;
                }
            });
        }

        document.getElementById("stat-squadre-create").innerText = squadre.length;
        document.getElementById("stat-draft-tentati").innerText = draftTentati;
        document.getElementById("stat-miglior-punteggio").innerText = `${migliorPunteggio.toFixed(1)} pt`;
        document.getElementById("stat-punti-totali").innerText = `${puntiTotali.toFixed(1)} pt`;
        document.getElementById("stat-budget-speso").innerText = `${budgetSpesoTotale} cr`;
        document.getElementById("stat-giocatore-preferito").innerHTML = maxScelteG > 0 ? `${giocatorePreferito} <small style="color:var(--accent-sky-bright);">(${maxScelteG})</small>` : "Nessuno";
        document.getElementById("stat-squadra-preferita").innerHTML = maxScelteS > 0 ? `${squadraPreferita} <small style="color:var(--accent-emerald-bright);">(${maxScelteS})</small>` : "Nessuna";
        document.getElementById("stat-modulo-preferito").innerHTML = maxScelteModulo > 0 ? `${moduloPreferito} <small style="color:var(--accent-gold);">(${maxScelteModulo})</small>` : "Nessuno";
        document.getElementById("stat-podi-oro").innerText = ori;
        document.getElementById("stat-podi-argento").innerText = argenti;
        document.getElementById("stat-podi-bronzo").innerText = bronzi;

        renderizzaTraguardi(uData);
    } catch (err) {
        mostraNotifica("Errore Statistiche", "Si è verificato un problema nel caricamento delle statistiche utente.", "error");
        tornaAllaHome();
    }
}

async function incrementaDraftTentatiCloud() {
    if (!currentUser) return;
    try {
        const userRef = db.collection("utenti").doc(currentUser.uid);
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(userRef);
            let currentDrafts = (doc.exists && doc.data().draftTentati !== undefined) ? doc.data().draftTentati : 0;
            transaction.update(userRef, { draftTentati: currentDrafts + 1 });
        });
    } catch (e) {}
}

function renderMatchdayPills(selectedDay) {
    const container = document.getElementById("matchdays-pills-container");
    container.innerHTML = "";
    for (let g = 1; g <= ACTIVE_MATCHDAY; g++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `btn-matchday-pill ${g === selectedDay ? 'active' : ''}`;
        btn.innerText = `Giornata ${g}`;
        btn.onclick = () => apriSchermataClassifica(g);
        container.appendChild(btn);
    }
}

async function apriRecapSquadraUtenteCorrente(index) {
    const sq = userSquadre[index];
    currentRecapSquadraIndex = index;
    let username = "Fantallenatore";
    let ownerId = currentUser ? currentUser.uid : null;

    if (currentUser) {
        try {
            const uDoc = await db.collection("utenti").doc(currentUser.uid).get();
            username = uDoc.exists ? getRealUsername(uDoc.data(), currentUser) : getRealUsername(null, currentUser);
        } catch (e) {
            username = getRealUsername(null, currentUser);
        }
    }
    renderRecapScreenReadOnly(sq, username, false, ownerId);
}

async function visualizzaSquadraGenerica(userId, nomeSquadra, giornata) {
    try {
        const doc = await db.collection("utenti").doc(userId).get();
        if (!doc.exists) {
            mostraNotifica("Utente Non Trovato", "Impossibile trovare l'allenatore selezionato.", "error");
            return;
        }

        const uData = doc.data();
        const username = getRealUsername(uData, null);
        const sq = (uData.squadre || []).find(s => s.nomeSquadra.toLowerCase() === nomeSquadra.toLowerCase() && (s.giornata !== undefined ? s.giornata : 8) === parseInt(giornata));
        if (!sq) {
            mostraNotifica("Squadra Non Trovata", "Squadra non trovata per questa giornata.", "warning");
            return;
        }

        currentRecapSquadraIndex = (currentUser && userId === currentUser.uid)
            ? userSquadre.findIndex(s => s.nomeSquadra.toLowerCase() === nomeSquadra.toLowerCase() && (s.giornata !== undefined ? s.giornata : 8) === parseInt(giornata))
            : -1;

        renderRecapScreenReadOnly(sq, username, true, userId);
    } catch (err) {
        mostraNotifica("Errore Caricamento", "Errore nel caricamento della squadra: " + err.message, "error");
    }
}

function renderRecapScreenReadOnly(sq, usernameOwner, fromClassifica = false, ownerUserId = null) {
    document.getElementById("welcome-screen").style.display = "none";
    document.getElementById("main-app").style.display = "none";
    document.getElementById("classifica-screen").style.display = "none";
    document.getElementById("profilo-screen").style.display = "none";
    document.getElementById("recap-screen").style.display = "block";
    document.getElementById("admin-screen").style.display = "none";

    currentRecapSquadraObj = sq;
    document.getElementById("recap-nome-squadra").innerText = sq.nomeSquadra;
    document.getElementById("recap-utente-owner").innerText = `Username: ${usernameOwner}`;
    document.getElementById("recap-modulo-title").innerText = sq.moduloSelezionato;

    const btnBackClassifica = document.getElementById("btn-recap-back-classifica");
    btnBackClassifica.style.display = fromClassifica ? "inline-flex" : "none";

    const btnModifica = document.getElementById("btn-recap-modifica-formazione");
    const isOwner = currentUser && ownerUserId === currentUser.uid;
    const giornataSquadra = sq.giornata !== undefined ? sq.giornata : ACTIVE_MATCHDAY;
    btnModifica.style.display = (isOwner && isMarketOpenForMatchday(giornataSquadra) && !sq.isTest) ? "inline-flex" : "none";

    const recapBadge = document.getElementById("recap-badge-status");
    if (sq.isTest) {
        recapBadge.style.borderColor = "var(--accent-sky-bright)";
        recapBadge.style.color = "var(--accent-sky-bright)";
        recapBadge.innerText = "TEST DRAFT (NON SALVATO)";
    } else {
        recapBadge.style.borderColor = "var(--accent-emerald-bright)";
        recapBadge.style.color = "var(--accent-emerald-bright)";
        recapBadge.innerText = `SQUADRA SALVATA (GIORNATA ${giornataSquadra})`;
    }

    const recapCampo = document.getElementById("recap-campo");
    recapCampo.innerHTML = "";
    creaRepartoCampo(recapCampo, "Portiere", [sq.schierati.find(p => p.ruolo === "Portiere")], true);
    creaRepartoCampo(recapCampo, "Difensore", sq.schierati.filter(p => p.ruolo === "Difensore"), true);
    creaRepartoCampo(recapCampo, "Centrocampista", sq.schierati.filter(p => p.ruolo === "Centrocampista"), true);
    creaRepartoCampo(recapCampo, "Attaccante", sq.schierati.filter(p => p.ruolo === "Attaccante"), true);

    const panchinaDiv = document.getElementById("recap-panchina");
    panchinaDiv.innerHTML = "";
    ["Portiere", "Difensore", "Centrocampista", "Attaccante"].forEach(ruolo => {
        const riserve = (sq.riserveSelezionate && sq.riserveSelezionate[ruolo]) || [];
        riserve.forEach((ris, i) => {
            const card = document.createElement("div");
            card.className = "recap-bench-card";
            card.innerHTML = `
                <div class="bench-player-meta"><i class="${roleIcons[ruolo]}"></i> ${ruolo} (R${i + 1})</div>
                <div class="bench-player-name">${ris.nome}</div>
            `;
            panchinaDiv.appendChild(card);
        });
    });

    if (sq.votiGiornata && Object.keys(sq.votiGiornata).length > 0) {
        mostraTabellinoVoti(sq);
    } else {
        document.getElementById("tabellino-container").innerHTML = `<p style="text-align:center; color:var(--text-muted); font-size:12px;">I voti per questa squadra non sono ancora stati calcolati.</p>`;
    }
}

function tornaAllaHome() {
    const colonnaSinistraDraft = document.querySelector(".desktop-col-left");
    if (colonnaSinistraDraft) colonnaSinistraDraft.style.display = "block";
    renderWelcomeScreen();
}

function avviaTestDraft() {
    if (customPlayersList.length < 24) {
        mostraNotifica("Lista Giocatori Non Pronta", "Caricamento giocatori in corso o file <strong>giocatori.xlsx</strong> non valido.", "warning");
        return;
    }

    incrementaDraftTentatiCloud();
    isTestMode = true;
    tempNomeSquadra = "Squadra Test Draft";

    document.getElementById("draft-panel").innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div>
                <h2 style="font-size:14px;">Scegli il tuo giocatore (Test)</h2>
                <span style="font-size:11px; color:var(--accent-sky-bright);">Tocca la scheda per acquistarlo</span>
            </div>
            <button type="button" onclick="annullaERicominciaDraft()" class="btn-action-danger" style="padding:6px 10px; font-size:11px;">Ricomincia</button>
        </div>
        <div id="players" class="players-container"></div>
    `;

    document.getElementById("btn-conferma-formazione").innerHTML = `<i class="fa-solid fa-flask"></i> Termina Test e Visualizza Recap`;
    resetDraftState();

    document.getElementById("welcome-screen").style.display = "none";
    document.getElementById("main-app").style.display = "flex";
    document.getElementById("current-draft-team-title").innerText = `Rosa Test: ${tempNomeSquadra}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    nextPick();
}

async function preparaEAvviaDraft() {
    if (!isMarketOpen()) {
        mostraNotifica("Mercato Chiuso", `Il mercato è chiuso per la <strong>Giornata ${ACTIVE_MATCHDAY}</strong>.`, "warning");
        return;
    }

    const squadreGiornataCorrente = userSquadre.filter(sq => (sq.giornata !== undefined ? sq.giornata : 8) === ACTIVE_MATCHDAY);
    if (squadreGiornataCorrente.length >= 3) {
        mostraNotifica("Gettoni Esauriti", `Hai già utilizzato tutti i 3 gettoni disponibili per la <strong>Giornata ${ACTIVE_MATCHDAY}</strong>.`, "warning");
        return;
    }

    const inputName = document.getElementById("new-team-name-input").value.trim();
    if (!inputName) {
        mostraNotifica("Nome Mancante", "Inserisci un nome per la tua nuova squadra prima di avviare il draft.", "warning");
        return;
    }

    const nomiEsistentiLega = await ottieniNomiSquadreGlobaliGiornata(ACTIVE_MATCHDAY);
    if (nomiEsistentiLega.includes(inputName.toLowerCase())) {
        mostraNotifica("Nome Già In Uso", `Il nome "<strong>${inputName}</strong>" è già stato scelto per la Giornata ${ACTIVE_MATCHDAY}.`, "error");
        return;
    }

    if (customPlayersList.length < 24) {
        mostraNotifica("Lista Giocatori Non Pronta", "Caricamento giocatori in corso o file <strong>giocatori.xlsx</strong> non valido.", "warning");
        return;
    }

    incrementaDraftTentatiCloud();
    isTestMode = false;
    tempNomeSquadra = inputName;

    document.getElementById("draft-panel").innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <div>
                <h2 style="font-size:14px;">Scegli il tuo giocatore</h2>
                <span style="font-size:11px; color:var(--accent-sky-bright);">Tocca la scheda per acquistarlo</span>
            </div>
            <button type="button" onclick="annullaERicominciaDraft()" class="btn-action-danger" style="padding:6px 10px; font-size:11px;">Ricomincia</button>
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
    budget = 800;
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

async function annullaERicominciaDraft() {
    const ok = await mostraConferma(
        "Ricomincia Draft",
        "Vuoi davvero ricominciare il draft? I giocatori selezionati verranno azzerati.",
        "warning",
        "Sì, ricomincia",
        "No"
    );
    if (ok) {
        incrementaDraftTentatiCloud();
        resetDraftState();
        nextPick();
    }
}

async function caricaGiocatoriDaExcel() {
    try {
        const response = await fetch("giocatori.xlsx");
        if (!response.ok) return;
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        if (jsonData.length > 0) parseAndSetPlayers(jsonData);
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
    ["Portiere", "Difensore", "Centrocampista", "Attaccante"].forEach(r => {
        document.getElementById(`count-box-${r}`).innerText = `${rosa[r].length}/${limits[r]}`;
    });
}

function updateProgressBar() {
    document.getElementById("progress-bar").style.width = ((turno / 24) * 100) + "%";
}

function nextPick() {
    turno++;
    updateProgressBar();
    updateDashboardCounters();
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
    if (candidates.length === 0) candidates = ruoliDisponibili.filter(p => p.valore <= budget);

    if (candidates.length === 0) {
        showModuloSelection();
        return;
    }

    const five = candidates.sort(() => Math.random() - 0.5).slice(0, 5);
    five.forEach(p => {
        const card = document.createElement("div");
        card.className = `player-card ${p.ruolo}`;
        card.onclick = () => draft(p.nome);
        card.innerHTML = `
            <div>
                <div class="player-name">${p.nome}</div>
                <div class="player-team">${p.squadra}</div>
                <span class="player-role-label">${p.ruolo}</span>
            </div>
            <div class="valore-badge-draft">${p.valore} cr</div>
        `;
        container.appendChild(card);
    });
}

function draft(nome) {
    if (!isTestMode && !isMarketOpen()) return;
    const p = availablePlayers.find(x => x.nome === nome);
    if (!p || rosa[p.ruolo].length >= limits[p.ruolo] || p.valore > budget) return;

    budget -= p.valore;
    rosa[p.ruolo].push(p);
    availablePlayers = availablePlayers.filter(x => x.nome !== nome);

    renderSlots();
    nextPick();
}

function renderSlots() {
    ["Portiere", "Difensore", "Centrocampista", "Attaccante"].forEach(ruolo => {
        const div = document.getElementById("slot-" + ruolo);
        const countSpan = document.getElementById("count-rosa-" + ruolo);
        div.innerHTML = "";
        countSpan.innerText = rosa[ruolo].length;

        if (rosa[ruolo].length === 0) {
            div.innerHTML = `<div style="font-size:10px; color:var(--text-muted); padding:4px 0;">Vuoto</div>`;
            return;
        }

        rosa[ruolo].forEach(p => {
            const isTit = schierati.some(s => s.nome === p.nome);
            const isBench = riserveSelezionate[ruolo].some(r => r.nome === p.nome);
            const slot = document.createElement("div");
            slot.className = `slot ${(isTit || isBench) ? "schierato" : ""}`;
            let tagStatus = isTit ? `<span class="slot-tag titolare">T</span>` : (isBench ? `<span class="slot-tag riserva">R</span>` : "");
            slot.innerHTML = `<span>${p.nome}</span>${tagStatus}`;
            slot.onclick = () => schieraGiocatoreDaLista(p, ruolo);
            div.appendChild(slot);
        });
    });
}

function schieraGiocatoreDaLista(playerObj, ruolo) {
    if (!isTestMode && !isMarketOpen()) return;
    if (!moduloSelezionato) {
        mostraNotifica("Modulo Mancante", "Scegli prima il modulo tattico prima di schierare i giocatori.", "warning");
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
        } else if (riserveSelezionate[ruolo].length < 2) {
            riserveSelezionate[ruolo].push(playerObj);
        }
    }

    ripristinaCampoTattico();
    renderSlots();
    renderPanchinaGrafica();
}

function apriModaleScelta(ruolo, targetType, indexTitolare = null) {
    if (!isTestMode && !isMarketOpen()) return;
    if (!moduloSelezionato) return;
    const giocatoriRuolo = rosa[ruolo];
    if (!giocatoriRuolo || giocatoriRuolo.length === 0) return;

    const overlay = document.createElement("div");
    overlay.className = "custom-modal-overlay";
    overlay.id = "selection-modal";

    let paramType = targetType === "campo_indice" ? `campo_indice_${indexTitolare}` : targetType;
    let itemsHtml = giocatoriRuolo.map(p => `
        <div class="modal-player-item" onclick="assegnaGiocatoreDaModale('${p.nome.replace(/'/g, "\'")}', '${ruolo}', '${paramType}')">
            <div>
                <div style="font-size:12px; font-weight:700; color:#fff;">${p.nome}</div>
                <div style="font-size:10px; color:var(--text-muted);">${p.squadra}</div>
            </div>
            <span style="font-size:10px; color:var(--accent-sky-bright);">Seleziona</span>
        </div>
    `).join("");

    overlay.innerHTML = `
        <div class="custom-modal-card">
            <h3>Seleziona ${ruolo}</h3>
            <div style="max-height:240px; overflow-y:auto; text-align:left; margin-bottom:12px;">${itemsHtml}</div>
            <button type="button" onclick="chiudiModale()" class="btn-action-secondary" style="width:100%;">Chiudi</button>
        </div>
    `;
    document.body.appendChild(overlay);
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
        if (riserveSelezionate[ruolo].length > index) riserveSelezionate[ruolo][index] = playerObj;
        else riserveSelezionate[ruolo].push(playerObj);
    }

    chiudiModale();
    ripristinaCampoTattico();
    renderSlots();
    renderPanchinaGrafica();
}

function showModuloSelection() {
    const headerTitle = isTestMode ? `Test Draft Completato` : `Draft Completato per ${tempNomeSquadra}`;
    const moduliDisponibili = [
        { codice: "4-4-2", label: "Equilibrato", desc: "4 Dif • 4 Cen • 2 Att" },
        { codice: "4-3-3", label: "Offensivo", desc: "4 Dif • 3 Cen • 3 Att" },
        { codice: "3-4-3", label: "Trazione Anteriore", desc: "3 Dif • 4 Cen • 3 Att" },
        { codice: "4-5-1", label: "Copertura", desc: "4 Dif • 5 Cen • 1 Att" },
        { codice: "3-5-2", label: "Centrocampo Folto", desc: "3 Dif • 5 Cen • 2 Att" },
        { codice: "5-3-2", label: "Difesa a oltranza", desc: "5 Dif • 3 Cen • 2 Att" }
    ];

    const cardsHtml = moduliDisponibili.map(m => `
        <button type="button" class="modulo-card-btn ${moduloSelezionato === m.codice ? 'active' : ''}" data-modulo="${m.codice}" onclick="setModulo('${m.codice}')">
            <span class="modulo-card-code">${m.codice}</span>
            <span class="modulo-card-label">${m.label}</span>
            <span class="modulo-card-desc">${m.desc}</span>
        </button>
    `).join("");

    document.getElementById("draft-panel").innerHTML = `
        <div class="modulo-selection-card">
            <div class="modulo-selection-badge">SCELTA TATTICA</div>
            <h3 style="font-size:15px; margin-bottom:4px;">${headerTitle}</h3>
            <p style="font-size:12px; color:var(--text-muted);">Seleziona il modulo tattico per schierare titolari e riserve:</p>
            <div class="modulo-cards-grid">${cardsHtml}</div>
        </div>
    `;
}

function setModulo(nuovoModulo) {
    if (!isTestMode && !isMarketOpen()) return;
    if (!nuovoModulo) return;
    moduloSelezionato = nuovoModulo;

    document.querySelectorAll(".modulo-card-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.modulo === moduloSelezionato);
    });

    schierati = [];
    riserveSelezionate = { Portiere: [], Difensore: [], Centrocampista: [], Attaccante: [] };

    document.getElementById("campo-panel-container").style.display = "block";
    document.getElementById("panchina-panel-container").style.display = "block";
    document.getElementById("conferma-container").style.display = "flex";

    ripristinaCampoTattico();
    renderSlots();
    renderPanchinaGrafica();
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
}

function creaRepartoCampo(campoContainer, ruolo, countOrPlayers, isReadOnly = false) {
    const reparto = document.createElement("div");
    reparto.className = "reparto-campo";
    let quantita = typeof countOrPlayers === 'number' ? countOrPlayers : countOrPlayers.length;

    for (let i = 0; i < quantita; i++) {
        const dz = document.createElement("div");
        dz.className = "pos";
        if (Array.isArray(countOrPlayers)) {
            const p = countOrPlayers[i];
            if (p) {
                dz.innerText = p.nome;
                dz.classList.add("filled");
            }
        } else {
            const titolariRuolo = schierati.filter(s => s.ruolo === ruolo);
            if (titolariRuolo[i]) {
                dz.innerText = titolariRuolo[i].nome;
                dz.classList.add("filled");
            } else {
                dz.innerText = `+ ${ruolo.substring(0, 3)}`;
            }
        }
        if (!isReadOnly) {
            const indexSlot = i;
            dz.onclick = () => apriModaleScelta(ruolo, "campo_indice", indexSlot);
        }
        reparto.appendChild(dz);
    }
    campoContainer.appendChild(reparto);
}

function renderPanchinaGrafica() {
    const container = document.getElementById("panchina-grafica");
    container.innerHTML = "";

    ["Portiere", "Difensore", "Centrocampista", "Attaccante"].forEach(ruolo => {
        const group = document.createElement("div");
        group.className = "panchina-role-group";
        const riserveRuolo = riserveSelezionate[ruolo] || [];

        let slotsHtml = "";
        for (let i = 0; i < 2; i++) {
            const p = riserveRuolo[i];
            slotsHtml += `
                <div class="pos ${p ? 'filled' : ''}" onclick="apriModaleScelta('${ruolo}', ${i})">
                    ${p ? p.nome : `+ R${i + 1}`}
                </div>
            `;
        }

        group.innerHTML = `
            <div class="panchina-role-header"><i class="${roleIcons[ruolo]}"></i> ${ruolo} (${riserveRuolo.length}/2)</div>
            <div class="bench-slots-grid">${slotsHtml}</div>
        `;
        container.appendChild(group);
    });
}

async function confermaFormazioneDefinitiva() {
    if (schierati.length < 11) {
        mostraNotifica("Formazione Incompleta", "Devi schierare tutti gli <strong>11 titolari</strong> prima di confermare.", "warning");
        return;
    }
    if (!haPanchinaCompleta()) {
        mostraNotifica("Panchina Incompleta", "Devi schierare <strong>tutte le 8 riserve</strong> (2 per ruolo) prima di confermare.", "warning");
        return;
    }

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
        renderRecapScreenReadOnly(squadraTestObj, getRealUsername(null, currentUser), false);
        return;
    }

    if (!isMarketOpen()) return;

    const ok = await mostraConferma(
        "Conferma Formazione",
        `Confermi la squadra "<strong>${tempNomeSquadra}</strong>" per la Giornata ${ACTIVE_MATCHDAY}? Questa operazione consumerà 1 Gettone.`,
        "info",
        "Sì, conferma",
        "No"
    );
    if (!ok) return;

    try {
        const userDocRef = db.collection("utenti").doc(currentUser.uid);
        const docSnapshot = await userDocRef.get();
        let squadreEsistenti = (docSnapshot.exists && docSnapshot.data().squadre) ? docSnapshot.data().squadre : [];

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

        await userDocRef.set({ squadre: userSquadre }, { merge: true });
        document.getElementById("new-team-name-input").value = "";
        await calcolaEVisualizzaTotaleSquadreGlobali(ACTIVE_MATCHDAY);
        renderWelcomeScreen();
        mostraNotifica("Formazione Salvata", `Squadra "<strong>${tempNomeSquadra}</strong>" salvata per la Giornata ${ACTIVE_MATCHDAY}.`, "success");
    } catch (err) {
        mostraNotifica("Errore Salvataggio", "Errore durante il salvataggio: " + err.message, "error");
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
    } catch (err) {}
}

function mostraTabellinoVoti(sq) {
    const container = document.getElementById("tabellino-container");
    let rowsHtml = "";
    let totale = 0;

    (sq.schierati || []).forEach(tit => {
        const info = sq.votiGiornata[tit.nome] || { voto: 0, fantavoto: 0, sv: true };
        const fv = info.fantavoto > 0 ? info.fantavoto : 0;
        totale += fv;
        rowsHtml += `
            <tr>
                <td><i class="${roleIcons[tit.ruolo]}"></i></td>
                <td><strong>${tit.nome}</strong></td>
                <td>${info.sv ? "S.V." : info.voto}</td>
                <td><strong style="color:var(--accent-emerald-bright);">${fv}</strong></td>
            </tr>
        `;
    });

    container.innerHTML = `
        <table class="voti-table">
            <thead><tr><th>Ruolo</th><th>Calciatore</th><th>Voto</th><th>Fantavoto</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
        </table>
        <div class="totale-punteggio">Totale Squadra: ${sq.punteggioTotale !== null ? sq.punteggioTotale : totale} pt</div>
    `;
}

async function caricaNuovaFotoProfiloBase64(event) {
    if (!isViewingOwnProfile) return;
    const file = event.target.files[0];
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.src = e.target.result;
        img.onload = async function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const MAX_SIZE = 150;
            let width = img.width, height = img.height;
            if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } }
            else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            const base64String = canvas.toDataURL('image/jpeg', 0.75);

            if (!currentUser) return;
            await db.collection("utenti").doc(currentUser.uid).update({ photoURL: base64String });
            aggiornaAvatarGrafica(base64String);
            const uDoc = await db.collection("utenti").doc(currentUser.uid).get();
            if (uDoc.exists) renderizzaTraguardi(uDoc.data());
            mostraNotifica("Foto Aggiornata", "Foto profilo aggiornata con successo.", "success");
        };
    };
    reader.readAsDataURL(file);
}

function aggiornaAvatarGrafica(url) {
    const profImg = document.getElementById("profilo-avatar-img");
    const navImg = document.getElementById("user-avatar-navbar");
    const navIcon = document.getElementById("user-icon-fallback");

    if (url && url.trim() !== "") {
        if (profImg) profImg.src = url;
        if (navImg) {
            navImg.src = url;
            navImg.style.display = "inline-block";
        }
        if (navIcon) navIcon.style.display = "none";
    } else {
        if (profImg) profImg.src = "https://via.placeholder.com/60";
        if (navImg) navImg.style.display = "none";
        if (navIcon) navIcon.style.display = "inline-block";
    }
}

async function vaiAMissioniProfilo() {
    if (!currentUser) return;
    await apriProfiloUtente(currentUser.uid);
    setTimeout(() => {
        const targetSection = document.getElementById("badge-grid-container");
        if (targetSection) targetSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
}

function renderizzaTraguardi(uData) {
    const container = document.getElementById("badge-grid-container");
    if (!container) return;
    container.innerHTML = "";

    const squadre = (uData && uData.squadre) ? uData.squadre : [];
    const numSquadre = squadre.length;
    const haFoto = uData && uData.photoURL && uData.photoURL.trim() !== "";

    const listaTraguardi = [
        { titolo: "Primo Scatto", desc: "Carica la tua foto profilo", icona: "fa-solid fa-camera", ok: haFoto, cur: haFoto ? 1 : 0, target: 1 },
        { titolo: "Mister Esperto", desc: "Crea e salva 50 squadre", icona: "fa-solid fa-shield-halved", ok: numSquadre >= 50, cur: numSquadre, target: 50 },
        { titolo: "Centurione", desc: "Crea e salva 100 squadre", icona: "fa-solid fa-trophy", ok: numSquadre >= 100, cur: numSquadre, target: 100 },
        { titolo: "Leggenda della Panchina", desc: "Crea e salva 500 squadre", icona: "fa-solid fa-crown", ok: numSquadre >= 500, cur: numSquadre, target: 500 }
    ];

    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "8px";

    listaTraguardi.forEach(t => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border-radius:10px; background:var(--bg-card); border:1px solid var(--border-subtle); gap:10px;";
        row.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <i class="${t.icona}" style="color:${t.ok ? 'var(--accent-emerald-bright)' : 'var(--text-muted)'};"></i>
                <div>
                    <div style="font-size:13px; font-weight:800;">${t.titolo}</div>
                    <div style="font-size:11px; color:var(--text-muted);">${t.desc}</div>
                </div>
            </div>
            <span style="font-size:11px; font-weight:800; color:${t.ok ? 'var(--accent-emerald-bright)' : 'var(--text-muted)'};">${t.ok ? 'SBLOCCATO' : `${t.cur} / ${t.target}`}</span>
        `;
        container.appendChild(row);
    });
}

function avviaModificaFormazioneSalvata() {
    if (!currentRecapSquadraObj) return;
    const sq = currentRecapSquadraObj;
    const giornataSquadra = sq.giornata !== undefined ? sq.giornata : ACTIVE_MATCHDAY;
    if (!isMarketOpenForMatchday(giornataSquadra)) return;

    rosa = JSON.parse(JSON.stringify(sq.rosa || { Portiere: [], Difensore: [], Centrocampista: [], Attaccante: [] }));
    schierati = JSON.parse(JSON.stringify(sq.schierati || []));
    riserveSelezionate = JSON.parse(JSON.stringify(sq.riserveSelezionate || { Portiere: [], Difensore: [], Centrocampista: [], Attaccante: [] }));
    moduloSelezionato = sq.moduloSelezionato;
    budget = sq.budget !== undefined ? sq.budget : 800;
    tempNomeSquadra = sq.nomeSquadra;
    isTestMode = false;

    document.getElementById("welcome-screen").style.display = "none";
    document.getElementById("recap-screen").style.display = "none";
    document.getElementById("main-app").style.display = "flex";
    document.getElementById("campo-panel-container").style.display = "block";
    document.getElementById("panchina-panel-container").style.display = "block";
    document.getElementById("conferma-container").style.display = "flex";

    const btnConferma = document.getElementById("btn-conferma-formazione");
    btnConferma.onclick = salvaModificaFormazioneSuCloud;
    btnConferma.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Salva Modifiche Formazione`;

    ripristinaCampoTattico();
    renderSlots();
    renderPanchinaGrafica();
}

async function salvaModificaFormazioneSuCloud() {
    if (!currentRecapSquadraObj || schierati.length < 11 || !haPanchinaCompleta()) return;
    const userDocRef = db.collection("utenti").doc(currentUser.uid);
    const docSnapshot = await userDocRef.get();
    let squadreEsistenti = (docSnapshot.exists && docSnapshot.data().squadre) ? docSnapshot.data().squadre : [];

    let idx = currentRecapSquadraIndex;
    if (idx < 0 || idx >= squadreEsistenti.length) {
        idx = squadreEsistenti.findIndex(s => s.nomeSquadra.toLowerCase() === tempNomeSquadra.toLowerCase());
    }
    if (idx < 0) return;

    squadreEsistenti[idx].schierati = JSON.parse(JSON.stringify(schierati));
    squadreEsistenti[idx].riserveSelezionate = JSON.parse(JSON.stringify(riserveSelezionate));
    squadreEsistenti[idx].moduloSelezionato = moduloSelezionato;
    userSquadre = squadreEsistenti;

    await userDocRef.update({ squadre: userSquadre });
    document.getElementById("btn-conferma-formazione").onclick = confermaFormazioneDefinitiva;
    mostraNotifica("Modifiche Salvate", "Formazione aggiornata con successo.", "success");
    apriRecapSquadraUtenteCorrente(idx);
}

async function controllaRuoloAdmin(uData) {
    const adminBtn = document.getElementById("admin-nav-button");
    if (adminBtn) adminBtn.style.display = (uData && uData.isAdmin === true) ? "inline-flex" : "none";
}

async function apriPannelloAdmin() {
    if (!currentUser) return;
    const uDoc = await db.collection("utenti").doc(currentUser.uid).get();
    if (!uDoc.exists || uDoc.data().isAdmin !== true) return;

    document.getElementById("welcome-screen").style.display = "none";
    document.getElementById("main-app").style.display = "none";
    document.getElementById("recap-screen").style.display = "none";
    document.getElementById("classifica-screen").style.display = "none";
    document.getElementById("profilo-screen").style.display = "none";
    document.getElementById("admin-screen").style.display = "block";
    caricaStatisticheAdmin();
}

async function caricaStatisticheAdmin() {
    const snap = await db.collection("utenti").get();
    let totaleSquadre = 0;
    snap.forEach(doc => { totaleSquadre += (doc.data().squadre || []).length; });
    document.getElementById("admin-stat-utenti").innerText = snap.size;
    document.getElementById("admin-stat-squadre").innerText = totaleSquadre;
}

async function adminEseguiRicalcoloGiornata() {
    const gInput = parseInt(document.getElementById("admin-input-giornata").value);
    if (isNaN(gInput) || gInput < 1) return;
    mostraNotifica("Ricalcolo Giornata", `Avviato controllo voti per la giornata ${gInput}.`, "info");
}

function mostraNotifica(titolo, messaggio, tipo = 'info') {
    const modal = document.getElementById('custom-alert-modal');
    const box = document.getElementById('custom-alert-box');
    const icon = document.getElementById('custom-alert-icon');
    const titleEl = document.getElementById('custom-alert-title');
    const msgEl = document.getElementById('custom-alert-message');

    box.className = `custom-modal-card alert-type-${tipo}`;
    icon.className = tipo === 'error' ? 'fa-solid fa-triangle-exclamation' : (tipo === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-info');
    titleEl.textContent = titolo;
    msgEl.innerHTML = messaggio;
    modal.style.display = 'flex';
}

function chiudiNotificaPersonalizzata() {
    document.getElementById('custom-alert-modal').style.display = 'none';
}

let confirmResolver = null;

function mostraConferma(titolo, messaggio, tipo = 'warning', testoSi = 'Sì', testoNo = 'No') {
    return new Promise((resolve) => {
        confirmResolver = resolve;
        document.getElementById('custom-confirm-title').textContent = titolo;
        document.getElementById('custom-confirm-message').innerHTML = messaggio;
        document.getElementById('custom-confirm-yes').innerHTML = `<i class="fa-solid fa-check"></i> ${testoSi}`;
        document.getElementById('custom-confirm-no').innerHTML = `<i class="fa-solid fa-xmark"></i> ${testoNo}`;
        document.getElementById('custom-confirm-modal').style.display = 'flex';
    });
}

function rispondiConferma(scelta) {
    document.getElementById('custom-confirm-modal').style.display = 'none';
    if (typeof confirmResolver === 'function') {
        const fn = confirmResolver;
        confirmResolver = null;
        fn(Boolean(scelta));
    }
}

function haPanchinaCompleta() {
    return ["Portiere", "Difensore", "Centrocampista", "Attaccante"].every(
        ruolo => Array.isArray(riserveSelezionate[ruolo]) && riserveSelezionate[ruolo].length >= 2
    );
}
