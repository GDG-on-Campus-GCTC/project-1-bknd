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
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true
    }
});

//for storing question and answers
let qaData = [];
const loadQAData = () => {
    //empty qaData array
    qaData = [];
    //check if questions.csv exists
    if (fs.existsSync(path.join(__dirname, 'questions.csv'))) {
        //csv can be very large so we use strams it breaks data into small pieces
        fs.createReadStream(path.join(__dirname, 'questions.csv'))
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
        const userQuestion = data.content.toLowerCase().trim();

        // Finding answer in CSV
        const match = qaData.find(item =>
            item.question.toLowerCase().trim() === userQuestion ||
            userQuestion.includes(item.question.toLowerCase().trim())
        );

        const response = match
            ? match.answer
            : "I'm sorry, I don't have an answer for that..";

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
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

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
