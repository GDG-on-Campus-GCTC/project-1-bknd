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

const app = express();
const server = http.createServer(app);

// Session configuration (moved before Socket.io setup for reuse)
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
});

const io = new Server(server, {
    cors: {
        origin: process.env.SOCKET_IO_CORS_ORIGIN || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Socket.io authentication middleware
io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, () => {
        if (socket.request.session && socket.request.session.passport && socket.request.session.passport.user) {
            next();
        } else {
            next(new Error('Unauthorized: Please log in to use the chat.'));
        }
    });
});

//for storing question and answers
let qaData = [];
const loadQAData = () => {
    //empty qaData array
    qaData = [];
    //check if questions.csv exists
    if (fs.existsSync(path.join(__dirname, 'questions.csv'))) {
        //csv can be very large so we use streams; it breaks data into small pieces
        fs.createReadStream(path.join(__dirname, 'questions.csv'))
            .on('error', (err) => {
                console.error('Error reading CSV file:', err);
            })
            //pipe and parse means we are separating csv file by comma like hello?I am assistant
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
//csv loads when server starts
loadQAData();

// Socket.io connection logic
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('send_message', (data) => {
        console.log('Message received:', data);

        // Validate incoming data before accessing data.content
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
        // 1. Prefer exact match
        let match = qaData.find(item => {
            if (!item.question) return false;
            return item.question.toLowerCase().trim() === userQuestion;
        });

        // 2. If no exact match, fall back to the most specific partial match
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

        // Emit response back to the client
        socket.emit('receive_message', {
            content: response,
            role: 'assistant',
            time: new Date().toISOString()
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Database Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Middleware
app.use(morgan('dev'));
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(express.json());
app.use(sessionMiddleware);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// --- Routes ---

// Manual Authentication Routes (Email/Password)
const authRoutes = require('./src/routes/authRoutes');
app.use('/auth', authRoutes);

// Google OAuth Routes

app.get('/auth/google',
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        prompt: 'select_account'
    })
);

// 2. Google Callback Route
app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login-failure' }),
    (req, res) => {
        // Successful login, redirect to your FRONTEND URL
        res.redirect('http://localhost:5173/home');
    }
);

// 3. Status Check
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
