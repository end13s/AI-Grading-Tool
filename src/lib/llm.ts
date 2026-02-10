import OpenAI from "openai";

export interface Feedback {
  lineComments: Record<number, string>;
  overallComments: string[];
  staticAnalysisOutput: string;
  feedbackResponses?: Record<number, 'yes' | 'no' | 'unsure'>;
  reasoning?: string;
}

interface LLMResponse {
  line_comments: Record<string, string>;
  overall_comments: string[];
  feedback_responses?: Record<string, 'yes' | 'no' | 'unsure'>;
  reasoning?: string;
}

export async function generateFeedback(
  code: string,
  linterOutput: string,
  promptTemplate: string,
  assignmentContext: string = "",
  apiKey: string,
  baseURL?: string
): Promise<Feedback> {
  if (!apiKey) {
    throw new Error(
      "OpenAI API key not configured. Please provide an API key.",
    );
  }

  const openai = new OpenAI({
    apiKey,
    baseURL,
    dangerouslyAllowBrowser: true, // Allow browser usage since this is a web app
  });

  try {
    // Substitute variables in the prompt template
    const prompt = promptTemplate
      .replace(/\{\{code\}\}/g, code)
      .replace(/\{\{linter_output\}\}/g, linterOutput)
      .replace(/\{\{assignment_context\}\}/g, assignmentContext);

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response content from LLM");
    }

    // Parse JSON response
    let parsedResponse: LLMResponse;
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : content;
      parsedResponse = JSON.parse(jsonString);
    } catch (_parseError) {
      console.error("Failed to parse LLM response as JSON:", content);
      throw new Error("LLM response is not valid JSON format");
    }

    // Validate and convert response format
    const lineComments: Record<number, string> = {};

    if (parsedResponse.line_comments) {
      for (const [lineStr, comment] of Object.entries(
        parsedResponse.line_comments,
      )) {
        const lineNumber = parseInt(lineStr, 10);
        if (!Number.isNaN(lineNumber) && typeof comment === "string") {
          lineComments[lineNumber] = comment;
        }
      }
    }

    const overallComments = Array.isArray(parsedResponse.overall_comments)
      ? parsedResponse.overall_comments.filter(
          (comment) => typeof comment === "string",
        )
      : [];

    // Parse feedback responses (Yes/No/Unsure)
    const feedbackResponses: Record<number, 'yes' | 'no' | 'unsure'> = {};
    if (parsedResponse.feedback_responses) {
      for (const [idStr, response] of Object.entries(parsedResponse.feedback_responses)) {
        const id = parseInt(idStr, 10);
        if (!Number.isNaN(id) && (response === 'yes' || response === 'no' || response === 'unsure')) {
          feedbackResponses[id] = response;
        }
      }
    }

    return {
      lineComments,
      overallComments,
      staticAnalysisOutput: linterOutput,
      feedbackResponses,
      reasoning: parsedResponse.reasoning,
    };
  } catch (error: unknown) {
    console.error("LLM API Error:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));

    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 401
    ) {
      throw new Error(
        "Invalid OpenAI API key. Please check your configuration.",
      );
    } else if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 429
    ) {
      throw new Error(
        "OpenAI API rate limit exceeded. Please try again later.",
      );
    } else if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 500
    ) {
      throw new Error("OpenAI API server error. Please try again later.");
    } else if (error instanceof Error && error.message.includes("JSON")) {
      throw new Error(
        "LLM returned invalid response format. Please try again.",
      );
    } else {
      throw new Error(
        `LLM integration failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

export function validateAPIKey(apiKey: string): { valid: boolean; error?: string } {
  if (!apiKey) {
    return {
      valid: false,
      error: "API key is not set",
    };
  }

  if (!apiKey.startsWith("sk-")) {
    return {
      valid: false,
      error: 'API key appears to be invalid (should start with "sk-")',
    };
  }

  return { valid: true };
}

export async function testLLMConnection(apiKey: string, baseURL?: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const testFeedback = await generateFeedback(
      'print("Hello, World!")',
      "No issues found.",
      'Analyze this code and respond with JSON: {"line_comments": {}, "overall_comments": ["Test successful"]}',
      "",
      apiKey,
      baseURL
    );

    if (testFeedback.overallComments.includes("Test successful")) {
      return { success: true };
    } else {
      return { success: false, error: "Unexpected response from LLM" };
    }
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
