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
import PublicGuidePage from "./pages/public-guide";
import type { DatasetKey } from "./lib/feed";

function NotFoundPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <main className="pt-panel space-y-3 p-4">
      <p className="pt-kicker">404</p>
      <h1 className="pt-title text-2xl">Page not found{id ? ` · ${id}` : ""}</h1>
      <p className="pt-muted text-sm">
        We couldn't find a record at this URL. Try a directory or use search.
      </p>
      <div className="flex flex-wrap gap-2 text-sm">
        <a className="pt-link" href="/">Home</a>
        <a className="pt-link" href="/search">Search</a>
        <a className="pt-link" href="/members">Members</a>
        <a className="pt-link" href="/pacs">PACs</a>
        <a className="pt-link" href="/bills">Bills</a>
        <a className="pt-link" href="/votes">Votes</a>
        <a className="pt-link" href="/states">States</a>
      </div>
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

          {/* Public context */}
          <Route path="/methodology/*" element={<PublicGuidePage view="methodology" />} />
          <Route path="/data-coverage/*" element={<PublicGuidePage view="sources" />} />
          <Route path="/mcp" element={<PublicGuidePage view="mcp" />} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </SiteShell>
    </BrowserRouter>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
