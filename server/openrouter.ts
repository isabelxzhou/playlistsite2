// Simple keyword-based recommendation system as fallback
function getLocalRecommendations(query: string, availablePlaylistsData: any[]) {
  const lowercaseQuery = query.toLowerCase();
  const keywords = lowercaseQuery.split(/\s+/);
  
  // Score playlists based on keyword matches
  const scoredPlaylists = availablePlaylistsData.map(playlist => {
    let score = 0;
    const searchText = `${playlist.name} ${playlist.description || ''} ${(playlist.tags || []).join(' ')}`.toLowerCase();
    
    // Check for keyword matches
    keywords.forEach(keyword => {
      if (searchText.includes(keyword)) {
        score += 1;
      }
    });
    
    // Boost score for exact name matches
    if (playlist.name.toLowerCase().includes(lowercaseQuery)) {
      score += 3;
    }
    
    // Boost score for tag matches
    (playlist.tags || []).forEach((tag: string) => {
      if (keywords.some(keyword => tag.toLowerCase().includes(keyword))) {
        score += 2;
      }
    });
    
    return { ...playlist, score };
  });
  
  // Get top 3 recommendations
  const recommendations = scoredPlaylists
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
    
  if (recommendations.length === 0) {
    // Return random playlists if no matches
    const shuffled = [...availablePlaylistsData].sort(() => 0.5 - Math.random());
    return {
      explanation: "I couldn't find exact matches for your request, so here are some popular playlists from your collection:",
      recommendations: shuffled.slice(0, 3)
    };
  }
  
  return {
    explanation: `Based on your request "${query}", here are some playlists that might interest you:`,
    recommendations
  };
}

// OpenRouter API integration for playlist recommendations
export async function getPlaylistRecommendations(query: string, availablePlaylistsData: any[]) {
  try {
    console.log("Making OpenRouter API request with key:", process.env.OPENROUTER_API_KEY ? "Key exists" : "No key found");
    
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "X-Title": "Playlist Recommendation System",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat",
        messages: [
          {
            role: "system",
            content: `You are a music recommendation AI. You have access to a collection of playlists with their names, descriptions, and tags. Based on the user's request, recommend 2-3 playlists from the available collection that best match their needs.

Available playlists:
${availablePlaylistsData.map(p => `- ID:${p.id} "${p.name}": ${p.description || 'No description'} [Tags: ${p.tags?.join(', ') || 'None'}]`).join('\n')}

Respond with a JSON object in this exact format:
{
  "explanation": "Brief explanation of why these playlists match the request",
  "recommendations": [
    {
      "id": playlist_id,
      "name": "playlist_name",
      "reason": "why this playlist fits the request"
    }
  ]
}`
          },
          {
            role: "user",
            content: query
          }
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenRouter API error: ${response.status} ${response.statusText}`, errorText);
      // Fall back to local recommendations if API fails
      console.log("Falling back to local recommendations");
      return getLocalRecommendations(query, availablePlaylistsData);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      console.log("No response from AI, falling back to local recommendations");
      return getLocalRecommendations(query, availablePlaylistsData);
    }

    try {
      // Parse the JSON response - remove code blocks if present
      let cleanContent = content;
      if (cleanContent.includes('```json')) {
        cleanContent = cleanContent.replace(/```json\s*/, '').replace(/```\s*$/, '');
      }
      const parsed = JSON.parse(cleanContent);
      
      // Add full playlist data to recommendations
      const fullRecommendations = parsed.recommendations.map((rec: any) => {
        const fullPlaylist = availablePlaylistsData.find(p => p.id === rec.id);
        return fullPlaylist ? { ...fullPlaylist, reason: rec.reason } : null;
      }).filter(Boolean);

      return {
        explanation: parsed.explanation,
        recommendations: fullRecommendations
      };
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.log("AI response was:", content);
      return getLocalRecommendations(query, availablePlaylistsData);
    }

  } catch (error) {
    console.error("OpenRouter API error:", error);
    // Fall back to local recommendations on any error
    return getLocalRecommendations(query, availablePlaylistsData);
  }
}