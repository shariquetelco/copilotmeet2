import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import CopilotDot from "@/components/copilot/CopilotDot";
import { useCopilotStore } from "@/store/copilotStore";
import { useEffect, useState as useReactState } from "react";
import { useProjectStore } from "@/store/projectStore";

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
    <ProjectTestPanel />
    </>
  );
}

function StateTestButtons() {
  const setState = useCopilotStore((s) => s.setState);
  const addQAEntry = useCopilotStore((s) => s.addQAEntry);
  let counter = 0;

  const addMockQuestion = () => {
    counter += 1;
    addQAEntry({
      question: `Mock question #${Date.now() % 1000}: Tell me about a challenge you faced?`,
      ragAnswer: "Pulled from your uploaded documents as a sample RAG response.",
      ragConfidence: Math.floor(70 + Math.random() * 25),
      llmAnswer: "Generic LLM-generated sample response for testing scroll behavior.",
      llmConfidence: Math.floor(60 + Math.random() * 25),
    });
  };

  return (
    <div className="fixed bottom-4 left-4 flex gap-2 z-50">
      <button onClick={() => setState("idle")} className="px-3 py-1 bg-neutral-700 text-white rounded">Idle</button>
      <button onClick={() => setState("thinking")} className="px-3 py-1 bg-neutral-700 text-white rounded">Thinking</button>
      <button onClick={() => setState("answering")} className="px-3 py-1 bg-neutral-700 text-white rounded">Answering</button>
      <button onClick={addMockQuestion} className="px-3 py-1 bg-blue-700 text-white rounded">+ Add Question</button>
    </div>
  );
}

function ProjectTestPanel() {
  const { projects, loading, error, fetchProjects, createProject, deleteProject } =
    useProjectStore();
  const [name, setName] = useReactState("");

  useEffect(() => {
    fetchProjects();
  }, []);

  return (
    <div className="fixed top-4 right-4 bg-white border rounded p-4 w-72 z-50 text-sm">
      <h2 className="font-bold mb-2">Project Test Panel</h2>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-500">{error}</p>}
      <div className="flex gap-2 mb-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name"
          className="border px-2 py-1 flex-1"
        />
        <button
          onClick={() => {
            if (name.trim()) {
              createProject(name, "Interview");
              setName("");
            }
          }}
          className="bg-blue-600 text-white px-2 py-1 rounded"
        >
          Add
        </button>
      </div>
      <ul className="flex flex-col gap-1">
        {projects.map((p) => (
          <li key={p.id} className="flex justify-between items-center border-b py-1">
            <span>{p.name} <span className="text-neutral-400">({p.meeting_mode})</span></span>
            <button
              onClick={() => deleteProject(p.id)}
              className="text-red-500 text-xs"
            >
              delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
