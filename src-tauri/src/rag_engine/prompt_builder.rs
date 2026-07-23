pub struct PromptContext {
    pub question: String,
    pub context: String,
    pub answer_style: String,
    pub meeting_mode: String,
}

fn answer_style_instruction(style: &str) -> &'static str {
    match style {
        "Executive" => "Answer with a brief, high-level executive summary.",
        "Consultant" => "Answer like a consultant: structured, with clear recommendations.",
        "Friendly" => "Answer in a warm, conversational, approachable tone.",
        "Technical" => "Answer with precise technical detail and correct terminology.",
        "Concise" => "Answer in 2-4 sentences, no more.",
        _ => "Answer in a clear, professional tone.", // "Professional" and any unrecognized value
    }
}

fn meeting_mode_instruction(mode: &str) -> &'static str {
    match mode {
        "Sales" => "Frame the answer to support a sales conversation, emphasizing value.",
        "Procurement" => "Frame the answer around requirements, compliance, and comparison.",
        "Legal" => "Frame the answer carefully and precisely, as in a legal review context.",
        "Executive" => "Frame the answer for a senior stakeholder audience.",
        "Custom" => "Answer naturally based on the context provided.",
        _ => "Frame the answer as if responding confidently in a professional interview.", // "Interview" and default
    }
}

pub const NOT_FOUND_PHRASE: &str = "I couldn't find that information in the uploaded documents.";

/// Fallback prompt used when the grounded, document-only prompt found
/// nothing relevant. Allows general knowledge, but the caller is
/// responsible for clearly labeling this as general knowledge in the UI.
pub fn build_general_prompt(question: &str, answer_style: &str, meeting_mode: &str) -> String {
    format!(
        "You are CopilotMeet, a real-time assistant helping the user during a live meeting.\n\
        The user's uploaded documents did not contain relevant information for this question.\n\
        Answer using your general knowledge instead.\n\n\
        {}\n{}\n\n\
        Question:\n{}",
        answer_style_instruction(answer_style),
        meeting_mode_instruction(meeting_mode),
        question,
    )
}

/// Builds a single grounded prompt from exactly four inputs: the question,
/// the top retrieved chunk, the user's answer style, and the project's
/// meeting mode. Deliberately one template, no chains, no few-shot examples.
pub fn build_prompt(ctx: &PromptContext) -> String {
    format!(
        "You are CopilotMeet, a real-time assistant helping the user during a live meeting.\n\
        STRICT RULE: Only use facts explicitly stated in the context below. Do not use any outside knowledge, even if you know the answer.\n\
        If the context does not explicitly answer the question, you MUST respond with exactly this and nothing else:\n\
        \"{}\"\n\
        Do not add explanations, apologies, or partial answers. Do not invent information that isn't in the context.\n\n\
        {}\n{}\n\n\
        Context:\n{}\n\n\
        Question:\n{}",
        NOT_FOUND_PHRASE,
        answer_style_instruction(&ctx.answer_style),
        meeting_mode_instruction(&ctx.meeting_mode),
        ctx.context,
        ctx.question,
    )
}