const User = require('../models/User');

/**
 * Register a new user with email and password
 * Enforces @gcet.edu.in domain validation
 */
exports.register = async (req, res) => {
    try {
        const { email, password, displayName } = req.body;

        // Validate required fields
        if (!email || !password || !displayName) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email, password, and displayName'
            });
        }

        // Extract and validate domain
        const domain = email.split('@')[1];
        if (domain !== 'gcet.edu.in') {
            return res.status(403).json({
                success: false,
                message: 'Access restricted to @gcet.edu.in domain only'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Validate password strength
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Create new user
        const newUser = await User.create({
            email,
            password,
            displayName,
            domain,
            authMethod: 'local'
        });

        // Remove password from response
        const userResponse = {
            id: newUser._id,
            email: newUser.email,
            displayName: newUser.displayName,
            domain: newUser.domain,
            authMethod: newUser.authMethod
        };

        // Log the user in by creating a session
        req.login(newUser, (err) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: 'Registration successful but login failed'
                });
            }

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                user: userResponse
            });
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration',
            error: error.message
        });
    }
};

/**
 * Login user with email and password
 * Enforces @gcet.edu.in domain validation
 */
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide both email and password'
            });
        }

        // Extract and validate domain
        const domain = email.split('@')[1];
        if (domain !== 'gcet.edu.in') {
            return res.status(403).json({
                success: false,
                message: 'Access restricted to @gcet.edu.in domain only'
            });
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if user registered with Google
        if (user.authMethod === 'google') {
            return res.status(400).json({
                success: false,
                message: 'This account uses Google authentication. Please login with Google.'
            });
        }

        // Verify password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Create session
        req.login(user, (err) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: 'Login failed'
                });
            }

            // Remove password from response
            const userResponse = {
                id: user._id,
                email: user.email,
                displayName: user.displayName,
                domain: user.domain,
                authMethod: user.authMethod,
                profilePic: user.profilePic
            };

            res.status(200).json({
                success: true,
                message: 'Login successful',
                user: userResponse
            });
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login',
            error: error.message
        });
    }
};
