import { NextRequest, NextResponse } from "next/server"

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

const SYSTEM_PROMPT = `You are Powercast AI Assistant, a helpful expert in power generation forecasting and optimization. You help users understand:
- Power plant operations (solar, hydro, wind, nuclear, thermal)
- Forecast data interpretation
- Optimization recommendations
- Energy efficiency strategies

Keep responses concise and helpful. Use simple language. If asked about something unrelated to power/energy, politely redirect to your expertise area.`

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY

    // Check if API key is configured
    if (!apiKey) {
      return NextResponse.json(
        { 
          error: "API key not configured",
          message: "The Gemini API key is not set. Please configure GEMINI_API_KEY in your environment variables."
        },
        { status: 503 }
      )
    }

    const body = await request.json()
    const { message, history = [] } = body

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Invalid request", message: "Message is required" },
        { status: 400 }
      )
    }

    // Build conversation contents for Gemini
    const contents = [
      // System context as first user message
      {
        role: "user",
        parts: [{ text: SYSTEM_PROMPT }]
      },
      {
        role: "model", 
        parts: [{ text: "I understand. I'm Powercast AI Assistant, ready to help with power generation forecasting and optimization questions." }]
      },
      // Previous conversation history
      ...history.map((msg: { role: string; content: string }) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
      })),
      // Current user message
      {
        role: "user",
        parts: [{ text: message }]
      }
    ]

    // Call Gemini API
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        ],
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error("Gemini API error:", errorData)
      return NextResponse.json(
        { error: "API error", message: "Failed to get response from AI" },
        { status: 500 }
      )
    }

    const data = await response.json()
    
    // Extract the response text
    const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "I apologize, but I couldn't generate a response. Please try again."

    return NextResponse.json({
      success: true,
      response: aiResponse
    })

  } catch (error) {
    console.error("Chat API error:", error)
    return NextResponse.json(
      { error: "Server error", message: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY
  
  return NextResponse.json({
    status: "ok",
    apiConfigured: !!apiKey
  })
}
