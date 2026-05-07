import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { ethers } from "ethers";
import { useWallet } from "./hooks/useWallet";
import Jobs from "./pages/Jobs";
import Workspace from "./pages/Workspace";
import CreateJob from "./pages/CreateJob";
import Dashboard from "./pages/Dashboard";
import Datasets from "./pages/Datasets";
import FineTune from "./pages/FineTune";
import Submissions from "./pages/Submissions";
import DatasetDetail from "./pages/DatasetDetail";

function Header() {
  const { signer, address, isCorrectChain, connect, switchToGalileo } = useWallet();
  const [balance, setBalance] = useState<string | null>(null);

  useEffect(() => {
    if (!signer || !address) return;
    signer.provider?.getBalance(address).then((b) =>
      setBalance(parseFloat(ethers.formatEther(b)).toFixed(2))
    );
  }, [address]);

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

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {address && isCorrectChain && balance !== null && (
          <div className="wallet-pill">
            <span className="balance">{balance} 0G</span>
            <span className="divider" />
            <span className="address">{address.slice(0, 6)}…{address.slice(-4)}</span>
          </div>
        )}
        {!address ? (
          <button className="btn-primary" onClick={connect}>Connect Wallet</button>
        ) : !isCorrectChain ? (
          <button className="btn-primary" onClick={switchToGalileo} style={{ background: "var(--error-bg)", color: "var(--error)" }}>
            Switch to Galileo
          </button>
        ) : null}
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
