import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const allowed = (process.env.CORS_ORIGIN || '').split(',').filter(Boolean);
const io = new Server(httpServer, {
  cors: {
    origin: allowed.length ? allowed : true,
    methods: ["GET", "POST"],
    credentials: true,
  }
});

type RoomState = {
  participants: Record<string, string>;
  votes: Record<string, number | null>;
  showResults: boolean;
};

const rooms: Record<string, RoomState> = {};

io.on('connection', (socket) => {
  socket.on('joinRoom', (roomId: string, nickname: string) => {
    if (!rooms[roomId]) {
      rooms[roomId] = { participants: {}, votes: {}, showResults: false };
    }
    
    const participantId = Math.random().toString(36).substring(2, 8);
    rooms[roomId].participants[participantId] = nickname;
    
    socket.join(roomId);
    socket.emit('participantId', participantId);
    io.to(roomId).emit('roomUpdate', rooms[roomId]);
  });

  socket.on('submitVote', (roomId: string, participantId: string, vote: number) => {
    if (rooms[roomId]) {
      rooms[roomId].votes[participantId] = vote;
      
      // Verifica se todos votaram (incluindo o voto atual)
      const participantIds = Object.keys(rooms[roomId].participants);
      const allVoted = participantIds.length > 0 && 
                      participantIds.every(id => 
                        rooms[roomId].votes[id] !== null && 
                        rooms[roomId].votes[id] !== undefined
                      );
      
      // Só mostra resultados se todos tiverem votado
      rooms[roomId].showResults = allVoted;
      
      io.to(roomId).emit('roomUpdate', rooms[roomId]);
    }
  });

  socket.on('resetVotes', (roomId: string) => {
    if (rooms[roomId]) {
      const participantIds = Object.keys(rooms[roomId].participants);
      participantIds.map(id => rooms[roomId].votes[id] = null);
      io.to(roomId).emit('roomUpdate', rooms[roomId]);
    }  

  });

  socket.on('disconnect', () => {
    // Cleanup logic can be added here
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
