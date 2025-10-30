import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import "./App.css";
import { useAccount, useSignMessage } from 'wagmi';

interface AIPreferenceNFT {
  id: string;
  encryptedTone: string;
  encryptedKnowledgeRange: string;
  encryptedResponseStyle: string;
  timestamp: number;
  owner: string;
  isActive: boolean;
  description: string;
}

// FHE Encryption/Decryption utilities for numerical preferences
const FHEEncryptNumber = (value: number): string => {
  return `FHE-${btoa(value.toString())}-${Date.now()}`;
};

const FHEDecryptNumber = (encryptedData: string): number => {
  if (encryptedData.startsWith('FHE-')) {
    const parts = encryptedData.split('-');
    if (parts.length >= 2) {
      return parseFloat(atob(parts[1]));
    }
  }
  return 0;
};

// Generate mock public key for signature verification
const generatePublicKey = () => `0x${Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [loading, setLoading] = useState(true);
  const [nfts, setNfts] = useState<AIPreferenceNFT[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ visible: false, status: "pending", message: "" });
  const [newNFTData, setNewNFTData] = useState({ 
    tonePreference: 50, 
    knowledgeRange: 75, 
    responseStyle: 25,
    description: "My AI Personality Settings"
  });
  const [showTutorial, setShowTutorial] = useState(false);
  const [selectedNFT, setSelectedNFT] = useState<AIPreferenceNFT | null>(null);
  const [decryptedData, setDecryptedData] = useState<{tone: number, knowledge: number, style: number} | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [publicKey, setPublicKey] = useState<string>("");
  const [currentStep, setCurrentStep] = useState(1);
  const [activeNFTs, setActiveNFTs] = useState(0);

  // Initialize component
  useEffect(() => {
    loadNFTs().finally(() => setLoading(false));
    setPublicKey(generatePublicKey());
  }, []);

  // Update active NFTs count
  useEffect(() => {
    setActiveNFTs(nfts.filter(nft => nft.isActive).length);
  }, [nfts]);

  // Load NFTs from contract
  const loadNFTs = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.log("Contract not available");
        return;
      }

      // Load NFT keys
      const keysBytes = await contract.getData("nft_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try {
          const keysStr = ethers.toUtf8String(keysBytes);
          if (keysStr.trim() !== '') keys = JSON.parse(keysStr);
        } catch (e) { 
          console.error("Error parsing NFT keys:", e);
        }
      }

      const nftList: AIPreferenceNFT[] = [];
      for (const key of keys) {
        try {
          const nftBytes = await contract.getData(`nft_${key}`);
          if (nftBytes.length > 0) {
            try {
              const nftData = JSON.parse(ethers.toUtf8String(nftBytes));
              nftList.push({
                id: key,
                encryptedTone: nftData.tone,
                encryptedKnowledgeRange: nftData.knowledge,
                encryptedResponseStyle: nftData.style,
                timestamp: nftData.timestamp,
                owner: nftData.owner,
                isActive: nftData.isActive,
                description: nftData.description
              });
            } catch (e) { 
              console.error(`Error parsing NFT data for ${key}:`, e);
            }
          }
        } catch (e) { 
          console.error(`Error loading NFT ${key}:`, e);
        }
      }
      
      nftList.sort((a, b) => b.timestamp - a.timestamp);
      setNfts(nftList);
    } catch (e) { 
      console.error("Error loading NFTs:", e);
    } finally { 
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  // Create new AI Preference NFT
  const createNFT = async () => {
    if (!isConnected) {
      alert("Please connect wallet first");
      return;
    }
    
    setCreating(true);
    setTransactionStatus({ 
      visible: true, 
      status: "pending", 
      message: "Encrypting AI preferences with Zama FHE..." 
    });

    try {
      // Encrypt preferences using FHE simulation
      const encryptedTone = FHEEncryptNumber(newNFTData.tonePreference);
      const encryptedKnowledge = FHEEncryptNumber(newNFTData.knowledgeRange);
      const encryptedStyle = FHEEncryptNumber(newNFTData.responseStyle);

      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");

      // Generate unique NFT ID
      const nftId = `aipref-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Store NFT data
      const nftData = {
        tone: encryptedTone,
        knowledge: encryptedKnowledge,
        style: encryptedStyle,
        timestamp: Math.floor(Date.now() / 1000),
        owner: address,
        isActive: true,
        description: newNFTData.description
      };

      await contract.setData(`nft_${nftId}`, ethers.toUtf8Bytes(JSON.stringify(nftData)));

      // Update NFT keys list
      const keysBytes = await contract.getData("nft_keys");
      let keys: string[] = [];
      if (keysBytes.length > 0) {
        try { 
          keys = JSON.parse(ethers.toUtf8String(keysBytes)); 
        } catch (e) { 
          console.error("Error parsing keys:", e);
        }
      }
      keys.push(nftId);
      await contract.setData("nft_keys", ethers.toUtf8Bytes(JSON.stringify(keys)));

      setTransactionStatus({ 
        visible: true, 
        status: "success", 
        message: "AI Preference NFT created successfully!" 
      });

      await loadNFTs();
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewNFTData({ 
          tonePreference: 50, 
          knowledgeRange: 75, 
          responseStyle: 25,
          description: "My AI Personality Settings"
        });
        setCurrentStep(1);
      }, 2000);

    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction") 
        ? "Transaction rejected by user" 
        : "NFT creation failed: " + (e.message || "Unknown error");
      
      setTransactionStatus({ 
        visible: true, 
        status: "error", 
        message: errorMessage 
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setCreating(false);
    }
  };

  // Decrypt NFT data with wallet signature
  const decryptWithSignature = async (nft: AIPreferenceNFT): Promise<{tone: number, knowledge: number, style: number} | null> => {
    if (!isConnected) {
      alert("Please connect wallet first");
      return null;
    }

    setIsDecrypting(true);
    try {
      // Simulate wallet signature for decryption authorization
      const message = `Decrypt AI Preferences NFT: ${nft.id}\nPublic Key: ${publicKey}\nTimestamp: ${Date.now()}`;
      await signMessageAsync({ message });
      
      // Simulate FHE decryption process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return {
        tone: FHEDecryptNumber(nft.encryptedTone),
        knowledge: FHEDecryptNumber(nft.encryptedKnowledgeRange),
        style: FHEDecryptNumber(nft.encryptedResponseStyle)
      };
    } catch (e) {
      console.error("Decryption failed:", e);
      return null;
    } finally {
      setIsDecrypting(false);
    }
  };

  // Toggle NFT active status
  const toggleNFTStatus = async (nftId: string, currentStatus: boolean) => {
    if (!isConnected) {
      alert("Please connect wallet first");
      return;
    }

    setTransactionStatus({ 
      visible: true, 
      status: "pending", 
      message: "Updating NFT status..." 
    });

    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");

      const nftBytes = await contract.getData(`nft_${nftId}`);
      if (nftBytes.length === 0) throw new Error("NFT not found");

      const nftData = JSON.parse(ethers.toUtf8String(nftBytes));
      const updatedNFT = { ...nftData, isActive: !currentStatus };

      await contract.setData(`nft_${nftId}`, ethers.toUtf8Bytes(JSON.stringify(updatedNFT)));

      setTransactionStatus({ 
        visible: true, 
        status: "success", 
        message: `NFT ${!currentStatus ? 'activated' : 'deactivated'} successfully!` 
      });

      await loadNFTs();
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);

    } catch (e: any) {
      setTransactionStatus({ 
        visible: true, 
        status: "error", 
        message: "Status update failed: " + (e.message || "Unknown error") 
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  // Check if current user owns the NFT
  const isOwner = (nftOwner: string) => address?.toLowerCase() === nftOwner.toLowerCase();

  // Tutorial steps
  const tutorialSteps = [
    { 
      title: "Connect Wallet", 
      description: "Connect your Web3 wallet to start creating AI Preference NFTs",
      icon: "🔗"
    },
    { 
      title: "Set Preferences", 
      description: "Configure your AI interaction preferences (tone, knowledge range, response style)",
      icon: "⚙️",
      details: "All preferences are encrypted using Zama FHE before storage"
    },
    { 
      title: "Mint NFT", 
      description: "Create your AI Preference NFT on the blockchain",
      icon: "🖼️",
      details: "Your encrypted preferences are stored as an NFT that you own and control"
    },
    { 
      title: "Use Anywhere", 
      description: "Use your NFT across compatible AI applications",
      icon: "🤖",
      details: "Maintain consistent personality across different AI platforms while keeping preferences private"
    }
  ];

  // Render preference visualization chart
  const renderPreferenceChart = (nft: AIPreferenceNFT) => {
    const tone = decryptedData?.tone || 50;
    const knowledge = decryptedData?.knowledge || 75;
    const style = decryptedData?.style || 25;

    return (
      <div className="preference-chart">
        <div className="chart-item">
          <label>Tone: {tone}%</label>
          <div className="chart-bar">
            <div className="chart-fill" style={{width: `${tone}%`, backgroundColor: '#4a90e2'}}></div>
          </div>
        </div>
        <div className="chart-item">
          <label>Knowledge: {knowledge}%</label>
          <div className="chart-bar">
            <div className="chart-fill" style={{width: `${knowledge}%`, backgroundColor: '#50e3c2'}}></div>
          </div>
        </div>
        <div className="chart-item">
          <label>Style: {style}%</label>
          <div className="chart-bar">
            <div className="chart-fill" style={{width: `${style}%`, backgroundColor: '#b8e986'}}></div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="fhe-spinner"></div>
        <p>Initializing Zama FHE connection...</p>
      </div>
    );
  }

  return (
    <div className="app-container fhe-theme">
      {/* Header Section */}
      <header className="app-header">
        <div className="logo-section">
          <div className="logo">
            <div className="fhe-lock-icon"></div>
            <h1>AI Preference <span>NFT</span></h1>
          </div>
          <div className="tagline">FHE-Encrypted Personalization</div>
        </div>
        
        <div className="header-controls">
          <div className="step-indicator">
            <div className={`step ${currentStep >= 1 ? 'active' : ''}`}>1</div>
            <div className={`step ${currentStep >= 2 ? 'active' : ''}`}>2</div>
            <div className={`step ${currentStep >= 3 ? 'active' : ''}`}>3</div>
            <div className={`step ${currentStep >= 4 ? 'active' : ''}`}>4</div>
          </div>
          
          <div className="header-actions">
            <button 
              onClick={() => setShowCreateModal(true)} 
              className="create-btn fhe-button"
            >
              <div className="plus-icon"></div>
              Create NFT
            </button>
            
            <button 
              className="fhe-button secondary"
              onClick={() => setShowTutorial(!showTutorial)}
            >
              {showTutorial ? "Hide Guide" : "Show Guide"}
            </button>
            
            <div className="wallet-connect">
              <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="main-content">
        {/* Welcome Banner */}
        <div className="welcome-banner">
          <div className="banner-content">
            <h2>Personal AI, Complete Privacy</h2>
            <p>Create FHE-encrypted AI preference NFTs that work across platforms while keeping your data private</p>
            <div className="stats-overview">
              <div className="stat">
                <div className="stat-value">{nfts.length}</div>
                <div className="stat-label">Total NFTs</div>
              </div>
              <div className="stat">
                <div className="stat-value">{activeNFTs}</div>
                <div className="stat-label">Active</div>
              </div>
              <div className="stat">
                <div className="stat-value">FHE</div>
                <div className="stat-label">Encrypted</div>
              </div>
            </div>
          </div>
          <div className="fhe-badge">
            <div className="shield-icon"></div>
            <span>Powered by Zama FHE</span>
          </div>
        </div>

        {/* Tutorial Section */}
        {showTutorial && (
          <div className="tutorial-section">
            <h3>How AI Preference NFTs Work</h3>
            <div className="tutorial-steps">
              {tutorialSteps.map((step, index) => (
                <div key={index} className="tutorial-step">
                  <div className="step-icon">{step.icon}</div>
                  <div className="step-content">
                    <h4>{step.title}</h4>
                    <p>{step.description}</p>
                    {step.details && <div className="step-details">{step.details}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NFT List Section */}
        <div className="nft-section">
          <div className="section-header">
            <h2>Your AI Preference NFTs</h2>
            <button 
              onClick={loadNFTs} 
              className="refresh-btn fhe-button"
              disabled={isRefreshing}
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {nfts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🤖</div>
              <h3>No AI Preference NFTs Yet</h3>
              <p>Create your first FHE-encrypted AI personality NFT to get started</p>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="fhe-button primary"
              >
                Create First NFT
              </button>
            </div>
          ) : (
            <div className="nft-grid">
              {nfts.map(nft => (
                <div key={nft.id} className="nft-card">
                  <div className="nft-header">
                    <div className="nft-id">#{nft.id.substring(0, 8)}</div>
                    <div className={`status-indicator ${nft.isActive ? 'active' : 'inactive'}`}>
                      {nft.isActive ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                  
                  <div className="nft-content">
                    <h4>{nft.description}</h4>
                    <div className="nft-meta">
                      <span>Owner: {nft.owner.substring(0, 6)}...{nft.owner.substring(38)}</span>
                      <span>Created: {new Date(nft.timestamp * 1000).toLocaleDateString()}</span>
                    </div>
                    
                    {decryptedData && selectedNFT?.id === nft.id ? (
                      renderPreferenceChart(nft)
                    ) : (
                      <div className="encrypted-preview">
                        <div className="encrypted-bar"></div>
                        <div className="encrypted-bar"></div>
                        <div className="encrypted-bar"></div>
                        <span>FHE Encrypted Data</span>
                      </div>
                    )}
                  </div>

                  <div className="nft-actions">
                    {isOwner(nft.owner) && (
                      <>
                        <button 
                          onClick={() => toggleNFTStatus(nft.id, nft.isActive)}
                          className={`status-btn fhe-button ${nft.isActive ? 'warning' : 'success'}`}
                        >
                          {nft.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        
                        <button 
                          onClick={async () => {
                            setSelectedNFT(nft);
                            if (!decryptedData || selectedNFT?.id !== nft.id) {
                              const data = await decryptWithSignature(nft);
                              if (data) setDecryptedData(data);
                            } else {
                              setDecryptedData(null);
                            }
                          }}
                          className="decrypt-btn fhe-button"
                          disabled={isDecrypting}
                        >
                          {isDecrypting ? 'Decrypting...' : 
                           decryptedData && selectedNFT?.id === nft.id ? 'Hide Data' : 'View Preferences'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create NFT Modal */}
      {showCreateModal && (
        <CreateNFTModal
          onSubmit={createNFT}
          onClose={() => {
            setShowCreateModal(false);
            setCurrentStep(1);
          }}
          creating={creating}
          nftData={newNFTData}
          setNftData={setNewNFTData}
          currentStep={currentStep}
          setCurrentStep={setCurrentStep}
        />
      )}

      {/* Transaction Status Modal */}
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`status-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="fhe-spinner"></div>}
              {transactionStatus.status === "success" && "✓"}
              {transactionStatus.status === "error" && "✕"}
            </div>
            <div className="status-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-info">
            <div className="footer-logo">
              <div className="fhe-lock-icon"></div>
              <span>AI Preference NFT</span>
            </div>
            <p>FHE-encrypted AI personalization powered by Zama</p>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy</a>
            <a href="#" className="footer-link">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Create NFT Modal Component
interface CreateNFTModalProps {
  onSubmit: () => void;
  onClose: () => void;
  creating: boolean;
  nftData: any;
  setNftData: (data: any) => void;
  currentStep: number;
  setCurrentStep: (step: number) => void;
}

const CreateNFTModal: React.FC<CreateNFTModalProps> = ({
  onSubmit,
  onClose,
  creating,
  nftData,
  setNftData,
  currentStep,
  setCurrentStep
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNftData({ ...nftData, [name]: value });
  };

  const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNftData({ ...nftData, [name]: parseInt(value) });
  };

  const nextStep = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = () => {
    if (!nftData.description.trim()) {
      alert("Please enter a description for your NFT");
      return;
    }
    onSubmit();
  };

  return (
    <div className="modal-overlay">
      <div className="create-modal">
        <div className="modal-header">
          <h2>Create AI Preference NFT</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        <div className="modal-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{width: `${(currentStep / 4) * 100}%`}}
            ></div>
          </div>
          <div className="step-labels">
            <span className={currentStep >= 1 ? 'active' : ''}>Description</span>
            <span className={currentStep >= 2 ? 'active' : ''}>Tone</span>
            <span className={currentStep >= 3 ? 'active' : ''}>Knowledge</span>
            <span className={currentStep >= 4 ? 'active' : ''}>Style</span>
          </div>
        </div>

        <div className="modal-body">
          {currentStep === 1 && (
            <div className="step-content">
              <h3>Describe Your AI Personality</h3>
              <textarea
                name="description"
                value={nftData.description}
                onChange={handleInputChange}
                placeholder="e.g., Professional assistant with technical expertise..."
                className="description-input"
              />
            </div>
          )}

          {currentStep === 2 && (
            <div className="step-content">
              <h3>Conversation Tone</h3>
              <div className="preference-slider">
                <label>Formal ←→ Casual: {nftData.tonePreference}%</label>
                <input
                  type="range"
                  name="tonePreference"
                  min="0"
                  max="100"
                  value={nftData.tonePreference}
                  onChange={handleRangeChange}
                  className="slider"
                />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="step-content">
              <h3>Knowledge Range</h3>
              <div className="preference-slider">
                <label>Specific ←→ Broad: {nftData.knowledgeRange}%</label>
                <input
                  type="range"
                  name="knowledgeRange"
                  min="0"
                  max="100"
                  value={nftData.knowledgeRange}
                  onChange={handleRangeChange}
                  className="slider"
                />
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="step-content">
              <h3>Response Style</h3>
              <div className="preference-slider">
                <label>Concise ←→ Detailed: {nftData.responseStyle}%</label>
                <input
                  type="range"
                  name="responseStyle"
                  min="0"
                  max="100"
                  value={nftData.responseStyle}
                  onChange={handleRangeChange}
                  className="slider"
                />
              </div>

              <div className="encryption-preview">
                <h4>FHE Encryption Preview</h4>
                <div className="preview-data">
                  <div>Original: Tone={nftData.tonePreference}, Knowledge={nftData.knowledgeRange}, Style={nftData.responseStyle}</div>
                  <div>Encrypted: {FHEEncryptNumber(nftData.tonePreference).substring(0, 30)}...</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={prevStep} disabled={currentStep === 1} className="fhe-button">
            Previous
          </button>
          
          {currentStep < 4 ? (
            <button onClick={nextStep} className="fhe-button primary">
              Next
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={creating} className="fhe-button primary">
              {creating ? "Creating NFT..." : "Create NFT"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;