const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

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
                    domain: domain
                });
                return done(null, user);
            }
        } catch (err) {
            console.error(err);
            return done(err, null);
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
