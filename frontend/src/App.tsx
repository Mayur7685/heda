import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useWallet } from "./hooks/useWallet";

function HedaConnectButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;
        const wrongChain = connected && chain.unsupported;

        if (!ready) return null;

        if (!connected) {
          return (
            <button className="btn-primary" onClick={openConnectModal} style={{ fontSize: 13 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>account_balance_wallet</span>
              Connect Wallet
            </button>
          );
        }

        if (wrongChain) {
          return (
            <button onClick={openChainModal}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 4, border: "1px solid var(--error)", background: "rgba(147,0,10,0.2)", color: "var(--error)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
              Switch to Galileo
            </button>
          );
        }

        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Balance + address pill */}
            <button onClick={openAccountModal}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer", transition: "border-color 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}>
              {account.displayBalance && (
                <>
                  <span style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 13, color: "var(--primary)", fontWeight: 600 }}>
                    {account.displayBalance}
                  </span>
                  <span style={{ width: 1, height: 14, background: "var(--border)" }} />
                </>
              )}
              <span style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 12, color: "var(--text-2)" }}>
                {account.displayName}
              </span>
              <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--text-3)" }}>expand_more</span>
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
import Landing from "./pages/Landing";
import Jobs from "./pages/Jobs";
import Workspace from "./pages/Workspace";
import CreateJob from "./pages/CreateJob";
import Dashboard from "./pages/Dashboard";
import Datasets from "./pages/Datasets";
import FineTune from "./pages/FineTune";
import Submissions from "./pages/Submissions";
import DatasetDetail from "./pages/DatasetDetail";
import Models from "./pages/Models";
import Leaderboard from "./pages/Leaderboard";
import RapidCVPipeline from "./pages/RapidCVPipeline";
import Devices from "./pages/Devices";
import DeviceGallery from "./pages/DeviceGallery";

import { useLocation } from "react-router-dom";

function Header() {
  const { address, isCorrectChain, switchToGalileo } = useWallet();

  const navLinks = address
    ? [
        { to: "/pipeline", label: "Rapid CV Studio" },
        { to: "/devices", label: "Edge Hardware" },
        { to: "/jobs", label: "Jobs" },
        { to: "/create", label: "Create Job" },
        { to: "/datasets", label: "Datasets" },
        { to: "/models", label: "Models" },
        { to: "/leaderboard", label: "Leaderboard" },
        { to: "/dashboard", label: "Dashboard" },
        { to: "/submissions", label: "My Work" },
      ]
    : [];

  return (
    <header className="heda-header" style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center" }}>
      <div style={{ justifySelf: "start" }}>
        <NavLink to="/" className="heda-logo" style={{ textDecoration: "none" }}>Heda</NavLink>
      </div>

      <nav className="heda-nav" style={{ justifySelf: "center" }}>
        {navLinks.map(({ to, label }) => (
          <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => isActive ? "active" : ""}>
            {label}
          </NavLink>
        ))}
      </nav>

      <div style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 10 }}>
        {address && !isCorrectChain && (
          <button onClick={switchToGalileo} style={{ fontSize: 12, padding: "4px 10px", background: "rgba(147,0,10,0.3)", border: "1px solid var(--error)", color: "var(--error)", borderRadius: 4, cursor: "pointer" }}>
            Switch to Galileo
          </button>
        )}
        <HedaConnectButton />
      </div>
    </header>
  );
}

function Footer() {
  const location = useLocation();
  // Hide footer on full-screen studio workspaces
  if (location.pathname === "/pipeline" || location.pathname.includes("/jobs/")) {
    return null;
  }

  return (
    <footer className="heda-footer">
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>Heda</span>
        <span className="label-caps">© 2024 Heda Protocol. Decentralized Data Intelligence.</span>
      </div>
      <nav className="heda-footer-links">
        <a href="https://docs.0g.ai" target="_blank" rel="noreferrer">Documentation</a>
        <a href="https://github.com/0g-ai" target="_blank" rel="noreferrer">Github</a>
        <a href="https://faucet.0g.ai" target="_blank" rel="noreferrer">0G Faucet</a>
      </nav>
    </footer>
  );
}

function WalletGuard({ children, feature }: { children: React.ReactNode; feature?: string }) {
  const { address } = useWallet();
  if (!address) {
    return (
      <div className="page" style={{ textAlign: "center", paddingTop: 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--primary)", marginBottom: 16 }}>account_balance_wallet</span>
        <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: "var(--text)" }}>Connect Wallet Required</h3>
        <p className="hint" style={{ maxWidth: 460 }}>
          Connect your Web3 wallet using the top right button to access {feature || "this feature"}.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

function AppContent() {
  const location = useLocation();
  const { address } = useWallet();
  const isWorkspaceRoute = address && (location.pathname === "/pipeline" || location.pathname.includes("/jobs/"));

  return (
    <>
      {!isWorkspaceRoute && <Header />}
      <main style={{
        paddingTop: isWorkspaceRoute ? 0 : 64,
        height: isWorkspaceRoute ? "100vh" : "auto",
        minHeight: isWorkspaceRoute ? "100vh" : "100vh",
        maxHeight: isWorkspaceRoute ? "100vh" : "none",
        overflow: isWorkspaceRoute ? "hidden" : "visible",
      }}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/pipeline" element={<WalletGuard feature="the 0G Rapid CV Studio"><RapidCVPipeline /></WalletGuard>} />
          <Route path="/rapid-cv" element={<WalletGuard feature="the 0G Rapid CV Studio"><RapidCVPipeline /></WalletGuard>} />
          <Route path="/devices" element={<WalletGuard feature="Edge Hardware Fleet"><Devices /></WalletGuard>} />
          <Route path="/devices/:deviceId" element={<WalletGuard feature="Edge Hardware Camera"><DeviceGallery /></WalletGuard>} />
          <Route path="/jobs" element={<WalletGuard feature="Annotation Jobs"><Jobs /></WalletGuard>} />
          <Route path="/jobs/:jobId/:taskId" element={<WalletGuard feature="Annotator Workspace"><Workspace /></WalletGuard>} />
          <Route path="/create" element={<WalletGuard feature="Job Creation"><CreateJob /></WalletGuard>} />
          <Route path="/datasets" element={<WalletGuard feature="0G Datasets"><Datasets /></WalletGuard>} />
          <Route path="/datasets/:datasetId" element={<WalletGuard feature="Dataset Details"><DatasetDetail /></WalletGuard>} />
          <Route path="/models" element={<WalletGuard feature="Model Registry"><Models /></WalletGuard>} />
          <Route path="/leaderboard" element={<WalletGuard feature="Annotator Leaderboard"><Leaderboard /></WalletGuard>} />
          <Route path="/finetune" element={<WalletGuard feature="Fine-Tuning"><FineTune /></WalletGuard>} />
          <Route path="/dashboard" element={<WalletGuard feature="Creator Dashboard"><Dashboard /></WalletGuard>} />
          <Route path="/submissions" element={<WalletGuard feature="My Work"><Submissions /></WalletGuard>} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
