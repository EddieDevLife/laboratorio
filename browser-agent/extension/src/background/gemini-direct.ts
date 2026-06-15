/**
 * Direct Gemini API Integration
 * Calls Google Gemini API directly from the extension without backend server
 */

/// <reference types="chrome"/>

interface GeminiConfig {
  apiKey: string;
  model: string;
}

interface GeminiRequest {
  contents: Array<{
    parts: Array<{
      text?: string;
      inline_data?: {
        mime_type: string;
        data: string;
      };
    }>;
  }>;
  generationConfig?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
  };
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

export class GeminiDirectClient {
  private config: GeminiConfig;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor(apiKey: string, model: string = 'gemini-2.0-flash-exp') {
    this.config = {
      apiKey,
      model,
    };
  }

  /**
   * Analyze page and generate action plan
   */
  async analyzeAndPlan(
    command: string,
    pageContext: {
      url: string;
      title: string;
      elements: string;
    },
    screenshot?: string
  ): Promise<any> {
    const prompt = this.buildPrompt(command, pageContext);
    
    const parts: any[] = [{ text: prompt }];
    
    // Add screenshot if available
    if (screenshot) {
      // Remove data URL prefix if present
      const base64Data = screenshot.includes(',') 
        ? screenshot.split(',')[1] 
        : screenshot;
      
      parts.push({
        inline_data: {
          mime_type: 'image/png',
          data: base64Data,
        },
      });
    }

    const request: GeminiRequest = {
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 2048,
      },
    };

    try {
      const response = await this.callGemini(request);
      return this.parseResponse(response);
    } catch (error) {
      console.error('Gemini API error:', error);
      throw error;
    }
  }

  /**
   * Call Gemini API
   */
  private async callGemini(request: GeminiRequest): Promise<GeminiResponse> {
    const url = `${this.baseUrl}/${this.config.model}:generateContent?key=${this.config.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Build prompt for Gemini
   */
  private buildPrompt(
    command: string,
    pageContext: {
      url: string;
      title: string;
      elements: string;
    }
  ): string {
    return `You are a browser automation agent. Analyze the page and determine the SINGLE NEXT action to accomplish this task:

**User Command**: ${command}

**Current Page**:
- URL: ${pageContext.url}
- Title: ${pageContext.title}

**Available Interactive Elements**:
${pageContext.elements}

**Instructions**:
1. Analyze the screenshot (if provided) and available elements
2. Determine the SINGLE NEXT action needed
3. Return ONLY valid JSON in this EXACT format:

\`\`\`json
{
  "reasoning": "Brief explanation of why this action is needed",
  "action": {
    "type": "click|type|press_key|scroll|navigate|wait|done",
    "target": {
      "nodeId": "element_id",
      "name": "element_name",
      "x": 100,
      "y": 200
    },
    "params": {
      "text": "text to type (for type action)",
      "key": "Enter (for press_key action)",
      "url": "https://... (for navigate action)",
      "deltaY": 500
    },
    "confidence": 0.9
  }
}
\`\`\`

**Action Types**:
- **click**: Click on element (provide nodeId or x,y)
- **type**: Type text (provide nodeId and text)
- **press_key**: Press key (provide key name)
- **scroll**: Scroll page (provide deltaY)
- **navigate**: Go to URL (provide url)
- **wait**: Wait milliseconds (provide ms)
- **done**: Task complete

**Important**:
- Return ONLY ONE action (the immediate next step)
- Use nodeId from elements list when possible
- If task is complete, use "done" action
- Return ONLY valid JSON, no additional text

Provide the next action:`;
  }

  /**
   * Parse Gemini response and extract action
   */
  private parseResponse(response: GeminiResponse): any {
    try {
      const text = response.candidates[0]?.content?.parts[0]?.text;
      if (!text) {
        throw new Error('No response text from Gemini');
      }

      console.log('Gemini response:', text);

      // Extract JSON from response
      const jsonMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/) || 
                       text.match(/(\{[\s\S]*\})/);
      
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[1]);
      return parsed;
    } catch (error) {
      console.error('Error parsing Gemini response:', error);
      return {
        reasoning: 'Failed to parse AI response',
        action: {
          type: 'done',
          confidence: 0.5,
        },
      };
    }
  }
}

/**
 * Get API key from Chrome storage
 */
export async function getGeminiApiKey(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(['geminiApiKey'], (result) => {
      resolve(result.geminiApiKey || null);
    });
  });
}

/**
 * Save API key to Chrome storage
 */
export async function saveGeminiApiKey(apiKey: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
      resolve();
    });
  });
}

// Made with Bob
