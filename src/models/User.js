const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    googleId: {
        type: String,
        sparse: true,  // Allows multiple null values, required only for Google auth
        unique: true
    },
    displayName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        // Required only for manual auth (not Google)
        required: function () {
            return this.authMethod === 'local';
        }
    },
    authMethod: {
        type: String,
        enum: ['google', 'local'],
        required: true,
        default: 'local'
    },
    profilePic: {
        type: String
    },
    domain: {
        type: String,
        required: true
    }
}, { timestamps: true });

// Hash password before saving (only for manual auth)
userSchema.pre('save', async function (next) {
    // Only hash password if it's been modified and authMethod is local
    if (this.authMethod === 'local' && this.isModified('password')) {
        try {
            const salt = await bcrypt.genSalt(10);
            this.password = await bcrypt.hash(this.password, salt);
        } catch (error) {
            return next(error);
        }
    }
    next();
});

// Method to compare password for login
userSchema.methods.comparePassword = async function (candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

module.exports = mongoose.model('User', userSchema);
