exports.handler = async function(event, context) {
    try {
        // 1. URL della fonte da cui recuperare i dati (es. API/JSON o pagina pubblica)
        const targetUrl = "https://raw.githubusercontent.com/outout/fantacalcio-api/main/voti_giornata_1.json";
        
        // 2. Il server Netlify esegue la richiesta (senza i blocchi CORS del browser)
        const response = await fetch(targetUrl);
        
        if (!response.ok) {
            throw new Error(`Errore HTTP: ${response.status}`);
        }

        const data = await response.json();

        // 3. Restituisce i dati al tuo sito con gli intestatari CORS aperti
        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*", // Permette la chiamata dal tuo frontend
                "Access-Control-Allow-Headers": "Content-Type"
            },
            body: JSON.stringify(data)
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};