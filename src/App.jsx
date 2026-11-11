import React, { useState, useEffect } from 'react';
import { GreenCard, PurpleCard, CardBack } from './components/Cards';
import { db } from './firebase';
import { ref, set, get, child, update, onValue } from 'firebase/database';

const SHEET_ID = '1ZMeRbwlUTBUHxoF1arWMCwHg-GfAB7jmJOh5mJlJnyA';
const WINNING_SCORE = 7;

export default function App() {
  const [greenCards, setGreenCards] = useState([]);
  const [purpleCards, setPurpleCards] = useState([]);
  const [loading, setLoading] = useState(true);

  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomData, setRoomData] = useState(null);
  
  const [playerHand, setPlayerHand] = useState([]);
  const [myDeck, setMyDeck] = useState([]);
  const [selectedCards, setSelectedCards] = useState([]);

  useEffect(() => {
    async function loadCards() {
      try {
        const greenRes = await fetch(`https://opensheet.elk.sh/${SHEET_ID}/GreenCards`);
        const greenData = await greenRes.json();
        const purpleRes = await fetch(`https://opensheet.elk.sh/${SHEET_ID}/PurpleCards`);
        const purpleData = await purpleRes.json();

        const cleanGreen = greenData
          .filter(row => row.text && row.text.toLowerCase() !== 'text')
          .map(row => ({
            id: row.id,
            text: row.text,
            pick: Number(row.pick) || 1,
            pack: row.pack || 'Classic'
          }));

        const cleanPurple = purpleData
          .filter(row => row.text && row.text.toLowerCase() !== 'text')
          .map(row => ({
            id: row.id,
            text: row.text,
            jp: row.jp || '',
            pack: row.pack || 'Classic'
          }));

        setGreenCards(cleanGreen);
        setPurpleCards(cleanPurple);
        setLoading(false);
      } catch (error) {
        console.error("Failed to fetch cards:", error);
        setLoading(false);
      }
    }
    loadCards();
  }, []);

  useEffect(() => {
    if (!currentRoom) return;

    const roomRef = ref(db, `rooms/${currentRoom}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setRoomData(data);
        setSelectedCards([]);
      }
    });

    return () => unsubscribe();
  }, [currentRoom]);

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const shuffleArray = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.map(card => ({ ...card, uniqueKey: Math.random() + Math.random() }));
  };

  const initPlayerDeckAndHand = (allPurpleCards) => {
    const shuffled = shuffleArray(allPurpleCards);
    const initialHand = shuffled.slice(0, 7);
    const remainingDeck = shuffled.slice(7);

    setPlayerHand(initialHand);
    setMyDeck(remainingDeck);
  };

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      alert("Please enter your name first!");
      return;
    }

    const newCode = generateRoomCode();
    const playerKey = `p_${Date.now()}`;

    try {
      await set(ref(db, `rooms/${newCode}`), {
        host: playerKey,
        status: 'lobby',
        players: {
          [playerKey]: { name: playerName, score: 0, isHost: true }
        }
      });
      setCurrentRoom(newCode);
      initPlayerDeckAndHand(purpleCards);
    } catch (err) {
      console.error("Error creating room:", err);
    }
  };

  const handleJoinRoom = async () => {
    if (!playerName.trim() || !roomCode.trim()) {
      alert("Please enter your name and a room code!");
      return;
    }

    const formattedCode = roomCode.toUpperCase().trim();
    const dbRef = ref(db);

    try {
      const snapshot = await get(child(dbRef, `rooms/${formattedCode}`));
      if (snapshot.exists()) {
        const playerKey = `p_${Date.now()}`;
        await set(ref(db, `rooms/${formattedCode}/players/${playerKey}`), {
          name: playerName,
          score: 0,
          isHost: false
        });
        setCurrentRoom(formattedCode);
        initPlayerDeckAndHand(purpleCards);
      } else {
        alert("Room not found! Check your code.");
      }
    } catch (err) {
      console.error("Error joining room:", err);
    }
  };

  const handleStartGame = async () => {
    if (greenCards.length === 0) return;
    const randomGreen = greenCards[Math.floor(Math.random() * greenCards.length)];
    const playerKeys = Object.keys(roomData.players);
    const randomJudge = playerKeys[Math.floor(Math.random() * playerKeys.length)];

    await update(ref(db, `rooms/${currentRoom}`), {
      status: 'playing',
      currentGreen: randomGreen,
      judge: randomJudge,
      submissions: null,
      winner: null
    });
  };

  const handleCardClick = (card) => {
    const requiredPick = roomData.currentGreen?.pick || 1;
    const selectedIndex = selectedCards.findIndex(c => c.uniqueKey === card.uniqueKey);

    if (selectedIndex !== -1) {
      setSelectedCards(selectedCards.filter(c => c.uniqueKey !== card.uniqueKey));
    } else {
      if (selectedCards.length < requiredPick) {
        setSelectedCards([...selectedCards, card]);
      } else if (requiredPick === 1) {
        setSelectedCards([card]);
      }
    }
  };

  const handleSubmitCard = async () => {
    const requiredPick = roomData.currentGreen?.pick || 1;
    if (selectedCards.length !== requiredPick) {
      alert(`Please select exactly ${requiredPick} card${requiredPick > 1 ? 's' : ''}!`);
      return;
    }

    const playerKey = Object.keys(roomData.players).find(
      k => roomData.players[k].name === playerName
    );

    await set(ref(db, `rooms/${currentRoom}/submissions/${playerKey}`), {
      cards: selectedCards.map(c => ({ text: c.text, jp: c.jp })),
      playerKey: playerKey 
    });

    const submittedKeys = selectedCards.map(c => c.uniqueKey);
    setPlayerHand(prev => prev.filter(c => !submittedKeys.includes(c.uniqueKey)));
    
    let currentDeck = [...myDeck];
    let newCardsToAdd = [];
    for (let i = 0; i < selectedCards.length; i++) {
      if (currentDeck.length > 0) {
        newCardsToAdd.push(currentDeck[0]);
        currentDeck = currentDeck.slice(1);
      }
    }
    setMyDeck(currentDeck);
    setPlayerHand(prev => [...prev, ...newCardsToAdd]);
    setSelectedCards([]);

    // Check if all non-judges have submitted
    const snapshot = await get(ref(db, `rooms/${currentRoom}`));
    const latestRoom = snapshot.val();
    if (latestRoom) {
      const totalPlayers = Object.keys(latestRoom.players || {}).length;
      const submissionsCount = Object.keys(latestRoom.submissions || {}).length;
      
      if (submissionsCount >= totalPlayers - 1) {
        await update(ref(db, `rooms/${currentRoom}`), { status: 'judging' });
      }
    }
  };

  const handlePickWinner = async (winnerKey) => {
    const currentScore = roomData.players[winnerKey]?.score || 0;
    const newScore = currentScore + 1;
    
    await update(ref(db, `rooms/${currentRoom}/players/${winnerKey}`), {
      score: newScore
    });

    // Check if player reached 7 points (Win condition)
    if (newScore >= WINNING_SCORE) {
      await update(ref(db, `rooms/${currentRoom}`), {
        status: 'game-over',
        winner: roomData.players[winnerKey].name
      });
      return;
    }

    const randomGreen = greenCards[Math.floor(Math.random() * greenCards.length)];
    const playerKeys = Object.keys(roomData.players);
    const currentJudgeIndex = playerKeys.indexOf(roomData.judge);
    const nextJudge = playerKeys[(currentJudgeIndex + 1) % playerKeys.length];

    await update(ref(db, `rooms/${currentRoom}`), {
      status: 'playing',
      currentGreen: randomGreen,
      judge: nextJudge,
      submissions: null
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-emerald-400 flex items-center justify-center text-xl font-bold">
        Loading Judgy Game...
      </div>
    );
  }

  // --- LOGIN SCREEN ---
  if (!currentRoom || !roomData) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6">
        <div className="bg-zinc-900 border-2 border-emerald-800/60 p-8 rounded-2xl shadow-2xl max-w-md w-full flex flex-col gap-6">
          <div className="text-center">
            <h1 className="text-5xl font-extrabold tracking-tight text-emerald-400 mb-2">JUDGY</h1>
            <p className="text-zinc-400 text-sm">The party game of questionable choices.</p>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-emerald-300 mb-1">Your Name</label>
              <input 
                type="text" 
                placeholder="e.g. Principal Smith" 
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button 
              onClick={handleCreateRoom}
              className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold py-3 rounded-xl transition-colors shadow-lg shadow-emerald-900/30"
            >
              Create New Room
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-zinc-800"></div>
              <span className="flex-shrink mx-4 text-zinc-500 text-xs uppercase font-bold">Or join</span>
              <div className="flex-grow border-t border-zinc-800"></div>
            </div>

            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="ROOM CODE" 
                maxLength={4}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                className="w-1/2 bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-white uppercase text-center tracking-widest font-bold focus:outline-none focus:border-emerald-500"
              />
              <button 
                onClick={handleJoinRoom}
                className="w-1/2 bg-purple-700 hover:bg-purple-600 font-bold py-3 rounded-xl transition-colors shadow-lg shadow-purple-900/30"
              >
                Join Room
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- LOBBY SCREEN (Host Only Start Button) ---
  if (roomData.status === 'lobby') {
    const myPlayerEntry = Object.entries(roomData.players || {}).find(([_, p]) => p.name === playerName);
    const isHost = myPlayerEntry ? myPlayerEntry[1].isHost : false;

    return (
      <div className="min-h-screen bg-zinc-950 text-white p-8 flex flex-col items-center">
        <div className="max-w-3xl w-full bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl mb-8 flex justify-between items-center">
          <div>
            <span className="text-xs text-emerald-400 uppercase tracking-widest font-bold">Room Code</span>
            <h2 className="text-4xl font-extrabold tracking-widest text-white">{currentRoom}</h2>
          </div>
          <div className="text-right">
            <span className="text-xs text-zinc-400 uppercase tracking-widest font-bold">Players</span>
            <p className="text-2xl font-bold text-emerald-300">{Object.keys(roomData.players || {}).length}</p>
          </div>
        </div>

        <div className="max-w-3xl w-full bg-zinc-900/50 border border-zinc-800/80 p-6 rounded-2xl mb-8">
          <h3 className="text-lg font-bold text-zinc-300 mb-4">Players in Lobby:</h3>
          <ul className="grid grid-cols-2 gap-3 mb-6">
            {Object.values(roomData.players || {}).map((p, idx) => (
              <li key={idx} className="bg-zinc-800/80 px-4 py-3 rounded-xl border border-zinc-700/50 flex items-center justify-between">
                <span className="font-semibold text-white">{p.name} {p.isHost && '(Host)'}</span>
                <span className="text-xs text-zinc-400">Score: {p.score || 0}</span>
              </li>
            ))}
          </ul>

          {isHost ? (
            <button 
              onClick={handleStartGame}
              className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold py-4 rounded-xl transition-colors text-lg shadow-lg shadow-emerald-900/40"
            >
              Start Game
            </button>
          ) : (
            <div className="text-center text-amber-300 font-bold bg-amber-950/40 border border-amber-800/60 p-4 rounded-xl">
              Waiting for the Room Creator (Host) to start the game...
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- WIN SCREEN ---
  if (roomData.status === 'game-over') {
    return (
      <div className="min-h-screen bg-zinc-950 text-white p-8 flex flex-col items-center justify-center text-center">
        <div className="bg-zinc-900 border-2 border-amber-500/60 p-10 rounded-3xl shadow-2xl max-w-xl w-full">
          <h1 className="text-5xl font-black text-amber-400 mb-4">🎉 WE HAVE A WINNER! 🎉</h1>
          <p className="text-3xl font-extrabold text-white mb-6">{roomData.winner} reached {WINNING_SCORE} points!</p>
          
          <div className="mb-8 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">Final Standings</h3>
            <div className="flex flex-col gap-2">
              {Object.values(roomData.players || {})
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center px-4 py-2 bg-zinc-900 rounded-lg">
                    <span className="font-bold">{p.name}</span>
                    <span className="text-emerald-400 font-black">{p.score || 0} pts</span>
                  </div>
                ))}
            </div>
          </div>

          <button 
            onClick={async () => {
              await update(ref(db, `rooms/${currentRoom}`), { status: 'lobby', winner: null, submissions: null });
              const resetPlayers = {};
              Object.entries(roomData.players || {}).forEach(([k, p]) => {
                resetPlayers[k] = { ...p, score: 0 };
              });
              await update(ref(db, `rooms/${currentRoom}/players`), resetPlayers);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 font-black px-8 py-4 rounded-xl text-lg shadow-lg w-full"
          >
            Play Again / Return to Lobby
          </button>
        </div>
      </div>
    );
  }

  const isCurrentJudge = roomData.judge && roomData.players[roomData.judge]?.name === playerName;
  const hasSubmitted = roomData.submissions && Object.keys(roomData.submissions).some(
    k => roomData.players[k]?.name === playerName
  );
  const requiredPick = roomData.currentGreen?.pick || 1;
  const totalPlayersCount = Object.keys(roomData.players || {}).length;
  const submissionsCount = Object.keys(roomData.submissions || {}).length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 flex flex-col items-center">
      {/* Header & Scoreboard */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-6 bg-zinc-900 px-6 py-4 rounded-xl border border-zinc-800">
        <span className="text-emerald-400 font-bold">Room: {currentRoom}</span>
        <div className="flex gap-3 items-center flex-wrap justify-center">
          {Object.values(roomData.players || {}).map((p, idx) => (
            <span key={idx} className={`text-xs px-3 py-1 rounded-full border ${roomData.judge && roomData.players[roomData.judge]?.name === p.name ? 'bg-purple-950 border-purple-500 text-purple-200' : 'bg-zinc-800 border-zinc-700 text-zinc-300'}`}>
              {p.name}: <strong className="text-emerald-400">{p.score || 0} pts</strong> {roomData.judge && roomData.players[roomData.judge]?.name === p.name && '👑'}
            </span>
          ))}
        </div>
        <span className="text-zinc-400 text-sm">Judge: <strong className="text-purple-400">{roomData.players[roomData.judge]?.name}</strong></span>
      </div>

      {/* Prompt Card */}
      <div className="mb-8">
        {roomData.currentGreen && (
          <GreenCard 
            text={roomData.currentGreen.text} 
          />
        )}
      </div>

      {/* JUDGING PHASE / SUBMISSIONS REVEAL */}
      {roomData.status === 'judging' ? (
        isCurrentJudge ? (
          <div className="w-full max-w-4xl flex flex-col items-center mb-8">
            <h3 className="text-xl font-bold text-purple-300 mb-2">Select the winning combo!</h3>
            <p className="text-zinc-400 text-sm mb-6">All submissions are in. Click your favorite combination below to award a point:</p>
            <div className="flex flex-wrap gap-8 justify-center">
              {Object.entries(roomData.submissions || {}).map(([playerKey, sub]) => (
                <div 
                  key={playerKey} 
                  onClick={() => handlePickWinner(playerKey)}
                  className="bg-zinc-900 border-2 border-zinc-700 hover:border-emerald-500 p-4 rounded-xl cursor-pointer transition-all flex flex-col gap-2 max-w-xs shadow-xl group hover:scale-105"
                >
                  <div className="flex flex-col gap-2">
                    {sub.cards?.map((cardObj, i) => (
                      <div key={i} className="relative">
                        {sub.cards.length > 1 && (
                          <span className="absolute -top-2 -left-2 bg-purple-600 text-white font-bold w-6 h-6 rounded-full flex items-center justify-center text-xs shadow z-10">
                            {i + 1}
                          </span>
                        )}
                        <PurpleCard text={cardObj.text} jp={cardObj.jp} selected={false} />
                      </div>
                    ))}
                  </div>
                  <span className="text-center text-xs font-bold text-emerald-400 mt-2 uppercase tracking-wider group-hover:underline">Pick This Winner 🏆</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center bg-purple-950/40 border border-purple-800 p-8 rounded-2xl max-w-md w-full mb-8 shadow-xl">
            <h3 className="text-2xl font-bold text-purple-300 mb-2">Judging in Progress!</h3>
            <p className="text-zinc-300 text-sm">All cards have been submitted anonymously. {roomData.players[roomData.judge]?.name} is reviewing them...</p>
          </div>
        )
      ) : isCurrentJudge ? (
        // --- JUDGE WAITING SCREEN WITH CARD BACKS ---
        <div className="w-full max-w-4xl flex flex-col items-center mb-8">
          <div className="text-center bg-purple-950/40 border border-purple-800 p-6 rounded-2xl max-w-md w-full mb-6">
            <h3 className="text-xl font-bold text-purple-300 mb-2">You are the Judge! 👑</h3>
            <p className="text-zinc-300 text-sm mb-3">Waiting for players to submit their cards...</p>
            <div className="text-sm font-black text-amber-400 bg-purple-900/60 px-4 py-1.5 rounded-full inline-block">
              Submissions: {submissionsCount} / {totalPlayersCount - 1}
            </div>
          </div>

          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Submitted Cards (Waiting to Reveal)</h4>
          <div className="flex flex-wrap justify-center gap-6">
            {Array.from({ length: submissionsCount }).map((_, idx) => (
              <CardBack key={idx} />
            ))}
            {submissionsCount === 0 && (
              <p className="text-zinc-500 italic text-sm">No submissions yet...</p>
            )}
          </div>
        </div>
      ) : hasSubmitted ? (
        // --- PLAYER WAITING SCREEN WITH CARD BACKS ---
        <div className="w-full max-w-4xl flex flex-col items-center mb-8">
          <div className="text-center bg-emerald-950/40 border border-emerald-800 p-6 rounded-2xl max-w-md w-full mb-6">
            <h3 className="text-xl font-bold text-emerald-300 mb-2">Combo Submitted! ✅</h3>
            <p className="text-zinc-300 text-sm">Waiting for other players and the judge...</p>
            <div className="text-xs text-emerald-400 font-bold mt-2">
              Submissions: {submissionsCount} / {totalPlayersCount - 1}
            </div>
          </div>

          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Table Status</h4>
          <div className="flex flex-wrap justify-center gap-6">
            {Array.from({ length: submissionsCount }).map((_, idx) => (
              <CardBack key={idx} />
            ))}
          </div>
        </div>
      ) : (
        // --- PLAYER SELECTION HAND SCREEN ---
        <div className="w-full max-w-4xl flex flex-col items-center mb-8">
          <h3 className="text-lg font-bold text-zinc-300 mb-4">
            Select {requiredPick} card{requiredPick > 1 ? 's' : ''} from your hand:
          </h3>
          <div className="flex flex-wrap gap-6 justify-center">
            {playerHand.map((card) => {
              const selectedIndex = selectedCards.findIndex(c => c.uniqueKey === card.uniqueKey);
              const isSelected = selectedIndex !== -1;
              return (
                <div key={card.uniqueKey} className="relative">
                  {isSelected && requiredPick > 1 && (
                    <span className="absolute -top-3 -left-3 z-10 bg-emerald-500 text-zinc-950 font-extrabold w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-xl border-2 border-zinc-950">
                      {selectedIndex + 1}
                    </span>
                  )}
                  <PurpleCard 
                    text={card.text} 
                    jp={card.jp}
                    pack={card.pack}
                    selected={isSelected}
                    onClick={() => handleCardClick(card)}
                  />
                </div>
              );
            })}
          </div>

          {selectedCards.length === requiredPick && (
            <div className="mt-8">
              <SubmitButton 
                onClick={handleSubmitCard} 
                label={requiredPick > 1 ? 'SUBMIT COMBINATION' : 'SUBMIT CARD'} 
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- COMIC-STYLED SUBMIT BUTTON COMPONENT ---
function SubmitButton({ onClick, disabled, label = "SUBMIT CARD" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-8 py-3 text-xl sm:text-2xl font-black rounded-2xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-150 select-none ${
        disabled
          ? 'bg-zinc-400 text-zinc-700 opacity-50 cursor-not-allowed shadow-none'
          : 'bg-emerald-400 hover:bg-emerald-300 active:translate-x-1 active:translate-y-1 active:shadow-none text-black cursor-pointer'
      }`}
      style={{
        fontFamily: "'Childos Arabic', system-ui, sans-serif",
        WebkitTextStroke: '1px #ffffff',
        paintOrder: 'stroke fill',
      }}
    >
      {label}
    </button>
  );
}