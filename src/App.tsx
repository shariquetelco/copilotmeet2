import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import CopilotDot from "@/components/copilot/CopilotDot";
import { useCopilotStore } from "@/store/copilotStore";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <>
    <main className="container">
      <h1 className="text-4xl font-bold text-blue-500">Welcome to Tauri + React</h1>

      <div className="row">
        <a href="https://vite.dev" target="_blank">
          <img src="/vite.svg" className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <p>Click on the Tauri, Vite, and React logos to learn more.</p>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button type="submit">Greet</button>
      </form>
      <p>{greetMsg}</p>
    </main>
    <CopilotDot />
    <StateTestButtons />
    </>
  );
}

function StateTestButtons() {
  const setState = useCopilotStore((s) => s.setState);
  return (
    <div className="fixed bottom-4 left-4 flex gap-2 z-50">
      <button onClick={() => setState("idle")} className="px-3 py-1 bg-neutral-700 text-white rounded">Idle</button>
      <button onClick={() => setState("thinking")} className="px-3 py-1 bg-neutral-700 text-white rounded">Thinking</button>
      <button onClick={() => setState("answering")} className="px-3 py-1 bg-neutral-700 text-white rounded">Answering</button>
    </div>
  );
}

export default App;
