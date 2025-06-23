import React, { useState, useEffect, useMemo, useCallback } from "react";
import "./App.css";

// --- Components ---
const Modal = ({ title, children, showCloseButton = true, onClose }) => (
  <div className="modal-overlay">
    <div className="modal">
      {title && <h2>{title}</h2>}
      <div className="modal-content">{children}</div>
      {showCloseButton && (
        <button onClick={onClose} className="modal-button">
          Close
        </button>
      )}
    </div>
  </div>
);

// --- Game Logic Utilities ---
const suits = ["♠", "♥", "♦", "♣"];
const values = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const createDeck = (numDecks) => {
  let deck = [];
  for (let d = 0; d < numDecks; d++) {
    for (let suit of suits) {
      for (let value of values) {
        deck.push({ suit, value });
      }
    }
  }
  return deck;
};

const shuffleDeck = (deck) => {
  let array = [...deck];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const cardCountValue = (card) => {
  if (!card) return 0;
  const val = card.value;
  if (["2", "3", "4", "5", "6"].includes(val)) return 1;
  if (["10", "J", "Q", "K", "A"].includes(val)) return -1;
  return 0;
};

const calculateHandValue = (hand) => {
  let total = 0;
  let aces = 0;
  hand.forEach((card) => {
    if (card.value === "A") {
      aces += 1;
      total += 11;
    } else if (["K", "Q", "J"].includes(card.value)) {
      total += 10;
    } else {
      total += parseInt(card.value, 10);
    }
  });
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
};

// --- Main App Component ---
function App() {
  const [activeModal, setActiveModal] = useState({ type: 'welcome' });
  const [numDecks, setNumDecks] = useState(null);
  const [pile, setPile] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [gameState, setGameState] = useState('playerTurn');
  const [scores, setScores] = useState({ player: 0, dealer: 0 });
  const [runningCount, setRunningCount] = useState(0);
  const [theme, setTheme] = useState(() => localStorage.getItem("selectedTheme") || "default");
  const [showCount, setShowCount] = useState(false);
  const [actionLog, setActionLog] = useState([]);

  const playerTotal = useMemo(() => calculateHandValue(playerHand), [playerHand]);
  const dealerTotal = useMemo(() => calculateHandValue(dealerHand), [dealerHand]);

  useEffect(() => {
    localStorage.setItem("selectedTheme", theme);
  }, [theme]);

  const handleNewGame = useCallback(() => {
    setNumDecks(null);
    setScores({ player: 0, dealer: 0 });
    setRunningCount(0);
    setPlayerHand([]);
    setDealerHand([]);
    setPile([]);
    setActionLog([]);
    setGameState('playerTurn');
    setActiveModal({ type: 'welcome' });
    setShowCount(false);
  }, []);

  const startNewRound = useCallback((initialDeck) => {
    setPile(currentPile => {
      const deckToUse = initialDeck || currentPile;
      if (deckToUse.length < 4) {
        alert("Not enough cards for a new round. Please start a new game.");
        handleNewGame();
        return currentPile;
      }
      const newPlayerHand = [deckToUse[0], deckToUse[1]];
      const newDealerHand = [deckToUse[2], deckToUse[3]];
      setPlayerHand(newPlayerHand);
      setDealerHand(newDealerHand);
      setGameState('playerTurn');
      setRunningCount(rc => rc + cardCountValue(deckToUse[0]) + cardCountValue(deckToUse[1]) + cardCountValue(deckToUse[2]));
      setActionLog([`Player dealt 2 cards`, `Dealer shows ${newDealerHand[0].value}${newDealerHand[0].suit}`]);
      setActiveModal(null);
      return deckToUse.slice(4);
    });
  }, [handleNewGame]);

  useEffect(() => {
    if (numDecks) {
      const newDeck = createDeck(numDecks);
      const shuffled = shuffleDeck(newDeck);
      startNewRound(shuffled);
    }
  }, [numDecks, startNewRound]);
  
  useEffect(() => {
    if (gameState !== 'playerTurn') return;
    let result = null;
    if (playerTotal > 21) {
      setGameState('playerBust');
      setActionLog(log => [...log, "Player busts!"]);
      setScores(s => ({ ...s, dealer: s.dealer + 1 }));
    } else if (playerHand.length === 2 && playerTotal === 21) {
      setRunningCount(rc => rc + cardCountValue(dealerHand[1]));
      const dealerFinalTotal = calculateHandValue(dealerHand);
      if (dealerFinalTotal === 21) {
        result = 'Both have blackjack. Push.';
      } else {
        result = 'Player has blackjack! Player wins!';
        setScores(s => ({ ...s, player: s.player + 1 }));
      }
      if (result) {
        setGameState('roundOver');
        setActionLog(log => [...log, result]);
        setActiveModal({ type: 'roundResult', message: result });
      }
    }
  }, [playerHand.length, playerTotal, gameState, dealerHand]);

  useEffect(() => {
    if (gameState !== 'playerBust') return;
    const handleBustSequence = async () => {
      await new Promise(res => setTimeout(res, 1000));
      setRunningCount(rc => rc + cardCountValue(dealerHand[1]));
      setActionLog(log => [...log, `Dealer's hole card was ${dealerHand[1].value}${dealerHand[1].suit}`]);
      
      const result = 'Player busts. Dealer wins.';
      setGameState('roundOver');
      setActiveModal({ type: 'roundResult', message: result });
    };
    handleBustSequence();
  }, [gameState, dealerHand]);

  const handleHit = () => {
    if (gameState !== 'playerTurn') return;
    if (pile.length < 1) {
      setActionLog(log => [...log, "No more cards in the deck! The round ends now."]);
      handleStand();
      return;
    }
    const card = pile[0];
    setPlayerHand(hand => [...hand, card]);
    setRunningCount(rc => rc + cardCountValue(card));
    setPile(p => p.slice(1));
    setActionLog(log => [...log, `Player hits: ${card.value}${card.suit}`]);
  };
  
  const handleStand = async () => {
    if (gameState !== 'playerTurn') return;
    setGameState('dealerTurn');
    setActionLog(log => [...log, "Player stands. Dealer's turn..."]);
    await new Promise(res => setTimeout(res, 500));
    setRunningCount(rc => rc + cardCountValue(dealerHand[1]));
    setActionLog(log => [...log, `Dealer reveals: ${dealerHand[1].value}${dealerHand[1].suit}`]);
    let currentHand = [...dealerHand];
    let currentPile = [...pile];
    while (calculateHandValue(currentHand) < 17 && currentPile.length > 0) {
      await new Promise(res => setTimeout(res, 800));
      const card = currentPile.shift();
      currentHand.push(card);
      setDealerHand([...currentHand]); 
      setRunningCount(rc => rc + cardCountValue(card));
      setActionLog(log => [...log, `Dealer hits: ${card.value}${card.suit}`]);
    }
    setPile(currentPile);
    const finalPlayerTotal = calculateHandValue(playerHand);
    const finalDealerTotal = calculateHandValue(currentHand);
    let result = '';
    if (finalDealerTotal > 21) {
      result = 'Dealer busts. Player wins.';
      setScores(s => ({ ...s, player: s.player + 1 }));
    } else if (finalPlayerTotal > finalDealerTotal) {
      result = 'Player wins!';
      setScores(s => ({ ...s, player: s.player + 1 }));
    } else if (finalDealerTotal > finalPlayerTotal) {
      result = 'Dealer wins!';
      setScores(s => ({ ...s, dealer: s.dealer + 1 }));
    } else {
      result = 'Push (tie).';
    }
    setGameState('roundOver');
    setActionLog(log => [...log, "Dealer stands.", result]);
    setActiveModal({ type: 'roundResult', message: result, finalDealerHand: currentHand });
  };

  const renderModalContent = () => {
    if (!activeModal) return null;
    switch (activeModal.type) {
      case 'welcome':
        return <Modal title="Card Counting 101" onClose={() => setActiveModal({ type: 'warning' })}><p>Welcome! The most popular card counting method is the Hi-Lo system. Cards 2-6 count as +1, 7-9 as 0, and 10-A as -1.</p></Modal>;
      case 'warning':
        return <Modal title="Warning" onClose={() => setActiveModal({ type: 'rules' })}><p>Casinos may ask you to leave if they suspect you are counting cards. This tool is for practice and educational purposes only.</p></Modal>;
      case 'rules':
        return <Modal title="Blackjack Rules" onClose={() => activeModal.fromHelp ? setActiveModal(null) : setActiveModal({ type: 'deckSelection' })}><p>Your goal is to beat the dealer without exceeding 21. You can "Hit" to take more cards or "Stand" to hold your total. The dealer must hit until their hand is 17 or higher.</p></Modal>;
      case 'deckSelection':
        return <Modal title="Deck Selection" showCloseButton={false}><p>How many decks would you like to play with?</p><div className="deck-selection">{[1, 2, 4, 6, 8].map(deckCount => <button key={deckCount} onClick={() => setNumDecks(deckCount)}>{deckCount} Deck{deckCount > 1 ? 's' : ''}</button>)}</div></Modal>;
      case 'roundResult':
        const finalDealerHand = activeModal.finalDealerHand || dealerHand;
        const finalDealerTotal = calculateHandValue(finalDealerHand);
        return <Modal title="Round Result" showCloseButton={false}><p>{activeModal.message}</p><p><strong>Your Hand ({playerTotal}):</strong> {playerHand.map(c => `${c.value}${c.suit}`).join(', ')}</p><p><strong>Dealer's Hand ({finalDealerTotal}):</strong> {finalDealerHand.map(c => `${c.value}${c.suit}`).join(', ')}</p><p><strong>Final Count: {runningCount}</strong></p><div className="round-buttons"><button onClick={() => setActiveModal(null)}>View Board</button></div></Modal>;
      case 'howToCount':
        return <Modal title="How to Count Cards" onClose={() => setActiveModal(null)}><p>The Hi-Lo system: Cards 2-6 are +1. Cards 7-9 are 0. Cards 10, J, Q, K, A are -1.</p></Modal>;
      default: return null;
    }
  };

  return (
    <div className={`App ${theme}`}>
      <div className="content-wrapper">
        {renderModalContent()}
        <div className="header">
          <div className="top-row">
            <div className={`count-display ${showCount ? "revealed" : ""}`} onClick={() => setShowCount(!showCount)}>Count: {runningCount}</div>
            {/* --- "New Game" button moved here --- */}
            <div className="help-buttons">
              <button onClick={() => setActiveModal({ type: 'howToCount'})}>How to Count</button>
              <button onClick={() => setActiveModal({ type: 'rules', fromHelp: true })}>Rules</button>
              <button onClick={handleNewGame}>New Game</button>
            </div>
          </div>
          <div className="scoreboard">
            <p>Player: {scores.player}</p>
            <p>Dealer: {scores.dealer}</p>
          </div>
          <div className="theme-selector">
            <label htmlFor="theme-select">Theme: </label>
            <select id="theme-select" value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="default">Default</option>
              <option value="neumorphic">Neumorphic</option>
              <option value="dark-mode">Dark Mode</option>
              <option value="translucent">Translucent</option>
            </select>
          </div>
        </div>
        <div className="game-board">
          <div className="hands">
            <div className="hand dealer-hand">
              <h3>Dealer's Hand (Total: {gameState === 'playerTurn' ? '?' : dealerTotal})</h3>
              <div className="cards">
                {dealerHand.map((card, index) => (
                  <div key={index} className="card">
                    {index === 1 && gameState === 'playerTurn' ? '??' : `${card.value}${card.suit}`}
                  </div>
                ))}
              </div>
            </div>
            <div className="hand player-hand">
              <h3>Your Hand (Total: {playerTotal})</h3>
              <div className="cards">{playerHand.map((card, index) => <div key={index} className="card">{`${card.value}${card.suit}`}</div>)}</div>
              <div className="game-buttons">
                {/* --- "New Game" button removed from here --- */}
                {gameState === 'playerTurn' ? (
                  <>
                    <button onClick={handleHit}>Hit</button>
                    <button onClick={handleStand}>Stand</button>
                  </>
                ) : (
                  <button onClick={() => startNewRound()}>Continue</button>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="action-log">
          <h3>Action Log</h3>
          {actionLog.slice().reverse().map((entry, index) => <p key={index}>{entry}</p>)}
        </div>
      </div>
    </div>
  );
}

export default App;