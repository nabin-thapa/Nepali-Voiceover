const test = async () => {
  const resp = await fetch('http://localhost:3000/api/tts/generate-script', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: 'A test script' })
  });
  const data = await resp.text();
  console.log('Status:', resp.status);
  console.log('Data:', data);
};
test();
