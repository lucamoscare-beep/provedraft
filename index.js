const functions = require("firebase-functions");
const admin = require("firebase-admin");
const path = require("path");
const XLSX = require("xlsx");
admin.initializeApp();
const db = admin.firestore();

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

exports.calcolaVotiAutomatici = functions.storage.object().onFinalize(async (object) => {
    const filePath = object.name; 
    
    // Controlla se il file caricato o sovrascritto è quello dei voti
    if (!filePath.endsWith("voti_ok.xlsx") && !filePath.endsWith("voti_ok.xls")) {
        return null;
    }

    console.log("📥 Rivelato nuovo file voti. Avvio calcolo automatico per tutte le squadre...");

    try {
        const bucket = admin.storage().bucket(object.bucket);
        const tempFilePath = path.join("/tmp", path.basename(filePath));
        await bucket.file(filePath).download({ destination: tempFilePath });

        const workbook = XLSX.readFile(tempFilePath);
        let nomeFoglioVoti = workbook.SheetNames.find(s => s.trim().toLowerCase() === "voti") || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[nomeFoglioVoti];
        const rows = XLSX.utils.sheet_to_json(worksheet);

        const usersSnapshot = await db.collection("utenti").get();

        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            let squadreArr = userData.squadre || [];
            let modificato = false;

            squadreArr.forEach(sq => {
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
            });

            if (modificato) {
                await db.collection("utenti").doc(userDoc.id).update({ squadre: squadreArr });
            }
        }

        console.log("✅ Calcolo automatico completato con successo per tutte le squadre della lega!");
        return null;
    } catch (error) {
        console.error("❌ Errore durante il calcolo automatico dei voti:", error);
        return null;
    }
});