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
      <div className="min-h-screen comic-bg text-emerald-400 flex items-center justify-center text-2xl font-black tracking-widest">
        LOADING JUDGY...
      </div>
    );
  }

  // --- LOGIN SCREEN ---
  if (!currentRoom || !roomData) {
    return (
      <div className="min-h-screen comic-bg text-white flex items-center justify-center p-4">
        {/* Constrained width wrapper so form elements never stretch full screen */}
        <div className="w-full max-w-md flex flex-col items-center">
          <div className="comic-panel p-8 rounded-3xl w-full flex flex-col gap-6 comic-glow-emerald">
            <div className="text-center">
              <h1 className="text-6xl font-black tracking-tight text-emerald-400 mb-2 drop-shadow-[2px_2px_0px_#000]">JUDGY</h1>
              <p className="text-zinc-300 font-bold text-sm">The party game of questionable choices.</p>
            </div>

            <div className="flex flex-col gap-5 w-full">
              <div className="w-full">
                <label className="block text-xs font-black uppercase tracking-wider text-emerald-400 mb-1.5">Your Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Principal Smith" 
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full bg-zinc-950 border-4 border-black rounded-xl px-4 py-3.5 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 font-bold text-lg"
                />
              </div>

              <button 
                onClick={handleCreateRoom}
                className="w-full bg-emerald-400 hover:bg-emerald-300 text-black font-black py-4 px-6 rounded-2xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-xl transition-all active:translate-x-1 active:translate-y-1 active:shadow-none cursor-pointer"
              >
                CREATE NEW ROOM
              </button>

              <div className="relative flex py-1 items-center w-full">
                <div className="flex-grow border-t-4 border-zinc-800"></div>
                <span className="flex-shrink mx-4 text-zinc-400 text-xs uppercase font-black tracking-wider">Or Join</span>
                <div className="flex-grow border-t-4 border-zinc-800"></div>
              </div>

              <div className="flex gap-3 w-full">
                <input 
                  type="text" 
                  placeholder="CODE" 
                  maxLength={4}
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  className="w-1/3 bg-zinc-950 border-4 border-black rounded-xl px-4 py-3.5 text-white uppercase text-center tracking-widest font-black text-lg focus:outline-none focus:border-purple-400"
                />
                <button 
                  onClick={handleJoinRoom}
                  className="w-2/3 bg-purple-600 hover:bg-purple-500 text-white font-black py-3.5 px-6 rounded-2xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-xl transition-all active:translate-x-1 active:translate-y-1 active:shadow-none cursor-pointer"
                >
                  JOIN ROOM
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- LOBBY SCREEN ---
  if (roomData.status === 'lobby') {
    const myPlayerEntry = Object.entries(roomData.players || {}).find(([_, p]) => p.name === playerName);
    const isHost = myPlayerEntry ? myPlayerEntry[1].isHost : false;

    return (
      <div className="min-h-screen comic-bg text-white p-8 flex flex-col items-center justify-center">
        <div className="max-w-xl w-full comic-panel p-6 rounded-3xl mb-6 flex justify-between items-center comic-glow-emerald">
          <div>
            <span className="text-xs text-emerald-400 uppercase tracking-widest font-black">Room Code</span>
            <h2 className="text-5xl font-black tracking-widest text-white">{currentRoom}</h2>
          </div>
          <div className="text-right">
            <span className="text-xs text-zinc-400 uppercase tracking-widest font-black">Players Connected</span>
            <p className="text-3xl font-black text-emerald-300">{Object.keys(roomData.players || {}).length}</p>
          </div>
        </div>

        <div className="max-w-xl w-full comic-panel p-6 rounded-3xl mb-6">
          <h3 className="text-sm font-black text-zinc-300 uppercase tracking-wider mb-4">Players in Lobby:</h3>
          <ul className="flex flex-col gap-2.5 mb-6">
            {Object.values(roomData.players || {}).map((p, idx) => (
              <li key={idx} className="bg-zinc-900 px-4 py-3.5 rounded-2xl border-4 border-black flex items-center justify-between shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <span className="font-bold text-white text-base">{p.name} {p.isHost && '👑'}</span>
                <span className="text-xs font-black text-emerald-400">Score: {p.score || 0}</span>
              </li>
            ))}
          </ul>

          {isHost ? (
            <button 
              onClick={handleStartGame}
              className="w-full bg-emerald-400 hover:bg-emerald-300 text-black font-black py-5 px-8 rounded-2xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-2xl transition-all active:translate-x-1 active:translate-y-1 active:shadow-none cursor-pointer"
            >
              START GAME 🚀
            </button>
          ) : (
            <div className="text-center text-amber-300 font-bold bg-amber-950/80 border-4 border-amber-600 p-4 rounded-2xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              Waiting for the Host to start the game...
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- WIN SCREEN ---
  if (roomData.status === 'game-over') {
    return (
      <div className="min-h-screen comic-bg text-white p-8 flex flex-col items-center justify-center text-center">
        <div className="comic-panel p-10 rounded-3xl max-w-xl w-full comic-glow-gold">
          <h1 className="text-4xl sm:text-5xl font-black text-amber-400 mb-4 drop-shadow-[2px_2px_0px_#000]">🏆 WE HAVE A WINNER! 🏆</h1>
          <p className="text-2xl sm:text-3xl font-black text-white mb-6">{roomData.winner} reached {WINNING_SCORE} points!</p>
          
          <div className="mb-8 bg-zinc-950 p-4 rounded-2xl border-4 border-black">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-3">Final Standings</h3>
            <div className="flex flex-col gap-2">
              {Object.values(roomData.players || {})
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center px-4 py-2.5 bg-zinc-900 rounded-xl border-2 border-black">
                    <span className="font-bold text-white">{p.name}</span>
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
            className="bg-amber-400 hover:bg-amber-300 text-black font-black px-8 py-4 rounded-2xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-xl w-full transition-all active:translate-x-1 active:translate-y-1 active:shadow-none cursor-pointer"
          >
            PLAY AGAIN 🔄
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

  const phaseGlowClass = roomData.status === 'judging' ? 'comic-glow-purple' : 'comic-glow-emerald';

  return (
    <div className="min-h-screen comic-bg text-white p-6 flex flex-col items-center">
      {/* Header & Scoreboard */}
      <div className={`w-full max-w-4xl flex justify-between items-center mb-8 comic-panel px-6 py-4 rounded-2xl ${phaseGlowClass}`}>
        <span className="text-emerald-400 font-black text-sm tracking-wider">ROOM: {currentRoom}</span>
        <div className="flex gap-2 items-center flex-wrap justify-center">
          {Object.values(roomData.players || {}).map((p, idx) => (
            <span key={idx} className={`text-xs px-3 py-1 rounded-full border-2 border-black font-bold ${roomData.judge && roomData.players[roomData.judge]?.name === p.name ? 'bg-purple-900 text-purple-200' : 'bg-zinc-800 text-zinc-200'}`}>
              {p.name}: <strong className="text-emerald-400">{p.score || 0} pts</strong> {roomData.judge && roomData.players[roomData.judge]?.name === p.name && '👑'}
            </span>
          ))}
        </div>
        <span className="text-zinc-300 text-xs font-black tracking-wider">JUDGE: <strong className="text-purple-400">{roomData.players[roomData.judge]?.name}</strong></span>
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
            <h3 className="text-2xl font-black text-purple-300 mb-2 drop-shadow tracking-wide">SELECT THE WINNING COMBO!</h3>
            <p className="text-zinc-300 text-sm font-bold mb-6">All submissions are in. Click any card combination below to award the point:</p>
            <div className="flex flex-wrap gap-8 justify-center">
              {Object.entries(roomData.submissions || {}).map(([playerKey, sub]) => (
                <div 
                  key={playerKey} 
                  onClick={() => handlePickWinner(playerKey)}
                  className="comic-panel p-4 rounded-2xl cursor-pointer transition-all flex flex-col gap-2 max-w-xs hover:border-emerald-400 hover:scale-105 active:scale-95 group"
                >
                  <div className="flex flex-col gap-2">
                    {sub.cards?.map((cardObj, i) => (
                      <div key={i} className="relative">
                        {sub.cards.length > 1 && (
                          <span className="absolute -top-2 -left-2 bg-purple-600 text-white font-black w-6 h-6 rounded-full border-2 border-black flex items-center justify-center text-xs shadow z-10">
                            {i + 1}
                          </span>
                        )}
                        <PurpleCard text={cardObj.text} jp={cardObj.jp} selected={false} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center comic-panel p-8 rounded-3xl max-w-md w-full mb-8 comic-glow-purple">
            <h3 className="text-2xl font-black text-purple-300 mb-2">JUDGING IN PROGRESS!</h3>
            <p className="text-zinc-200 text-sm font-bold">All cards submitted anonymously. {roomData.players[roomData.judge]?.name} is reviewing them...</p>
          </div>
        )
      ) : isCurrentJudge ? (
        // --- JUDGE WAITING SCREEN ---
        <div className="w-full max-w-4xl flex flex-col items-center mb-8">
          <div className="text-center comic-panel p-6 rounded-3xl max-w-md w-full mb-6 comic-glow-purple">
            <h3 className="text-xl font-black text-purple-300 mb-2">YOU ARE THE JUDGE! 👑</h3>
            <p className="text-zinc-200 text-sm font-bold mb-3">Waiting for players to submit their cards...</p>
            <div className="text-sm font-black text-amber-400 bg-purple-900 border-2 border-black px-4 py-1.5 rounded-full inline-block">
              Submissions: {submissionsCount} / {totalPlayersCount - 1}
            </div>
          </div>

          <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4">SUBMITTED CARDS (WAITING TO REVEAL)</h4>
          <div className="flex flex-wrap justify-center gap-6">
            {Array.from({ length: submissionsCount }).map((_, idx) => (
              <CardBack key={idx} />
            ))}
            {submissionsCount === 0 && (
              <p className="text-zinc-400 italic text-sm font-semibold">No submissions yet...</p>
            )}
          </div>
        </div>
      ) : hasSubmitted ? (
        // --- PLAYER WAITING SCREEN ---
        <div className="w-full max-w-4xl flex flex-col items-center mb-8">
          <div className="text-center comic-panel p-6 rounded-3xl max-w-md w-full mb-6 comic-glow-emerald">
            <h3 className="text-xl font-black text-emerald-300 mb-2">COMBO SUBMITTED! ✅</h3>
            <p className="text-zinc-200 text-sm font-bold">Waiting for other players and the judge...</p>
            <div className="text-xs text-emerald-400 font-black mt-2">
              Submissions: {submissionsCount} / {totalPlayersCount - 1}
            </div>
          </div>

          <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4">TABLE STATUS</h4>
          <div className="flex flex-wrap justify-center gap-6">
            {Array.from({ length: submissionsCount }).map((_, idx) => (
              <CardBack key={idx} />
            ))}
          </div>
        </div>
      ) : (
        // --- PLAYER SELECTION HAND SCREEN ---
        <div className="w-full max-w-4xl flex flex-col items-center mb-8">
          <h3 className="text-lg font-black text-zinc-200 mb-4 tracking-wider uppercase drop-shadow">
            SELECT {requiredPick} CARD{requiredPick > 1 ? 'S' : ''} FROM YOUR HAND:
          </h3>
          <div className="flex flex-wrap gap-6 justify-center">
            {playerHand.map((card) => {
              const selectedIndex = selectedCards.findIndex(c => c.uniqueKey === card.uniqueKey);
              const isSelected = selectedIndex !== -1;
              return (
                <div key={card.uniqueKey} className="relative">
                  <PurpleCard 
                    text={card.text} 
                    jp={card.jp}
                    pack={card.pack}
                    selected={isSelected}
                    selectionIndex={selectedIndex}
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
                label={requiredPick > 1 ? 'SUBMIT COMBO!' : 'SUBMIT CARD!'} 
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- COMIC-STYLED SUBMIT BUTTON COMPONENT ---
function SubmitButton({ onClick, disabled, label = "SUBMIT CARD!" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-12 py-5 text-2xl sm:text-3xl font-black rounded-2xl border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all duration-150 select-none ${
        disabled
          ? 'bg-zinc-700 text-zinc-400 opacity-50 cursor-not-allowed shadow-none'
          : 'bg-emerald-400 hover:bg-emerald-300 active:translate-x-1.5 active:translate-y-1.5 active:shadow-none text-black cursor-pointer animate-pulse'
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