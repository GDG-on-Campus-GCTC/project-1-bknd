const fs = require('fs');

const testAuth = async () => {
    const baseUrl = 'http://localhost:3000';
    let output = '';

    const log = (message) => {
        console.log(message);
        output += message + '\n';
    };

    log('\n=== Test 1: Register with valid @gcet.edu.in email ===');
    try {
        const response = await fetch(`${baseUrl}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'testuser@gcet.edu.in',
                password: 'Test123!',
                displayName: 'Test User'
            })
        });
        const data = await response.json();
        log('Status: ' + response.status);
        log('Response: ' + JSON.stringify(data, null, 2));
    } catch (error) {
        log('Error: ' + error.message);
    }

    log('\n=== Test 2: Register with invalid domain (@gmail.com) ===');
    try {
        const response = await fetch(`${baseUrl}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'invalid@gmail.com',
                password: 'Test123!',
                displayName: 'Invalid User'
            })
        });
        const data = await response.json();
        log('Status: ' + response.status);
        log('Response: ' + JSON.stringify(data, null, 2));
    } catch (error) {
        log('Error: ' + error.message);
    }

    log('\n=== Test 3: Login with correct credentials ===');
    try {
        const response = await fetch(`${baseUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'testuser@gcet.edu.in',
                password: 'Test123!'
            })
        });
        const data = await response.json();
        log('Status: ' + response.status);
        log('Response: ' + JSON.stringify(data, null, 2));
    } catch (error) {
        log('Error: ' + error.message);
    }

    log('\n=== Test 4: Login with incorrect password ===');
    try {
        const response = await fetch(`${baseUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'testuser@gcet.edu.in',
                password: 'WrongPassword'
            })
        });
        const data = await response.json();
        log('Status: ' + response.status);
        log('Response: ' + JSON.stringify(data, null, 2));
    } catch (error) {
        log('Error: ' + error.message);
    }

    log('\n=== Test 5: Check auth status ===');
    try {
        const response = await fetch(`${baseUrl}/auth/status`, {
            method: 'GET'
        });
        const data = await response.json();
        log('Status: ' + response.status);
        log('Response: ' + JSON.stringify(data, null, 2));
    } catch (error) {
        log('Error: ' + error.message);
    }

    log('\n=== All Tests Complete ===');

    // Write output to file
    fs.writeFileSync('test-results.log', output);
    log('\nResults written to test-results.log');
};

testAuth();
