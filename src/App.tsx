import "./App.css";
import CopilotDot from "@/components/copilot/CopilotDot";
import ThemeToggle from "@/components/settings/ThemeToggle";

function App() {
  return (
    <>
      <CopilotDot />
      <div className="fixed top-4 left-4 z-50">
        <ThemeToggle />
      </div>
    </>
  );
}

export default App;