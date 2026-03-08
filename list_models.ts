
import dotenv from "dotenv";

dotenv.config();

async function listModels() {
    const apiKey = process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        console.error("No API key found in .env");
        return;
    }

    try {
        console.log("Checking v1beta models...");
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await fetch(url);
        const data: any = await response.json();

        console.log("=== Available Models (v1beta) ===");
        if (data.models) {
            data.models.forEach((m: any) => {
                if (m.supportedGenerationMethods.includes('bidiGenerateContent')) {
                    console.log(`[LIVE SUPPORT] - ${m.name}`);
                } else {
                    console.log(`- ${m.name}`);
                }
            });
        } else {
            console.log("No models returned or error:", data);
        }

        console.log("\nChecking v1alpha models...");
        const urlAlpha = `https://generativelanguage.googleapis.com/v1alpha/models?key=${apiKey}`;
        const responseAlpha = await fetch(urlAlpha);
        const dataAlpha: any = await responseAlpha.json();

        console.log("=== Available Models (v1alpha) ===");
        if (dataAlpha.models) {
            dataAlpha.models.forEach((m: any) => {
                if (m.supportedGenerationMethods.includes('bidiGenerateContent')) {
                    console.log(`[LIVE SUPPORT] - ${m.name}`);
                } else {
                    console.log(`- ${m.name}`);
                }
            });
        } else {
            console.log("No models returned or error:", dataAlpha);
        }

    } catch (e) {
        console.error("List models failed:", e);
    }
}

listModels();
