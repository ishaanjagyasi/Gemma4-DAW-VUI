# Start Ollama, wait until it answers, load the model into memory, then run the app server.
ollama serve &
until ollama list > /dev/null 2>&1; do sleep 1; done
curl -s http://127.0.0.1:11434/api/generate -d '{"model": "gemma4-mixer", "keep_alive": -1}' > /dev/null &
exec node server.js
