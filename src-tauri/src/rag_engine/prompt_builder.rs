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

/// Builds a single grounded prompt from exactly four inputs: the question,
/// the top retrieved chunk, the user's answer style, and the project's
/// meeting mode. Deliberately one template, no chains, no few-shot examples.
pub fn build_prompt(ctx: &PromptContext) -> String {
    format!(
        "You are CopilotMeet, a real-time assistant helping the user during a live meeting.\n\
        Answer ONLY using the supplied context below. If the answer is not contained in the context, say:\n\
        \"I couldn't find that information in the uploaded documents.\"\n\
        Do not invent information that isn't in the context.\n\n\
        {}\n{}\n\n\
        Context:\n{}\n\n\
        Question:\n{}",
        answer_style_instruction(&ctx.answer_style),
        meeting_mode_instruction(&ctx.meeting_mode),
        ctx.context,
        ctx.question,
    )
}