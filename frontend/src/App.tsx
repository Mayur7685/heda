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
import Jobs from "./pages/Jobs";
import Workspace from "./pages/Workspace";
import CreateJob from "./pages/CreateJob";
import Dashboard from "./pages/Dashboard";
import Datasets from "./pages/Datasets";
import FineTune from "./pages/FineTune";
import Submissions from "./pages/Submissions";
import DatasetDetail from "./pages/DatasetDetail";

function Header() {
  const { address, isCorrectChain, switchToGalileo } = useWallet();

  const navLinks = [
    { to: "/", label: "Jobs" },
    { to: "/create", label: "Create Job" },
    { to: "/datasets", label: "Datasets" },
    { to: "/dashboard", label: "Dashboard" },
    { to: "/submissions", label: "My Work" },
  ];

  return (
    <header className="heda-header">
      <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
        <NavLink to="/" className="heda-logo" style={{ textDecoration: "none" }}>Heda</NavLink>
        <nav className="heda-nav">
          {navLinks.map(({ to, label }) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => isActive ? "active" : ""}>
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
  return (
    <footer className="heda-footer">
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>Heda</span>
        <span className="label-caps">© 2024 Heda Protocol. Decentralized Data Intelligence.</span>
      </div>
      <nav className="heda-footer-links">
        <a href="#">Documentation</a>
        <a href="#">Terms</a>
        <a href="#">Privacy</a>
        <a href="https://github.com" target="_blank" rel="noreferrer">Github</a>
      </nav>
    </footer>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Jobs />} />
          <Route path="/jobs/:jobId/:taskId" element={<Workspace />} />
          <Route path="/create" element={<CreateJob />} />
          <Route path="/datasets" element={<Datasets />} />
          <Route path="/datasets/:datasetId" element={<DatasetDetail />} />
          <Route path="/finetune" element={<FineTune />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/submissions" element={<Submissions />} />
        </Routes>
      </main>
      <Footer />
    </BrowserRouter>
  );
}
