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
const cardValues = { "A": 11, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, "J": 10, "Q": 10, "K": 10 };

const createDeck = (numDecks) => {
  let deck = [];
  for (let d = 0; d < numDecks; d++) {
    for (let suit of suits) {
      for (let value of values) {
        deck.push({ suit, value, id: `${value}-${suit}-${d}-${Math.random()}` });
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
    if (card.value === "A") aces++;
    total += cardValues[card.value];
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
  const [theme, setTheme] = useState(() => localStorage.getItem("selectedTheme") || "default");
  
  const [pile, setPile] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [playerHands, setPlayerHands] = useState([[]]);
  const [activeHandIndex, setActiveHandIndex] = useState(0);
  const [gameState, setGameState] = useState('betting');
  const [handResults, setHandResults] = useState([]);

  const [scores, setScores] = useState({ player: 0, dealer: 0 });
  const [runningCount, setRunningCount] = useState(0);
  const [showCount, setShowCount] = useState(false);
  const [actionLog, setActionLog] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);

  const playerTotals = useMemo(() => playerHands.map(calculateHandValue), [playerHands]);
  const dealerTotal = useMemo(() => calculateHandValue(dealerHand), [dealerHand]);
  
  const canSplit = useMemo(() => {
    const hand = playerHands[0];
    if (!hand || playerHands.length !== 1 || hand.length !== 2) {
      return false;
    }
    return cardValues[hand[0].value] === cardValues[hand[1].value];
  }, [playerHands]);

  useEffect(() => localStorage.setItem("selectedTheme", theme), [theme]);

  const handleNewGame = useCallback(() => {
    setNumDecks(null);
    setScores({ player: 0, dealer: 0 });
    setRunningCount(0);
    setPlayerHands([[]]);
    setDealerHand([]);
    setPile([]);
    setActionLog([]);
    setGameState('betting');
    setActiveModal({ type: 'welcome' });
    setShowCount(false);
  }, []);

  const startNewRound = useCallback((initialDeck) => {
    setIsProcessing(true);
    setPile(currentPile => {
      const deckToUse = initialDeck || currentPile;
      if (deckToUse.length < 10) {
        alert("Not enough cards for a new round. Please start a new game.");
        handleNewGame();
        return currentPile;
      }
      
      const newPlayerHand = [deckToUse[0], deckToUse[2]];
      const newDealerHand = [deckToUse[1], deckToUse[3]];
      
      setPlayerHands([newPlayerHand]);
      setDealerHand(newDealerHand);
      setGameState('playerTurn');
      setActiveHandIndex(0);
      setHandResults([]);

      setRunningCount(rc => rc + [deckToUse[0], deckToUse[1], deckToUse[2]].map(cardCountValue).reduce((a, b) => a + b, 0));
      setActionLog([`Round started.`, `Dealer shows ${newDealerHand[0].value}${newDealerHand[0].suit}`]);
      setActiveModal(null);
      setIsProcessing(false);
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
    if (gameState !== 'playerTurn' || isProcessing || playerHands[activeHandIndex]?.length < 2) return;
    
    const currentTotal = playerTotals[activeHandIndex];
    
    if (currentTotal >= 21) {
      if (currentTotal > 21) {
        setActionLog(log => [...log, `Hand ${activeHandIndex + 1} busts with ${currentTotal}.`]);
        setScores(s => ({ ...s, dealer: s.dealer + 1 }));
      } else {
        setActionLog(log => [...log, `Hand ${activeHandIndex + 1} has 21.`]);
      }

      if (playerHands.length > 1 && activeHandIndex === 0) {
        setTimeout(() => setActiveHandIndex(1), 1000);
      } else {
        setTimeout(() => dealerPlayLogic(), 1000);
      }
    }
  }, [playerTotals, activeHandIndex, gameState, playerHands.length, isProcessing]);


  const dealerPlayLogic = async () => {
    if (gameState === 'dealerTurn') return;
    
    const allHandsBusted = playerTotals.every(total => total > 21);
    if (allHandsBusted) {
        setActionLog(log => [...log, "All player hands busted. Dealer wins."]);
        setGameState('roundOver');
        const results = playerHands.map(() => 'Player Busts');
        setHandResults(results);
        setActiveModal({ type: 'roundResult', finalDealerHand: dealerHand });
        return;
    }

    setGameState('dealerTurn');
    setIsProcessing(true);
    setActionLog(log => [...log, "Player's turn is over. Dealer's turn..."]);
    
    await new Promise(r => setTimeout(r, 500));
    setRunningCount(rc => rc + cardCountValue(dealerHand[1]));
    setActionLog(log => [...log, `Dealer reveals: ${dealerHand[1].value}${dealerHand[1].suit}`]);
    
    let currentDealerHand = [...dealerHand];
    let currentPile = [...pile];
    while (calculateHandValue(currentDealerHand) < 17 && currentPile.length > 0) {
      await new Promise(r => setTimeout(r, 800));
      const card = currentPile.shift();
      currentDealerHand.push(card);
      setDealerHand([...currentDealerHand]);
      setRunningCount(rc => rc + cardCountValue(card));
      setActionLog(log => [...log, `Dealer hits: ${card.value}${card.suit}`]);
    }
    setPile(currentPile);
    await new Promise(r => setTimeout(r, 1000));
    
    const finalDealerTotal = calculateHandValue(currentDealerHand);
    const results = playerHands.map((hand, index) => {
      const playerTotal = playerTotals[index];
      if (playerTotal > 21) return 'Player Busts';
      if (finalDealerTotal > 21) return 'Dealer Busts - You Win!';
      if (playerTotal === 21 && hand.length === 2 && playerHands.length === 1) return 'Blackjack - You Win!';
      if (playerTotal > finalDealerTotal) return 'You Win!';
      if (finalDealerTotal > playerTotal) return 'Dealer Wins';
      return 'Push';
    });
    setHandResults(results);
    
    let newScores = {...scores};
    results.forEach(res => {
        if(res.includes('You Win!')) newScores.player++;
        if(res.includes('Dealer Wins')) newScores.dealer++;
    });
    setScores(newScores);

    setGameState('roundOver');
    setIsProcessing(false);
    setActiveModal({ type: 'roundResult', finalDealerHand: currentDealerHand });
  };

  const handleHit = () => {
    if (isProcessing || gameState !== 'playerTurn') return;
    setIsProcessing(true);
    
    const card = pile[0];
    const newPlayerHands = playerHands.map((hand, index) => 
      index === activeHandIndex ? [...hand, card] : hand
    );
    
    setPlayerHands(newPlayerHands);
    setPile(p => p.slice(1));
    setRunningCount(rc => rc + cardCountValue(card));
    setActionLog(log => [...log, `Hand ${activeHandIndex + 1} hits and gets a ${card.value}${card.suit}`]);
    
    setIsProcessing(false);
  };
  
  const handleStand = () => {
    if (isProcessing || gameState !== 'playerTurn') return;
    setActionLog(log => [...log, `Player stands on Hand ${activeHandIndex + 1}.`]);
    if (playerHands.length > 1 && activeHandIndex === 0) {
      setActiveHandIndex(1);
    } else {
      dealerPlayLogic();
    }
  };

  const handleSplit = () => {
    if (!canSplit || isProcessing) return;
    setIsProcessing(true);
    setIsSplitting(true);

    setTimeout(() => {
      const originalHand = playerHands[0];
      const newHands = [[originalHand[0]], [originalHand[1]]];
      const newPile = [...pile];
      
      newHands[0].push(newPile.shift());
      newHands[1].push(newPile.shift());
      
      setPlayerHands(newHands);
      setPile(newPile);
      setRunningCount(rc => rc + cardCountValue(newHands[0][1]) + cardCountValue(newHands[1][1]));
      setActionLog(log => [...log, `Player splits into two hands.`]);
      setIsSplitting(false);
      setIsProcessing(false);
    }, 600);
  };

  const renderHand = (hand, index) => {
    const total = playerTotals[index];
    let handClass = 'hand player-hand';
    if (gameState === 'playerTurn' && index === activeHandIndex) handClass += ' active-hand';
    if ((gameState === 'dealerTurn' || gameState === 'roundOver') && total <= 21) handClass += ' stood-hand';
    const isCurrentHandTurn = gameState === 'playerTurn' && index === activeHandIndex;

    return (
      <div key={index} className={handClass}>
        <h3>
          {playerHands.length > 1 ? `Hand ${index + 1}` : 'Your Hand'} (Total: {total})
        </h3>
        <div className="cards">
          {hand.map((card, cardIndex) => (
            <div 
              key={card.id} 
              className={`card ${isSplitting && cardIndex < 2 ? 'splitting' : ''} ${isSplitting && cardIndex === 0 ? 'split-to-top' : ''} ${isSplitting && cardIndex === 1 ? 'split-to-bottom' : ''}`}
            >
              {card.value}{card.suit}
            </div>
          ))}
        </div>
        <div className="game-buttons">
          {isCurrentHandTurn && (
            <>
              <button onClick={handleHit} disabled={isProcessing || total >= 21}>Hit</button>
              <button onClick={handleStand} disabled={isProcessing || total >= 21}>Stand</button>
              {canSplit && <button onClick={handleSplit} disabled={isProcessing}>Split</button>}
            </>
          )}
        </div>
      </div>
    );
  };

  const renderModalContent = () => {
    if (!activeModal) return null;
    switch (activeModal.type) {
        // --- THIS IS THE FIX ---
        case 'welcome':
            return <Modal title="Card Counting Trainer" onClose={() => setActiveModal({ type: 'warning' })}><p>Welcome! Practice your card counting and blackjack skills.</p></Modal>;
        // --- END OF FIX ---
        case 'warning':
            return <Modal title="For Educational Use" onClose={() => setActiveModal({ type: 'rules' })}><p>This tool is for practice and educational purposes only.</p></Modal>;
        case 'rules':
            return <Modal title="Blackjack Rules" onClose={() => activeModal.fromHelp ? setActiveModal(null) : setActiveModal({ type: 'deckSelection' })}><p>Goal: Beat the dealer without exceeding 21. Split: If your first two cards have the same point value, you can split them into two separate hands.</p></Modal>;
        case 'deckSelection':
            return <Modal title="Deck Selection" showCloseButton={false}><p>How many decks would you like to play with?</p><div className="deck-selection">{[1, 2, 4, 6, 8].map(deckCount => <button key={deckCount} onClick={() => setNumDecks(deckCount)}>{deckCount} Deck{deckCount > 1 ? 's' : ''}</button>)}</div></Modal>;
        case 'roundResult':
            return (
              <Modal title="Round Result" showCloseButton={false}>
                {playerHands.map((hand, index) => (
                  <p key={index}><strong>Hand {index + 1} ({playerTotals[index]}):</strong> {handResults[index]}</p>
                ))}
                <p><strong>Dealer's Hand ({dealerTotal}):</strong> {activeModal.finalDealerHand.map(c => `${c.value}${c.suit}`).join(', ')}</p>
                <p><strong>Final Count: {runningCount}</strong></p>
                <div className="round-buttons">
                  <button onClick={() => setActiveModal(null)}>View Board</button>
                </div>
              </Modal>
            );
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
            <div className={`hands ${playerHands.length > 1 ? 'hands-split' : ''}`}>
                <div className="hand dealer-hand">
                    <h3>Dealer's Hand (Total: {gameState === 'playerTurn' ? '?' : dealerTotal})</h3>
                    <div className="cards">
                        {dealerHand.map((card, index) => (
                            <div key={card.id} className="card">
                                {index === 1 && gameState === 'playerTurn' ? '??' : `${card.value}${card.suit}`}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="player-hands-container">
                  {playerHands[0]?.length > 0 && playerHands.map(renderHand)}
                </div>
            </div>
        </div>
        
        {gameState === 'roundOver' && (
          <div className="game-buttons" style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
            <button onClick={() => startNewRound()}>Start Next Round</button>
          </div>
        )}

        <div className="action-log">
            <h3>Action Log</h3>
            {actionLog.slice().reverse().map((entry, index) => <p key={index}>{entry}</p>)}
        </div>
      </div>
    </div>
  );
}

export default App;
