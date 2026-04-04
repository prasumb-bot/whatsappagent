import OpenAI from "openai";
import { bookAppointment, checkSlot } from "@/lib/appointments";

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful AI assistant. Be concise and friendly.";

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "book_appointment",
      description:
        "Book an appointment for the patient. Use this when the patient wants to schedule a visit and has provided a date and time.",
      parameters: {
        type: "object",
        properties: {
          patient_name: {
            type: "string",
            description: "Patient's full name",
          },
          date: {
            type: "string",
            description: "Appointment date in YYYY-MM-DD format",
          },
          time: {
            type: "string",
            description: "Appointment time in HH:MM format (24h)",
          },
          reason: {
            type: "string",
            description: "Reason for visit",
          },
        },
        required: ["patient_name", "date", "time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_availability",
      description:
        "Check if a specific date/time slot is available. Use this before booking or when the patient asks about availability.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Date to check in YYYY-MM-DD format",
          },
          time: {
            type: "string",
            description: "Time to check in HH:MM format (24h). Optional — if not provided, returns all available slots for the day.",
          },
        },
        required: ["date"],
      },
    },
  },
];

export async function getAIResponse(
  messages: { role: "user" | "assistant"; content: string }[],
  systemPrompt?: string,
  context?: {
    businessId?: string;
    conversationId?: string;
    patientPhone?: string;
  }
): Promise<string> {
  const todayStr = new Date().toISOString().split("T")[0];

  const completion = await openai.chat.completions.create({
    model: process.env.AI_MODEL || "anthropic/claude-sonnet-4-20250514",
    messages: [
      {
        role: "system",
        content: `${systemPrompt || DEFAULT_SYSTEM_PROMPT}\n\nToday's date is ${todayStr}. When the patient mentions relative dates like "tomorrow" or "next Monday", convert them to YYYY-MM-DD format. When they say times like "3pm", convert to 24h format like "15:00".`,
      },
      ...messages,
    ],
    tools: context?.businessId ? TOOLS : undefined,
  });

  const choice = completion.choices[0];

  // If no tool call, return the text response
  if (!choice?.message?.tool_calls?.length) {
    return choice?.message?.content || "Sorry, I couldn't generate a response.";
  }

  // Handle tool calls
  const toolCall = choice.message.tool_calls[0];
  const args = JSON.parse(toolCall.function.arguments);
  let toolResult: string;

  if (toolCall.function.name === "book_appointment") {
    const result = await bookAppointment({
      businessId: context!.businessId!,
      conversationId: context!.conversationId!,
      patientName: args.patient_name,
      patientPhone: context!.patientPhone!,
      date: args.date,
      time: args.time + ":00",
      reason: args.reason,
    });
    toolResult = result.message;
  } else if (toolCall.function.name === "check_availability") {
    const slot = await checkSlot(
      context!.businessId!,
      args.date,
      args.time ? args.time + ":00" : "00:00"
    );
    if (args.time) {
      toolResult = slot.available
        ? `The slot on ${args.date} at ${args.time} is available.`
        : `That slot is taken. Available times: ${slot.alternativeSlots?.join(", ") || "none"}`;
    } else {
      toolResult = `Available slots on ${args.date}: ${slot.alternativeSlots?.join(", ") || "all slots open"}`;
    }
  } else {
    toolResult = "Unknown action.";
  }

  // Send tool result back to AI for a natural-language response
  const followUp = await openai.chat.completions.create({
    model: process.env.AI_MODEL || "anthropic/claude-sonnet-4-20250514",
    messages: [
      {
        role: "system",
        content: systemPrompt || DEFAULT_SYSTEM_PROMPT,
      },
      ...messages,
      choice.message as OpenAI.Chat.Completions.ChatCompletionMessageParam,
      {
        role: "tool",
        tool_call_id: toolCall.id,
        content: toolResult,
      },
    ],
  });

  return (
    followUp.choices[0]?.message?.content ||
    toolResult
  );
}
