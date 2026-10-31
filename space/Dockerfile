# Hugging Face Space: Ollama serving the fine-tuned model, plus the Node server for the app (port 7860).
FROM ollama/ollama:0.40.4

COPY --from=node:22-bookworm-slim /usr/local/bin/node /usr/local/bin/node
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates git && rm -rf /var/lib/apt/lists/*

# The Space runs the container as user 1000, so the model store and HOME must be writable by anyone.
ENV OLLAMA_MODELS=/models HOME=/tmp OLLAMA_NUM_PARALLEL=4 \
    PORT=7860 HOST=0.0.0.0 RESULTS_REPO=ishaanjagyasi/mixer-study-results

# The model is built into the image, so a restart doesn't download it again.
WORKDIR /build
COPY Modelfile .
RUN curl -fsSL -o gemma4-mixer-Q4_K_M.gguf \
      https://huggingface.co/ishaanjagyasi/gemma4-e4b-mixer-assistant/resolve/main/gemma4-mixer-Q4_K_M.gguf \
 && (ollama serve & pid=$!; sleep 5; ollama create gemma4-mixer -f Modelfile; status=$?; kill $pid; exit $status) \
 && rm -rf /build/gemma4-mixer-Q4_K_M.gguf && chmod -R a+rwX /models

WORKDIR /app
COPY . .
EXPOSE 7860
ENTRYPOINT []
CMD ["sh", "start.sh"]
