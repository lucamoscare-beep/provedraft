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


// =========================================================
// CONFIGURAZIONE DINAMICA GIORNATE E DEADLINE (SCADENZE)
// =========================================================
const MATCHDAY_DEADLINES = {
    8: new Date("2025-10-26T12:29:00+01:00").getTime(),
    9: new Date("2025-10-29T18:29:00+01:00").getTime(),
    10: new Date("2025-11-01T14:59:00+01:00").getTime(),
    11: new Date("2025-11-07T20:44:00+01:00").getTime(),
    12: new Date("2025-11-22T14:59:00+01:00").getTime(),
    13: new Date("2025-11-28T20:44:00+01:00").getTime(),
    14: new Date("2025-12-05T20:44:00+01:00").getTime(),
    15: new Date("2025-12-12T20:44:00+01:00").getTime(),
    16: new Date("2025-12-20T14:59:00+01:00").getTime(),
    17: new Date("2025-12-27T12:29:00+01:00").getTime(),
    18: new Date("2026-01-03T12:29:00+01:00").getTime(),
    19: new Date("2026-01-06T14:59:00+01:00").getTime(),
    20: new Date("2026-01-10T14:59:00+01:00").getTime(),
    21: new Date("2026-01-16T20:44:00+01:00").getTime(),
    22: new Date("2026-01-23T20:44:00+01:00").getTime(),
    23: new Date("2026-01-30T20:44:00+01:00").getTime(),
    24: new Date("2026-02-06T20:44:00+01:00").getTime(),
    25: new Date("2026-02-13T20:44:00+01:00").getTime(),
    26: new Date("2026-02-20T20:44:00+01:00").getTime(),
    27: new Date("2026-02-27T20:44:00+01:00").getTime(),
    28: new Date("2026-03-06T20:44:00+01:00").getTime(),
    29: new Date("2026-03-13T20:44:00+01:00").getTime(),
    30: new Date("2026-03-20T20:44:00+01:00").getTime(),
    31: new Date("2026-04-04T14:59:00+01:00").getTime(),
    32: new Date("2026-04-11T14:59:00+01:00").getTime(),
    33: new Date("2026-04-18T14:59:00+01:00").getTime(),
    34: new Date("2026-04-25T14:59:00+01:00").getTime(),
    35: new Date("2026-05-02T14:59:00+01:00").getTime(),
    36: new Date("2026-05-09T14:59:00+01:00").getTime(),
    37: new Date("2026-05-16T14:59:00+01:00").getTime(),
    38: new Date("2026-05-23T14:59:00+01:00").getTime()
};

function getCurrentActiveMatchday() {
    const now = Date.now();
    const matchdays = Object.keys(MATCHDAY_DEADLINES).map(Number).sort((a, b) => a - b);

    for (let g of matchdays) {
        if (now < MATCHDAY_DEADLINES[g]) {
            return g;
        }
    }
    return matchdays[matchdays.length - 1] || 8;
}

function getDeadlineForMatchday(matchday) {
    return MATCHDAY_DEADLINES[matchday] || MATCHDAY_DEADLINES[8];
}

function getUltimaGiornataConVoti() {
    const active = getCurrentActiveMatchday();
    return active > 1 ? active - 1 : 1;
}

// Variabili globali di gioco
let ACTIVE_MATCHDAY = getCurrentActiveMatchday();
let DEADLINE_TIMESTAMP = getDeadlineForMatchday(ACTIVE_MATCHDAY);

let budget = 800;
let turno = 0;
let moduloSelezionato = "";
const limits = { Portiere: 3, Difensore: 8, Centrocampista: 8, Attaccante: 6 };
let rosa = { Portiere: [], Difensore: [], Centrocampista: [], Attaccante: [] };
let schierati = [];
let riserveSelezionate = { Portiere: [], Difensore: [], Centrocampista: [], Attaccante: [] };
let customPlayersList = [];
let availablePlayers = [];

// Variabili di stato Utente & Squadre
let currentUser = null;
let userSquadre = [];
let currentSelectedMatchday = ACTIVE_MATCHDAY;
let isTestMode = false;
let tempNomeSquadra = "";

// Variabile per tracciare se l'utente sta visualizzando il proprio profilo
let isViewingOwnProfile = false;

// Variabili per tracciare la squadra visualizzata nel recap e la sua posizione
let currentRecapSquadraObj = null;
let currentRecapSquadraIndex = -1;

// Variabile globale per verificare la disponibilità dei voti ok
let isVotiOkAvailable = false;

const roleIcons = {
    Portiere: "fa-solid fa-hands",
    Difensore: "fa-solid fa-shield",
    Centrocampista: "fa-solid fa-bolt",
    Attaccante: "fa-solid fa-futbol"
};

const roleColors = {
    Portiere: "var(--role-por)",
    Difensore: "var(--role-dif)",
    Centrocampista: "var(--role-cen)",
    Attaccante: "var(--role-att)"
};

// =========================================================
// FUNZIONE UNIFICATA PER ESTRARRE IL VERO USERNAME
// =========================================================
function getRealUsername(uData, authUser) {
    if (uData && uData.username && uData.username.trim() !== "") {
        return uData.username.trim();
    }
    if (authUser && authUser.displayName && authUser.displayName.trim() !== "") {
        return authUser.displayName.trim();
    }
    if (authUser && authUser.email) {
        return authUser.email.split("@")[0];
    }
    return "Fantallenatore";
}

// =========================================================
// SISTEMA MARQUEE DINAMICO CONTINUO PER TESTI TRONCATI
// =========================================================
function initMarqueeElements() {
    const containers = document.querySelectorAll('.marquee-container');
    containers.forEach(container => {
        const textSpan = container.querySelector('.marquee-text');
        if (!textSpan) return;

        textSpan.classList.remove('scroll-active');
        textSpan.style.removeProperty('--scroll-distance');
        textSpan.style.removeProperty('--scroll-duration');

        const containerWidth = container.clientWidth;
        const textWidth = textSpan.scrollWidth;

        if (textWidth > containerWidth && containerWidth > 0) {
            const overflow = textWidth - containerWidth;
            const distance = -(overflow + 12);
            const duration = Math.max(3, Math.min(8, overflow / 20));

            textSpan.style.setProperty('--scroll-distance', `${distance}px`);
            textSpan.style.setProperty('--scroll-duration', `${duration}s`);
            textSpan.classList.add('scroll-active');
        }
    });
}

function refreshAllMarquees() {
    requestAnimationFrame(() => {
        initMarqueeElements();
        setTimeout(initMarqueeElements, 150);
    });
}

window.addEventListener('resize', () => {
    refreshAllMarquees();
});

// =========================================================
// GESTIONE AUTENTICAZIONE LANDING E-SPORT
// =========================================================
function switchAuthTab(tabName) {
    const loginTab = document.getElementById("tab-login");
    const registerTab = document.getElementById("tab-register");
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");

    if (tabName === "login") {
        loginTab.classList.add("active");
        registerTab.classList.remove("active");
        loginForm.style.display = "block";
        registerForm.style.display = "none";
    } else {
        registerTab.classList.add("active");
        loginTab.classList.remove("active");
        registerForm.style.display = "block";
        loginForm.style.display = "none";
    }
}

function togglePasswordVisibility(inputId, iconEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === "password") {
        input.type = "text";
        iconEl.classList.remove("fa-eye");
        iconEl.classList.add("fa-eye-slash");
    } else {
        input.type = "password";
        iconEl.classList.remove("fa-eye-slash");
        iconEl.classList.add("fa-eye");
    }
}

function resetPasswordPrompt() {
    const emailInput = document.getElementById("login-email");
    const email = emailInput ? emailInput.value.trim() : "";
    if (!email) {
        mostraNotifica("Email Mancante", "Inserisci il tuo indirizzo email nel campo Email per ricevere il link di recupero password.", "warning");
        return;
    }

    auth.sendPasswordResetEmail(email)
        .then(() => {
            mostraNotifica("Email Inviata", `📧 Link per reimpostare la password inviato a <strong>${email}</strong>.`, "success");
        })
        .catch((error) => {
            mostraNotifica("Errore Recupero Password", error.message, "error");
        });
}

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("login-email").value.trim();
            const password = document.getElementById("login-password").value;

            try {
                await auth.signInWithEmailAndPassword(email, password);
            } catch (error) {
                mostraNotifica("Accesso Fallito", "Credenziali non valide o errore durante l'accesso: " + error.message, "error");
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document.getElementById("reg-username").value.trim();
            const email = document.getElementById("reg-email").value.trim();
            const password = document.getElementById("reg-password").value;

            if (!username || username.length < 2) {
                mostraNotifica("Username Non Valido", "Scegli un username di almeno 2 caratteri.", "warning");
                return;
            }

            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const uid = userCredential.user.uid;

                await userCredential.user.updateProfile({ displayName: username });

                await db.collection("utenti").doc(uid).set({
                    username: username,
                    email: email,
                    squadre: [],
                    draftTentati: 0,
                    createdAt: new Date()
                });

            } catch (error) {
                mostraNotifica("Registrazione Fallita", error.message, "error");
            }
        });
    }
});

// =========================================================
// GESTIONE STATO AUTH FIREBASE
// =========================================================
auth.onAuthStateChanged(async (user) => {
    const authModal = document.getElementById("auth-modal");
    const globalHeader = document.getElementById("global-header");

    if (user) {
        currentUser = user;
        if (authModal) authModal.style.display = "none";
        if (globalHeader) globalHeader.style.display = "flex";

        await caricaGiocatoriDaExcel();
        await caricaDatiUtenteCloud();
        await verificaECalcolaVotiAutomaticamente();
        await calcolaEVisualizzaTotaleSquadreGlobali(ACTIVE_MATCHDAY);
        renderWelcomeScreen();
        startCountdownTimer();
        refreshAllMarquees();
    } else {
        currentUser = null;
        if (authModal) authModal.style.display = "flex";
        if (globalHeader) globalHeader.style.display = "none";
    }
});

function logoutUtente() {
    auth.signOut().then(() => {
        window.location.reload();
    });
}

// =========================================================
// CARICAMENTO DATI UTENTE DA FIRESTORE & CALCOLO SQUADRE GLOBALI
// =========================================================
async function caricaDatiUtenteCloud() {
    if (!currentUser) return;
    try {
        const docRef = db.collection("utenti").doc(currentUser.uid);
        const doc = await docRef.get();

        let uData = null;
        if (doc.exists) {
            uData = doc.data();
            userSquadre = uData.squadre || [];
        } else {
            userSquadre = [];
        }

        const realUsername = getRealUsername(uData, currentUser);
        document.getElementById("user-name-display").innerText = realUsername;

        if (uData && uData.photoURL && uData.photoURL.trim() !== "") {
            aggiornaAvatarGrafica(uData.photoURL);
        } else {
            aggiornaAvatarGrafica("");
        }

        controllaRuoloAdmin(uData);

    } catch (err) {}
}

async function calcolaEVisualizzaTotaleSquadreGlobali(giornata) {
    try {
        if (!giornata) giornata = ACTIVE_MATCHDAY;

        const snapshot = await db.collection("utenti").get();
        let totaleSquadreGiornata = 0;

        snapshot.forEach(doc => {
            const uData = doc.data();
            const squadreArr = uData.squadre || [];

            squadreArr.forEach(sq => {
                let g = sq.giornata !== undefined ? sq.giornata : 8;
                if (g === giornata) {
                    totaleSquadreGiornata++;
                }
            });
        });

        const badgeEl = document.getElementById("global-teams-count");
        if (badgeEl) {
            badgeEl.innerText = totaleSquadreGiornata;
        }
    } catch (err) {}
}

async function ottieniNomiSquadreGlobaliGiornata(giornata) {
    let nomi = [];
    try {
        const snapshot = await db.collection("utenti").get();
        snapshot.forEach(doc => {
            const uData = doc.data();
            const squadreArr = uData.squadre || [];
            squadreArr.forEach(sq => {
                let g = sq.giornata !== undefined ? sq.giornata : 8;
                if (g === giornata && sq.nomeSquadra) {
                    nomi.push(sq.nomeSquadra.trim().toLowerCase());
                }
            });
        });
    } catch (err) {}
    return nomi;
}

// =========================================================
// GESTIONE COUNTDOWN & BLOCCO MERCATO DINAMICO PER GIORNATA
// =========================================================
function isMarketOpen() {
    ACTIVE_MATCHDAY = getCurrentActiveMatchday();
    DEADLINE_TIMESTAMP = getDeadlineForMatchday(ACTIVE_MATCHDAY);
    return Date.now() < DEADLINE_TIMESTAMP;
}

function isMarketOpenForMatchday(matchday) {
    const deadline = getDeadlineForMatchday(matchday);
    return Date.now() < deadline;
}

function startCountdownTimer() {
    function updateTimer() {
        ACTIVE_MATCHDAY = getCurrentActiveMatchday();
        DEADLINE_TIMESTAMP = getDeadlineForMatchday(ACTIVE_MATCHDAY);

        const now = Date.now();
        const distance = DEADLINE_TIMESTAMP - now;

        const deadlineLabel = document.getElementById("deadline-label-text");
        if (deadlineLabel) {
            deadlineLabel.innerHTML = `CHIUSURA MERCATO GIORNATA ${ACTIVE_MATCHDAY}:`;
        }

        if (distance < 0) {
            document.getElementById("cd-days").innerText = "00";
            document.getElementById("cd-hours").innerText = "00";
            document.getElementById("cd-minutes").innerText = "00";
            document.getElementById("cd-seconds").innerText = "00";
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        document.getElementById("cd-days").innerText = String(days).padStart(2, '0');
        document.getElementById("cd-hours").innerText = String(hours).padStart(2, '0');
        document.getElementById("cd-minutes").innerText = String(minutes).padStart(2, '0');
        document.getElementById("cd-seconds").innerText = String(seconds).padStart(2, '0');
    }

    updateTimer();
    setInterval(updateTimer, 1000);
}

// =========================================================
// AGGIORNAMENTO BANNER DINAMICO STATO VOTI IN HOMEPAGE
// =========================================================
function updateHomeStatusBannerState() {
    const banner = document.getElementById("home-status-banner");
    if (!banner) return;

    const ultimaGiornataVoti = getUltimaGiornataConVoti();

    if (isVotiOkAvailable) {
        banner.className = "home-status-banner ready";
        banner.innerHTML = `<i class="fa-solid fa-trophy"></i> <span>🏆 Voti e classifica della Giornata ${ultimaGiornataVoti} disponibili! Clicca per visualizzare</span>`;
        banner.onclick = () => apriSchermataClassifica(ultimaGiornataVoti);
    } else {
        banner.className = "home-status-banner waiting";
        banner.innerHTML = `<i class="fa-solid fa-clock"></i> <span>⏳ In attesa dei voti ufficiali della Giornata ${ultimaGiornataVoti}</span>`;
        banner.onclick = null;
    }
}

// =========================================================
// TOGGLE GUIDA 4 PASSI IN HOMEPAGE
// =========================================================
function aggiornaStatoBottoneGuida(isOpen) {
    const btn = document.getElementById("scopri-di-piu-link");
    if (!btn) return;
    btn.setAttribute("aria-expanded", String(isOpen));
    btn.innerHTML = isOpen
        ? `<i class="fa-solid fa-circle-chevron-up"></i> Nascondi`
        : `<i class="fa-solid fa-circle-info"></i> Scopri di più`;
}

function toggleGuida4Passi() {
    const guidaBox = document.getElementById("guida-4-passi-box");
    if (!guidaBox) return;

    const isCurrentlyOpen = guidaBox.style.display === "block";
    if (isCurrentlyOpen) {
        guidaBox.style.display = "none";
        aggiornaStatoBottoneGuida(false);
    } else {
        guidaBox.style.display = "block";
        aggiornaStatoBottoneGuida(true);
    }
}

// =========================================================
// RENDERING SCHERMATE (HOME / DRAFT / CLASSIFICA / PROFILO / RECAP)
// =========================================================
function renderWelcomeScreen() {
    ACTIVE_MATCHDAY = getCurrentActiveMatchday();
    DEADLINE_TIMESTAMP = getDeadlineForMatchday(ACTIVE_MATCHDAY);

    document.getElementById("welcome-screen").style.display = "block";
    document.getElementById("main-app").style.display = "none";
    document.getElementById("recap-screen").style.display = "none";
    document.getElementById("classifica-screen").style.display = "none";
    document.getElementById("profilo-screen").style.display = "none";
    document.getElementById("admin-screen").style.display = "none";

    // Mantieni la guida sempre chiusa di default all'ingresso nella Home
    const guidaBox = document.getElementById("guida-4-passi-box");
    if (guidaBox) {
        guidaBox.style.display = "none";
        aggiornaStatoBottoneGuida(false);
    }

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
        const nomeSquadra = sq.nomeSquadra || "Squadra Senza Nome";
        const isLongName = nomeSquadra.length > 18;
        const infoModulo = sq.moduloSelezionato ? ` • Modulo ${sq.moduloSelezionato}` : "";

        item.innerHTML = `
            <div class="team-card-left-content">
                <div class="team-card-icon-box">
                    <i class="fa-solid fa-shirt"></i>
                </div>
                <div class="team-card-info">
                    <div class="team-card-name-wrapper ${isLongName ? 'is-scrolling' : ''}">
                        <span class="team-card-name-scroll ${isLongName ? 'scrolling' : ''}">${nomeSquadra}</span>
                    </div>
                    <span class="team-card-label">${infoModulo}</span>
                    ${punteggioHtml}
                </div>
            </div>
            <div class="team-card-actions">
                <button onclick="apriRecapSquadraUtenteCorrente(${realIndex})" class="btn-team-action">
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
                    <td class="rank-cell" style="color:var(--text-muted);">-</td>
                    <td style="font-weight:700; color:var(--accent-blue); cursor:pointer;" onclick="apriProfiloUtente('${item.userId}')"><div class="marquee-container" style="max-width: 120px;"><span class="marquee-text"><i class="fa-solid fa-user"></i> ${item.username}</span></div></td>
                    <td style="font-weight:800; color:#fff;"><div class="marquee-container" style="max-width: 150px;"><span class="marquee-text">${item.nomeSquadra}</span></div></td>
                    <td style="color:var(--text-muted); font-size:12px;">In attesa voti</td>
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
            return;
        }

        podiumArea.style.display = "";
        if (regolaParitaBox) regolaParitaBox.style.display = "flex";

        tutteSquadreLega.sort((a, b) => {
            if (b.punteggio !== a.punteggio) {
                return b.punteggio - a.punteggio;
            }
            return b.budgetResiduo - a.budgetResiduo;
        });

        let classificaConRango = tutteSquadreLega.map((item, i) => ({
            ...item,
            rank: i + 1
        }));

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
        const cameraOverlay = document.querySelector("#profilo-screen .profilo-header .fa-camera")?.parentElement;
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

        let squadreCreateCount = squadre.length;
        let puntiTotali = 0;
        let migliorPunteggio = 0;
        let budgetSpesoTotale = 0;

        let conteggioGiocatoriUtente = {};
        let conteggioSquadreSerieA = {};

        squadre.forEach(sq => {
            let pts = sq.punteggioTotale !== undefined && sq.punteggioTotale !== null ? sq.punteggioTotale : 0;
            puntiTotali += pts;
            if (pts > migliorPunteggio) migliorPunteggio = pts;

            let budgetResiduo = sq.budget !== undefined && sq.budget !== null ? sq.budget : 800;
            let spesoPerQuestaSquadra = 800 - budgetResiduo;
            if (spesoPerQuestaSquadra < 0) spesoPerQuestaSquadra = 0;
            budgetSpesoTotale += spesoPerQuestaSquadra;

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

        let conteggioModuli = {};
        squadre.forEach(sq => {
            try {
                if (sq.moduloSelezionato) {
                    let modulo = String(sq.moduloSelezionato).trim();
                    if (modulo !== "") {
                        conteggioModuli[modulo] = (conteggioModuli[modulo] || 0) + 1;
                    }
                }
            } catch (errInner) {}
        });

        let moduloPreferito = "Nessuno";
        let maxScelteModulo = 0;
        for (let [mod, count] of Object.entries(conteggioModuli)) {
            if (count > maxScelteModulo) {
                maxScelteModulo = count;
                moduloPreferito = mod;
            }
        }

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

        if (document.getElementById("stat-modulo-preferito")) {
            let testoM = maxScelteModulo > 0 ? `${moduloPreferito} <span style="font-size:14px; color:var(--accent-gold); font-weight:700;">(${maxScelteModulo} ${maxScelteModulo === 1 ? 'volta' : 'volte'})</span>` : "Nessuno";
            document.getElementById("stat-modulo-preferito").innerHTML = testoM;
        }

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

    for (let g = 1; g <= ACTIVE_MATCHDAY; g++) {
        const btn = document.createElement("button");
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
            if (uDoc.exists) {
                username = getRealUsername(uDoc.data(), currentUser);
            } else {
                username = getRealUsername(null, currentUser);
            }
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
        const squadreArr = uData.squadre || [];

        const sq = squadreArr.find(s => s.nomeSquadra.toLowerCase() === nomeSquadra.toLowerCase() && (s.giornata !== undefined ? s.giornata : 8) === parseInt(giornata));
        if (!sq) {
            mostraNotifica("Squadra Non Trovata", "Squadra non trovata per questa giornata.", "warning");
            return;
        }

        if (currentUser && userId === currentUser.uid) {
            currentRecapSquadraIndex = userSquadre.findIndex(s => s.nomeSquadra.toLowerCase() === nomeSquadra.toLowerCase() && (s.giornata !== undefined ? s.giornata : 8) === parseInt(giornata));
        } else {
            currentRecapSquadraIndex = -1;
        }

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
    const isMarketOpenForThisTeam = isMarketOpenForMatchday(giornataSquadra);

    if (isOwner && isMarketOpenForThisTeam && !sq.isTest) {
        btnModifica.style.display = "inline-flex";
    } else {
        btnModifica.style.display = "none";
    }

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
        recapBadge.innerText = `🔒 SQUADRA SALVATA (GIORNATA ${giornataSquadra})`;
    }

    const recapCampo = document.getElementById("recap-campo");
    recapCampo.innerHTML = "";

    creaRepartoCampo(recapCampo, "Portiere", [sq.schierati.find(p => p.ruolo === "Portiere")], true);
    creaRepartoCampo(recapCampo, "Difensore", sq.schierati.filter(p => p.ruolo === "Difensore"), true);
    creaRepartoCampo(recapCampo, "Centrocampista", sq.schierati.filter(p => p.ruolo === "Centrocampista"), true);
    creaRepartoCampo(recapCampo, "Attaccante", sq.schierati.filter(p => p.ruolo === "Attaccante"), true);

    const panchinaDiv = document.getElementById("recap-panchina");
    panchinaDiv.innerHTML = "";

    const hasVoti = !!(sq.votiGiornata && Object.keys(sq.votiGiornata).length > 0);
    const subentratiSet = new Set();
    if (hasVoti) {
        (sq.schierati || []).forEach(tit => {
            const vInfo = sq.votiGiornata[tit.nome];
            const isSenzaVoto = !vInfo || vInfo.sv === true || vInfo.voto === undefined || vInfo.voto === null || vInfo.voto === 0;
            if (isSenzaVoto) {
                const riserveRuolo = (sq.riserveSelezionate && sq.riserveSelezionate[tit.ruolo]) || [];
                for (const ris of riserveRuolo) {
                    if (!subentratiSet.has(ris.nome)) {
                        const risInfo = sq.votiGiornata[ris.nome];
                        if (risInfo && risInfo.sv !== true && risInfo.voto > 0) {
                            subentratiSet.add(ris.nome);
                            break;
                        }
                    }
                }
            }
        });
    }

    ["Portiere", "Difensore", "Centrocampista", "Attaccante"].forEach(ruolo => {
        const riserve = (sq.riserveSelezionate && sq.riserveSelezionate[ruolo]) || [];
        riserve.forEach((ris, i) => {
            const card = document.createElement("div");
            card.className = "recap-bench-card";

            let voteBadgeHtml = "";
            if (hasVoti) {
                const rInfo = sq.votiGiornata[ris.nome];
                const haVoto = rInfo && rInfo.sv !== true && rInfo.voto > 0;
                const votoTxt = haVoto ? `Voto ${rInfo.voto}` : "S.V.";
                const fantaVal = haVoto ? (rInfo.fantavoto > 0 ? rInfo.fantavoto : 0) : 0;
                const fantaTxt = haVoto ? `FV ${fantaVal}` : "FV 0";
                const statoSub = subentratiSet.has(ris.nome)
                    ? `<span style="color:var(--accent-gold); font-weight:700; margin-left:4px;">• Subentrato</span>`
                    : `<span style="color:var(--text-muted); margin-left:4px;">• In panchina</span>`;

                voteBadgeHtml = `
                    <div style="margin-top:4px; font-size:11px; display:flex; align-items:center; flex-wrap:wrap; gap:6px;">
                        <span style="font-weight:800; color:${haVoto ? '#e2e8f0' : 'var(--accent-red)'};">${votoTxt}</span>
                        <span style="font-weight:800; color:var(--accent-blue);">${fantaTxt}</span>
                        ${statoSub}
                    </div>
                `;
            }

            card.innerHTML = `
                <div>
                    <div class="bench-player-meta">
                        <i class="${roleIcons[ruolo]}"></i> ${ruolo} (R${i+1})
                    </div>
                    <div class="bench-player-name">
                        <div class="marquee-container" style="max-width:220px;"><span class="marquee-text">${ris.nome}</span></div>
                    </div>
                    ${voteBadgeHtml}
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

    aggiornaOrdineRecapMobile(hasVoti);
    refreshAllMarquees();
}

function aggiornaOrdineRecapMobile(hasVoti) {
    const recapScreen = document.getElementById("recap-screen");
    const recapContent = recapScreen ? recapScreen.querySelector(".recap-content") : null;
    const votiBox = recapScreen ? recapScreen.querySelector(".voti-box") : null;
    if (!recapScreen || !recapContent || !votiBox) return;

    const isMobile = window.innerWidth <= 768;

    if (isMobile && hasVoti) {
        if (votiBox.nextElementSibling !== recapContent) {
            recapScreen.insertBefore(votiBox, recapContent);
        }
    } else {
        if (recapContent.nextElementSibling !== votiBox) {
            recapScreen.insertBefore(recapContent, votiBox);
        }
    }
}

window.addEventListener("resize", () => {
    const recapScreen = document.getElementById("recap-screen");
    if (recapScreen && recapScreen.style.display !== "none" && currentRecapSquadraObj) {
        const hasVoti = !!(currentRecapSquadraObj.votiGiornata && Object.keys(currentRecapSquadraObj.votiGiornata).length > 0);
        aggiornaOrdineRecapMobile(hasVoti);
    }
});

function tornaAllaHome() {
    const colonnaSinistraDraft = document.querySelector(".desktop-col-left");
    if (colonnaSinistraDraft) colonnaSinistraDraft.style.display = "block";

    const btnCancellaTutto = document.querySelector("#conferma-container button.btn-action-danger");
    if (btnCancellaTutto) btnCancellaTutto.style.display = "inline-flex";

    renderWelcomeScreen();
}

function avviaTestDraft() {
    if (customPlayersList.length < 24) {
        mostraNotifica("Lista Giocatori Non Pronta", "Caricamento giocatori in corso o file <strong>giocatori.xlsx</strong> non valido.", "warning");
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
        mostraNotifica("Mercato Chiuso", `⚠️ Il mercato è chiuso per la <strong>Giornata ${ACTIVE_MATCHDAY}</strong>.`, "warning");
        return;
    }

    const squadreGiornataCorrente = userSquadre.filter(sq => (sq.giornata !== undefined ? sq.giornata : 8) === ACTIVE_MATCHDAY);
    if (squadreGiornataCorrente.length >= 3) {
        mostraNotifica("Gettoni Esauriti", `Hai già utilizzato tutti i 3 gettoni disponibili per la <strong>Giornata ${ACTIVE_MATCHDAY}</strong>!`, "warning");
        return;
    }

    const inputName = document.getElementById("new-team-name-input").value.trim();
    if (!inputName) {
        mostraNotifica("Nome Mancante", "Inserisci un nome per la tua nuova squadra prima di avviare il draft!", "warning");
        return;
    }

    const nomiEsistentiLega = await ottieniNomiSquadreGlobaliGiornata(ACTIVE_MATCHDAY);
    if (nomiEsistentiLega.includes(inputName.toLowerCase())) {
        mostraNotifica("Nome Già In Uso", `❌ Il nome "<strong>${inputName}</strong>" è già stato scelto da un utente per la Giornata ${ACTIVE_MATCHDAY}! Scegli un nome differente.`, "error");
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
    budget = 800;
    turno = 0;
    moduloSelezionato = "";
    rosa = { Portiere: [], Difensore: [], Centrocampista: [], Attaccante: [] };
    schierati = [];
    riserveSelezionate = { Portiere: [], Difensore: [], Centrocampista: [], Attaccante: [] };
    availablePlayers = [...customPlayersList];

    const colonnaSinistraDraft = document.querySelector(".desktop-col-left");
    if (colonnaSinistraDraft) colonnaSinistraDraft.style.display = "block";

    const btnCancellaTutto = document.querySelector("#conferma-container button.btn-action-danger");
    if (btnCancellaTutto) btnCancellaTutto.style.display = "inline-flex";

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
        mostraNotifica("Budget Esaurito", "Impossibile trovare giocatori compatibili con il budget residuo.", "warning");
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
            <div style="width: 100%; min-width: 0;">
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
        mostraNotifica("Mercato Chiuso", "⚠️ Tempo scaduto! Il mercato è chiuso per questa giornata.", "warning");
        return;
    }

    const p = availablePlayers.find(x => x.nome === nome);
    if (!p) return;

    if (rosa[p.ruolo].length >= limits[p.ruolo]) {
        mostraNotifica("Limite Ruolo Raggiunto", `Hai già raggiunto il limite massimo di <strong>${limits[p.ruolo]}</strong> giocatori per il ruolo <strong>${p.ruolo}</strong>!`, "warning");
        return;
    }

    if (p.valore > budget) {
        mostraNotifica("Crediti Insufficienti", `Non hai abbastanza crediti per acquistare <strong>${p.nome}</strong>! Budget residuo: <strong>${budget}</strong>`, "error");
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

    ["Portiere", "Difensore", "Centrocampista", "Attaccante"].forEach(ruolo => {
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
        mostraNotifica("Modulo Mancante", "Scegli prima il modulo tattico prima di schierare i giocatori!", "warning");
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
                mostraNotifica("Posti Esauriti", `Hai già esaurito i posti in campo e le 2 riserve per il ruolo <strong>${ruolo}</strong>!`, "warning");
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
        mostraNotifica("Modulo Mancante", "Scegli prima il modulo tattico prima di schierare i giocatori!", "warning");
        return;
    }

    const giocatoriRuolo = rosa[ruolo];
    if (giocatoriRuolo.length === 0) {
        mostraNotifica("Nessun Giocatore", `Non hai acquistato alcun giocatore nel ruolo: <strong>${ruolo}</strong>`, "warning");
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
            <div class="modulo-selection-header">
                <div class="modulo-selection-badge"><i class="fa-solid fa-chess-board"></i> SCELTA TATTICA</div>
                <h3>${headerTitle}</h3>
                <p>Seleziona il modulo tattico per schierare titolari e riserve:</p>
            </div>
            <div class="modulo-cards-grid">
                ${cardsHtml}
            </div>
            <div style="text-align:center; margin-top:14px;">
                <button onclick="annullaERicominciaDraft()" class="btn-action-danger"><i class="fa-solid fa-trash-can"></i> Scarta Rosa e Ricomincia</button>
            </div>
        </div>
    `;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setModulo(nuovoModulo) {
    if (!isTestMode && !isMarketOpen()) {
        mostraNotifica("Mercato Chiuso", "⚠️ Tempo scaduto! Impossibile impostare la formazione.", "warning");
        return;
    }

    const selectEl = document.getElementById("modulo");
    const valoreScelto = nuovoModulo || (selectEl ? selectEl.value : "");
    if (!valoreScelto) return;

    moduloSelezionato = valoreScelto;
    if (selectEl) selectEl.value = moduloSelezionato;

    document.querySelectorAll(".modulo-card-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.modulo === moduloSelezionato);
    });

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
    if (schierati.length < 11) {
        mostraNotifica("Formazione Incompleta", "Devi schierare tutti gli <strong>11 titolari</strong> prima di confermare!", "warning");
        return;
    }

    if (!haPanchinaCompleta()) {
        mostraNotifica("Panchina Incompleta", "Devi schierare <strong>tutte le 8 riserve</strong> (2 Portieri, 2 Difensori, 2 Centrocampisti e 2 Attaccanti) prima di confermare!", "warning");
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

        let currentUsername = "Test User";
        if (currentUser) {
            try {
                const uDoc = await db.collection("utenti").doc(currentUser.uid).get();
                if (uDoc.exists) currentUsername = getRealUsername(uDoc.data(), currentUser);
                else currentUsername = getRealUsername(null, currentUser);
            } catch (e) {}
        }

        renderRecapScreenReadOnly(squadraTestObj, currentUsername, false);
        return;
    }

    if (!isMarketOpen()) {
        mostraNotifica("Mercato Chiuso", "⚠️ Tempo scaduto! Non è più possibile confermare la formazione.", "warning");
        return;
    }

    const ok = await mostraConferma(
        "Conferma Formazione",
        `Confermi la squadra "<strong>${tempNomeSquadra}</strong>" per la Giornata ${ACTIVE_MATCHDAY}? Questa operazione scalerà 1 Gettone ed è definitiva.`,
        "info",
        "Sì, conferma",
        "No"
    );
    if (!ok) return;

    try {
        const nomiEsistentiLega = await ottieniNomiSquadreGlobaliGiornata(ACTIVE_MATCHDAY);
        if (nomiEsistentiLega.includes(tempNomeSquadra.toLowerCase().trim())) {
            mostraNotifica("Nome Già In Uso", `❌ Un altro utente ha già registrato una squadra chiamata "<strong>${tempNomeSquadra}</strong>" per la Giornata ${ACTIVE_MATCHDAY}! Scegli un nome differente.`, "error");
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
            mostraNotifica("Gettoni Esauriti", `⚠️ Hai già utilizzato tutti i 3 gettoni disponibili per la <strong>Giornata ${ACTIVE_MATCHDAY}</strong>!`, "warning");
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

        mostraNotifica("Formazione Salvata!", `🎉 Squadra "<strong>${tempNomeSquadra}</strong>" convalidata e salvata con successo per la Giornata ${ACTIVE_MATCHDAY}!`, "success");
        document.getElementById("new-team-name-input").value = "";
        await calcolaEVisualizzaTotaleSquadreGlobali(ACTIVE_MATCHDAY);
        renderWelcomeScreen();

    } catch (err) {
        mostraNotifica("Errore Salvataggio", "❌ Errore durante il salvataggio: " + err.message, "error");
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
                            let haGiocato = (rawVotoPuro > 0);

                            if (matchRow && haGiocato) {
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
                        votiObj[p.nome] = { voto: 0, fantavoto: 0, sv: true, gf: 0, gs: 0, ass: 0, au: 0, esp: 0, amm: 0, rp: 0, rs: 0, rf: 0 };
                    });

                    (sq.schierati || []).forEach(tit => {
                        let vInfo = votiObj[tit.nome];
                        let eff = vInfo;

                        let isSenzaVoto = false;
                        if (!vInfo) {
                            isSenzaVoto = true;
                        } else if (vInfo.sv === true) {
                            isSenzaVoto = true;
                        } else if (vInfo.voto === undefined || vInfo.voto === null || vInfo.voto === 0) {
                            isSenzaVoto = true;
                        }

                        if (isSenzaVoto) {
                            let riserveRuolo = (sq.riserveSelezionate || {})[tit.ruolo] || [];
                            let riservaValida = null;

                            for (let ris of riserveRuolo) {
                                if (!riserveGiaSubentrate.has(ris.nome)) {
                                    let risInfo = votiObj[ris.nome];
                                    let risHaVotoValido = risInfo && risInfo.sv !== true && risInfo.voto > 0;
                                    if (risHaVotoValido) {
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

    if (vInfo.gf > 0) { count++; for (let i = 0; i < vInfo.gf; i++) html += `<img src="icone/gol.png" class="fanta-icon-img" alt="Gol">`; }
    if (vInfo.rf > 0) { count++; for (let i = 0; i < vInfo.rf; i++) html += `<img src="icone/rigore_segnato.png" class="fanta-icon-img" alt="Rigore Segnato">`; }
    if (vInfo.gs > 0) { count++; for (let i = 0; i < vInfo.gs; i++) html += `<img src="icone/gol_subito.png" class="fanta-icon-img" alt="Gol Subito">`; }
    if (vInfo.ass > 0) { count++; for (let i = 0; i < vInfo.ass; i++) html += `<img src="icone/assist.png" class="fanta-icon-img" alt="Assist">`; }
    if (vInfo.au > 0) { count++; for (let i = 0; i < vInfo.au; i++) html += `<img src="icone/autogol.png" class="fanta-icon-img" alt="Autogol">`; }
    if (vInfo.rp > 0) { count++; for (let i = 0; i < vInfo.rp; i++) html += `<img src="icone/rigore_parato.png" class="fanta-icon-img" alt="Rigore Parato">`; }
    if (vInfo.rs > 0) { count++; for (let i = 0; i < vInfo.rs; i++) html += `<img src="icone/rigore_sbagliato.png" class="fanta-icon-img" alt="Rigore Sbagliato">`; }
    if (vInfo.amm === 1) { count++; html += `<img src="icone/ammonizione.png" class="fanta-icon-img" alt="Ammonizione">`; }
    else if (vInfo.amm >= 2) { count++; html += `<img src="icone/doppia_ammonizione.png" class="fanta-icon-img" alt="Doppia Ammonizione">`; }
    if (vInfo.esp > 0) { count++; for (let i = 0; i < vInfo.esp; i++) html += `<img src="icone/espulsione.png" class="fanta-icon-img" alt="Espulsione">`; }

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

    (sq.schierati || []).forEach(tit => {
        let vInfo = sq.votiGiornata[tit.nome];
        let eff = vInfo;
        let note = "<span style='color:var(--accent-green)'>Titolare</span>";
        let subentratoSenzaVoto = null;

        let isSenzaVoto = false;
        if (!vInfo || vInfo.sv === true || vInfo.voto === undefined || vInfo.voto === null || vInfo.voto === 0) {
            isSenzaVoto = true;
        }

        if (isSenzaVoto) {
            let riserveRuolo = (sq.riserveSelezionate || {})[tit.ruolo] || [];
            let riservaValida = null;

            for (let ris of riserveRuolo) {
                if (!riserveGiaSubentrate.has(ris.nome)) {
                    let risInfo = sq.votiGiornata[ris.nome];
                    let risHaVotoValido = risInfo && risInfo.sv !== true && risInfo.voto > 0;
                    if (risHaVotoValido) {
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
                eff = { voto: 0, fantavoto: 0, sv: true, gf: 0, gs: 0, ass: 0, au: 0, esp: 0, amm: 0, rp: 0, rs: 0, rf: 0 };

                const riservaSv = riserveRuolo.find(ris => {
                    if (riserveGiaSubentrate.has(ris.nome)) return false;
                    const rInfo = sq.votiGiornata[ris.nome];
                    return !rInfo || rInfo.sv === true || rInfo.voto === undefined || rInfo.voto === null || rInfo.voto === 0;
                });
                if (riservaSv) {
                    riserveGiaSubentrate.add(riservaSv.nome);
                    subentratoSenzaVoto = riservaSv;
                }
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

        if (subentratoSenzaVoto) {
            html += `<tr style="background: rgba(245, 158, 11, 0.06);">
                <td><i class="${roleIcons[tit.ruolo]}"></i></td>
                <td><div class="marquee-container" style="max-width: 140px;"><span class="marquee-text"><strong>${subentratoSenzaVoto.nome}</strong></span></div></td>
                <td><span style='color:var(--accent-gold)'>🔁 Subentrato (S.V.)</span></td>
                <td><strong style="color:var(--accent-red);">S.V.</strong></td>
                <td><span style="color:var(--text-muted); font-size:10px;">-</span></td>
                <td><strong style="color:var(--accent-blue);">0</strong></td>
            </tr>`;
        }
    });

    html += `</tbody></table>
    <div class="totale-punteggio">🏆 Totale Squadra: ${sq.punteggioTotale !== null ? sq.punteggioTotale : totale} Punti</div>`;

    container.innerHTML = html;
    refreshAllMarquees();
}

// ==========================================
// GESTIONE FOTO PROFILO (BASE64)
// ==========================================

async function caricaNuovaFotoProfiloBase64(event) {
    if (!isViewingOwnProfile) {
        mostraNotifica("Azione Non Consentita", "⛔ Non puoi modificare la foto del profilo di un altro utente.", "error");
        event.target.value = "";
        return;
    }

    const file = event.target.files[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        mostraNotifica("Formato Non Valido", "Puoi caricare solo immagini <strong>JPG</strong>, <strong>PNG</strong> o <strong>WEBP</strong>.", "warning");
        event.target.value = "";
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.src = e.target.result;

        img.onload = async function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const MAX_SIZE = 150;

            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
            } else {
                if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            const base64String = canvas.toDataURL('image/jpeg', 0.75);

            try {
                if (!currentUser) {
                    mostraNotifica("Sessione Scaduta", "Errore: utente non autenticato.", "error");
                    return;
                }

                await db.collection("utenti").doc(currentUser.uid).update({
                    photoURL: base64String
                });

                aggiornaAvatarGrafica(base64String);

                const uDoc = await db.collection("utenti").doc(currentUser.uid).get();
                if (uDoc.exists) renderizzaTraguardi(uDoc.data());

                mostraNotifica("Foto Aggiornata", "📸 Foto profilo aggiornata con successo!", "success");

            } catch (err) {
                mostraNotifica("Errore Salvataggio", "Errore nel salvataggio sul database: " + err.message, "error");
            }
        };
    };
    reader.readAsDataURL(file);
}

function aggiornaAvatarGrafica(url) {
    const profImg = document.getElementById("profilo-avatar-img");
    const navImg = document.getElementById("user-avatar-navbar");
    const navIcon = document.getElementById("user-icon-fallback");
    const userBadge = document.querySelector(".user-badge");

    if (url && url.trim() !== "") {
        if (profImg) profImg.src = url;

        if (navImg) {
            navImg.src = url;
            navImg.style.display = "inline-block";
        } else if (userBadge) {
            let iconaBadge = userBadge.querySelector("i.fa-user");
            if (iconaBadge) iconaBadge.style.display = "none";

            let existingImg = userBadge.querySelector("img#user-avatar-navbar");
            if (!existingImg) {
                const newImg = document.createElement("img");
                newImg.id = "user-avatar-navbar";
                newImg.src = url;
                newImg.alt = "Avatar";
                newImg.style.width = "26px";
                newImg.style.height = "26px";
                newImg.style.borderRadius = "50%";
                newImg.style.objectFit = "cover";
                newImg.style.marginRight = "6px";
                userBadge.insertBefore(newImg, userBadge.firstChild);
            } else {
                existingImg.src = url;
                existingImg.style.display = "inline-block";
            }
        }

        if (navIcon) {
            navIcon.style.display = "none";
        }
    } else {
        if (profImg) profImg.src = "https://via.placeholder.com/60";
        if (navImg) navImg.style.display = "none";
        if (navIcon) navIcon.style.display = "inline-block";

        if (userBadge) {
            let iconaBadge = userBadge.querySelector("i.fa-user");
            if (iconaBadge) iconaBadge.style.display = "inline-block";
            let existingImg = userBadge.querySelector("img#user-avatar-navbar");
            if (existingImg) existingImg.style.display = "none";
        }
    }
}

// ==========================================
// ROUTING RAPIDO DALLA HOME ALLE MISSIONI
// ==========================================

async function vaiAMissioniProfilo() {
    if (!currentUser) return;

    await apriProfiloUtente(currentUser.uid);

    setTimeout(() => {
        const targetSection = document.getElementById("badge-grid-container");
        if (targetSection) {
            targetSection.scrollIntoView({ behavior: 'smooth', block: 'center' });

            const parentCard = targetSection.closest('.profilo-section-card') || targetSection.parentElement;
            if (parentCard) {
                parentCard.style.transition = "transform 0.3s, border-color 0.3s";
                parentCard.style.borderColor = "#a78bfa";
                parentCard.style.transform = "scale(1.02)";
                setTimeout(() => {
                    parentCard.style.transform = "scale(1)";
                    parentCard.style.borderColor = "rgba(255,255,255,0.05)";
                }, 600);
            }
        }
    }, 150);
}

// ==========================================
// GESTIONE TRAGUARDI (ALTA LEGGIBILITÀ)
// ==========================================

function renderizzaTraguardi(uData) {
    const container = document.getElementById("badge-grid-container");
    if (!container) return;
    container.innerHTML = "";

    const squadre = (uData && uData.squadre) ? uData.squadre : [];
    const numSquadre = squadre.length;
    const haFoto = uData && uData.photoURL && uData.photoURL.trim() !== "";

    const listaTraguardi = [
        {
            id: "primo_scatto",
            titolo: "Primo Scatto",
            descrizione: "Carica la tua foto profilo personalizzata",
            icona: "fa-solid fa-camera",
            colore: "var(--accent-blue)",
            sbloccato: haFoto,
            attuale: haFoto ? 1 : 0,
            target: 1
        },
        {
            id: "squadre_50",
            titolo: "Mister Esperto",
            descrizione: "Crea e salva 50 squadre",
            icona: "fa-solid fa-shield-halved",
            colore: "#38bdf8",
            sbloccato: numSquadre >= 50,
            attuale: numSquadre,
            target: 50
        },
        {
            id: "squadre_100",
            titolo: "Centurione",
            descrizione: "Crea e salva 100 squadre",
            icona: "fa-solid fa-trophy",
            colore: "var(--accent-gold)",
            sbloccato: numSquadre >= 100,
            attuale: numSquadre,
            target: 100
        },
        {
            id: "squadre_500",
            titolo: "Leggenda della Panchina",
            descrizione: "Crea e salva 500 squadre",
            icona: "fa-solid fa-crown",
            colore: "#a78bfa",
            sbloccato: numSquadre >= 500,
            attuale: numSquadre,
            target: 500
        },
        {
            id: "squadre_1000",
            titolo: "Mitico 1000",
            descrizione: "Raggiungi quota 1000 squadre iscritte!",
            icona: "fa-solid fa-fire-flame-curved",
            colore: "#f43f5e",
            sbloccato: numSquadre >= 1000,
            attuale: numSquadre,
            target: 1000
        }
    ];

    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "10px";

    listaTraguardi.forEach(t => {
        const item = document.createElement("div");
        item.style.display = "flex";
        item.style.alignItems = "center";
        item.style.justifyContent = "space-between";
        item.style.padding = "12px 14px";
        item.style.borderRadius = "10px";
        item.style.background = t.sbloccato ? "rgba(15, 23, 42, 0.85)" : "rgba(15, 23, 42, 0.35)";
        item.style.border = t.sbloccato ? `1px solid ${t.colore}` : "1px solid rgba(255,255,255,0.08)";
        item.style.opacity = t.sbloccato ? "1" : "0.75";
        item.style.gap = "12px";

        let badgeProgresso = t.sbloccato
            ? `<div style="background: rgba(16, 185, 129, 0.15); border: 1px solid var(--accent-neon-green); color: var(--accent-neon-green); font-size: 11px; font-weight: 800; padding: 6px 12px; border-radius: 8px; white-space: nowrap;">✔ SBLOCCATO</div>`
            : `<div style="background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(255,255,255,0.1); color: #fff; font-size: 12px; font-weight: 800; padding: 6px 12px; border-radius: 8px; white-space: nowrap; text-align: center;">${t.attuale} / ${t.target}</div>`;

        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
                <div style="width: 40px; height: 40px; min-width: 40px; border-radius: 8px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; font-size: 18px; color: ${t.sbloccato ? t.colore : 'var(--text-muted)'};">
                    <i class="${t.icona}"></i>
                </div>
                <div style="display: flex; flex-direction: column; gap: 2px; overflow: hidden;">
                    <div style="font-size: 13px; font-weight: 800; color: #fff; line-height: 1.2;">${t.titolo}</div>
                    <div style="font-size: 11px; color: #94a3b8; line-height: 1.3;">${t.descrizione}</div>
                </div>
            </div>

            <div>
                ${badgeProgresso}
            </div>
        `;

        container.appendChild(item);
    });
}

// ==========================================
// LOGICA MODIFICA FORMAZIONE SALVATA
// ==========================================

function avviaModificaFormazioneSalvata() {
    if (!currentRecapSquadraObj) return;

    const sq = currentRecapSquadraObj;
    const giornataSquadra = sq.giornata !== undefined ? sq.giornata : ACTIVE_MATCHDAY;

    if (giornataSquadra < ACTIVE_MATCHDAY) {
        mostraNotifica("Giornata Conclusa", "❌ Impossibile modificare le formazioni delle giornate precedenti o concluse.", "error");
        return;
    }

    if (!isMarketOpenForMatchday(giornataSquadra)) {
        mostraNotifica("Mercato Chiuso", "⚠️ Tempo scaduto! Il mercato è chiuso e le formazioni sono bloccate per questo turno.", "warning");
        return;
    }

    rosa = JSON.parse(JSON.stringify(sq.rosa || { Portiere: [], Difensore: [], Centrocampista: [], Attaccante: [] }));
    schierati = JSON.parse(JSON.stringify(sq.schierati || []));
    riserveSelezionate = JSON.parse(JSON.stringify(sq.riserveSelezionate || { Portiere: [], Difensore: [], Centrocampista: [], Attaccante: [] }));
    moduloSelezionato = sq.moduloSelezionato;
    budget = sq.budget !== undefined ? sq.budget : 800;
    tempNomeSquadra = sq.nomeSquadra;
    isTestMode = false;

    const colonnaSinistraDraft = document.querySelector(".desktop-col-left");
    if (colonnaSinistraDraft) {
        colonnaSinistraDraft.style.display = "none";
    }

    document.getElementById("welcome-screen").style.display = "none";
    document.getElementById("recap-screen").style.display = "none";
    document.getElementById("main-app").style.display = "flex";
    document.getElementById("admin-screen").style.display = "none";

    document.getElementById("current-draft-team-title").innerText = `Modifica Formazione: ${sq.nomeSquadra} (G${giornataSquadra})`;

    document.getElementById("campo-panel-container").style.display = "block";
    document.getElementById("panchina-panel-container").style.display = "block";
    document.getElementById("conferma-container").style.display = "flex";

    const btnCancellaTutto = document.querySelector("#conferma-container button.btn-action-danger");
    if (btnCancellaTutto) {
        btnCancellaTutto.style.display = "none";
    }

    const btnConferma = document.getElementById("btn-conferma-formazione");
    btnConferma.onclick = salvaModificaFormazioneSuCloud;
    btnConferma.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Salva Modifiche Formazione`;

    ripristinaCampoTattico();
    renderSlots();
    renderPanchinaGrafica();

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function salvaModificaFormazioneSuCloud() {
    const btnCancellaTutto = document.querySelector("#conferma-container button.btn-action-danger");
    if (btnCancellaTutto) {
        btnCancellaTutto.style.display = "inline-flex";
    }

    const colonnaSinistraDraft = document.querySelector(".desktop-col-left");
    if (colonnaSinistraDraft) {
        colonnaSinistraDraft.style.display = "block";
    }

    if (!currentRecapSquadraObj) return;
    const giornataSquadra = currentRecapSquadraObj.giornata !== undefined ? currentRecapSquadraObj.giornata : ACTIVE_MATCHDAY;

    if (!isMarketOpenForMatchday(giornataSquadra)) {
        mostraNotifica("Mercato Chiuso", "⚠️ Tempo scaduto! Il mercato ha chiuso durante le tue modifiche. Le modifiche non sono state salvate.", "warning");
        tornaAllaHome();
        return;
    }

    if (schierati.length < 11) {
        mostraNotifica("Formazione Incompleta", "Devi schierare tutti gli <strong>11 titolari</strong>!", "warning");
        return;
    }

    if (!haPanchinaCompleta()) {
        mostraNotifica("Panchina Incompleta", "Devi schierare <strong>tutte le 8 riserve</strong> (2 per ruolo) prima di salvare le modifiche!", "warning");
        return;
    }

    const ok = await mostraConferma(
        "Salva Modifiche",
        `Confermi le modifiche alla formazione di "<strong>${tempNomeSquadra}</strong>"?`,
        "info",
        "Sì, salva",
        "No"
    );
    if (!ok) return;

    try {
        const userDocRef = db.collection("utenti").doc(currentUser.uid);
        const docSnapshot = await userDocRef.get();

        if (!docSnapshot.exists) {
            mostraNotifica("Errore Utente", "Utente non trovato nel database.", "error");
            return;
        }

        let squadreEsistenti = docSnapshot.data().squadre || [];

        let indexTarget = currentRecapSquadraIndex;
        if (indexTarget === -1 || indexTarget >= squadreEsistenti.length) {
            indexTarget = squadreEsistenti.findIndex(s => s.nomeSquadra.toLowerCase() === tempNomeSquadra.toLowerCase() && (s.giornata !== undefined ? s.giornata : ACTIVE_MATCHDAY) === giornataSquadra);
        }

        if (indexTarget === -1) {
            mostraNotifica("Squadra Non Trovata", "Errore: Squadra non trovata nel database.", "error");
            return;
        }

        squadreEsistenti[indexTarget].schierati = JSON.parse(JSON.stringify(schierati));
        squadreEsistenti[indexTarget].riserveSelezionate = JSON.parse(JSON.stringify(riserveSelezionate));
        squadreEsistenti[indexTarget].moduloSelezionato = moduloSelezionato;
        squadreEsistenti[indexTarget].modificataIl = new Date();

        userSquadre = squadreEsistenti;

        await userDocRef.update({ squadre: userSquadre });

        mostraNotifica("Modifiche Salvate", "✅ Formazione aggiornata con successo!", "success");

        document.getElementById("btn-conferma-formazione").onclick = confermaFormazioneDefinitiva;

        const draftPanel = document.getElementById("draft-panel");
        if (draftPanel) draftPanel.style.display = "block";

        apriRecapSquadraUtenteCorrente(indexTarget);

    } catch (err) {
        mostraNotifica("Errore Aggiornamento", "❌ Errore durante l'aggiornamento: " + err.message, "error");
    }
}

// ==========================================
// LOGICA PANNELLO ADMIN & BACKOFFICE
// ==========================================

async function controllaRuoloAdmin(uData) {
    const adminBtn = document.getElementById("admin-nav-button");
    if (uData && uData.isAdmin === true) {
        if (adminBtn) adminBtn.style.display = "inline-flex";
    } else {
        if (adminBtn) adminBtn.style.display = "none";
    }
}

async function apriPannelloAdmin() {
    if (!currentUser) return;

    try {
        const uDoc = await db.collection("utenti").doc(currentUser.uid).get();
        if (!uDoc.exists || uDoc.data().isAdmin !== true) {
            mostraNotifica("Accesso Negato", "⛔ Non disponi dei privilegi di amministratore.", "error");
            return;
        }
    } catch (e) {
        mostraNotifica("Errore Permessi", "Errore di verifica permessi.", "error");
        return;
    }

    document.getElementById("welcome-screen").style.display = "none";
    document.getElementById("main-app").style.display = "none";
    document.getElementById("recap-screen").style.display = "none";
    document.getElementById("classifica-screen").style.display = "none";
    document.getElementById("profilo-screen").style.display = "none";
    document.getElementById("admin-screen").style.display = "block";

    window.scrollTo({ top: 0, behavior: 'smooth' });
    caricaStatisticheAdmin();
}

async function caricaStatisticheAdmin() {
    try {
        const snap = await db.collection("utenti").get();
        let totaleUtenti = snap.size;
        let totaleSquadre = 0;

        snap.forEach(doc => {
            const squadre = doc.data().squadre || [];
            totaleSquadre += squadre.length;
        });

        const elUtenti = document.getElementById("admin-stat-utenti");
        const elSquadre = document.getElementById("admin-stat-squadre");

        if (elUtenti) elUtenti.innerText = totaleUtenti;
        if (elSquadre) elSquadre.innerText = totaleSquadre;
    } catch (e) {
        console.error("Errore caricamento statistiche admin:", e);
    }
}

async function adminEseguiRicalcoloGiornata() {
    const gInput = parseInt(document.getElementById("admin-input-giornata").value);
    if (isNaN(gInput) || gInput < 1) {
        mostraNotifica("Giornata Non Valida", "Inserisci un numero di giornata valido.", "warning");
        return;
    }

    await ricalcolaTuttaLaGiornata(gInput);
}

async function ricalcolaTuttaLaGiornata(giornata) {
    const ok = await mostraConferma(
        "Forza Ricalcolo",
        `Vuoi forzare il ricalcolo e la sovrascrittura dei punteggi per <strong>TUTTE</strong> le squadre della Giornata ${giornata}?`,
        "warning",
        "Sì, ricalcola",
        "No"
    );
    if (!ok) return;

    try {
        mostraNotifica("Ricalcolo In Corso", `🔄 Avvio ricalcolo massivo per la <strong>Giornata ${giornata}</strong>...`, "info");

        const fileName = `voti_ok${giornata}.xlsx`;
        let fileResponse;
        try {
            fileResponse = await fetch(fileName);
            if (!fileResponse.ok) throw new Error("File non trovato");
        } catch (e) {
            mostraNotifica("File Voti Mancante", `❌ Impossibile trovare il file "<strong>${fileName}</strong>" nella directory principale. Assicurati di averlo caricato.`, "error");
            return;
        }

        let arrayBuffer = await fileResponse.arrayBuffer();
        let workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
        let nomeFoglioVoti = workbook.SheetNames.find(s => s.trim().toLowerCase() === "voti") || workbook.SheetNames[0];
        let rows = XLSX.utils.sheet_to_json(workbook.Sheets[nomeFoglioVoti]);

        const snapshot = await db.collection("utenti").get();
        let squadreAggiornateTotali = 0;

        for (const docUser of snapshot.docs) {
            let uData = docUser.data();
            let squadreArr = uData.squadre || [];
            let modificato = false;

            squadreArr.forEach(sq => {
                let giornataSquadra = sq.giornata !== undefined ? sq.giornata : 8;

                if (giornataSquadra === giornata) {
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
                            let haGiocato = (rawVotoPuro > 0);

                            if (haGiocato) {
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
                        votiObj[p.nome] = { voto: 0, fantavoto: 0, sv: true, gf: 0, gs: 0, ass: 0, au: 0, esp: 0, amm: 0, rp: 0, rs: 0, rf: 0 };
                    });

                    (sq.schierati || []).forEach(tit => {
                        let vInfo = votiObj[tit.nome];
                        let eff = vInfo;
                        let isSenzaVoto = false;

                        if (!vInfo || vInfo.sv === true || vInfo.voto === undefined || vInfo.voto === null || vInfo.voto === 0) {
                            isSenzaVoto = true;
                        }

                        if (isSenzaVoto) {
                            let riserveRuolo = (sq.riserveSelezionate || {})[tit.ruolo] || [];
                            let riservaValida = null;

                            for (let ris of riserveRuolo) {
                                if (!riserveGiaSubentrate.has(ris.nome)) {
                                    let risInfo = votiObj[ris.nome];
                                    let risHaVotoValido = risInfo && risInfo.sv !== true && risInfo.voto > 0;
                                    if (risHaVotoValido) {
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
                    squadreAggiornateTotali++;
                }
            });

            if (modificato) {
                await db.collection("utenti").doc(docUser.id).update({ squadre: squadreArr });
            }
        }

        if (currentUser) {
            await caricaDatiUtenteCloud();
        }

        mostraNotifica("Ricalcolo Completato", `✅ Ricalcolo completato con successo! Aggiornate <strong>${squadreAggiornateTotali}</strong> squadre per la Giornata ${giornata}.`, "success");
        caricaStatisticheAdmin();

    } catch (err) {
        mostraNotifica("Errore Ricalcolo", "❌ Errore durante il ricalcolo massivo: " + err.message, "error");
    }
}

function mostraNotifica(titolo, messaggio, tipo = 'info') {
    const modal = document.getElementById('custom-alert-modal');
    const box = document.getElementById('custom-alert-box');
    const icon = document.getElementById('custom-alert-icon');
    const titleEl = document.getElementById('custom-alert-title');
    const msgEl = document.getElementById('custom-alert-message');

    box.classList.remove('alert-type-error', 'alert-type-success', 'alert-type-warning', 'alert-type-info');
    box.classList.add(`alert-type-${tipo}`);

    if (tipo === 'error') {
        icon.className = 'fa-solid fa-triangle-exclamation';
    } else if (tipo === 'success') {
        icon.className = 'fa-solid fa-circle-check';
    } else if (tipo === 'warning') {
        icon.className = 'fa-solid fa-circle-exclamation';
    } else {
        icon.className = 'fa-solid fa-circle-info';
    }

    titleEl.textContent = titolo;
    msgEl.innerHTML = messaggio;
    modal.style.display = 'flex';
}

function chiudiNotificaPersonalizzata() {
    document.getElementById('custom-alert-modal').style.display = 'none';
}

// ==========================================
// MODALE DI CONFERMA SÌ / NO PERSONALIZZATA
// ==========================================

let confirmResolver = null;

function mostraConferma(titolo, messaggio, tipo = 'warning', testoSi = 'Sì', testoNo = 'No') {
    return new Promise((resolve) => {
        confirmResolver = resolve;

        const modal = document.getElementById('custom-confirm-modal');
        const box = document.getElementById('custom-confirm-box');
        const icon = document.getElementById('custom-confirm-icon');
        const titleEl = document.getElementById('custom-confirm-title');
        const msgEl = document.getElementById('custom-confirm-message');
        const btnYes = document.getElementById('custom-confirm-yes');
        const btnNo = document.getElementById('custom-confirm-no');

        box.classList.remove('alert-type-error', 'alert-type-success', 'alert-type-warning', 'alert-type-info');
        box.classList.add(`alert-type-${tipo}`);

        if (tipo === 'error') {
            icon.className = 'fa-solid fa-triangle-exclamation';
        } else if (tipo === 'success') {
            icon.className = 'fa-solid fa-circle-check';
        } else if (tipo === 'warning') {
            icon.className = 'fa-solid fa-circle-question';
        } else {
            icon.className = 'fa-solid fa-circle-info';
        }

        titleEl.textContent = titolo;
        msgEl.innerHTML = messaggio;
        btnYes.innerHTML = `<i class="fa-solid fa-check"></i> ${testoSi}`;
        btnNo.innerHTML = `<i class="fa-solid fa-xmark"></i> ${testoNo}`;

        modal.style.display = 'flex';
    });
}

function rispondiConferma(scelta) {
    const modal = document.getElementById('custom-confirm-modal');
    if (modal) modal.style.display = 'none';

    if (typeof confirmResolver === 'function') {
        const resolveFn = confirmResolver;
        confirmResolver = null;
        resolveFn(Boolean(scelta));
    }
}

function haPanchinaCompleta() {
    const ruoli = ["Portiere", "Difensore", "Centrocampista", "Attaccante"];
    return ruoli.every(ruolo => Array.isArray(riserveSelezionate[ruolo]) && riserveSelezionate[ruolo].length >= 2);
}