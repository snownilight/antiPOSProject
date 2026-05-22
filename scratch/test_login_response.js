

async function test() {
  try {
    const response = await fetch('http://localhost:8081/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: 'waiter', password: 'waiter123' }),
    });

    console.log('HTTP status:', response.status);
    console.log('HTTP ok:', response.ok);
    
    const data = await response.json();
    console.log('Response body:', data);
    console.log('Type of data.code:', typeof data.code);
    console.log('Value of data.code:', data.code);
    console.log('Value of data.data:', data.data);
    console.log('Condition data.code === 200:', data.code === 200);
    console.log('Condition data.data:', !!data.data);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
