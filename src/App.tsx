import { Route, Routes } from "react-router-dom";
import { Nav } from "./components/Nav";
import { SessionProvider } from "./state/SessionContext";
import { ViewProvider } from "./state/ViewContext";
import { PartyProvider } from "./state/PartyContext";
import { Home } from "./pages/Home";
import { Store } from "./pages/Store";
import { Library } from "./pages/Library";
import { Friends } from "./pages/Friends";
import { GamePage } from "./pages/Game";
import { Party } from "./pages/Party";

function App() {
  return (
    <SessionProvider>
      <PartyProvider>
        <ViewProvider>
          <div className="min-h-screen bg-neutral-950 text-neutral-100">
            <Nav />
            <main className="mx-auto max-w-6xl px-4 py-6">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/store" element={<Store />} />
                <Route path="/library" element={<Library />} />
                <Route path="/friends" element={<Friends />} />
                <Route path="/game/:gameId" element={<GamePage />} />
                <Route path="/party" element={<Party />} />
              </Routes>
            </main>
          </div>
        </ViewProvider>
      </PartyProvider>
    </SessionProvider>
  );
}

export default App;
