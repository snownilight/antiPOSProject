const fs = require('fs');
const https = require('https');

// Read .jira-config
const configContent = fs.readFileSync('.jira-config', 'utf8');
const config = {};
configContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    config[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const email = config['JIRA_EMAIL'];
const token = config['JIRA_API_TOKEN'];
const domain = config['JIRA_DOMAIN'];

if (!email || !token || !domain) {
  console.error('Missing configuration in .jira-config');
  process.exit(1);
}

const auth = Buffer.from(`${email}:${token}`).toString('base64');

const options = {
  hostname: domain,
  path: '/rest/api/3/issue/POS-55',
  method: 'GET',
  headers: {
    'Authorization': `Basic ${auth}`,
    'Accept': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      fs.writeFileSync('scratch/POS-55.json', data);
      console.log('Successfully fetched Jira ticket POS-55 and saved to scratch/POS-55.json');
      
      const ticket = JSON.parse(data);
      console.log('--- Ticket Summary ---');
      console.log('Key:', ticket.key);
      console.log('Summary:', ticket.fields.summary);
      console.log('Description:', JSON.stringify(ticket.fields.description, null, 2));
    } else {
      console.error(`Status Code: ${res.statusCode}`);
      console.error('Response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.end();
