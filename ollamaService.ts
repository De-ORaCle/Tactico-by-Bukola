
import { Player, Drawing } from "./types";

export const analyzeTactic = async (players: Player[], drawings: Drawing[]) => {
  // Default to moondream:latest since the user has it, or fallback to a common small model.
  // Ideally, this should be configurable or detected.
  const modelName = "moondream:latest"; 
  
  const systemInstruction = `
    You are an elite football tactical analyst (UEFA Pro License level). 
    You will be given a JSON representation of a tactical board (player positions and drawings like passes/runs).
    Analyze the formation, potential pressing traps, passing lanes, and offensive transitions.
    Keep the analysis punchy, professional, and actionable.
    Use Markdown for formatting.
  `;

  const prompt = `
    ${systemInstruction}

    Current Pitch State:
    Home Team Players: ${JSON.stringify(players.filter(p => p.team === 'home').map(p => ({ n: p.number, pos: p.position })))}
    Away Team Players: ${JSON.stringify(players.filter(p => p.team === 'away').map(p => ({ n: p.number, pos: p.position })))}
    Tactical Markings (Arrows/Areas): ${JSON.stringify(drawings.map(d => ({ type: d.type, points: d.points })))}

    Please provide:
    1. Formation identification for both sides.
    2. One key defensive risk.
    3. One key offensive opportunity based on current positions and markings.
    4. A coaching tip for the Home team.
  `;

  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        prompt: prompt,
        stream: false, // For simplicity, we turn off streaming.
        options: {
          temperature: 0.7,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response || "No analysis generated.";
  } catch (error) {
    console.error("Ollama Error:", error);
    return "Failed to connect to the local AI engine. Ensure Ollama is running (moondream:latest).";
  }
};
