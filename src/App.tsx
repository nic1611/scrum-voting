import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// const socket: Socket = io('http://localhost:3001');
const socket: Socket = io(process.env.REACT_APP_SOCKET_URL as string, {
  transports: ['websocket'], // reduz problemas de sticky session
});

interface RoomState {
  participants: Record<string, string>;
  votes: Record<string, number | null>;
  showResults: boolean;
}

const FibonacciVoting = () => {
  const [roomId, setRoomId] = useState('');
  const [participants, setParticipants] = useState<Record<string, string>>({});
  const [votes, setVotes] = useState<Record<string, number | null>>({});
  const [tempNickname, setTempNickname] = useState('');
  const [nickname, setNickname] = useState(() => {
    const savedNick = localStorage.getItem('scrumVotingNickname');
    if (savedNick) setTempNickname(savedNick);
    return savedNick || '';
  });
  const [currentParticipantId, setCurrentParticipantId] = useState('');
  const [roomInput, setRoomInput] = useState('');

  const [roomState, setRoomState] = useState<RoomState | null>(null);

  useEffect(() => {
    socket.on('roomUpdate', (roomState: RoomState) => {
      setParticipants(roomState.participants);
      setVotes(roomState.votes);
      setRoomState(roomState);
    });

    socket.on('participantId', (id: string) => {
      setCurrentParticipantId(id);
    });

    return () => {
      socket.off('roomUpdate');
      socket.off('participantId');
    };
  }, []);

  const createRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(newRoomId);
    socket.emit('joinRoom', newRoomId, nickname);
  };

  const joinRoom = (roomId: string) => {
    setRoomId(roomId);
    socket.emit('joinRoom', roomId, nickname);
  };

  const submitVote = (vote: number) => {
    if (roomId && currentParticipantId) {
      socket.emit('submitVote', roomId, currentParticipantId, vote);
    }
  };

  const handleJoin = () => {
    socket.emit('joinRoom', roomId, nickname);
  };

  const fibonacciNumbers = [0, 1, 2, 3, 5, 8, 13, 21];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Fibonacci Voting</h1>
        
        {!nickname ? (
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-6">
            <div className="flex flex-col space-y-4">
              <div className="flex flex-col space-y-2">
                <label className="text-sm text-gray-400">Choose your nickname</label>
                <input
                  type="text"
                  value={tempNickname}
                  onChange={(e) => setTempNickname(e.target.value)}
                  placeholder="Enter your nickname"
                  className="bg-gray-700 text-white rounded-md p-2"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && tempNickname.trim()) {
                      localStorage.setItem('scrumVotingNickname', tempNickname.trim());
                      setNickname(tempNickname.trim());
                    }
                  }}
                />
              </div>
              <button 
                onClick={() => {
                  if (tempNickname.trim()) {
                    localStorage.setItem('scrumVotingNickname', tempNickname.trim());
                    setNickname(tempNickname.trim());
                  }
                }}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                disabled={!tempNickname.trim()}
              >
                Continue
              </button>
            </div>
          </div>
        ) : !roomId ? (
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-6 space-y-4">
            <div className="flex flex-col space-y-2">
              <input
                type="text"
                placeholder="Enter Room ID"
                className="bg-gray-700 text-white rounded-md p-2"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
              />
              <button 
                onClick={() => joinRoom(roomInput)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
                disabled={!roomInput.trim()}
              >
                Join Existing Room
              </button>
            </div>
            <div className="text-center text-gray-400">or</div>
            <button 
              onClick={createRoom}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full"
            >
              Create New Room
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
              <h2 className="text-xl font-semibold mb-4">Room: {roomId}</h2>
              
              {!currentParticipantId ? (
                <div className="space-y-4">
                  <div className="flex flex-col space-y-2">
                    <label className="text-sm text-gray-400">Your Nickname</label>
                    <input
                      type="text"
                      value={nickname}
                      onChange={(e) => {
                    if (e.target.value.length <= 20) {
                      setNickname(e.target.value);
                    }
                  }}
                      placeholder="Enter your nickname"
                      className="bg-gray-700 text-white rounded-md p-2"
                    />
                  </div>
                  <button 
                    onClick={handleJoin}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded w-full"
                  >
                    Join Room
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-4 mt-4">
                  {fibonacciNumbers.map((num) => (
                    <button
                      key={num}
                      onClick={() => submitVote(num)}
                      className={`bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition-all ${
                        votes[currentParticipantId] === num ? 'ring-2 ring-green-500 scale-105' : ''
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
              <h2 className="text-xl font-semibold mb-4">Participants</h2>
              <ul className="divide-y divide-gray-700">
                {Object.entries(participants).map(([id, name]) => (
                  <li key={id} className="py-2 flex justify-between items-center">
                    <span>{name}</span>
                    <span className="font-mono">
                      {roomState?.showResults ? 
                        (votes[id] !== undefined ? votes[id] : '...') : 
                        (id === currentParticipantId ? votes[id] : '?')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {currentParticipantId && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    console.log('ssss');
                    socket.emit('resetVotes', roomId);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                >
                  Reset
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FibonacciVoting;
