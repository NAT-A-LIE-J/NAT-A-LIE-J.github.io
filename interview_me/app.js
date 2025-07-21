// Vector similarity function
function cosineSimilarity(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Database operations
async function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('InterviewBotDB', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

async function searchSimilarChunks(queryEmbedding, topK = 5) {
    const db = await openDB();
    const transaction = db.transaction(['embeddings'], 'readonly');
    const store = transaction.objectStore('embeddings');
    
    const allChunks = [];
    const request = store.openCursor();
    
    return new Promise((resolve) => {
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                allChunks.push(cursor.value);
                cursor.continue();
            } else {
                // Calculate similarities
                const similarities = allChunks.map(chunk => ({
                    ...chunk,
                    similarity: cosineSimilarity(queryEmbedding, chunk.embedding)
                }));
                
                // Sort and return top K
                similarities.sort((a, b) => b.similarity - a.similarity);
                resolve(similarities.slice(0, topK));
            }
        };
    });
}

// Chat functionality
async function sendMessage() {
    const input = document.getElementById('chatInput');
    const question = input.value.trim();
    
    if (!question) return;
    
    // Display user message
    displayMessage(question, 'user');
    input.value = '';
    
    // Show typing indicator
    document.getElementById('typingIndicator').style.display = 'flex';
    
    try {
        // Get embedding for the question
        const embedResponse = await fetch('https://interview-dh6kw2zz1-natalie-lam-johnsons-projects.vercel.app/api/embed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: question })
        });
        
        const { embedding } = await embedResponse.json();
        
        // Find relevant chunks
        const relevantChunks = await searchSimilarChunks(embedding);
        const context = relevantChunks
            .map(chunk => chunk.text)
            .join('\n\n');
        
        // Stream response from API
        const response = await fetch('https://interview-dh6kw2zz1-natalie-lam-johnsons-projects.vercel.app/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question, context })
        });
        
        // Hide typing indicator
        document.getElementById('typingIndicator').style.display = 'none';
        
        // Create message element for streaming
        const messageElement = document.createElement('div');
        messageElement.className = 'message bot-message';
        const textElement = document.createElement('p');
        messageElement.appendChild(textElement);
        document.getElementById('chatMessages').appendChild(messageElement);
        
        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = '';
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
                            accumulatedText += parsed.candidates[0].content.parts[0].text;
                            textElement.textContent = accumulatedText;
                            scrollToBottom();
                        }
                    } catch (e) {
                        // Handle non-JSON data
                    }
                }
            }
        }
        
    } catch (error) {
        document.getElementById('typingIndicator').style.display = 'none';
        displayMessage('Sorry, I encountered an error. Please try again.', 'bot');
    }
}

function displayMessage(text, sender) {
    const messagesContainer = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const textP = document.createElement('p');
    textP.textContent = text;
    messageDiv.appendChild(textP);
    
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}