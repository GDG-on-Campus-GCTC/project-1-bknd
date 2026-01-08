const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');

// Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback",
    // This hints to Google to only show accounts from this domain
    hostedDomain: 'gcet.edu.in',
},
    async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails[0].value;
            const domain = email.split('@')[1];

            // Security check for domain restriction
            if (domain !== 'gcet.edu.in') {
                return done(null, false, { message: 'Access restricted to gcet.edu.in domain only.' });
            }

            // Check if user already exists in our DB
            let user = await User.findOne({ googleId: profile.id });

            if (user) {
                // User already exists
                return done(null, user);
            } else {
                // Create new user in DB
                user = await User.create({
                    googleId: profile.id,
                    displayName: profile.displayName,
                    email: email,
                    profilePic: profile.photos[0].value,
                    domain: domain,
                    authMethod: 'google'
                });
                return done(null, user);
            }
        } catch (err) {
            console.error(err);
            return done(err, null);
        }
    }
));

// Local Strategy (Email/Password)
passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
},
    async (email, password, done) => {
        try {
            // Find user by email
            const user = await User.findOne({ email });

            if (!user) {
                return done(null, false, { message: 'Invalid email or password' });
            }

            // Check if user registered with Google
            if (user.authMethod === 'google') {
                return done(null, false, { message: 'This account uses Google authentication' });
            }

            // Verify password
            const isMatch = await user.comparePassword(password);

            if (!isMatch) {
                return done(null, false, { message: 'Invalid email or password' });
            }

            // Verify domain
            const domain = email.split('@')[1];
            if (domain !== 'gcet.edu.in') {
                return done(null, false, { message: 'Access restricted to gcet.edu.in domain only' });
            }

            return done(null, user);
        } catch (err) {
            console.error('Local strategy error:', err);
            return done(err);
        }
    }
));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

module.exports = passport;
