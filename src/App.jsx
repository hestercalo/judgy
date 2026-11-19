import React, { useState, useEffect } from 'react';
import { GreenCard, PurpleCard, CardBack } from './components/Cards';
import { db } from './firebase';
import { ref, set, get, child, update, onValue, runTransaction } from 'firebase/database';

const SHEET_ID = '1ZMeRbwlUTBUHxoF1arWMCwHg-GfAB7jmJOh5mJlJnyA';
const HAND_SIZE = 9;

export default function App() {
  const [greenCards, setGreenCards] = useState([]);
  const [purpleCards, setPurpleCards] = useState([]);
  const [loading, setLoading] = useState(true);

  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [targetScore, setTargetScore] = useState(7);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomData, setRoomData] = useState(null);
  const [joiningRoom, setJoiningRoom] = useState(false);

  const [playerHand, setPlayerHand] = useState([]);
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
          .map((row, idx) => ({
            id: row.id || `p_${idx}`,
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
    return arr.map((card, index) => ({
      ...card,
      uniqueKey: `${card.id || 'card'}_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`
    }));
  };

  // Draws `count` cards safely from the shared deck, reshuffling discardPile if needed
  const drawFromSharedDeck = async (code, count) => {
    const deckRef = ref(db, `rooms/${code}/deck`);
    const discardRef = ref(db, `rooms/${code}/discardPile`);

    const discardSnap = await get(discardRef);
    let currentDiscard = discardSnap.exists() ? discardSnap.val() || [] : [];

    let drawnCards = [];
    let didReshuffleDiscard = false;

    await runTransaction(deckRef, (currentDeck) => {
      let pool = Array.isArray(currentDeck) ? [...currentDeck] : [];

      if (pool.length < count && currentDiscard.length > 0) {
        pool = [...pool, ...shuffleArray(currentDiscard)];
        didReshuffleDiscard = true;
      }

      drawnCards = pool.slice(0, count);
      return pool.slice(count);
    });

    if (didReshuffleDiscard) {
      await set(discardRef, []);
    }

    return drawnCards;
  };

  const handleCreateRoom = async () => {
    const cleanName = playerName.trim().slice(0, 12);
    if (!cleanName) {
      alert("Please enter your name first!");
      return;
    }

    const clampedScore = Math.max(1, Math.min(15, Number(targetScore) || 7));
    const newCode = generateRoomCode();
    const playerKey = `p_${Date.now()}`;

    const shuffledDeck = shuffleArray(purpleCards);
    const initialHand = shuffledDeck.slice(0, HAND_SIZE);
    const remainingDeck = shuffledDeck.slice(HAND_SIZE);

    try {
      await set(ref(db, `rooms/${newCode}`), {
        host: playerKey,
        status: 'lobby',
        winningScore: clampedScore,
        deck: remainingDeck,
        discardPile: [],
        players: {
          [playerKey]: { name: cleanName, score: 0, isHost: true }
        }
      });
      setPlayerName(cleanName);
      setTargetScore(clampedScore);
      setCurrentRoom(newCode);
      setPlayerHand(initialHand);
    } catch (err) {
      console.error("Error creating room:", err);
    }
  };

  const handleJoinRoom = async () => {
    if (joiningRoom) return;

    const cleanName = playerName.trim().slice(0, 12);
    if (!cleanName || !roomCode.trim()) {
      alert("Please enter your name and a room code!");
      return;
    }

    const formattedCode = roomCode.toUpperCase().trim();
    const dbRef = ref(db);
    setJoiningRoom(true);

    try {
      const snapshot = await get(child(dbRef, `rooms/${formattedCode}`));
      if (snapshot.exists()) {
        const dealtHand = await drawFromSharedDeck(formattedCode, HAND_SIZE);
        const playerKey = `p_${Date.now()}`;

        await set(ref(db, `rooms/${formattedCode}/players/${playerKey}`), {
          name: cleanName,
          score: 0,
          isHost: false
        });
        setPlayerName(cleanName);
        setCurrentRoom(formattedCode);
        setPlayerHand(dealtHand);
      } else {
        alert("Room not found! Check your code.");
        setJoiningRoom(false);
      }
    } catch (err) {
      console.error("Error joining room:", err);
      setJoiningRoom(false);
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

  const handleUpdateWinningScore = async (newScore) => {
    const scoreNum = Math.max(1, Math.min(15, Number(newScore) || 7));
    setTargetScore(scoreNum);
    if (currentRoom) {
      await update(ref(db, `rooms/${currentRoom}`), {
        winningScore: scoreNum
      });
    }
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

    // Move submitted cards into the room's shared discard pile
    const discardRef = ref(db, `rooms/${currentRoom}/discardPile`);
    await runTransaction(discardRef, (currentDiscard) => {
      const existing = Array.isArray(currentDiscard) ? currentDiscard : [];
      return [...existing, ...selectedCards];
    });

    // Remove submitted cards from player's hand and draw replacements from shared deck
    const submittedKeys = selectedCards.map(c => c.uniqueKey);
    const remainingHand = playerHand.filter(c => !submittedKeys.includes(c.uniqueKey));
    const replacementCards = await drawFromSharedDeck(currentRoom, selectedCards.length);

    setPlayerHand([...remainingHand, ...replacementCards]);
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
    const gameGoal = roomData.winningScore || 7;

    await update(ref(db, `rooms/${currentRoom}/players/${winnerKey}`), {
      score: newScore
    });

    if (newScore >= gameGoal) {
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
      <div className="min-h-screen comic-bg flex items-center justify-center p-6">
        <div
          className="comic-panel p-6 rounded-3xl flex flex-col items-center comic-glow-emerald shadow-2xl box-border gap-6 bg-[#18181f]"
          style={{ width: '480px', maxWidth: '100%' }}
        >
          {/* Header Title */}
          <div className="text-center w-full">
            <h2 className="text-2xl font-black tracking-widest text-emerald-400 drop-shadow-[2px_2px_0px_#000]">LOADING GAME</h2>
          </div>

          {/* GIF Frame */}
          <div className="w-full rounded-2xl border-4 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-[#18181f]">
            <img
              src={`${import.meta.env.BASE_URL}loading-screen.gif`}
              alt="Loading Judgy..."
              className="w-full h-auto block m-0 object-cover"
            />
          </div>

          {/* Loading Status Box */}
          <div className="text-center text-emerald-300 font-bold bg-zinc-900 border-4 border-black p-3.5 rounded-2xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] w-full box-border text-sm animate-pulse">
            Getting things ready...
          </div>
        </div>
      </div>
    );
  }

  // --- START / LOGIN SCREEN ---
  if (!currentRoom || !roomData) {
    return (
      <div className="min-h-screen w-full comic-bg text-white flex items-center justify-center p-4">
        <div
          className="comic-panel p-8 sm:p-10 rounded-3xl flex flex-col gap-5 comic-glow-emerald shadow-2xl box-border overflow-hidden"
          style={{ width: '480px', maxWidth: '100%' }}
        >
          <div className="text-center">
            <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-emerald-400 mb-1 drop-shadow-[2px_2px_0px_#000]">JUDGY</h1>
            <p className="text-zinc-300 font-bold text-xs sm:text-sm">The game where only you can be the judge! Designed to be used for educational purposes only.</p>
          </div>

          <div className="flex flex-col items-center gap-4 w-full min-w-0">
            {/* Centered Name Input */}
            <div className="w-2/3 min-w-[240px] flex flex-col items-center">
              <label className="block text-xs font-black uppercase tracking-wider text-emerald-400 mb-1 w-full text-left">Your Name</label>
              <input
                type="text"
                placeholder="例：Steven J. Kuiya, Roxy Music, Jason Jones, etc"
                maxLength={12}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full max-w-full box-border bg-zinc-900 border-4 border-black rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30 font-bold text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
              />
            </div>

            {/* Target Score Selector */}
            <div className="w-2/3 min-w-[240px] flex flex-col items-center">
              <label className="block text-xs font-black uppercase tracking-wider text-amber-400 mb-1 w-full text-left">Target Score to Win</label>
              <input
                type="number"
                min={1}
                max={15}
                value={targetScore}
                onChange={(e) => setTargetScore(e.target.value)}
                className="w-full box-border bg-zinc-900 border-4 border-black rounded-xl px-3.5 py-2.5 text-white font-black text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] focus:outline-none focus:border-amber-400 text-center"
              />
            </div>

            {/* Host Lobby Button */}
            <div className="flex justify-center w-full pt-1">
              <HostLobbyButton onClick={handleCreateRoom} />
            </div>

            <div className="relative flex py-1 items-center w-full">
              <div className="flex-grow border-t-4 border-zinc-800"></div>
              <span className="flex-shrink mx-3 text-zinc-400 text-xs uppercase font-black tracking-wider">Or Join</span>
              <div className="flex-grow border-t-4 border-zinc-800"></div>
            </div>

            {/* Room Code & Join Button */}
            <div className="flex items-end w-full min-w-0">
              <div className="flex flex-col w-36 sm:w-40 shrink-0">
                <label className="block text-xs font-black uppercase tracking-wider text-purple-400 mb-1 w-full text-left">Room Code</label>
                <input
                  type="text"
                  placeholder="CODE"
                  maxLength={4}
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  className="w-full box-border bg-zinc-900 border-4 border-black rounded-xl px-3 py-2.5 text-white uppercase text-center tracking-widest font-black text-sm focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all"
                />
              </div>
              <div className="flex shrink-0" style={{ marginLeft: '-60px' }}>
                <JoinRoomButton onClick={handleJoinRoom} disabled={joiningRoom} />
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
      <div className="min-h-screen comic-bg text-white p-6 flex flex-col items-center justify-center">
        <div
          className="comic-panel p-6 rounded-3xl flex flex-col box-border mx-auto comic-glow-emerald gap-6"
          style={{ width: '480px', maxWidth: '100%' }}
        >
          {/* Top Section: Room Code & Winning Score */}
          <div className="flex justify-between items-center w-full">
            <div>
              <span className="text-xs text-emerald-400 uppercase tracking-widest font-black">Room Code</span>
              <h2 className="text-4xl font-black tracking-widest text-white">{currentRoom}</h2>
            </div>
            <div className="text-right">
              <span className="text-xs text-amber-400 uppercase tracking-widest font-black">Winning Score</span>
              {isHost ? (
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={roomData.winningScore || 7}
                  onChange={(e) => handleUpdateWinningScore(e.target.value)}
                  className="w-20 bg-zinc-900 border-2 border-black rounded-lg text-amber-400 font-black text-lg text-center px-2 py-0.5 mt-1 focus:outline-none focus:border-amber-400"
                />
              ) : (
                <p className="text-2xl font-black text-amber-300">{roomData.winningScore || 7} pts</p>
              )}
            </div>
          </div>

          {/* Divider Line */}
          <div className="border-t-4 border-zinc-800 w-full"></div>

          {/* Bottom Section: Players List & Start Button */}
          <div className="flex flex-col items-center w-full">
            <h3 className="text-xs font-black text-zinc-300 uppercase tracking-wider mb-3 w-full text-left">Players in Lobby:</h3>
            <ul className="flex flex-col gap-2.5 mb-5 w-full items-center box-border">
              {Object.values(roomData.players || {}).map((p, idx) => (
                <li key={idx} className="bg-zinc-900 px-4 py-3 rounded-2xl border-4 border-black flex items-center justify-between shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] w-full max-w-4/5  mx-auto box-border">
                  <span className="font-bold text-white text-sm truncate pr-2">{p.name} {p.isHost && '👑'}</span>
                </li>
              ))}
            </ul>

            {isHost ? (
              <div className="flex justify-center w-full pt-2">
                <StartGameButton onClick={handleStartGame} />
              </div>
            ) : (
              <div className="text-center text-amber-300 font-bold bg-amber-950/80 border-4 border-amber-600 p-3.5 rounded-2xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] w-full box-border text-sm">
                Waiting for the Host to start the game...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- WIN SCREEN ---
  if (roomData.status === 'game-over') {
    const goalScore = roomData.winningScore || 7;
    return (
      <div className="min-h-screen comic-bg text-white p-6 flex flex-col items-center justify-center text-center">
        <div
          className="comic-panel p-8 rounded-3xl flex flex-col items-center box-border mx-auto comic-glow-gold"
          style={{ width: '480px', maxWidth: '100%' }}
        >
          <h1 className="text-3xl sm:text-4xl font-black text-amber-400 mb-3 drop-shadow-[2px_2px_0px_#000]">🏆 WE HAVE A WINNER! 🏆</h1>
          <p className="text-xl sm:text-2xl font-black text-white mb-5">{roomData.winner} reached the target of {goalScore} points!</p>

          <div className="mb-6 bg-zinc-950 p-4 rounded-2xl border-4 border-black w-full">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 mb-2.5 text-left">Final Standings</h3>
            <div className="flex flex-col gap-2">
              {Object.values(roomData.players || {})
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center px-3.5 py-2 bg-zinc-900 rounded-xl border-2 border-black">
                    <span className="font-bold text-white text-sm">{p.name}</span>
                    <span className="text-emerald-400 font-black text-sm">{p.score || 0} pts</span>
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
            className="bg-amber-400 hover:bg-amber-300 text-black font-black py-2.5 px-6 rounded-2xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-base transition-all active:translate-x-1 active:translate-y-1 active:shadow-none cursor-pointer"
          >
            PLAY AGAIN
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
      <div className={`w-full max-w-4xl flex justify-between items-center mb-6 comic-panel px-5 py-3.5 rounded-2xl ${phaseGlowClass}`}>
        <span className="text-emerald-400 font-black text-xs tracking-wider">ROOM: {currentRoom} (Goal: {roomData.winningScore || 7})</span>
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
      <div className="mb-6">
        {roomData.currentGreen && (
          <GreenCard
            text={roomData.currentGreen.text}
          />
        )}
      </div>

      {/* JUDGING PHASE / SUBMISSIONS REVEAL */}
      {roomData.status === 'judging' ? (
        isCurrentJudge ? (
          <div className="w-full max-w-4xl flex flex-col items-center mb-6">
            <h3 className="text-xl font-black text-purple-300 mb-2 drop-shadow tracking-wide">SELECT THE WINNER!</h3>
            <p className="text-zinc-300 text-xs font-bold mb-5">All submissions are in. Click any card below to award the point:</p>
            <div className="flex flex-wrap gap-6 justify-center">
              {Object.entries(roomData.submissions || {}).map(([playerKey, sub]) => (
                <div
                  key={playerKey}
                  onClick={() => handlePickWinner(playerKey)}
                  className="cursor-pointer flex flex-col gap-2 max-w-xs group"
                >
                  <div className="flex flex-col gap-2">
                    {sub.cards?.map((cardObj, i) => (
                      <div key={i} className="transition-transform duration-200 hover:filter hover:drop-shadow-[0_0_22px_rgba(255,255,255,0.9)] hover:drop-shadow-[0_0_8px_rgba(255,255,255,1)]">
                        <PurpleCard text={cardObj.text} jp={cardObj.jp} selected={false} noHover={true} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div
            className="comic-panel text-center p-6 rounded-3xl mb-6 comic-glow-purple box-border mx-auto"
            style={{ width: '480px', maxWidth: '100%' }}
          >
            <h3 className="text-xl font-black text-purple-300 mb-2">JUDGING IN PROGRESS!</h3>
            <p className="text-zinc-200 text-xs font-bold">All cards submitted anonymously. {roomData.players[roomData.judge]?.name} is reviewing them...</p>
          </div>
        )
      ) : isCurrentJudge ? (
        // --- JUDGE WAITING SCREEN ---
        <div className="w-full max-w-4xl flex flex-col items-center mb-6">
          <div
            className="comic-panel text-center p-5 rounded-3xl mb-5 comic-glow-purple box-border mx-auto"
            style={{ width: '480px', maxWidth: '100%' }}
          >
            <h3 className="text-lg font-black text-purple-300 mb-1.5">YOU ARE THE JUDGE! 👑</h3>
            <p className="text-zinc-200 text-xs font-bold mb-2.5">Waiting for players to submit their cards...</p>
            <div className="text-xs font-black text-amber-400 bg-purple-900 border-2 border-black px-3.5 py-1 rounded-full inline-block">
              Submissions: {submissionsCount} / {totalPlayersCount - 1}
            </div>
          </div>

          <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-3">SUBMITTED CARDS (WAITING TO REVEAL)</h4>
          <div className="flex flex-wrap justify-center gap-5">
            {Array.from({ length: submissionsCount }).map((_, idx) => (
              <CardBack key={idx} />
            ))}
            {submissionsCount === 0 && (
              <p className="text-zinc-400 italic text-xs font-semibold">No submissions yet...</p>
            )}
          </div>
        </div>
      ) : hasSubmitted ? (
        // --- PLAYER WAITING SCREEN ---
        <div className="w-full max-w-4xl flex flex-col items-center mb-6">
          <div
            className="comic-panel text-center p-5 rounded-3xl mb-5 comic-glow-emerald box-border mx-auto"
            style={{ width: '480px', maxWidth: '100%' }}
          >
            <h3 className="text-lg font-black text-emerald-300 mb-1.5">COMBO SUBMITTED! ✅</h3>
            <p className="text-zinc-200 text-xs font-bold">Waiting for other players and the judge...</p>
            <div className="text-xs text-emerald-400 font-black mt-1.5">
              Submissions: {submissionsCount} / {totalPlayersCount - 1}
            </div>
          </div>

          <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-3">TABLE STATUS</h4>
          <div className="flex flex-wrap justify-center gap-5">
            {Array.from({ length: submissionsCount }).map((_, idx) => (
              <CardBack key={idx} />
            ))}
          </div>
        </div>
      ) : (
        // --- PLAYER SELECTION HAND SCREEN ---
        <div className="w-full max-w-4xl flex flex-col items-center mb-6">
          <h3 className="text-base font-black text-zinc-200 mb-3 tracking-wider uppercase drop-shadow">
            SELECT {requiredPick} CARD{requiredPick > 1 ? 'S' : ''} FROM YOUR HAND:
          </h3>
          <div className="flex flex-wrap gap-5 justify-center">
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
            <div className="mt-6">
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

// --- CUSTOM IMAGE BUTTON COMPONENTS ---
function HostLobbyButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative border-none bg-transparent p-0 transition-transform duration-150 select-none hover:scale-105 active:scale-95 cursor-pointer inline-flex items-center justify-center"
    >
      <img
        src={`${import.meta.env.BASE_URL}host-lobby-button.png`}
        alt="Host Lobby"
        className="w-40 sm:w-48 h-auto drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all"
      />
    </button>
  );
}

function JoinRoomButton({ onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group relative border-none bg-transparent p-0 transition-transform duration-150 select-none inline-flex items-center justify-center ${
        disabled
          ? 'opacity-50 cursor-not-allowed grayscale'
          : 'hover:scale-105 active:scale-95 cursor-pointer'
      }`}
    >
      <img
        src={`${import.meta.env.BASE_URL}join-room-button.png`}
        alt="Join Room"
        className="w-32 sm:w-38 h-auto drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all"
      />
    </button>
  );
}

// --- CUSTOM START GAME BUTTON COMPONENT ---
function StartGameButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative border-none bg-transparent p-0 transition-transform duration-150 select-none hover:scale-105 active:scale-95 cursor-pointer inline-flex items-center justify-center"
    >
      <img
        src={`${import.meta.env.BASE_URL}start-game-button.png`}
        alt="Start Game"
        className="w-44 sm:w-52 h-auto drop-shadow-[5px_5px_0px_rgba(0,0,0,1)] transition-all"
      />
    </button>
  );
}

// --- COMIC-STYLED IMAGE SUBMIT BUTTON COMPONENT ---
function SubmitButton({ onClick, disabled, label = "SUBMIT CARD!" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group relative border-none bg-transparent p-0 transition-transform duration-150 select-none inline-flex items-center justify-center ${
        disabled
          ? 'opacity-50 cursor-not-allowed grayscale'
          : 'hover:scale-105 active:scale-95 cursor-pointer animate-bounce'
      }`}
    >
      <img
        src={`${import.meta.env.BASE_URL}submit-card-button.png`}
        alt={label}
        className="w-44 sm:w-52 h-auto drop-shadow-[5px_5px_0px_rgba(0,0,0,1)] transition-all"
      />
    </button>
  );
}