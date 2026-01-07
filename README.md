
# Tactico Developer Guide

Welcome to **Tactico by Bukola**! This guide is designed to help developers understand the codebase, architecture, and how to customize the application—with a special focus on the AI integration.

## Project Overview

**Tactico** is a modern, interactive football (soccer) tactic board built with:
- **React (Vite)**: For a fast, component-based UI.
- **TypeScript**: For type safety and better developer experience.
- **Tailwind CSS**: For rapid, utility-first styling.
- **Ollama (Local AI)**: For generating instant tactical analysis without external APIs.

The application allows users to drag-and-drop players, draw tactical lines/arrows/areas, link players dynamically, and receive AI-powered insights on their setup.

---

## Project Structure

- **`App.tsx`**: The heart of the application. Handles:
  - Global state (players, drawings, tools, settings).
  - Event listeners (pointer down/move/up for drawing and dragging).
  - UI layout (Header, Sidebar, Canvas, Footer).
- **`types.ts`**: Defines core data models (`Player`, `Drawing`, `Tool`, `Team`). **Start here** to understand the data shape.
- **`constants.ts`**: Configuration for pitch dimensions, initial coordinates, colors, and formation templates.
- **`ollamaService.ts`**: The bridge to your local AI model.
- **`components/PitchLayer.tsx`**: A pure SVG component that renders the green pitch background and markings.

---

## Core Concepts

### 1. The Coordinate System
The board uses an SVG coordinate system defined in `constants.ts` (`PITCH_DIMENSIONS`).
- **Dragging**: Logic in `handlePointerMove` calculates delta positions relative to the SVG container.
- **Drawings**: Lines, polygons, and arrows are arrays of `{x, y}` points stored in the `drawings` state.

### 2. The Tool System
Tools are defined in the `Tool` enum (`types.ts`).
- **`Tool.SELECT`**: Allows dragging players and the ball.
- **`Tool.PEN`, `Tool.ARROW`, `Tool.TRIANGLE`**: Create static SVG paths/polygons.
- **`Tool.LINK`**: Creates dynamic relationships between players.
  - *2 Players*: Dotted line.
  - *3+ Players*: Polygon area.
  - *Implementation*: Stores `playerIds` instead of fixed points, so the graphic updates automatically when players move.

---

## AI Integration (Ollama)

This is the most advanced feature of Tactico. It uses **Ollama** running locally on the user's machine to analyze the board state.

### How it works (`ollamaService.ts`)
1.  **Data Capture**: The app captures the current state of:
    - Home/Away player positions.
    - Active drawings (arrows, areas).
2.  **Prompt Engineering**: It constructs a text prompt describing the scene (e.g., *"Home Team Player 9 is at x:500, y:200..."*).
3.  **API Call**: Sends a `POST` request to `http://localhost:11434/api/generate`.
4.  **Model**: Currently defaults to `moondream:latest`.

### Customizing the AI

#### 1. Changing the Model
To use a different model (e.g., `llama3`, `mistral`, `gemma`), edit `ollamaService.ts`:

```typescript
// ollamaService.ts
const modelName = "llama3"; // Change this string
```
*Note: Ensure the user has pulled the model via `ollama pull <modelname>`.*

#### 2. Tuning the Persona
You can modify the `systemInstruction` variable to change how the AI behaves.
- **Current**: "Elite tactical analyst (UEFA Pro License level)."
- **Example Modification**: Change it to "A sarcastic commentator" or "A beginner coach explaining basics."

#### 3. Analyzing More Data
Currently, we send simplified position data. To make the AI smarter, you could include:
- **Player Roles**: Send `{ role: p.role }` in the prompt so the AI knows "Player 1 is a GK".
- **Distances**: Pre-calculate distances between key defenders and send that as "Context".

---

## Customization & Theming

### Pitch Dimensions & Colors
Modify `constants.ts`:
```typescript
export const PITCH_DIMENSIONS = { width: 1200, height: 800 }; // Resize board
export const PITCH_COLORS = { home: '#ff0000', away: '#0000ff' }; // Change team colors
```

### Adding New Formations
Add to `FORMATION_TEMPLATES` in `constants.ts`. The keys (e.g., `'4-4-2'`) will automatically appear in the dropdown menu.

---

## Contributing Checklist

1.  **Type Safety**: Always add new shapes to the `Drawing` interface in `types.ts`.
2.  **Performance**: The board re-renders on every mouse move. Avoid heavy computations in `App.tsx` body; wraps handy handlers in `useCallback`.
3.  **Linting**: Ensure no unused imports or variables before committing.

Happy Coding!
