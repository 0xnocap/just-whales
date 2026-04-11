const fs = require('fs');

let appCode = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Add react-router-dom imports
appCode = appCode.replace(
  "import { formatEther, parseEther, formatUnits, parseUnits } from 'viem';",
  "import { formatEther, parseEther, formatUnits, parseUnits } from 'viem';\nimport { Routes, Route, useNavigate, useLocation } from 'react-router-dom';"
);

// 2. Update RetroButton
appCode = appCode.replace(
  /const RetroButton = \(\{ icon: Icon, label, active, onClick, disabled, tooltip \}: \{ icon: any, label: string, active: boolean, onClick: \(\) => void, disabled\?: boolean, tooltip\?: string \}\) => \{/,
  `const RetroButton = ({ icon: Icon, label, to, disabled, tooltip }: { icon: any, label: string, to: string, disabled?: boolean, tooltip?: string }) => {\n  const navigate = useNavigate();\n  const location = useLocation();\n  const active = location.pathname === to;\n  const onClick = () => navigate(to);`
);

// 3. Update App Component
const appStart = "export default function App() {";
const mainContentOld = `  type TabType = 'home' | 'staking' | 'trade' | 'mint';
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [history, setHistory] = useState<TabType[]>([]);
  const [modalToken, setModalToken] = useState<ModalTokenProps | null>(null);

  const changeTab = (tab: TabType) => {
    if (tab !== activeTab) {
      setHistory(prev => [...prev, activeTab]);
      setActiveTab(tab);
    }
  };

  const goBack = () => {
    if (history.length > 0) {
      const newHistory = [...history];
      const lastTab = newHistory.pop();
      if (lastTab) {
        setHistory(newHistory);
        setActiveTab(lastTab);
      }
    } else if (activeTab !== 'home') {
      setActiveTab('home');
    }
  };`;

const mainContentNew = `  const [modalToken, setModalToken] = useState<ModalTokenProps | null>(null);
  const location = useLocation();
  const navigate = useNavigate();`;

appCode = appCode.replace(mainContentOld, mainContentNew);

appCode = appCode.replace(
  `key={activeTab}`,
  `key={location.pathname}`
);

appCode = appCode.replace(
  `{activeTab !== 'home' && (`,
  `{location.pathname !== '/' && (`
);

appCode = appCode.replace(
  `onClick={goBack}`,
  `onClick={() => navigate(-1)}`
);

const routesOld = `{activeTab === 'home' && <HomePage />}
            {activeTab === 'staking' && <StakingPage />}
            {activeTab === 'trade' && <TradePage onSelectToken={setModalToken} />}
            {activeTab === 'mint' && <MintPage onMintSuccess={setModalToken} />}`;

const routesNew = `<Routes location={location} key={location.pathname}>
              <Route path="/" element={<HomePage />} />
              <Route path="/staking" element={<StakingPage />} />
              <Route path="/trade" element={<TradePage onSelectToken={setModalToken} />} />
              <Route path="/mint" element={<MintPage onMintSuccess={setModalToken} />} />
            </Routes>`;

appCode = appCode.replace(routesOld, routesNew);

const navOld = `<RetroButton icon={Home} label="Home" active={activeTab === 'home'} onClick={() => changeTab('home')} />
        <RetroButton icon={Sparkles} label="Mint" active={activeTab === 'mint'} onClick={() => changeTab('mint')} />
        <RetroButton icon={ArrowLeftRight} label="Trade" active={activeTab === 'trade'} onClick={() => changeTab('trade')} />
        <RetroButton icon={Coins} label="Staking" active={activeTab === 'staking'} onClick={() => changeTab('staking')} />`;

const navNew = `<RetroButton icon={Home} label="Home" to="/" />
        <RetroButton icon={Sparkles} label="Mint" to="/mint" />
        <RetroButton icon={ArrowLeftRight} label="Trade" to="/trade" />
        <RetroButton icon={Coins} label="Staking" to="/staking" />`;

appCode = appCode.replace(navOld, navNew);

fs.writeFileSync('src/App.tsx', appCode);
console.log('Routing implemented.');
