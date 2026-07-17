import { useEffect } from "react";
import "./App.css";
import PetWidget from "@/components/pet/PetWidget";
import SettingsPage from "@/pages/SettingsPage";
import { usePetStore } from "@/store/petStore";

function App() {
  const { hydrated, hydrate } = usePetStore();

  useEffect(() => {
    hydrate();
  }, []);

  return (
    <>
      <SettingsPage />
      {hydrated && <PetWidget />}
    </>
  );
}

export default App;