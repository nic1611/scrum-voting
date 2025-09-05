import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const allowed = (`${process.env.CORS_ORIGIN},http://localhost:3000`).split(',').filter(Boolean);
const io = new Server(httpServer, {
  cors: {
    origin: allowed.length ? allowed : true,
    methods: ["GET", "POST"],
    credentials: true,
  }
});


type Participant = {
  name: string;
  role: 'voter' | 'observer';
};

type RoomState = {
  participants: Record<string, Participant>;
  votes: Record<string, number | null>;
  showResults: boolean;
};

const rooms: Record<string, RoomState> = {};

io.on('connection', (socket) => {
  // Handler para mudança de papel
  socket.on('changeRole', (roomId: string, participantId: string, newRole: 'voter' | 'observer') => {
    if (rooms[roomId]?.participants[participantId]) {
      rooms[roomId].participants[participantId].role = newRole;
      
      // Atualiza status de votação
      const votingParticipants = Object.keys(rooms[roomId].participants)
        .filter(id => rooms[roomId].participants[id].role === 'voter');
      
      const allVoted = votingParticipants.length > 0 && 
                      votingParticipants.every(id => 
                        rooms[roomId].votes[id] !== null && 
                        rooms[roomId].votes[id] !== undefined
                      );
      
      rooms[roomId].showResults = allVoted;
      io.to(roomId).emit('roomUpdate', rooms[roomId]);
    }
  });

    socket.on('joinRoom', (roomId: string, nickname: string, role: 'voter' | 'observer') => {
      if (!rooms[roomId]) {
      rooms[roomId] = { participants: {}, votes: {}, showResults: false };
    }
    
    const participantId = Math.random().toString(36).substring(2, 8);
    rooms[roomId].participants[participantId] = { name: nickname, role };
    
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.participantId = participantId;
    socket.emit('participantId', participantId);
    io.to(roomId).emit('roomUpdate', rooms[roomId]);
  });

  socket.on('submitVote', (roomId: string, participantId: string, vote: number) => {
    if (rooms[roomId]) {
      rooms[roomId].votes[participantId] = vote;
      
      // Verifica se todos votaram (incluindo o voto atual)
      const votingParticipants = Object.keys(rooms[roomId].participants)
        .filter(id => rooms[roomId].participants[id].role === 'voter');
      
      const allVoted = votingParticipants.length > 0 && 
                      votingParticipants.every(id => 
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
    const { roomId, participantId } = socket.data;
    
    if (roomId && rooms[roomId] && participantId) {
      delete rooms[roomId].participants[participantId];
      delete rooms[roomId].votes[participantId];
      
      if (Object.keys(rooms[roomId].participants).length === 0) {
        delete rooms[roomId];
      } else {
        const remainingParticipants = Object.keys(rooms[roomId].participants);
        const allVoted = remainingParticipants.every(id => 
          rooms[roomId].votes[id] !== null
        );
        rooms[roomId].showResults = allVoted;
        io.to(roomId).emit('roomUpdate', rooms[roomId]);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
