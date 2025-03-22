// src/App.js
import React, { useState, useEffect } from "react";
import "./App.css";

// Modal component for popups
const Modal = ({ title, children, onClose, showCloseButton = true }) => {
  return (
    <div className="modal-overlay">
      <div className="modal">
        {title && <h2>{title}</h2>}
        <div className="modal-content">{children}</div>
        {showCloseButton && (
          <button onClick={onClose} className="modal-button">
            Understand
          </button>
        )}
      </div>
    </div>
  );
};

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
    let j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const cardCountValue = (card) => {
  const { value } = card;
  if (["2", "3", "4", "5", "6"].includes(value)) return 1;
  if (["10", "J", "Q", "K", "A"].includes(value)) return -1;
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
      total += parseInt(card.value);
    }
  });
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
};

function App() {
  // Modal steps: 1 = card counting instructions, 2 = casino warning, 3 = blackjack rules, 4 = deck selection, 0 = game started.
  const [modalStep, setModalStep] = useState(1);
  const [showCount, setShowCount] = useState(false);
  const [numDecks, setNumDecks] = useState(null);
  const [deckChoice, setDeckChoice] = useState(null); // temporary state for deck selection buttons
  const [pile, setPile] = useState([]);
  const [trash, setTrash] = useState([]);
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [actionLog, setActionLog] = useState([]);
  const [scores, setScores] = useState({ player: 0, dealer: 0 });
  const [disableButtons, setDisableButtons] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(null);
  // Running count persists through rounds and resets only on New Game.
  const [runningCount, setRunningCount] = useState(0);
  // Round result modal state.
  const [roundResult, setRoundResult] = useState(null);
  // Theme selection state.
  const [theme, setTheme] = useState(localStorage.getItem("selectedTheme") || "default");

  // Persist theme selection.
  useEffect(() => {
    localStorage.setItem("selectedTheme", theme);
  }, [theme]);

  // Deal initial hands and update runningCount (visible cards: player’s two cards and dealer's first card)
  const dealInitialCards = (deck) => {
    if (deck.length < 4) return deck;
    const newPlayerHand = [deck[0], deck[1]];
    const newDealerHand = [deck[2], deck[3]];
    setPlayerHand(newPlayerHand);
    setDealerHand(newDealerHand);
    setRunningCount((prev) =>
      prev + cardCountValue(deck[0]) + cardCountValue(deck[1]) + cardCountValue(deck[2])
    );
    setActionLog([
      "Player dealt 2 cards",
      `Dealer shows ${newDealerHand[0].value}${newDealerHand[0].suit}`,
    ]);
    return deck.slice(4);
  };

  // When numDecks is chosen, create & shuffle deck, then deal initial cards immediately.
  useEffect(() => {
    if (numDecks) {
      const newDeck = createDeck(numDecks);
      const shuffled = shuffleDeck(newDeck);
      const remainingDeck = dealInitialCards(shuffled);
      setPile(remainingDeck);
    }
  }, [numDecks]);

  // Check for immediate blackjack and show round result modal.
  useEffect(() => {
    if (modalStep === 0 && playerHand.length === 2 && dealerHand.length === 2) {
      const pTotal = calculateHandValue(playerHand);
      const dTotal = calculateHandValue(dealerHand);
      if (pTotal === 21 || dTotal === 21) {
        let resultMsg = "";
        if (pTotal === 21 && dTotal === 21) {
          resultMsg = "Both have blackjack. Push.";
        } else if (pTotal === 21) {
          resultMsg = "Player has blackjack! Player wins!";
          setScores((prev) => ({ ...prev, player: prev.player + 1 }));
        } else if (dTotal === 21) {
          resultMsg = "Dealer has blackjack! Dealer wins!";
          setScores((prev) => ({ ...prev, dealer: prev.dealer + 1 }));
        }
        setDisableButtons(true);
        setRoundResult({
          result: resultMsg,
          playerHand,
          dealerHand,
          playerTotal: pTotal,
          dealerTotal: dTotal,
        });
      }
    }
  }, [playerHand, dealerHand, modalStep]);

  // Start a new round (runningCount persists).
  const startNewRound = () => {
    setTrash((prev) => [...prev, ...playerHand, ...dealerHand]);
    setPlayerHand([]);
    setDealerHand([]);
    setActionLog([]);
    if (pile.length < 4) {
      alert("Not enough cards left! Game over.");
      return;
    }
    const remainingDeck = dealInitialCards(pile);
    setPile(remainingDeck);
    setDisableButtons(false);
  };

  // Player chooses to hit; update runningCount for the new card.
  const handleHit = () => {
    if (pile.length < 1 || disableButtons) return;
    const card = pile[0];
    setPlayerHand((prev) => [...prev, card]);
    setRunningCount((prev) => prev + cardCountValue(card));
    setPile((prev) => prev.slice(1));
  };

  // Player stands; begin dealer turn.
  const handleStand = () => {
    setDisableButtons(true);
    setActionLog((prev) => [...prev, "Player stands. Dealer turn..."]);
    dealerTurn();
  };

  // Async dealer turn: hit until total is 17 or more.
  const dealerTurn = async () => {
    let currentDealerHand = [...dealerHand];
    let currentPile = [...pile];
    if (currentDealerHand.length === 2) {
      setRunningCount((prev) => prev + cardCountValue(currentDealerHand[1]));
    }
    while (calculateHandValue(currentDealerHand) < 17 && currentPile.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const card = currentPile.shift();
      currentDealerHand.push(card);
      setDealerHand([...currentDealerHand]);
      setRunningCount((prev) => prev + cardCountValue(card));
      setPile([...currentPile]);
      setActionLog((prev) => [...prev, `Dealer hits: ${card.value}${card.suit}`]);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setActionLog((prev) => [...prev, "Dealer stands. Determining winner..."]);
    determineWinner(currentDealerHand);
  };

  // Determine winner based on blackjack rules and show round result modal.
  const determineWinner = (finalDealerHand = dealerHand) => {
    const playerTotal = calculateHandValue(playerHand);
    const dealerTotal = calculateHandValue(finalDealerHand);
    let resultMsg = "";
    if (playerTotal > 21) {
      resultMsg = "Player busts. Dealer wins.";
      setScores((prev) => ({ ...prev, dealer: prev.dealer + 1 }));
    } else if (dealerTotal > 21) {
      resultMsg = "Dealer busts. Player wins.";
      setScores((prev) => ({ ...prev, player: prev.player + 1 }));
    } else if (playerTotal > dealerTotal) {
      resultMsg = "Player wins!";
      setScores((prev) => ({ ...prev, player: prev.player + 1 }));
    } else if (dealerTotal > playerTotal) {
      resultMsg = "Dealer wins!";
      setScores((prev) => ({ ...prev, dealer: prev.dealer + 1 }));
    } else {
      resultMsg = "Push (tie).";
    }
    setActionLog((prev) => [...prev, resultMsg]);
    setRoundResult({
      result: resultMsg,
      playerHand,
      dealerHand: finalDealerHand,
      playerTotal,
      dealerTotal,
    });
  };

  // Auto-check for bust after a hit.
  useEffect(() => {
    const total = calculateHandValue(playerHand);
    if (total > 21 && playerHand.length > 0) {
      setActionLog((prev) => [...prev, "Player busts!"]);
      setScores((prev) => ({ ...prev, dealer: prev.dealer + 1 }));
      setDisableButtons(true);
      setRoundResult({
        result: "Player busts. Dealer wins.",
        playerHand,
        dealerHand,
        playerTotal: total,
        dealerTotal: calculateHandValue(dealerHand),
      });
    }
  }, [playerHand]);

  // Reset game completely (including runningCount) and show all modals again.
  const handleNewGame = () => {
    setScores({ player: 0, dealer: 0 });
    setTrash([]);
    setPile([]);
    setPlayerHand([]);
    setDealerHand([]);
    setActionLog([]);
    setNumDecks(null);
    setDeckChoice(null);
    setDisableButtons(false);
    setRunningCount(0);
    setRoundResult(null);
    setModalStep(1);
  };

  return (
    <div className={`App ${theme}`}>
      <div className="content-wrapper">
        {/* Header Section */}
        <div className="header">
          <div className="top-row">
            <div
              className={`count-display ${showCount ? "revealed" : ""}`}
              onClick={() => setShowCount(!showCount)}
            >
              Count: {runningCount}
            </div>
            <div className="help-buttons">
              <button onClick={() => setShowHelpModal("count")}>
                How to Count Cards
              </button>
              <button onClick={() => setShowHelpModal("rules")}>
                Rules
              </button>
            </div>
          </div>
          <div className="scoreboard">
            <p>Player: {scores.player}</p>
            <p>Dealer: {scores.dealer}</p>
          </div>
          <div className="theme-selector">
            <label htmlFor="theme-select">Theme: </label>
            <select
              id="theme-select"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            >
              <option value="default">Default</option>
              <option value="neumorphic">Neumorphic</option>
              <option value="dark-mode">Dark Mode</option>
              <option value="translucent">Translucent</option>
            </select>
          </div>
        </div>

        {/* Main Game Board */}
        <div className="game-board">
          <div className="hands">
            <div className="hand dealer-hand">
              <h3>Dealer's Hand (Total: {calculateHandValue(dealerHand)})</h3>
              <div className="cards">
                {dealerHand.map((card, index) => (
                  <div key={index} className="card">
                    {index === 1 && !disableButtons ? "??" : `${card.value}${card.suit}`}
                  </div>
                ))}
              </div>
            </div>
            <div className="hand player-hand">
              <h3>Your Hand (Total: {calculateHandValue(playerHand)})</h3>
              <div className="cards">
                {playerHand.map((card, index) => (
                  <div key={index} className="card">
                    {`${card.value}${card.suit}`}
                  </div>
                ))}
              </div>
              <div className="game-buttons">
                <button onClick={handleHit} disabled={disableButtons}>
                  Hit
                </button>
                <button onClick={handleStand} disabled={disableButtons}>
                  Stand
                </button>
                <button onClick={handleNewGame}>New Game</button>
              </div>
            </div>
          </div>
        </div>

        {/* Action Log */}
        <div className="action-log">
          <h3>Action Log</h3>
          {actionLog.map((entry, index) => (
            <p key={index}>{entry}</p>
          ))}
        </div>

        {/* Help Modals */}
        {showHelpModal === "count" && (
          <Modal title="How to Count Cards" onClose={() => setShowHelpModal(null)}>
            <p>
              The most popular system is the Hi-Lo method: Cards 2-6 count as +1,
              7-9 count as 0, and 10, J, Q, K, A count as -1.
            </p>
          </Modal>
        )}
        {showHelpModal === "rules" && (
          <Modal title="Blackjack Rules" onClose={() => setShowHelpModal(null)}>
            <p>
              The goal is to get as close to 21 without going over. You and the dealer are both dealt two cards.
              You may choose to hit or stand. The dealer must hit until reaching 17.
            </p>
          </Modal>
        )}

        {/* Initial Instruction Modals */}
        {modalStep === 1 && (
          <Modal title="Card Counting 101" onClose={() => setModalStep(2)}>
            <p>
              Welcome! The most popular card counting method is the Hi-Lo system.
              In this system, cards 2-6 count as +1, 7-9 count as 0, and 10, J, Q, K, A count as -1.
            </p>
          </Modal>
        )}
        {modalStep === 2 && (
          <Modal title="Warning" onClose={() => setModalStep(3)}>
            <p>
              Casinos are able to kick you out if they catch you counting cards.
            </p>
          </Modal>
        )}
        {modalStep === 3 && (
          <Modal title="Blackjack Rules" onClose={() => setModalStep(4)}>
            <p>
              In blackjack, your goal is to beat the dealer without exceeding 21.
              Both you and the dealer start with two cards. You can hit to take more cards
              or stand to hold your total. The dealer must hit until reaching 17.
            </p>
          </Modal>
        )}
        {modalStep === 4 && (
          <Modal title="Deck Selection" onClose={() => {}} showCloseButton={false}>
            <p>How many decks would you like to play with?</p>
            <div className="deck-selection">
              {[1, 2, 4, 6, 8].map((deck) => (
                <button
                  key={deck}
                  onClick={() => setDeckChoice(deck)}
                  className={deckChoice === deck ? "selected" : ""}
                >
                  {deck} Deck{deck > 1 ? "s" : ""}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                if (deckChoice) {
                  setNumDecks(deckChoice);
                  setModalStep(0);
                } else {
                  alert("Please select a deck option");
                }
              }}
            >
              Confirm
            </button>
          </Modal>
        )}

        {/* Round Result Modal */}
        {roundResult && (
          <Modal title="Round Result" onClose={() => {}} showCloseButton={false}>
            <p>{roundResult.result}</p>
            <p>
              <strong>Your Hand ({roundResult.playerTotal}):</strong>{" "}
              {roundResult.playerHand.map((card) => `${card.value}${card.suit}`).join(", ")}
            </p>
            <p>
              <strong>Dealer's Hand ({roundResult.dealerTotal}):</strong>{" "}
              {roundResult.dealerHand.map((card) => `${card.value}${card.suit}`).join(", ")}
            </p>
            <div className="round-buttons">
              <button
                onClick={() => {
                  setRoundResult(null);
                  startNewRound();
                }}
              >
                Continue
              </button>
              <button
                onClick={() => {
                  setRoundResult(null);
                  handleNewGame();
                }}
              >
                New Game
              </button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}

export default App;
