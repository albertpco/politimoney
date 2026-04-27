import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useParams } from "react-router-dom";
import "./styles.css";
import { SiteShell } from "./components/site-shell";
import HomePage from "./pages/home";
import MemberDetailPage from "./pages/member";
import StateDetailPage from "./pages/state";
import { HouseVotePage, SenateVotePage } from "./pages/vote";
import DirectoryPage from "./pages/directory";
import SearchPage from "./pages/search";
import ComparePage from "./pages/compare";
import PacDetailPage from "./pages/pac";
import DonorDetailPage from "./pages/donor";
import BillDetailPage from "./pages/bill";
import CongressTradeDetailPage from "./pages/insider-trade";
import type { DatasetKey } from "./lib/feed";

function GenericDetailFallback({ section }: { section: string }) {
  const { id } = useParams<{ id: string }>();
  return (
    <main className="pt-panel space-y-2 p-4">
      <p className="pt-kicker">Coming soon</p>
      <h1 className="pt-title text-2xl">{section} · {id}</h1>
      <p className="pt-muted text-sm">
        A dedicated profile for this record is on the way. Until then, browse the index or open the
        raw JSON record from the feed manifest.
      </p>
    </main>
  );
}

function DirectoryRoute({ section }: { section: DatasetKey }) {
  return <DirectoryPage section={section} />;
}

function App() {
  return (
    <BrowserRouter>
      <SiteShell>
        <Routes>
          <Route path="/" element={<HomePage />} />

          {/* Members */}
          <Route path="/members" element={<DirectoryRoute section="members" />} />
          <Route path="/members/:id" element={<MemberDetailPage />} />

          {/* States */}
          <Route path="/states" element={<DirectoryRoute section="states" />} />
          <Route path="/states/:id" element={<StateDetailPage />} />

          {/* Votes */}
          <Route path="/votes" element={<DirectoryRoute section="votes" />} />
          <Route path="/votes/house/:id" element={<HouseVotePage />} />
          <Route path="/votes/senate/:id" element={<SenateVotePage />} />

          {/* Generic explorers (port to dedicated pages later) */}
          <Route path="/pacs" element={<DirectoryRoute section="pacs" />} />
          <Route path="/pacs/:id" element={<PacDetailPage />} />
          <Route path="/donors" element={<DirectoryRoute section="donors" />} />
          <Route path="/donors/:id" element={<DonorDetailPage />} />
          <Route path="/bills" element={<DirectoryRoute section="bills" />} />
          <Route path="/bills/:id" element={<BillDetailPage />} />
          <Route path="/congress-trades" element={<DirectoryRoute section="congressTrades" />} />
          <Route path="/congress-trades/:id" element={<CongressTradeDetailPage />} />

          {/* Search + Compare */}
          <Route path="/search" element={<SearchPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/compare/:slug" element={<ComparePage />} />

          {/* Static stubs (until ported) */}
          <Route path="/methodology/*" element={<GenericDetailFallback section="Methodology" />} />
          <Route path="/data-coverage/*" element={<GenericDetailFallback section="Data coverage" />} />

          <Route path="*" element={<GenericDetailFallback section="Page" />} />
        </Routes>
      </SiteShell>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
