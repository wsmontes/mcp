const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Proxy endpoint for Anthropic API (handle both GET and POST)
app.use('/api/anthropic/*', async (req, res) => {
    try {
        const anthropicPath = req.params[0];
        // Fix: Remove the v1 prefix if it's already in the path to avoid double v1
        const cleanPath = anthropicPath.startsWith('v1/') ? anthropicPath.substring(3) : anthropicPath;
        const anthropicUrl = `https://api.anthropic.com/v1/${cleanPath}`;
        
        // Get API key from request headers
        const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
        
        if (!apiKey) {
            console.error('No API key provided in request headers');
            return res.status(401).json({ 
                error: 'Authentication required',
                message: 'No API key provided. Please include x-api-key header.'
            });
        }
        
        // Forward headers for Anthropic API
        const headers = {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': req.headers['anthropic-version'] || '2023-06-01'
        };
        
        console.log(`Proxying Anthropic request to: ${anthropicUrl}`);
        console.log('Headers:', Object.keys(headers));
        
        // Handle streaming vs non-streaming requests
        if (req.body && req.body.stream) {
            // Streaming request
            const response = await fetch(anthropicUrl, {
                method: req.method,
                headers,
                body: JSON.stringify(req.body)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Anthropic API error:', response.status, errorText);
                
                // Pass through the actual error from Anthropic API
                return res.status(response.status).json(JSON.parse(errorText));
            }
            
            // Set headers for SSE streaming
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*'
            });
            
            // Pipe the streaming response
            response.body.on('data', (chunk) => {
                res.write(chunk);
            });
            
            response.body.on('end', () => {
                res.end();
            });
            
            response.body.on('error', (error) => {
                console.error('Streaming error:', error);
                res.end();
            });
            
        } else {
            // Non-streaming request
            const requestOptions = {
                method: req.method,
                headers
            };
            
            // Only add body for non-GET requests
            if (req.method !== 'GET' && req.body) {
                requestOptions.body = JSON.stringify(req.body);
            }
            
            const response = await fetch(anthropicUrl, requestOptions);
            
            const data = await response.text();
            
            if (!response.ok) {
                console.error('Anthropic API error:', response.status, data);
                
                // Pass through the actual error from Anthropic API
                try {
                    const errorData = JSON.parse(data);
                    return res.status(response.status).json(errorData);
                } catch (parseError) {
                    // If we can't parse the error as JSON, return it as text
                    return res.status(response.status).json({ 
                        error: `Anthropic API error: ${response.status}`,
                        message: data
                    });
                }
            }
            
            res.status(response.status).json(JSON.parse(data));
        }
        
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ 
            error: 'Proxy server error', 
            details: error.message 
        });
    }
});

// Proxy endpoint for Google Gemini API (handle both GET and POST)
app.use('/api/gemini/*', async (req, res) => {
    try {
        const geminiPath = req.params[0];
        const geminiUrl = `https://generativelanguage.googleapis.com/v1/${geminiPath}`;
        
        // Get API key from request headers
        const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
        
        if (!apiKey) {
            console.error('No API key provided in request headers');
            return res.status(401).json({ 
                error: 'Authentication required',
                message: 'No API key provided. Please include x-api-key header.'
            });
        }
        
        // Forward headers for Gemini API
        const headers = {
            'Content-Type': 'application/json'
        };
        
        console.log(`Proxying Gemini request to: ${geminiUrl}`);
        console.log('Headers:', Object.keys(headers));
        
        // Handle streaming vs non-streaming requests
        if (req.body && (req.body.stream || geminiPath.includes(':streamGenerateContent'))) {
            // Streaming request
            const response = await fetch(`${geminiUrl}?key=${apiKey}`, {
                method: req.method,
                headers,
                body: JSON.stringify(req.body)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Gemini API error:', response.status, errorText);
                
                // Pass through the actual error from Gemini API
                try {
                    const errorData = JSON.parse(errorText);
                    return res.status(response.status).json(errorData);
                } catch (parseError) {
                    // If we can't parse the error as JSON, return it as text
                    return res.status(response.status).json({ 
                        error: `Gemini API error: ${response.status}`,
                        message: errorText
                    });
                }
            }
            
            // Set headers for SSE streaming
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': '*'
            });
            
            console.log('🔄 Starting Gemini streaming response...');
            
            // Pipe the streaming response
            response.body.on('data', (chunk) => {
                console.log('📦 Gemini streaming chunk:', chunk.toString().substring(0, 100) + '...');
                res.write(chunk);
            });
            
            response.body.on('end', () => {
                console.log('✅ Gemini streaming response ended');
                res.end();
            });
            
            response.body.on('error', (error) => {
                console.error('Streaming error:', error);
                res.end();
            });
            
        } else {
            // Non-streaming request
            const requestOptions = {
                method: req.method,
                headers
            };
            
            // Only add body for non-GET requests
            if (req.method !== 'GET' && req.body) {
                requestOptions.body = JSON.stringify(req.body);
            }
            
            const response = await fetch(`${geminiUrl}?key=${apiKey}`, requestOptions);
            
            const data = await response.text();
            
            if (!response.ok) {
                console.error('Gemini API error:', response.status, data);
                
                // Pass through the actual error from Gemini API
                try {
                    const errorData = JSON.parse(data);
                    return res.status(response.status).json(errorData);
                } catch (parseError) {
                    // If we can't parse the error as JSON, return it as text
                    return res.status(response.status).json({ 
                        error: `Gemini API error: ${response.status}`,
                        message: data
                    });
                }
            }
            
            res.status(response.status).json(JSON.parse(data));
        }
        
    } catch (error) {
        console.error('Gemini proxy error:', error);
        res.status(500).json({ 
            error: 'Proxy server error', 
            details: error.message 
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Anthropic & Gemini Proxy Server running on http://localhost:${PORT}`);
    console.log(`📡 Proxying requests to Anthropic API: /api/anthropic/*`);
    console.log(`📡 Proxying requests to Gemini API: /api/gemini/*`);
    console.log(`🔍 Health check: http://localhost:${PORT}/health`);
});