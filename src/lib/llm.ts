import OpenAI from "openai";
import { getModel } from "./aiConfig";

export interface Feedback {
  lineComments: Record<number, string>;
  overallComments: string[];
  staticAnalysisOutput: string;
  feedbackResponses?: Record<number, 'yes' | 'no' | 'unsure'>;
  reasoning?: string;
  suggestions?: { comment: string; grade: number }[];
}

interface LLMResponse {
  line_comments: Record<string, string>;
  overall_comments: string[];
  feedback_responses?: Record<string, 'yes' | 'no' | 'unsure'>;
  reasoning?: string;
  suggestions?: { comment: string; grade: number }[];
}

// ── Exercise-based evaluation ─────────────────────────────────────────────────

export interface RequirementVerdict {
  requirement: string;        // AI-extracted requirement from the exercise description
  verdict: 'met' | 'not-met' | 'partial' | 'unsure';
  comment: string;            // Specific observation about this requirement in the code
  suggestedDeduction: number; // Suggested point deduction if not fully met
}

export interface ExerciseEvaluation {
  requirements: RequirementVerdict[];
  overallComments: string[];
  reasoning: string;
}

/**
 * Evaluate student code against a pasted exercise description.
 * AI extracts the requirements from the description and returns a per-requirement verdict.
 */
export async function evaluateAgainstExercise(
  code: string,
  exerciseDescription: string,
  assignmentContext: string,
  apiKey: string,
): Promise<ExerciseEvaluation> {
  if (!apiKey) throw new Error("OpenAI API key not configured.");

  const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  const prompt = `You are a computer science grading assistant.

Below is the exercise description the student was asked to implement, followed by their Python code submission.

Your job:
1. Extract every distinct requirement from the exercise description (e.g. "print X", "use a loop", "handle edge case Y").
2. For each requirement, evaluate whether the student's code satisfies it.
3. Return a JSON response with per-requirement verdicts.

Verdict meanings:
- "met"      — requirement is clearly and correctly implemented
- "not-met"  — requirement is clearly missing or wrong
- "partial"  — requirement is attempted but incomplete or has issues
- "unsure"   — cannot determine without running the code

Exercise Description:
"""
${exerciseDescription}
"""

Student Code:
\`\`\`python
${code}
\`\`\`

Assignment context: ${assignmentContext}

Respond ONLY with valid JSON:
{
  "requirements": [
    {
      "requirement": "Brief description of the requirement",
      "verdict": "met" | "not-met" | "partial" | "unsure",
      "comment": "Specific observation about how the code handles this requirement",
      "suggested_deduction": 0
    }
  ],
  "overall_comments": ["Brief overall assessment sentence"],
  "reasoning": "One paragraph summary of the submission quality"
}

Rules:
- Extract 3–8 concrete, checkable requirements from the description. Do not be vague.
- suggested_deduction should be 0 for "met", and a reasonable integer (1–10) for "not-met"/"partial"/"unsure" based on importance.
- Keep comments concise and actionable (1 sentence each).`;

  const response = await openai.chat.completions.create({
    model: getModel(),
    messages: [{ role: "user", content: prompt }],
    max_completion_tokens: 16000,
  });

  const content = response.choices[0]?.message?.content ?? "";
  let parsed: {
    requirements: { requirement: string; verdict: string; comment: string; suggested_deduction: number }[];
    overall_comments: string[];
    reasoning: string;
  };

  try {
    const match = content.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match ? match[0] : content);
  } catch {
    throw new Error("AI returned an invalid JSON response. Please try again.");
  }

  const verdictSet = new Set(['met', 'not-met', 'partial', 'unsure']);
  return {
    requirements: (parsed.requirements ?? []).map(r => ({
      requirement: r.requirement ?? "",
      verdict: verdictSet.has(r.verdict) ? r.verdict as RequirementVerdict['verdict'] : 'unsure',
      comment: r.comment ?? "",
      suggestedDeduction: typeof r.suggested_deduction === 'number' ? r.suggested_deduction : 0,
    })),
    overallComments: Array.isArray(parsed.overall_comments) ? parsed.overall_comments : [],
    reasoning: parsed.reasoning ?? "",
  };
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
      model: getModel(),
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      max_completion_tokens: 16000,
    });

    const choice = response.choices[0];
    const content = choice?.message?.content;
    if (!content) {
      throw new Error(
        `No response content from LLM (finish_reason: ${choice?.finish_reason ?? "none"}, refusal: ${choice?.message?.refusal ?? "none"})`,
      );
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
      suggestions: Array.isArray(parsedResponse.suggestions) ? parsedResponse.suggestions : undefined,
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

/**
 * Analyze turtle visual output + source code with the configured (vision-capable) model.
 * imageBase64 should be a plain base64-encoded PNG (no data URI prefix needed here;
 * we'll add the prefix internally).
 */
export async function analyzeTurtleOutput(
  code: string,
  imageBase64: string,
  assignmentContext: string,
  apiKey: string,
): Promise<{ comments: string[]; reasoning: string }> {
  if (!apiKey) {
    throw new Error("OpenAI API key not configured.");
  }

  const openai = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const prompt = `You are a computer science grading assistant evaluating a Python turtle graphics submission.

Assignment: ${assignmentContext}

The image shows the turtle graphics output produced by the student's code.
The source code is also provided below.

Evaluate:
1. Does the visual output match what the code is supposed to draw?
2. Are there any visible errors, missing elements, or incorrect shapes/colors?
3. Is the code well-structured for producing this kind of drawing?

Code:
\`\`\`python
${code}
\`\`\`

Respond ONLY with valid JSON:
{
  "comments": ["specific observation 1", "specific observation 2"],
  "reasoning": "overall assessment of the turtle output quality"
}`;

  const response = await openai.chat.completions.create({
    model: getModel(),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${imageBase64}`,
              detail: "high",
            },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
    max_completion_tokens: 8000,
  });

  const content = response.choices[0]?.message?.content ?? "";
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    return {
      comments: Array.isArray(parsed.comments) ? parsed.comments : [],
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
    };
  } catch {
    return { comments: [content], reasoning: "" };
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
