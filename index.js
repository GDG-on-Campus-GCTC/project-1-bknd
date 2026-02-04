require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const morgan = require('morgan');
const cors = require('cors');
const passport = require('./src/config/passport');
const { Server } = require('socket.io');
const http = require('http');
const fs = require('fs');
const { parse } = require('csv-parse');
const path = require('path');
const Message = require('./src/models/Message');

const app = express();
const server = http.createServer(app);

// Session configuration
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
});

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(morgan('dev'));
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(express.json());
app.use(sessionMiddleware);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Socket.io setup
const io = new Server(server, {
    cors: {
        origin: process.env.SOCKET_IO_CORS_ORIGIN || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Socket.io authentication middleware
io.engine.use(sessionMiddleware);

io.use((socket, next) => {
    const req = socket.request;
    passport.initialize()(req, {}, () => {
        passport.session()(req, {}, () => {
            if (req.user) {
                next();
            } else {
                next();
            }
        });
    });
});

// For storing question and answers
let qaData = [];
const loadQAData = () => {
    qaData = [];
    if (fs.existsSync(path.join(__dirname, 'questions.csv'))) {
        fs.createReadStream(path.join(__dirname, 'questions.csv'))
            .on('error', (err) => {
                console.error('Error reading CSV file:', err);
            })
            .pipe(parse({ columns: true, trim: true }))
            .on('data', (row) => {
                qaData.push(row);
            })
            .on('end', () => {
                console.log('CSV data loaded successfully');
            })
            .on('error', (err) => {
                console.error('Error loading CSV:', err);
            });
    } else {
        console.warn('questions.csv not found');
    }
};
loadQAData();

// Socket.io connection logic
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);
    const user = socket.request.user;

    socket.on('send_message', async (data) => {
        console.log('Message received:', data);

        if (!data || typeof data.content !== 'string') {
            console.warn('Invalid message format received:', data);
            socket.emit('receive_message', {
                content: "Invalid message format.",
                role: 'assistant',
                time: new Date().toISOString()
            });
            return;
        }

        const userQuestion = data.content.toLowerCase().trim();

        // Finding answer in CSV
        let match = qaData.find(item => {
            const normalizedQuestion = (item.question || '').toLowerCase().trim();
            if (!normalizedQuestion) return false;
            return normalizedQuestion === userQuestion;
        });

        if (!match) {
            const candidates = qaData
                .map(item => {
                    const normalizedQuestion = (item.question || '').toLowerCase().trim();
                    return { item, normalizedQuestion };
                })
                .filter(entry =>
                    entry.normalizedQuestion &&
                    userQuestion.includes(entry.normalizedQuestion)
                )
                .sort((a, b) => b.normalizedQuestion.length - a.normalizedQuestion.length);

            if (candidates.length > 0) {
                match = candidates[0].item;
            }
        }

        const response = match
            ? match.answer
            : "I'm sorry, I don't have an answer for that.";

        let currentChatId = data.chatId;

        if (user && data.chatId) {
            try {
                const chat = await Message.findById(data.chatId);

                if (chat) {
                    const updateData = {
                        $push: { history: { question: data.content, answer: response } }
                    };

                    if (chat.history.length === 0) {
                        updateData.title = data.content.substring(0, 30);
                    }

                    await Message.findByIdAndUpdate(data.chatId, updateData);
                }
            } catch (err) {
                console.error('Error saving message:', err);
            }
        }

        socket.emit('receive_message', {
            content: response,
            role: 'assistant',
            chatId: currentChatId,
            time: new Date().toISOString()
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// --- Routes ---

// Manual Authentication Routes
const authRoutes = require('./src/routes/authRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
app.use('/auth', authRoutes);
app.use('/chat', chatRoutes);

// Google OAuth Routes
app.get('/auth/google',
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        prompt: 'select_account'
    })
);

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login-failure' }),
    (req, res) => {
        res.redirect('http://localhost:5173/home');
    }
);

app.get('/auth/status', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ authenticated: true, user: req.user });
    } else {
        res.json({ authenticated: false });
    }
});

app.post('/auth/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect('http://localhost:5173/');
    });
});

app.get('/login-failure', (req, res) => {
    res.status(401).json({ message: 'Authentication failed. Domain restricted?' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});